const fs = require('fs');
const path = require('path');

function generateTranscriptHandoff(transcriptPath, conversationId, workspacePath) {
  let userGoals = [];
  let modifiedFiles = new Set();
  let subagentsUsed = [];
  let lastModelResponse = '';

  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          
          // User goals
          if (entry.type === 'USER_INPUT' && entry.content) {
            let clean = entry.content.replace(/<USER_REQUEST>|<\/USER_REQUEST>|<ADDITIONAL_METADATA>[\s\S]*$/gi, '').trim();
            if (clean && !userGoals.includes(clean)) {
              userGoals.push(clean);
            }
          }

          // Tool calls for file edits
          if (entry.tool_calls && Array.isArray(entry.tool_calls)) {
            for (const tc of entry.tool_calls) {
              if (['write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(tc.name)) {
                const target = tc.args ? (tc.args.TargetFile || tc.args.targetFile || tc.args.path) : null;
                if (target) modifiedFiles.add(target);
              }
              if (tc.name === 'invoke_subagent') {
                const role = tc.args ? (tc.args.Role || tc.args.TypeName) : 'Subagent';
                subagentsUsed.push(role);
              }
            }
          }

          if (entry.type === 'PLANNER_RESPONSE' && entry.content) {
            lastModelResponse = entry.content.slice(0, 300);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  const fileList = Array.from(modifiedFiles).map(f => `- \`${f}\``).join('\n') || '- None tracked yet';
  const goalsList = userGoals.slice(0, 3).map((g, idx) => `${idx + 1}. ${g}`).join('\n') || '1. Continue pair programming session.';
  const subagentList = subagentsUsed.length > 0 ? Array.from(new Set(subagentsUsed)).join(', ') : 'None';

  const handoffMarkdown = `# 🔄 ContextGuard Session Continuation Handoff

> **Generated**: \`${new Date().toISOString()}\`  
> **Source Session ID**: \`${conversationId || 'active_session'}\`  
> **Workspace**: \`${workspacePath || process.cwd()}\`  

---

## 🎯 Primary Session Goals
${goalsList}

---

## 📁 Key Project Files & Code References
${fileList}

---

## 🛠️ Execution & Subagent Context
- **Subagents Invoked**: ${subagentList}
- **Latest State Summary**: ${lastModelResponse || 'Completed phase tasks.'}

---

## 📋 Recommended Next Steps for New Chat
1. Copy this entire summary into the prompt of your new Antigravity chat.
2. Confirm the workspace root: \`${workspacePath || process.cwd()}\`
3. Resume work on pending goals listed above.
`;

  return handoffMarkdown;
}

module.exports = {
  generateTranscriptHandoff
};
