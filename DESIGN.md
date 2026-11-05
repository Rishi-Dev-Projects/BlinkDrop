# BlinkDrop — Design System & Direction

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2

Reading this as: peer-to-peer file transfer web application for cross-device sharing, in a futuristic technically credible midnight visual foundation with cyan and violet functional accents, dial ENERGY 2 / RHYTHM 2 / MOTION 2.

---

## 1. Product Identity & Purpose

BlinkDrop is a browser-to-browser peer-to-peer file transfer application. It uses WebRTC DataChannels for direct binary payload delivery and lightweight signaling for room rendezvous and ICE exchange. 

The aesthetic is futuristic, interactive, and technically credible. It feels like an operational communication instrument, not a generic marketing SaaS template.

### Anti Slop Commitments
* No fake statistics or simulated transfer rates. All bytes, speeds, and connection latency metrics reflect real browser telemetry.
* No decorative gradients without functional hierarchy.
* No em dashes in copy (R-02 compliance). Colons, commas, or parentheses are used instead.
* No emojis in UI markup or copy. Standardized SVG geometric primitives and icons are used.
* No generic AI card grids or fake terminal windows.
* Glassmorphism is restricted to at most one floating navigation/status header layer (R-10 compliance).
* Actual file transfer payloads never pass through Firebase or signaling servers. Signaling handles session coordination only.

---

## 2. Dials and Aesthetic Parameters

| Parameter | Value | Justification |
| :--- | :--- | :--- |
| **ENERGY** | **2 (Balanced)** | Grounded technical credibility with responsive interactive feedback. |
| **RHYTHM** | **2 (Structured Breaks)** | Unified control console with distinctive pairing radar and transfer telemetry modules. |
| **MOTION** | **2 (Purposeful Transitions)** | State changes (pairing, handshaking, transferring, verification) animate to clarify connection state. Full support for `prefers-reduced-motion`. |

---

## 3. Color Architecture

Every color has a defined semantic role. Palette saturation is calibrated to avoid neon glare and ensure WCAG AA contrast (4.5:1 for standard text, 3:1 for large display elements).

### Core Palette
* **Deep Space Base (`#080C14`):** Main viewport background, grounding the application in a midnight environment.
* **Surface Void (`#0D1322`):** Elevated card and panel backgrounds.
* **Surface Raised (`#141D32`):** Interactive inputs, drop zones, and list items.
* **Borders & Dividers (`#1E2C4A`):** Low-contrast 1px separation lines for crisp mechanical structure.
* **Border Highlight (`#2A3F6C`):** Focus outlines and active card borders.

### Functional Accents
* **Signal Cyan (`#06B6D4` / `#22D3EE`):** Primary action color, active peer connectivity, and verified transfer progress. Contrast ratio against `#080C14` is 7.4:1.
* **Quantum Violet (`#8B5CF6` / `#A78BFA`):** Room identification, cryptographic verification hashes, and secondary device grouping. Contrast ratio against `#080C14` is 6.2:1.
* **Telemetry Slate (`#94A3B8`):** Secondary labels, metadata, and timestamps. Contrast ratio is 5.8:1.
* **Bright Text (`#F8FAFC`):** Primary headings, device names, and critical values. Contrast ratio is 16.2:1.

### Operational Status Tokens
* **Connection Direct (P2P Host/Srflx):** Emerald (`#10B981`)
* **Connection Relayed (TURN Relay):** Amber (`#F59E0B`) with explicit indicator noting relay transit
* **Connection Warning / Disconnected:** Rose (`#F43F5E`)
* **Standby / Scanning:** Cyan Pulse (`#06B6D4`)

---

## 4. Typography Hierarchy

Fonts are chosen for legibility on high-density displays, avoiding generic defaults.

* **Primary Sans (UI & Structure):** `Outfit` or system geometric sans (`system-ui, -apple-system, sans-serif`).
  * Display / Hero Header: 32px to 40px, bold (`font-bold`), letter-spacing tight (`tracking-tight`).
  * Section Headers: 18px to 20px, medium (`font-semibold`).
  * Body & Interactive Labels: 14px to 15px, regular (`font-normal`), line-height relaxed (`leading-normal`).
