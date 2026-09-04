const fs = require('fs');
const path = require('path');
const os = require('os');
const engine = require('./engine.js');
const doodle = require('./doodle-ui.js');

const BRAIN_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
let currentActiveId = null;

function findActiveConversation() {
  if (!fs.existsSync(BRAIN_DIR)) return null;

  try {
    const dirs = fs.readdirSync(BRAIN_DIR);
    let latestId = null;
    let latestMtime = 0;
    let latestTranscriptPath = null;

    for (const dir of dirs) {
      const transcriptPath = path.join(BRAIN_DIR, dir, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(transcriptPath)) {
        try {
          const stats = fs.statSync(transcriptPath);
          if (stats.mtimeMs > latestMtime) {
            latestMtime = stats.mtimeMs;
            latestId = dir;
            latestTranscriptPath = transcriptPath;
          }
        } catch (e) {}
      }
    }

    return { conversationId: latestId, transcriptPath: latestTranscriptPath };
  } catch (e) {
    return null;
  }
}

function pollActiveChat() {
  const active = findActiveConversation();
  if (active && active.conversationId) {
    const live = engine.updateChatState(active.conversationId, process.cwd(), { transcriptPath: active.transcriptPath });
    
    // Also write HTML & MD artifacts to the active chat's brain directory
    const activeBrainDir = path.join(BRAIN_DIR, active.conversationId);
    doodle.writeDoodleArtifacts(activeBrainDir, live);

    if (currentActiveId !== active.conversationId) {
      currentActiveId = active.conversationId;
      console.log(`[ContextGuard Auto-Detector] Switched active chat to: ${active.conversationId} (${live.percentageUsed}%)`);
    }
  }
}

if (require.main === module) {
  // Initial check
  pollActiveChat();
  // Poll every 1 second for active chat switching
  setInterval(pollActiveChat, 1000);
}

module.exports = {
  findActiveConversation,
  pollActiveChat
};
