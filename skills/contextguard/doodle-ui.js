const fs = require('fs');
const path = require('path');
const engine = require('./engine.js');

function renderDoodleAsciiBar(pct) {
  const total = 20;
  const filled = Math.min(total, Math.max(0, Math.round((pct / 100) * total)));
  const empty = total - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function generateDoodleMarkdown(state) {
  const maxCtx = state.maxContext || 1048576;
  const formattedMax = (maxCtx / 1024 / 1024).toFixed(2) + 'M';
  const bar = (state.percentageUsed !== null && state.percentageUsed !== undefined)
    ? renderDoodleAsciiBar(state.percentageUsed)
    : '░'.repeat(20);
  const formattedUsed = (state.tokensUsed !== null && state.tokensUsed !== undefined)
    ? state.tokensUsed.toLocaleString()
    : (state.level === 'UNKNOWN' ? 'ENCRYPTED' : 'NO DATA');
  const formattedRem = (state.remainingTokens !== null && state.remainingTokens !== undefined)
    ? `${state.remainingTokens.toLocaleString()} Tokens`
    : 'Unknown';
  const pctStr = (state.percentageUsed !== null && state.percentageUsed !== undefined)
    ? `${state.percentageUsed}%`
    : (state.level === 'UNKNOWN' ? 'ENCRYPTED' : 'NO DATA');
  const updated = state.updatedAt || state.timestamp || new Date().toISOString();

  return `# ContextGuard ~ Doodle Dark Telemetry

\`\`\`
+-----------------------------------------------------------------------+
|  [ContextGuard]  ~ Doodle Dark Mode ~             [ 🔄 Refresh ]       |
+-----------------------------------------------------------------------+
|  Context : [${bar}] ${pctStr} (${formattedUsed} / ${formattedMax})       |
+-----------------------------------------------------------------------+
|  Status    : ${state.badge}                                       |
|  Precision : ${state.precision}                                       |
|  Remaining : ${formattedRem}                                   |
|  Advice    : ${state.advice}                                           |
|  Session ID: ${state.conversationId}                                  |
+-----------------------------------------------------------------------+
|  Actions   : Run /contextguard refresh  |  Run /contextguard handoff |
+-----------------------------------------------------------------------+
\`\`\`

> **Doodle Status Level**: \`${state.level}\`  
> **Last Updated**: \`${updated}\`  
`;
}

function generateDoodleHtml(state) {
  const maxCtx = state.maxContext || 1048576;
  const formattedMax = (maxCtx / 1024 / 1024).toFixed(2) + 'M';
  const bar = (state.percentageUsed !== null && state.percentageUsed !== undefined)
    ? renderDoodleAsciiBar(state.percentageUsed)
    : '░'.repeat(20);
  const formattedUsed = (state.tokensUsed !== null && state.tokensUsed !== undefined)
    ? state.tokensUsed.toLocaleString()
    : (state.level === 'UNKNOWN' ? 'ENCRYPTED' : 'NO DATA');
  const formattedRem = (state.remainingTokens !== null && state.remainingTokens !== undefined)
    ? `${state.remainingTokens.toLocaleString()} Tokens`
    : 'Unknown';
  const pctStr = (state.percentageUsed !== null && state.percentageUsed !== undefined)
    ? `${state.percentageUsed}%`
    : (state.level === 'UNKNOWN' ? 'ENCRYPTED' : 'NO DATA');
  const barWidth = (state.percentageUsed !== null && state.percentageUsed !== undefined) ? state.percentageUsed : 0;
  const updated = state.updatedAt || state.timestamp || new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ContextGuard - Doodle Dark UI</title>
  <style>
    body {
      background-color: #000000;
      color: #F0F0F0;
      font-family: 'Courier New', Courier, monospace;
      padding: 16px;
      margin: 0;
    }
    .doodle-card {
      border: 2px dashed #444;
      border-radius: 12px;
      padding: 20px;
      background-color: #0A0A0A;
      box-shadow: 0 4px 20px rgba(0,255,150,0.05);
      max-width: 550px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px dashed #333;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .title {
      font-size: 1.2rem;
      font-weight: bold;
      letter-spacing: 1px;
      color: #FFF;
    }
    .refresh-btn {
      background: #111;
      color: ${state.hexColor};
      border: 1.5px dashed ${state.hexColor};
      padding: 6px 12px;
      border-radius: 6px;
      font-family: inherit;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: bold;
      transition: all 0.2s ease;
    }
    .refresh-btn:hover {
      background: ${state.hexColor};
      color: #000;
    }
    .progress-container {
      margin: 18px 0;
    }
    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.95rem;
      margin-bottom: 8px;
    }
    .bar-bg {
      background: #1A1A1A;
      border: 1.5px dashed #444;
      border-radius: 8px;
      height: 22px;
      overflow: hidden;
      position: relative;
    }
    .bar-fill {
      background: ${state.hexColor};
      height: 100%;
      width: ${barWidth}%;
      transition: width 0.4s ease;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border: 1.5px solid ${state.hexColor};
      color: ${state.hexColor};
      border-radius: 6px;
      font-weight: bold;
      font-size: 0.85rem;
      margin-top: 6px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 16px 0;
      font-size: 0.85rem;
      border-top: 1px dashed #333;
      padding-top: 14px;
    }
    .metric-item {
      background: #141414;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #222;
    }
    .metric-title {
      color: #888;
      font-size: 0.75rem;
      margin-bottom: 4px;
    }
    .metric-value {
      font-weight: bold;
      color: #EEE;
    }
    .advice-box {
      background: #121212;
      border-left: 3px solid ${state.hexColor};
      padding: 10px 14px;
      font-size: 0.82rem;
      color: #CCC;
      margin-top: 14px;
      border-radius: 0 6px 6px 0;
    }
    .footer {
      margin-top: 16px;
      font-size: 0.75rem;
      color: #555;
      text-align: right;
    }
  </style>
</head>
<body>
  <div class="doodle-card">
    <div class="header">
      <div class="title">✏️ ContextGuard</div>
      <button class="refresh-btn" onclick="location.reload()">[ 🔄 Refresh ]</button>
    </div>

    <div class="progress-container">
      <div class="progress-label">
        <span>Context Usage</span>
        <span style="color: ${state.hexColor}; font-weight: bold;">${pctStr}</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill"></div>
      </div>
    </div>

    <div>
      <span class="badge">${state.badge}</span>
    </div>

    <div class="metrics-grid">
      <div class="metric-item">
        <div class="metric-title">TOKENS USED</div>
        <div class="metric-value">${formattedUsed} / ${formattedMax}</div>
      </div>
      <div class="metric-item">
        <div class="metric-title">REMAINING TOKENS</div>
        <div class="metric-value">${formattedRem}</div>
      </div>
      <div class="metric-item">
        <div class="metric-title">DATA PRECISION</div>
        <div class="metric-value">${state.precision}</div>
      </div>
      <div class="metric-item">
        <div class="metric-title">SESSION ID</div>
        <div class="metric-value" style="font-size:0.7rem;">${state.conversationId.substring(0,18)}...</div>
      </div>
    </div>

    <div class="advice-box">
      <strong>Recommendation:</strong> ${state.advice}
    </div>

    <div class="footer">
      Last Updated: ${new Date(updated).toLocaleTimeString()}
    </div>
  </div>
</body>
</html>`;
}

function writeDoodleArtifacts(brainDir, state) {
  if (!brainDir || !fs.existsSync(brainDir)) return false;

  const mdPath = path.join(brainDir, 'context_guard_status.md');
  const htmlPath = path.join(brainDir, 'context_guard_status.html');

  try {
    fs.writeFileSync(mdPath, generateDoodleMarkdown(state), 'utf8');
    fs.writeFileSync(htmlPath, generateDoodleHtml(state), 'utf8');
    return { mdPath, htmlPath };
  } catch (e) {
    return false;
  }
}

module.exports = {
  renderDoodleAsciiBar,
  generateDoodleMarkdown,
  generateDoodleHtml,
  writeDoodleArtifacts
};
