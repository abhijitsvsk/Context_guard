# 🛡️ ContextGuard

> Real-time context-window monitor and dark chalk-doodle telemetry for **Google Antigravity**.

ContextGuard tracks token usage across Antigravity sessions in real time, displays an interactive, draggable chalkboard status badge directly inside the Antigravity UI, warns you before context window exhaustion, and generates structured continuation handoffs with one click.

---

## ✨ Features

- **⚡ Real-Time CDP In-DOM Overlay**: Connects directly to Antigravity's internal Chrome DevTools Protocol (CDP) port. Automatically injects and updates a live `♡ ContextGuard: XX% ([ LEVEL ])` badge into your Antigravity window.
- **🎯 Draggable & Position Persistent**: Freely drag the blackboard badge anywhere on your screen (including title bars, auxiliary panels, or margins with edge protection). Your preferred badge coordinates are remembered across sessions in `context_guard_pos.json`.
- **🔄 Instant Tab-Switch Detection**: Hooks into `Page.navigatedWithinDocument` CDP events to detect Single-Page App (SPA) navigation instantly ($O(1)$ response time) when switching between chat sessions.
- **📋 Non-Destructive Handoff Modal**: Click `[ handoff ]` right from the in-DOM badge to view and copy a structured continuation handoff directly without leaving your chat.
- **🎨 Dark Chalkboard Doodle Aesthetic**: Hand-crafted blackboard chalkboard visual style with chalk doodle typography and vibrant status badges.
- **🛡️ 5-Tier Warning Thresholds**:
  - `[ OK ]` **NORMAL (0–60%)**: `#239B43` Green — Optimal context state.
  - `[ NOTICE ]` **NOTICE (60–75%)**: `#FFD600` Yellow — Moderate context usage.
  - `[ CAUTION ]` **CAUTION (75–85%)**: `#FF9100` Orange — Plan your reset.
  - `[ WARNING ]` **WARNING (85–95%)**: `#FF1744` Red — Prepare a continuation handoff soon.
  - `[ CRITICAL ]` **CRITICAL (95–100%)**: `#FF0235` Bright Red — Context limit reached.
- **📂 Multi-Tier Transcript Resolution**:
  1. `transcript.jsonl` (Active session log)
  2. `transcript_full.jsonl` (Full untruncated transcript)
  3. `overview.txt` (Intermediate fallback)
  4. Encrypted binary archives (`.pb`) detected with clean `[ ENCRYPTED - Usage Unknown ]` state without NaN corruption.
- **📊 Calibrated Token Density**: Calibrated at **2.70 Bytes/Token** for Gemini models, matching exact server-side token counts.
- **🚀 Auto-Start Architecture (Triple-Tier Redundancy)**:
  - **Tier 1: Antigravity Native Sidecar** (`sidecar.json`) — Managed and launched automatically whenever the Antigravity application opens.
  - **Tier 2: Windows Startup Service** (`contextguard-autostart.vbs`) — Persistent background daemon on user login.
  - **Tier 3: Agent Lifecycle Hooks** (`hooks.json`) — Fallback check on `PreInvocation` and `PostToolUse`.

---

## 📁 Repository Structure

```text
Context_guard/
├── plugin.json                     # Antigravity plugin manifest
├── hooks.json                      # PreInvocation & PostToolUse lifecycle hooks
├── contextguard-panel.html         # Interactive HTML widget panel
├── README.md                       # Documentation
└── skills/
    └── contextguard/
        ├── SKILL.md                # Antigravity skill specification
        ├── engine.js               # Token calculation & multi-tier transcript resolver
        ├── cdp-service.js          # Background CDP daemon & in-DOM badge injector
        ├── doodle-ui.js            # Blackboard chalk doodle UI renderer
        ├── contextguard.js         # CLI entry point
        ├── handoff.js              # Session handoff generator
        ├── history.js              # Historical session tracker
        └── autostart.js            # Silent background daemon launcher
```

---

## 🚀 Getting Started

### 1. Installation

Clone into your workspace's `.agents/plugins/` directory:

```bash
git clone https://github.com/abhijitsvsk/Context_guard.git .agents/plugins/contextguard
```

Or install globally into your Antigravity configuration directory:

```bash
git clone https://github.com/abhijitsvsk/Context_guard.git ~/.gemini/config/plugins/contextguard
```

### 2. Native Antigravity Sidecar (Automatic Launch)

To have ContextGuard start automatically every time Antigravity opens:

1. Create `~/.gemini/config/sidecars/contextguard/sidecar.json`:
```json
{
  "description": "ContextGuard real-time context window monitor and in-DOM telemetry daemon",
  "command": "node",
  "args": ["cdp-service.js"],
  "restart_policy": "always",
  "display_name": "ContextGuard"
}
```

2. Copy the service scripts (`cdp-service.js`, `engine.js`, `handoff.js`, `doodle-ui.js`, `history.js`) into `~/.gemini/config/sidecars/contextguard/`.

3. Enable the sidecar in `~/.gemini/config/config.json`:
```json
{
  "sidecars": {
    "contextguard": {
      "enabled": true
    }
  }
}
```

Antigravity will now automatically launch ContextGuard whenever the application opens and restart it if needed.

### 3. CLI Commands & Slash Commands

You can run ContextGuard commands directly from the terminal or chat:

```bash
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
```

---

## 📜 License

MIT License. Crafted for the Google Antigravity developer ecosystem.
