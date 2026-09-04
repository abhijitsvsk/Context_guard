const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(__dirname, 'data');
const LIVE_JSON_PATH = path.join(CONFIG_DIR, 'context_guard_live.json');
const HISTORY_JSON_PATH = path.join(CONFIG_DIR, 'context_guard_history.json');

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function getThresholdInfo(pct, precision = '') {
  if (precision === 'legacy_encrypted_pb') {
    return {
      level: 'UNKNOWN',
      badge: '[ ENCRYPTED - Usage Unknown ]',
      colorName: 'Muted Purple',
      hex: '#8B5CF6',
      advice: 'Legacy pre-May 2026 session stored as an encrypted binary archive (.pb). Plaintext telemetry is unavailable.'
    };
  } else if (pct === null || pct === undefined) {
    return {
      level: 'NO_DATA',
      badge: '[ NO DATA ]',
      colorName: 'Slate Gray',
      hex: '#64748B',
      advice: 'No transcript logs found for this session.'
    };
  } else if (pct >= 95) {
    return {
      level: 'CRITICAL',
      badge: '[ CRITICAL - Context Limit Reached ]',
      colorName: 'Red',
      hex: '#FF0235',
      advice: 'Strongly recommend starting a new chat session immediately.'
    };
  } else if (pct >= 85) {
    return {
      level: 'WARNING',
      badge: '[ WARNING - New Chat Recommended ]',
      colorName: 'Red',
      hex: '#FF1744',
      advice: 'Context usage high. Prepare a continuation handoff soon.'
    };
  } else if (pct >= 75) {
    return {
      level: 'CAUTION',
      badge: '[ CAUTION - Plan Reset ]',
      colorName: 'Orange',
      hex: '#FF9100',
      advice: 'Context reaching 75%. Plan your conversation handoff.'
    };
  } else if (pct >= 60) {
    return {
      level: 'NOTICE',
      badge: '[ NOTICE ]',
      colorName: 'Yellow',
      hex: '#FFD600',
      advice: 'Moderate context usage.'
    };
  } else {
    return {
      level: 'NORMAL',
      badge: '[ OK ]',
      colorName: 'Forest Neon Green',
      hex: '#239B43', // #1B5E20 base with neon touch
      advice: 'Optimal context usage.'
    };
  }
}

function resolveTranscriptFile(brainDir, primaryPath) {
  // 1. Primary path if explicitly provided (e.g. from telemetry / agent state)
  if (primaryPath && fs.existsSync(primaryPath)) {
    try {
      const stats = fs.statSync(primaryPath);
      if (stats.size > 0) return { path: primaryPath, type: 'transcript.jsonl', size: stats.size };
    } catch (e) {}
  }
  
  if (brainDir && fs.existsSync(brainDir)) {
    // 2. Modern JSONL transcript in .system_generated/logs/
    const jsonl = path.join(brainDir, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(jsonl)) {
      try {
        const stats = fs.statSync(jsonl);
        if (stats.size > 0) return { path: jsonl, type: 'transcript.jsonl', size: stats.size };
      } catch (e) {}
    }

    // 3. Modern full JSONL transcript in .system_generated/logs/
    const fullJsonl = path.join(brainDir, '.system_generated', 'logs', 'transcript_full.jsonl');
    if (fs.existsSync(fullJsonl)) {
      try {
        const stats = fs.statSync(fullJsonl);
        if (stats.size > 0) return { path: fullJsonl, type: 'transcript_full.jsonl', size: stats.size };
      } catch (e) {}
    }

    // 4. Intermediate overview.txt in .system_generated/logs/
    const logsOverview = path.join(brainDir, '.system_generated', 'logs', 'overview.txt');
    if (fs.existsSync(logsOverview)) {
      try {
        const stats = fs.statSync(logsOverview);
        if (stats.size > 0) return { path: logsOverview, type: 'overview.txt', size: stats.size };
      } catch (e) {}
    }

    // 5. Intermediate overview.txt in brainDir root
    const rootOverview = path.join(brainDir, 'overview.txt');
    if (fs.existsSync(rootOverview)) {
      try {
        const stats = fs.statSync(rootOverview);
        if (stats.size > 0) return { path: rootOverview, type: 'overview.txt', size: stats.size };
      } catch (e) {}
    }

    // 6. Absolute last resort: Legacy encrypted conversation archives (.pb)
    const conversationId = path.basename(brainDir);
    const antigravityDir = path.dirname(path.dirname(brainDir));
    const conversationsDir = path.join(antigravityDir, 'conversations');

    const convPb = path.join(conversationsDir, `${conversationId}.pb`);
    if (fs.existsSync(convPb)) {
      try {
        const stats = fs.statSync(convPb);
        if (stats.size > 0) return { path: convPb, type: 'conversation.pb', size: stats.size };
      } catch (e) {}
    }
  }

  return null;
}

