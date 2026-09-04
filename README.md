# ♡ ContextGuard

> Real-time context-window monitor and chalk-doodle telemetry plugin for **Google Antigravity**.

ContextGuard tracks token usage across Antigravity sessions in real-time, displays a persistent in-DOM status badge directly inside the Antigravity UI, warns you before context window exhaustion, and generates structured continuation handoffs.

---

## ✨ Features

- **⚡ Real-Time CDP In-DOM Overlay**: Connects directly to Antigravity's internal Chrome DevTools Protocol (CDP) port. Automatically injects and updates a live \♡ ContextGuard: XX% ([ LEVEL ])\ badge in the bottom-right corner of your Antigravity window.
- **🔄 Instant Tab-Switch Detection**: Hooks into \Page.navigatedWithinDocument\ CDP events to detect Single-Page App (SPA) navigation immediately (O(1) response time) when switching between chat sessions.
- **🎨 Dark Chalk Blackboard Doodle UI**: Minimalist blackboard doodle aesthetic rendered directly in chat artifacts and CLI output.
- **🛡️ 5-Tier Warning Thresholds**:
  - \[ OK ]\ **NORMAL (0–60%)**: \#239B43\ Green — Optimal context state.
  - \[ NOTICE ]\ **NOTICE (60–75%)**: \#FFD600\ Yellow — Moderate context usage.
  - \[ CAUTION ]\ **CAUTION (75–85%)**: \#FF9100\ Orange — Plan your reset.
  - \[ WARNING ]\ **WARNING (85–95%)**: \#FF1744\ Red — Prepare a continuation handoff.
  - \[ CRITICAL ]\ **CRITICAL (95–100%)**: \#FF0235\ Bright Red — Context limit reached.
- **📂 Multi-Tier Transcript Resolution**:
  1. \	ranscript.jsonl\ (Modern Antigravity session log)
  2. \	ranscript_full.jsonl\ (Full untruncated transcript)
  3. \overview.txt\ (Intermediate fallback format)
  4. Encrypted binary archives (\.pb\) detected with clean \[ ENCRYPTED - Usage Unknown ]\ state (no corrupted NaN or false metrics).
- **📊 Calibrated Token Density**: Calibrated at **2.70 Bytes/Token** for Gemini models, matching exact server-side token counts.
- **📋 Continuation Handoffs**: Automatically parses session transcripts to extract active goals, edited files, and subagent state for seamless new chat handoffs.

---

## 📁 Repository Structure

\\\	ext
Context_guard/
├── plugin.json                    # Antigravity plugin manifest
├── hooks.json                     # PreInvocation & PostToolUse lifecycle hooks
├── contextguard-panel.html        # Interactive HTML panel
├── README.md                      # Documentation
└── skills/
    └── contextguard/
        ├── SKILL.md               # Antigravity skill specification
        ├── engine.js              # Token calculation & multi-tier transcript resolver
        ├── cdp-service.js         # Background CDP daemon & in-DOM badge injector
        ├── doodle-ui.js           # Blackboard chalk doodle UI renderer
        ├── contextguard.js        # CLI entry point
        ├── handoff.js             # Session handoff generator
        ├── history.js             # Historical session tracker
        ├── autostart.js           # Silent background daemon launcher
        ├── autostart.ps1          # Windows PowerShell launcher
        ├── ContextGuardBox.ps1    # Native floating WPF doodle HUD overlay
        └── ContextGuardDoodleBox.cs # C# implementation of doodle overlay
\\\

---

## 🚀 Getting Started

### Installation

Clone into your workspace's \.agents/plugins/\ directory:

\\\ash
git clone https://github.com/abhijitsvsk/Context_guard.git .agents/plugins/contextguard
\\\

### Automatic Daemon Launch

ContextGuard includes automatic lifecycle hooks via \hooks.json\. On any agent turn or tool execution, \utostart.js\ checks if the CDP background daemon is running and silently starts it if not:

\\\ash
node skills/contextguard/autostart.js
\\\

### CLI Commands

You can run ContextGuard directly from the terminal:

\\\ash
# Display live chalk doodle telemetry card
node skills/contextguard/contextguard.js status

# Force immediate telemetry refresh
node skills/contextguard/contextguard.js refresh

# Generate a continuation handoff summary for a new chat
node skills/contextguard/contextguard.js handoff

# Display usage history across recent sessions
node skills/contextguard/contextguard.js history

# Reset local history database
node skills/contextguard/contextguard.js reset
\\\

---

## 📜 License

MIT License. Crafted for the Google Antigravity developer ecosystem.
