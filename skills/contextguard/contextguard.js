const fs = require('fs');
const path = require('path');
const os = require('os');
const engine = require('./engine.js');
const doodle = require('./doodle-ui.js');
const handoff = require('./handoff.js');
const sessionWatcher = require('./session-watcher.js');

const action = (process.argv[2] || 'status').toLowerCase();
let conversationId = process.env.ANTIGRAVITY_CONVERSATION_ID;
let transcriptPath = null;
let brainDir = null;

if (!conversationId) {
  const active = sessionWatcher.findActiveConversation();
  if (active && active.conversationId) {
    conversationId = active.conversationId;
    transcriptPath = active.transcriptPath;
  } else {
    conversationId = 'active_session';
  }
}

const workspacePath = process.cwd();

// Find active brain folder
if (conversationId && conversationId !== 'active_session') {
  brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain', conversationId);
  if (!transcriptPath && brainDir) {
    transcriptPath = path.join(brainDir, '.system_generated', 'logs', 'transcript.jsonl');
  }
}

switch (action) {
  case 'refresh':
  case 'status': {
    const live = engine.updateChatState(conversationId, workspacePath, { transcriptPath });
    if (fs.existsSync(brainDir)) {
      doodle.writeDoodleArtifacts(brainDir, live);
    }
    console.log(doodle.generateDoodleMarkdown(live));
    break;
  }

  case 'handoff': {
    const live = engine.getLiveState();
    const summary = handoff.generateTranscriptHandoff(transcriptPath, conversationId, workspacePath);
    console.log(summary);

    if (fs.existsSync(brainDir)) {
      const handoffPath = path.join(brainDir, 'context_guard_handoff.md');
      fs.writeFileSync(handoffPath, summary, 'utf8');
      console.log(`\n[ContextGuard] Saved continuation handoff to: ${handoffPath}`);
    }
    break;
  }

  case 'history': {
    const hist = engine.getHistory();
    console.log('\n==================================================================');
    console.log('            ContextGuard Persistent Session History               ');
    console.log('==================================================================\n');
    const keys = Object.keys(hist);
    if (keys.length === 0) {
      console.log('No historical session records found.');
    } else {
      console.table(keys.map(k => ({
        SessionID: hist[k].conversationId.substring(0, 18) + '...',
        CurrentUsage: hist[k].currentPct !== null && hist[k].currentPct !== undefined ? `${hist[k].currentPct}%` : 'NO DATA',
        PeakUsage: `${hist[k].peakPct}%`,
        HighestLevel: hist[k].highestLevel,
        LastUpdated: new Date(hist[k].lastUpdated).toLocaleTimeString()
      })));
    }
    break;
  }

  case 'reset': {
    engine.clearHistory();
    console.log('[ContextGuard] History database cleared successfully.');
    break;
  }

  default: {
    console.log(`Unknown command: ${action}. Available: status, refresh, handoff, history, reset`);
  }
}