* **Technical Monospace (Telemetry & Cryptography):** `JetBrains Mono` or system mono (`ui-monospace, monospace`).
  * Applied strictly to numbers, file sizes, transfer speed (KB/s, MB/s), chunk counts, room keys, and verification fingerprints.
  * Size: 12px to 13px, tabular figures (`tabular-nums`).

---

## 5. Layout & Spatial Composition

The interface is structured as a dedicated operational console that scales cleanly from mobile handsets to widescreen monitors.

* **Viewport Strategy:** Uses `min-h-[100dvh]` to avoid mobile address-bar displacement. No fixed `h-screen`.
* **Container Bounds:** `max-w-5xl mx-auto px-4 sm:px-6 py-6`.
* **Zero Horizontal Scroll:** Rigid flex/grid clamping ensures no overflow on viewports down to 320px width.
* **The Three Operational Zones:**
  1. **Session & Discovery Header:** Room code generator, QR code pairing trigger, and signaling status indicator.
  2. **Device Radar & Pairing Stage:** Visualized local peer node and discovered remote peers with real connection state indicators (Searching, Connecting, Connected, Disconnected).
  3. **Transfer Bay & Telemetry Console:** Drag-and-drop file staging area, queue list with MIME-specific metadata, real-time chunk progress bar, instantaneous transfer speed calculation, and peer acknowledgment verification badge.

---

## 6. Interactive States & Resilience (C-4 & R-27)

Every visual component implements complete lifecycle states:

1. **Empty State:** Clean prompt guiding the user to share a room link, scan a QR code, or enter a 6-character room key.
2. **Scanning / Signaling State:** Subtle rhythmic pulse indicating active WebSocket or signaling channel polling.
3. **Connecting State:** Two-stage WebRTC handshake state showing SDP exchange and ICE candidate negotiation.
4. **Active Transfer State:** Real-time chunk streaming with percentage indicator, elapsed time, transfer rate in MB/s, and byte count.
5. **Awaiting Peer Acknowledgment:** Clear intermediate state preventing premature completion display until the recipient confirms complete chunk reassembly.
6. **Error / Interruption State:** Clear inline message detailing the failure reason (e.g., ICE connection lost, recipient canceled, channel closed unexpectedly) with an instant retry action.

---

## 7. Motion & Micro-Interactions

* Motion is functional, not decorative. It guides attention during state transitions.
* Uses standard spring physics: stiffness 120, damping 20.
* **Peer Node Animation:** Gentle orbit pulse while signaling is negotiating. Locks into a stable linked state upon WebRTC channel open.
* **Progress Bar:** Directly driven by `bytesTransferred / totalBytes`. Updates synchronously with DataChannel buffer events without synthetic delays.
* **Accessibility:** All animations strictly respect `@media (prefers-reduced-motion: reduce)` by immediately switching to static state badges.

---

## 8. Decision Justifications (Rule R-31)

| Decision | One-Line Purpose |
| :--- | :--- |
| **Deep Midnight Base** | Provides visual focus for peer nodes and minimizes eye strain in low-light environments. |
| **Signal Cyan Primary** | Delivers 7.4:1 contrast ratio against the dark canvas for critical action triggers. |
| **Quantum Violet Pairing Key** | Visually distinguishes pairing security codes and verification hashes from transfer telemetry. |
| **Tabular Monospace for Stats** | Prevents layout jitter when byte counters and transfer speeds update rapidly. |
| **8px to 12px Border Radius** | Delivers an engineered, technical instrument feel without childlike pill-shaped cards. |
| **Separated Signaling & Data Path**| Ensures user privacy and zero bandwidth consumption on backend servers. |
| **Explicit Relay (TURN) Indicator** | Maintains user trust by honestly disclosing whether traffic is direct P2P or relayed. |
| **Recipient Acknowledgment Gate** | Prevents false success reporting before the receiving device has saved the payload. |

