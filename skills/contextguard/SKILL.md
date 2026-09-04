---
name: contextguard
description: >-
  Global context-window monitor and doodle-styled continuation handoff tool for Google Antigravity.
  Provides `/contextguard status`, `/contextguard refresh`, `/contextguard handoff`, and `/contextguard history`
  to check context usage with a black doodle UI, trigger manual telemetry refresh, or prepare a continuation handoff.
---

# ContextGuard ~ Native Antigravity Plugin

ContextGuard continuously monitors your active conversation's context window telemetry using a Dark Blackboard Chalk Doodle UI with 5 warning levels:

- **NORMAL (0–60%)**: `#239B43` Green (`[ OK ]`)
- **NOTICE (60–75%)**: `#FFD600` Yellow (`[ NOTICE ]`)
- **CAUTION (75–85%)**: `#FF9100` Orange (`[ CAUTION ]`)
- **WARNING (85–95%)**: `#FF1744` Red (`[ WARNING ]`)
- **CRITICAL (95–100%)**: `#FF0235` Bright Red (`[ CRITICAL ]`)

---

## Active Tab Switch Detection Architecture

- **Primary Mode (`CDP_ACTIVE`)**: Dynamically discovers Antigravity's local Chrome DevTools Protocol (CDP) port on launch, connects a background WebSocket to the `type: "page"` target, enables `Page.enable`, and listens for `Page.navigatedWithinDocument` SPA routing events (`/c/<session-id>`). Upon tab switch, context telemetry is updated instantly without waiting for the 1-second timer tick.
- **Fallback Mode (`TITLE_MTIME_FALLBACK`)**: If CDP WebSocket connection fails or debug endpoints are disabled, ContextGuard falls back to IDE window title changes and log `mtime` scanning.
- **Manual Refresh**: Use `/contextguard refresh` or click the `[🔄 refresh...]` button on the widget for an instant manual telemetry scan.

---

## Slash Commands

- `/contextguard status`: Displays the live Dark Blackboard Chalk Doodle status card in the active chat.
- `/contextguard refresh`: Triggers an immediate telemetry scan across active conversation logs.
- `/contextguard handoff`: Generates and copies a ready-to-use continuation handoff summary.
- `/contextguard history`: Displays context usage history across recent sessions.
