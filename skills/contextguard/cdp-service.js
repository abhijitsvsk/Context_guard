const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const engine = require('./engine.js');
const handoff = require('./handoff.js');

const LOG_FILE = path.join(__dirname, 'data', 'cdp_service.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    const dataDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) {}
  console.log(msg);
}

process.on('uncaughtException', (err) => {
  log(`[CDP Service] UNCAUGHT EXCEPTION: ${err.stack || err}`);
});

process.on('unhandledRejection', (reason) => {
  log(`[CDP Service] UNHANDLED REJECTION: ${reason.stack || reason}`);
});

class ContextGuardCDPService {
  constructor() {
    this.mode = 'DISCOVERING'; // DISCOVERING, CDP_ACTIVE
    this.currentChatId = null;
    this.ws = null;
    this.cdpPort = null;
    this.wsUrl = null;
    this.reconnectTimer = null;
    this.keepAliveInterval = null;
    this.pendingRetryTimers = [];
  }

  async discoverCDPPort() {
    const priorityPorts = [this.cdpPort, 50270, 61009, 9222, 9229].filter(Boolean);
    for (const port of priorityPorts) {
      const target = await this.checkPortForAntigravity(port);
      if (target) return target;
    }

    try {
      const listeningPorts = await this.getListeningPorts();
      for (const port of listeningPorts) {
        if (!priorityPorts.includes(port)) {
          const target = await this.checkPortForAntigravity(port);
          if (target) return target;
        }
      }
    } catch (e) {}

    return null;
  }

