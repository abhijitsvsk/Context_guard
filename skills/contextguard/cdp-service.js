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
    this.mode = 'DISCOVERING';
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
    
    try {
      const myPid = process.pid;
      const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'node.exe'\\" | Where-Object { $_.CommandLine -like '*cdp-service.js*' -and $_.ProcessId -ne ${myPid} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`;
      exec(cmd, () => {});
    } catch (e) {}

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

      const jsonStr = JSON.stringify(handoffMd);
      const feedbackJs = `
        (function() {
          const btn = document.getElementById('contextguard-handoff-action-btn');
          const content = ${jsonStr};
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(content).catch(function() {});
            }
          } catch(e) {}
          if (btn) {
            btn.innerText = '✓ Copied & Saved handoff.md!';
            btn.style.backgroundColor = '#0a2318';
            btn.style.borderColor = '#22C55E';
            btn.style.color = '#4ade80';
            setTimeout(function() {
              if (btn) {
                btn.innerText = '📋 Generate Handoff';
                btn.style.backgroundColor = '#111111';
                btn.style.borderColor = '#38BDF8';
                btn.style.color = '#38BDF8';
              }
            }, 3000);
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
          if (window.__cg_update_badge_view) window.__cg_update_badge_view();
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
      if (el && (!el.querySelector('#contextguard-badge-header') || !el.__cg_draggable || el.__cg_theme !== 'doodle_black_v2')) {
        el.remove();
        el = null;
      }
      if (!el) {
        el = document.createElement('div');
        el.id = 'contextguard-dom-badge';
        el.__isExpanded = false;
        el.__cg_draggable = true;
        el.__cg_theme = 'doodle_black_v2';

        el.style.position = 'fixed';
        el.style.zIndex = '999999';
        el.style.background = '#050505';
        el.style.fontFamily = "'Comic Neue', 'Chalkboard SE', 'Comic Sans MS', 'Segoe Print', cursive, sans-serif";
        el.style.fontSize = '12px';
        el.style.fontWeight = 'bold';
        el.style.letterSpacing = '0.5px';
        el.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.9), inset 0 0 10px rgba(255, 255, 255, 0.04)';
        el.style.userSelect = 'none';
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.overflow = 'hidden';
        el.style.transition = 'border-radius 0.15s ease';

        // Restore saved position if present
        let savedPos = null;
        try {
          savedPos = JSON.parse(localStorage.getItem('contextguard_badge_pos') || 'null');
          if (savedPos && typeof savedPos.top === 'number' && savedPos.top < 38) {
            localStorage.removeItem('contextguard_badge_pos');
            savedPos = null;
          }
        } catch(e) {}

        if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
          el.style.top = Math.max(40, Math.min(window.innerHeight - 40, savedPos.top)) + 'px';
          el.style.left = Math.max(10, Math.min(window.innerWidth - 80, savedPos.left)) + 'px';
          el.style.right = 'auto';
        } else {
          el.style.top = '48px';
          el.style.right = '260px';
        }

        el.style.setProperty('-webkit-app-region', 'no-drag', 'important');

        const header = document.createElement('div');
        header.id = 'contextguard-badge-header';
        header.title = 'Click to expand/collapse, drag to move';
        header.style.setProperty('-webkit-app-region', 'no-drag', 'important');
        header.style.padding = '5px 14px';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.gap = '8px';
        header.style.cursor = 'grab';
        header.style.whiteSpace = 'nowrap';
        header.style.fontFamily = "'Comic Neue', 'Chalkboard SE', 'Comic Sans MS', 'Segoe Print', cursive, sans-serif";
        header.style.textShadow = '0 0 2px rgba(255, 255, 255, 0.2)';

        const title = document.createElement('span');
        title.id = 'contextguard-badge-title';
        title.style.fontFamily = 'inherit';
        header.appendChild(title);

        const arrow = document.createElement('span');
        arrow.id = 'contextguard-badge-arrow';
        arrow.style.fontSize = '10px';
        arrow.style.opacity = '0.7';
        arrow.style.display = 'none';
        arrow.innerText = '▲';
        header.appendChild(arrow);

        const panel = document.createElement('div');
        panel.id = 'contextguard-badge-panel';
        panel.style.display = 'none';
        panel.style.flexDirection = 'column';
        panel.style.gap = '8px';
        panel.style.padding = '8px 14px 10px 14px';
        panel.style.background = '#090909';
        panel.style.borderTop = '1.5px dashed rgba(255, 255, 255, 0.2)';
        panel.style.fontFamily = "'Comic Neue', 'Chalkboard SE', 'Comic Sans MS', 'Segoe Print', cursive, sans-serif";

        const metaRow = document.createElement('div');
        metaRow.style.display = 'flex';
        metaRow.style.justifyContent = 'space-between';
        metaRow.style.fontSize = '11px';
        metaRow.style.color = '#A0A0A0';
        metaRow.style.fontFamily = "'Comic Neue', 'Chalkboard SE', 'Comic Sans MS', 'Segoe Print', cursive, sans-serif";
        metaRow.style.fontWeight = 'normal';
        metaRow.style.letterSpacing = '0.3px';

        const sessionLabel = document.createElement('span');
        sessionLabel.id = 'contextguard-badge-session';
        sessionLabel.style.fontFamily = 'inherit';
        metaRow.appendChild(sessionLabel);

        const precLabel = document.createElement('span');
        precLabel.id = 'contextguard-badge-prec';
        precLabel.style.fontFamily = 'inherit';
        metaRow.appendChild(precLabel);
        panel.appendChild(metaRow);

        const btn = document.createElement('button');
        btn.id = 'contextguard-handoff-action-btn';
        btn.style.background = '#111111';
        btn.style.border = '1.5px dashed #38BDF8';
        btn.style.color = '#38BDF8';
        btn.style.borderRadius = '8px';
        btn.style.padding = '6px 14px';
        btn.style.fontSize = '12px';
        btn.style.fontFamily = "'Comic Neue', 'Chalkboard SE', 'Comic Sans MS', 'Segoe Print', cursive, sans-serif";
        btn.style.fontWeight = 'bold';
        btn.style.letterSpacing = '0.5px';
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.gap = '6px';
        btn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.7)';
        btn.style.transition = 'all 0.2s ease';
        btn.innerText = '📋 Generate Handoff';
        panel.appendChild(btn);

        el.appendChild(header);
        el.appendChild(panel);
        document.body.appendChild(el);

        // Draggable mechanics
        let isDragging = false;
        let hasMoved = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        header.addEventListener('mousedown', function(e) {
          if (e.button !== 0) return;
          e.preventDefault();
          isDragging = false;
          hasMoved = false;
          startX = e.clientX;
          startY = e.clientY;
          const rect = el.getBoundingClientRect();
          initialLeft = rect.left;
          initialTop = rect.top;

          function onMouseMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
              hasMoved = true;
              isDragging = true;
              header.style.cursor = 'grabbing';
              document.body.style.userSelect = 'none';
            }
            if (isDragging) {
              const maxLeft = Math.max(10, window.innerWidth - (el.offsetWidth || 150) - 10);
              const maxTop = Math.max(40, window.innerHeight - (el.offsetHeight || 30) - 10);
              const curLeft = Math.max(10, Math.min(maxLeft, initialLeft + dx));
              const curTop = Math.max(40, Math.min(maxTop, initialTop + dy));
              el.style.left = curLeft + 'px';
              el.style.top = curTop + 'px';
              el.style.right = 'auto';
            }
          }

          function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove, true);
            document.removeEventListener('mouseup', onMouseUp, true);
            window.removeEventListener('mouseup', onMouseUp, true);
            header.style.cursor = 'grab';
            document.body.style.userSelect = '';
            if (hasMoved) {
              el.__justDragged = true;
              setTimeout(function() { el.__justDragged = false; }, 200);
              try {
                const rect = el.getBoundingClientRect();
                localStorage.setItem('contextguard_badge_pos', JSON.stringify({ top: Math.round(rect.top), left: Math.round(rect.left) }));
              } catch(e) {}
            }
          }

          document.addEventListener('mousemove', onMouseMove, true);
          document.addEventListener('mouseup', onMouseUp, true);
          window.addEventListener('mouseup', onMouseUp, true);
        });

        header.addEventListener('click', function(e) {
          e.stopPropagation();
          if (el.__justDragged) {
            el.__justDragged = false;
            return;
          }
          el.__isExpanded = !el.__isExpanded;
          updateView();
        });

        panel.addEventListener('mousedown', function(e) {
          e.stopPropagation();
        });

        panel.addEventListener('click', function(e) {
          e.stopPropagation();
        });

        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          const cid = el.getAttribute('data-chat-id') || '';
          if (window.contextGuardTriggerHandoff) {
            window.contextGuardTriggerHandoff(cid);
          }
        });
      }

      const curT = parseInt(el.style.top, 10);
      if (isNaN(curT) || curT < 40) {
        el.style.top = '48px';
        el.style.right = '260px';
        el.style.left = 'auto';
        try { localStorage.removeItem('contextguard_badge_pos'); } catch(e) {}
      }

      el.setAttribute('data-chat-id', '${chatId}');
      el.style.borderColor = '${hexColor}';
      el.style.color = '${hexColor}';
      el.style.border = '2px dashed ${hexColor}';

      const titleEl = document.getElementById('contextguard-badge-title');
      if (titleEl) {
        titleEl.innerText = '♡ ContextGuard: ${textContent}';
        titleEl.style.color = '${hexColor}';
      }

      const sessionEl = document.getElementById('contextguard-badge-session');
      if (sessionEl) sessionEl.innerText = 'Session: ${chatId.substring(0, 10)}...';

      const precEl = document.getElementById('contextguard-badge-prec');
      if (precEl) precEl.innerText = '${precisionText}';

      function updateView() {
        const b = document.getElementById('contextguard-dom-badge');
        if (!b) return;
        const isExp = !!b.__isExpanded;
        b.style.borderRadius = isExp ? '12px' : '9999px';
        const panelEl = document.getElementById('contextguard-badge-panel');
        if (panelEl) panelEl.style.display = isExp ? 'flex' : 'none';
        const arrowEl = document.getElementById('contextguard-badge-arrow');
        if (arrowEl) arrowEl.style.display = isExp ? 'inline' : 'none';

        if (isExp && b.style.left && b.style.left !== 'auto') {
          const rect = b.getBoundingClientRect();
          if (rect.right > window.innerWidth) {
            b.style.left = Math.max(0, window.innerWidth - rect.width - 10) + 'px';
          }
          if (rect.bottom > window.innerHeight) {
            b.style.top = Math.max(0, window.innerHeight - rect.height - 10) + 'px';
          }
        }
      }

      if (window.__cg_doc_click_handler) {
        document.removeEventListener('click', window.__cg_doc_click_handler, true);
        document.removeEventListener('click', window.__cg_doc_click_handler, false);
      }
      window.__cg_doc_click_handler = function(e) {
        const b = document.getElementById('contextguard-dom-badge');
        if (b && b.__justDragged) return;
        if (b && !b.contains(e.target)) {
          const panel = document.getElementById('contextguard-badge-panel');
          if (b.__isExpanded || (panel && panel.style.display !== 'none')) {
            b.__isExpanded = false;
            updateView();
          }
        }
      };
      document.addEventListener('click', window.__cg_doc_click_handler, true);

      window.__cg_update_badge_view = updateView;
      updateView();
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