function calculateTokensFromTranscript(transcriptPath, brainDir) {
  const resolved = resolveTranscriptFile(brainDir, transcriptPath);
  if (!resolved) {
    return { tokens: null, precision: 'no_data', hasData: false };
  }

  if (resolved.type === 'conversation.pb') {
    // Encrypted binary archive: ciphertext bytes have no mathematical relationship to token count
    return { tokens: null, precision: 'legacy_encrypted_pb', hasData: false, isEncrypted: true };
  }

  try {
    const BYTES_PER_TOKEN = 2.70; // Empirically calibrated conservative density constant
    const estimatedTokens = Math.round(resolved.size / BYTES_PER_TOKEN);
    return { tokens: estimatedTokens, precision: `Transcript (${resolved.type})`, hasData: true };
  } catch (e) {
    return { tokens: null, precision: 'unavailable', hasData: false };
  }
}

function updateChatState(conversationId, workspacePath, inputMetrics = {}) {
  const maxContext = 1048576;
  const brainDir = conversationId ? path.join(os.homedir(), '.gemini', 'antigravity', 'brain', conversationId) : null;
  
  let tokens = inputMetrics.tokens !== undefined ? inputMetrics.tokens : null;
  let precision = inputMetrics.precision || 'unavailable';
  let hasData = true;

  if (tokens === null && (inputMetrics.transcriptPath || brainDir)) {
    const res = calculateTokensFromTranscript(inputMetrics.transcriptPath, brainDir);
    tokens = res.tokens;
    precision = res.precision;
    hasData = res.hasData;
  }

  let pct = null;
  let remaining = null;
  
  if (hasData && tokens !== null) {
    pct = Math.min(100, Math.round((tokens / maxContext) * 100));
    remaining = Math.max(0, maxContext - tokens);
  }

  const threshold = getThresholdInfo(pct, precision);

  const liveState = {
    conversationId: conversationId || 'active_session',
    timestamp: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    maxContext: maxContext,
    percentageUsed: pct,
    tokensUsed: tokens,
    remainingTokens: remaining,
    precision: precision,
    level: threshold.level,
    badge: threshold.badge,
    colorName: threshold.colorName,
    hexColor: threshold.hex,
    advice: threshold.advice,
    hasData: hasData,
    isEncrypted: precision === 'legacy_encrypted_pb'
  };

  const tmpPath = LIVE_JSON_PATH + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(liveState, null, 2), 'utf8');
    if (fs.existsSync(LIVE_JSON_PATH)) {
      fs.unlinkSync(LIVE_JSON_PATH);
    }
    fs.renameSync(tmpPath, LIVE_JSON_PATH);
  } catch (err) {
    try { fs.writeFileSync(LIVE_JSON_PATH, JSON.stringify(liveState, null, 2), 'utf8'); } catch (e) {}
  }

  let history = {};
  if (fs.existsSync(HISTORY_JSON_PATH)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_JSON_PATH, 'utf8'));
    } catch (e) { history = {}; }
  }

  const key = conversationId || 'active_session';
  const existing = history[key] || { peakPct: 0, peakTokens: 0, peakTime: new Date().toISOString(), highestLevel: 'NORMAL' };

  let validPct = (pct !== null && pct !== undefined) ? pct : 0;
  let peakPct = Math.max(existing.peakPct || 0, validPct);
  let peakTokens = Math.max(existing.peakTokens || 0, tokens);
  let peakTime = (validPct >= (existing.peakPct || 0)) ? new Date().toISOString() : existing.peakTime;

  history[key] = {
    conversationId: key,
    workspacePath: workspacePath || process.cwd(),
    currentPct: pct,
    currentTokens: tokens,
    peakPct: peakPct,
    peakTokens: peakTokens,
    peakTime: peakTime,
    highestLevel: threshold.level,
    lastUpdated: new Date().toISOString()
  };

  try {
    fs.writeFileSync(HISTORY_JSON_PATH, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {}

  return liveState;
}

function getLiveState() {
  if (fs.existsSync(LIVE_JSON_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LIVE_JSON_PATH, 'utf8'));
    } catch (e) {}
  }
  return {
    conversationId: 'active_session',
    percentageUsed: 0,
    tokensUsed: 0,
    maxContext: 1048576,
    remainingTokens: 1048576,
    precision: 'unavailable',
    level: 'NORMAL',
    badge: '[ OK ]',
    hexColor: '#239B43',
    advice: 'Telemetry initialising...',
    updatedAt: new Date().toISOString()
  };
}

function getHistory() {
  if (fs.existsSync(HISTORY_JSON_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(HISTORY_JSON_PATH, 'utf8'));
    } catch (e) {}
  }
  return {};
}

function clearHistory() {
  if (fs.existsSync(HISTORY_JSON_PATH)) {
    fs.unlinkSync(HISTORY_JSON_PATH);
  }
  return true;
}

module.exports = {
  getThresholdInfo,
  updateChatState,
  getLiveState,
  getHistory,
  clearHistory,
  calculateTokensFromTranscript
};