  async checkPortForAntigravity(port) {
    try {
      const data = await this.httpGet(`http://127.0.0.1:${port}/json/list`, 800);
      const targets = JSON.parse(data);
      const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl && (t.url.includes('/c/') || (t.title && (t.title.includes('Antigravity') || t.title.includes('ContextGuard')))));
      if (pageTarget) {
        this.cdpPort = port;
        return { port, wsUrl: pageTarget.webSocketDebuggerUrl, url: pageTarget.url };
      }
    } catch (e) {}
    return null;
  }

  getListeningPorts() {
    return new Promise((resolve) => {
      const cmd = `powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort -Unique | ConvertTo-Json"`;
      exec(cmd, (err, stdout) => {
        if (err || !stdout) return resolve([]);
        try {
          let ports = JSON.parse(stdout.trim());
          if (typeof ports === 'number') ports = [ports];
          resolve(ports);
        } catch (e) {
          resolve([]);
        }
      });
    });
  }

  httpGet(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }

  async start() {
    log(`[CDP Service] Starting persistent ContextGuard service (PID: ${process.pid})...`);
    
    if (!this.keepAliveInterval) {
      this.keepAliveInterval = setInterval(() => {}, 30000);
    }

    await this.tryConnect();
  }

  async tryConnect() {
    log('[CDP Service] Discovering Antigravity CDP debug port...');
    const target = await this.discoverCDPPort();

    if (target) {
      log(`[CDP Service] CDP port discovered: ${target.port} (${target.wsUrl})`);
      this.wsUrl = target.wsUrl;
      const connected = await this.connectWebSocket(target.wsUrl);
      if (connected) {
        this.mode = 'CDP_ACTIVE';
        log('[CDP Service] Active Mode: CDP_ACTIVE with in-DOM overlay and expandable handoff');
        this.syncCurrentState(target.url);
        return;
      }
    }

    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this.mode !== 'CDP_ACTIVE') {
          log('[CDP Service] Retrying CDP connection...');
          this.tryConnect();
        }
      }, 5000);
    }
  }

  connectWebSocket(wsUrl) {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          if (this.ws.readyState !== WebSocket.OPEN) {
            try { this.ws.close(); } catch(e) {}
            resolve(false);
          }
        }, 2500);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          log('[CDP Service] WebSocket connected successfully.');
          this.setupCDPListeners();
          this.sendCDP('Page.enable');
          this.sendCDP('Runtime.enable');
          this.sendCDP('Runtime.addBinding', { name: 'contextGuardTriggerHandoff' });
          resolve(true);
        };

        this.ws.onerror = (err) => {
          clearTimeout(timeout);
          log(`[CDP Service] WebSocket error: ${err.message || 'Connection Error'}`);
          resolve(false);
        };

        this.ws.onclose = () => {
          log('[CDP Service] WebSocket closed.');
          this.mode = 'DISCOVERING';
          setTimeout(() => this.tryConnect(), 4000);
        };
      } catch (e) {
        resolve(false);
      }
    });
  }

  sendCDP(method, params = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg = { id: Math.floor(Math.random() * 1000000), method, params };
      this.ws.send(JSON.stringify(msg));
    }
  }

  evalJS(expression) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg = {
        id: Math.floor(Math.random() * 1000000),
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true }
      };
      this.ws.send(JSON.stringify(msg));
    }
  }

  setupCDPListeners() {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const method = msg.method || '';
        const params = msg.params || {};

        if (method === 'Page.loadEventFired' || method === 'Page.domContentEventFired') {
          log(`[CDP Event] ${method} -> Re-injecting DOM overlay...`);
          this.injectDOMOverlay();
        } else if (method === 'Page.navigatedWithinDocument') {
          const url = params.url || '';
          log(`[CDP Event] Page.navigatedWithinDocument -> SPA Route Changed: ${url}`);
          this.syncCurrentState(url);
        } else if (method === 'Runtime.bindingCalled' && params.name === 'contextGuardTriggerHandoff') {
          log(`[CDP Service] Handoff button clicked in DOM overlay for session: ${params.payload || this.currentChatId}`);
          this.handleHandoffTrigger(params.payload || this.currentChatId);
        }
      } catch (e) {}
    };
  }

  handleHandoffTrigger(chatId) {
    try {
      const cid = chatId || this.currentChatId || process.env.ANTIGRAVITY_CONVERSATION_ID;
      if (!cid) return;
      const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', cid);
      const transcriptPath = path.join(brainDir, '.system_generated', 'logs', 'transcript.jsonl');
      const handoffMd = handoff.generateTranscriptHandoff(transcriptPath, cid, process.cwd());
      
      if (fs.existsSync(brainDir)) {
        const handoffPath = path.join(brainDir, 'context_guard_handoff.md');
        fs.writeFileSync(handoffPath, handoffMd, 'utf8');
        log(`[CDP Service] Generated handoff successfully at: ${handoffPath}`);
      }

      const feedbackJs = `
        (function() {
          const btn = document.getElementById('contextguard-handoff-action-btn');
          if (btn) {
            btn.innerHTML = '✓ Saved handoff.md!';
            btn.style.backgroundColor = '#166534';
            btn.style.borderColor = '#22C55E';
            btn.style.color = '#FFFFFF';
            setTimeout(() => {
              if (btn) {
                btn.innerHTML = '📋 Generate Handoff';
                btn.style.backgroundColor = '#1E293B';
                btn.style.borderColor = '#38BDF8';
                btn.style.color = '#38BDF8';
              }
            }, 2500);
          }
        })()
      `;
      this.evalJS(feedbackJs);
    } catch (e) {
      log(`[CDP Service] Error in handoff generation: ${e.message}`);
    }
  }

  syncCurrentState(targetUrl) {
    let chatId = null;
    if (targetUrl) {
      const match = targetUrl.match(/\/c\/([a-f0-9\-]+)/i);
      if (match) chatId = match[1];
    }

    if (!chatId) {
      chatId = process.env.ANTIGRAVITY_CONVERSATION_ID || 'active_session';
    }

    if (this.pendingRetryTimers && this.pendingRetryTimers.length > 0) {
      this.pendingRetryTimers.forEach(t => clearTimeout(t));
    }
    this.pendingRetryTimers = [];

    this.currentChatId = chatId;
    
    let live = engine.updateChatState(chatId, process.cwd());
    const pctLog = live.percentageUsed !== null ? live.percentageUsed + '%' : (live.level === 'UNKNOWN' ? 'ENCRYPTED' : 'NO DATA');
    log(`[CDP Service] Fresh Telemetry updated for ${chatId.substring(0, 8)}... (${pctLog})`);
    
    // Collapse badge on navigation
    this.evalJS(`
      (function() {
        const badge = document.getElementById('contextguard-dom-badge');
        if (badge && badge.__isExpanded) {
          badge.__isExpanded = false;
          if (window.__cg_render_badge) window.__cg_render_badge();
        }
      })()
    `);

    this.updateDOMBadge(live);

    if (live.precision === 'no_data') {
      const retryDelays = [300, 1000, 3000, 5000];
      retryDelays.forEach((delayMs) => {
        const timer = setTimeout(() => {
          if (this.currentChatId === chatId) {
            const delayedLive = engine.updateChatState(chatId, process.cwd());
            if (delayedLive.precision !== 'no_data') {
              log(`[CDP Service] Progressive Retry Resolved (${delayMs}ms) for ${chatId.substring(0, 8)}... -> Updated to ${delayedLive.percentageUsed}% (${delayedLive.precision})`);
              this.updateDOMBadge(delayedLive);
            }
          }
        }, delayMs);
        this.pendingRetryTimers.push(timer);
      });
    }
  }

  injectDOMOverlay() {
    const live = engine.getLiveState();
    this.updateDOMBadge(live);
  }

  updateDOMBadge(live) {
    let textContent;
    if (live.level === 'UNKNOWN') {
      textContent = `${live.badge}`;
    } else {
      const pctText = live.percentageUsed !== null ? `${live.percentageUsed}%` : 'NO DATA';
      textContent = `${pctText} (${live.badge})`;
    }
    const hexColor = live.hexColor || live.colorHex || '#22C55E';
    const chatId = this.currentChatId || live.conversationId || 'active_session';
    const precisionText = live.precision || 'Telemetry';

    const js = `
    (function() {
      let el = document.getElementById('contextguard-dom-badge');
      if (!el) {
        el = document.createElement('div');
        el.id = 'contextguard-dom-badge';
        el.__isExpanded = false;

        el.style.position = 'fixed';
        el.style.top = '14px';
        el.style.right = '280px';
        el.style.zIndex = '999999';
        el.style.background = '#0F172A';
        el.style.border = '2px solid ${hexColor}';
        el.style.color = '${hexColor}';
        el.style.borderRadius = '9999px';
        el.style.fontFamily = 'Consolas, monospace';
        el.style.fontSize = '12px';
        el.style.fontWeight = 'bold';
        el.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.6)';
        el.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.cursor = 'pointer';
        el.style.userSelect = 'none';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.overflow = 'hidden';

        document.body.appendChild(el);
      }

      if (!el.__cg_click_bound) {
        el.__cg_click_bound = true;
        el.addEventListener('click', function(e) {
          if (e.target.closest('#contextguard-handoff-action-btn')) return;
          el.__isExpanded = !el.__isExpanded;
          if (window.__cg_render_badge) window.__cg_render_badge();
        });
      }

      if (!window.__cg_outside_click_installed) {
        window.__cg_outside_click_installed = true;
        document.addEventListener('click', function(e) {
          const badge = document.getElementById('contextguard-dom-badge');
          if (badge && !badge.contains(e.target) && badge.__isExpanded) {
            badge.__isExpanded = false;
            if (window.__cg_render_badge) window.__cg_render_badge();
          }
        });
      }

      el.style.borderColor = '${hexColor}';
      el.style.color = '${hexColor}';

      window.__cg_render_badge = function() {
        const isExp = el.__isExpanded;
        if (!isExp) {
          el.style.borderRadius = '9999px';
          el.innerHTML = '<div style="padding: 5px 14px; display: flex; align-items: center; gap: 6px; white-space: nowrap;">♡ ContextGuard: ${textContent}</div>';
        } else {
          el.style.borderRadius = '12px';
          el.innerHTML = \`
            <div style="padding: 6px 14px 4px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px dashed rgba(255,255,255,0.15); white-space: nowrap;">
              <span>♡ ContextGuard: ${textContent}</span>
              <span style="font-size: 10px; opacity: 0.6;">▲</span>
            </div>
            <div style="padding: 8px 14px 10px 14px; display: flex; flex-direction: column; gap: 6px; background: rgba(0,0,0,0.3);">
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94A3B8; font-weight: normal;">
                <span>Session: ${chatId.substring(0, 10)}...</span>
                <span>${precisionText}</span>
              </div>
              <button id="contextguard-handoff-action-btn" onclick="event.stopPropagation(); if (window.contextGuardTriggerHandoff) window.contextGuardTriggerHandoff('${chatId}');" style="background: #1E293B; border: 1.5px solid #38BDF8; color: #38BDF8; border-radius: 6px; padding: 5px 12px; font-size: 11px; font-family: Consolas, monospace; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s ease;">📋 Generate Handoff</button>
            </div>
          \`;
        }
      };

      window.__cg_render_badge();
    })()
    `;
    this.evalJS(js);
  }
}

if (require.main === module) {
  const service = new ContextGuardCDPService();
  service.start();
}

module.exports = ContextGuardCDPService;
