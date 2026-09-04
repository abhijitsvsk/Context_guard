const fs = require('fs');
const path = require('path');
const os = require('os');

const BRAIN_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
const MAX_CONTEXT = 1048576;
const BYTES_PER_TOKEN = 2.70; // Calibrated token density constant

function generateHistory() {
  const sessions = [];

  if (!fs.existsSync(BRAIN_DIR)) {
    return { markdown: '> No sessions found.', sessions: [] };
  }

  try {
    const dirs = fs.readdirSync(BRAIN_DIR);
    for (const d of dirs) {
      const fullDir = path.join(BRAIN_DIR, d);
      const tPath = path.join(fullDir, '.system_generated', 'logs', 'transcript.jsonl');

      if (!fs.existsSync(tPath)) continue;

      try {
        const stat = fs.statSync(tPath);
        const fileSizeBytes = stat.size;
        const estTokens = Math.round(fileSizeBytes / BYTES_PER_TOKEN);
        const pct = Math.min(100, Math.round((estTokens / MAX_CONTEXT) * 100));

        let level = 'NORMAL';
        let badge = '[ OK ]';
        let hexColor = '#239B43';

        if (pct >= 95) { level = 'CRITICAL'; badge = '[ CRITICAL ]'; hexColor = '#FF0235'; }
        else if (pct >= 85) { level = 'WARNING'; badge = '[ WARNING ]'; hexColor = '#FF1744'; }
        else if (pct >= 75) { level = 'CAUTION'; badge = '[ CAUTION ]'; hexColor = '#FF9100'; }
        else if (pct >= 60) { level = 'NOTICE'; badge = '[ NOTICE ]'; hexColor = '#FFD600'; }

        // Count user messages
        let userMsgCount = 0;
        try {
          const content = fs.readFileSync(tPath, 'utf8');
          const lines = content.split('\n').filter(Boolean);
          for (const l of lines) {
            if (l.includes('"USER_INPUT"')) userMsgCount++;
          }
        } catch (e) {}

        sessions.push({
          conversationId: d,
          tokens: estTokens,
          pct,
          level,
          badge,
          hexColor,
          userMessages: userMsgCount,
          lastModified: stat.mtime,
          fileSize: fileSizeBytes
        });
      } catch (e) {}
    }
  } catch (e) {}

  // Sort by most recent first
  sessions.sort((a, b) => b.lastModified - a.lastModified);

  // Generate markdown report
  const now = new Date().toISOString();
  let md = `# ContextGuard ~ Session History\n\n`;
  md += `> **Generated**: \`${now}\`  \n`;
  md += `> **Total Sessions**: \`${sessions.length}\`\n\n`;

  if (sessions.length === 0) {
    md += '> No sessions with transcripts found.\n';
    return { markdown: md, sessions };
  }

  md += `| # | Session ID | Context Used | Tokens | Level | User Messages | Last Active |\n`;
  md += `|---|-----------|-------------|--------|-------|--------------|-------------|\n`;

  sessions.forEach((s, i) => {
    const shortId = s.conversationId.substring(0, 12) + '...';
    const tokenStr = s.tokens >= 1048576
      ? (s.tokens / 1048576).toFixed(2) + 'M'
      : s.tokens >= 1024
        ? Math.round(s.tokens / 1024) + 'K'
        : s.tokens.toString();
    const dateStr = s.lastModified.toISOString().replace('T', ' ').substring(0, 19);
    const marker = i === 0 ? ' **← active**' : '';

    md += `| ${i + 1} | \`${shortId}\` | ${s.pct}% | ${tokenStr} / 1.00M | ${s.badge} | ${s.userMessages} | ${dateStr}${marker} |\n`;
  });

  md += `\n---\n\n`;

  // Summary stats
  const totalTokens = sessions.reduce((sum, s) => sum + s.tokens, 0);
  const totalMessages = sessions.reduce((sum, s) => sum + s.userMessages, 0);
  const criticalCount = sessions.filter(s => s.level === 'CRITICAL').length;
  const warningCount = sessions.filter(s => s.level === 'WARNING').length;

  md += `### Summary\n\n`;
  md += `- **Total tokens across all sessions**: ${totalTokens >= 1048576 ? (totalTokens / 1048576).toFixed(2) + 'M' : Math.round(totalTokens / 1024) + 'K'}\n`;
  md += `- **Total user messages**: ${totalMessages}\n`;
  md += `- **Sessions at WARNING+**: ${warningCount + criticalCount}\n`;
  md += `- **Sessions at CRITICAL**: ${criticalCount}\n`;

  return { markdown: md, sessions };
}

module.exports = { generateHistory };
