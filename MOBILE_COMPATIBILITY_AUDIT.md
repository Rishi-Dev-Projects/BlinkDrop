# BlinkDrop: Mobile Compatibility & Cross-Device Engineering Audit

This audit evaluates BlinkDrop's readiness for reliable cross-device file transfer between Android Chrome (specifically verified against Samsung Galaxy S25 Ultra specifications) and Desktop Chrome.

---

## 1. WebRTC Connection Implementation

* **Current Status:** Basic `RTCPeerConnection` configuration with public STUN servers.
* **Code Reference:** [`src/services/webrtc.ts`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/services/webrtc.ts#L162-L170)
* **Verified Findings:**
  1. **STUN Configuration:** Uses Google STUN servers (`stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`). While functional for local networks or basic NATs, cross-device transfers between mobile cellular networks (4G/5G Carrier-Grade NAT) and home Wi-Fi require reliable candidate gathering and optional TURN relay support.
  2. **DataChannel Configuration:** Channel label `'blinkdrop_payload'` initialized with `{ ordered: true }`.
  3. **No Automatic Reconnection:** If mobile connectivity drops momentarily (e.g., cell tower handover or Wi-Fi to cellular transition), the connection fails permanently without an automatic ICE restart mechanism.

---

## 2. Firebase Signalling Implementation

* **Current Status:** Dual signaling channels: `BroadcastSignalingChannel` (default) and `FirebaseSignalingChannel`.
* **Code Reference:** [`src/services/signaling.ts`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/services/signaling.ts#L25-L178)
* **Verified Findings:**
  1. **BroadcastChannel Cross-Device Limitation:** `BroadcastChannel` is scoped to the browser profile on a single machine. It cannot bridge two physically separate devices (Android Chrome ↔ Desktop Chrome).
  2. **Firebase Message Race Conditions:** In `FirebaseSignalingChannel.send()`, room state updates write `{ lastMessage: message }` to the room document. If an offer and join-reply occur in rapid succession, one message can overwrite the other before `onSnapshot` delivers it.
  3. **Candidate Filtering:** ICE candidates are written to a `candidates` subcollection. Both peers listen to all candidate additions without filtering out their own sent candidates, causing redundant candidate processing.
  4. **Fallback Public Signaling:** Users without a pre-configured Firebase project need an immediate cross-network signaling mechanism or clear guidance for local network testing.

---

## 3. QR Generation and Scanning

* **Current Status:** QR Code generation only; QR code camera scanning is completely absent.
* **Code Reference:** [`src/components/RoomControls.tsx`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/components/RoomControls.tsx#L25-L43)
* **Verified Findings:**
  1. **No QR Camera Scanner:** The application renders a QR code canvas on desktop, but mobile users cannot scan it within BlinkDrop. Users must either manually type the 6-character room key or rely on external camera apps.
  2. **Secure Context Constraint (`window.isSecureContext`):** `navigator.mediaDevices.getUserMedia` is restricted to secure contexts (`https://` or `localhost`). When testing over local Wi-Fi IP (e.g., `http://192.168.1.22:3000`), Android Chrome blocks camera access unless HTTPS is enabled or an adb reverse proxy is active.
  3. **Track Lifecycle:** Any scanner implementation must strictly stop camera tracks (`track.stop()`) on dismissal to prevent continuous battery drain and background camera usage.

---

## 4. File Selection and Transmission

* **Current Status:** Standard HTML `<input type="file" multiple>` with drag-and-drop.
* **Code Reference:** [`src/components/FileStaging.tsx`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/components/FileStaging.tsx#L115-L122)
* **Verified Findings:**
  1. **Missing Input Attributes on Android:** The file input lacks an explicit `accept="*/*"` and explicit mobile trigger styling. Android Chrome gallery pickers can delay or produce generic `application/octet-stream` without proper extensions.
  2. **MIME Type Fallback:** Android camera captures and downloads occasionally return empty `file.type`. The system must infer MIME types from file extensions (e.g., `.jpg`, `.mp4`, `.pdf`).
  3. **No File Size Safety Ceiling:** Users selecting a multi-gigabyte video on mobile could crash the browser tab through memory pressure. A sensible size warning/ceiling and chunked streaming are required.

---

## 5. Binary Chunk Reconstruction

* **Current Status:** Fixed 64 KB chunk size; in-memory accumulation in `ArrayBuffer[]`.
* **Code Reference:** [`src/services/webrtc.ts`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/services/webrtc.ts#L10-L11), [`L430-L466`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/services/webrtc.ts#L430-L466)
* **Verified Findings:**
  1. **Chunk Size Sizing:** Fixed 64 KB chunks can exceed maximum safe SCTP packet budgets on some mobile WebRTC implementations, causing buffer drops. Mobile WebRTC requires adaptive chunking defaulting to 16 KB to 32 KB.
  2. **Memory Accumulation:** The receiver accumulates all incoming chunks in an in-memory array (`inbound.chunks.push(payload)`). For large files on mobile, holding hundreds of megabytes in JavaScript heap risks triggering the Android OS Out-of-Memory (OOM) killer.
  3. **Chunk Sequencing:** Chunks are delivered over ordered channels, but binary frames should explicitly validate chunk indexes against total chunk counts to catch corruptions or missed slices.

---

## 6. Transfer Progress and Completion Handling

* **Current Status:** Real telemetry calculation; two-phase verification with `FILE_ACK`.
* **Code Reference:** [`src/services/webrtc.ts`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/services/webrtc.ts#L368-L415)
* **Verified Findings:**
  1. **Backpressure Throttling:** Sender implements backpressure checking via `bufferedAmountLowThreshold` (512 KB), which is good. However, if the receiver cancels or the channel closes mid-transfer, the sender loop could hang waiting for `onbufferedamountlow`.
  2. **Timeout Handling:** If a peer accepts a file but disconnects before sending `FILE_ACK`, the transfer must gracefully time out and report a disconnection error.

---

## 7. Blob Creation and Download Implementation

* **Current Status:** In-memory `Blob` creation and direct anchor download.
* **Code Reference:** [`src/components/TransferConsole.tsx`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/components/TransferConsole.tsx#L144-L152)
* **Verified Findings:**
  1. **Blob URL Leaks:** `URL.createObjectURL(blob)` is created for received files, but `URL.revokeObjectURL(blobUrl)` is never invoked when transfers are dismissed. This leaks memory on low-RAM mobile devices.
  2. **Android Chrome Download Trigger:** Clicking `<a href={blobUrl} download={name}>` works on modern Android Chrome, but programmatic triggers or fallback direct links are needed when touch events are intercepted.

---

## 8. Responsive Layout and Mobile Interaction

* **Current Status:** Tailwind responsive styling; desktop-oriented spatial layout.
* **Code Reference:** [`src/components/DeviceRadar.tsx`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/components/DeviceRadar.tsx#L25-L35), [`src/components/RoomControls.tsx`](file:///c:/Users/rishi/Desktop/BlinkDrop/src/components/RoomControls.tsx#L82-L160)
* **Verified Findings:**
  1. **Radar Height on Mobile Viewport:** The device radar visual contains decorative fixed-size background circles and large vertical padding. On mobile viewports (e.g. 412px width on Galaxy S25 Ultra), it occupies excessive screen real estate, pushing the transfer console below the fold.
  2. **Tap Target Sizes:** Small secondary controls (e.g., "New Room" and small status pills) are under the recommended 44px minimum tap target for finger touch.
  3. **Mobile Keyboard Inset:** When typing the 6-character room code on mobile, the on-screen keyboard can obscure action buttons without appropriate scrolling margins.

---

## 9. Browser-Specific Assumptions

* **Verified Findings:**
  1. **Desktop-Only Defaults:** Defaults to `BroadcastChannel`, which silently prevents any cross-device interaction between Desktop and Android.
  2. **Insecure Context Rejection:** When accessing via LAN IP (`http://192.168.1.x:3000`), Android Chrome treats the origin as insecure, disabling `navigator.mediaDevices`. BlinkDrop must provide HTTPS support or clear pairing instructions for USB adb reverse and LAN environments.

---

## 10. ICE Candidate and Connection Lifecycle Handling

* **Verified Findings:**
  1. **ICE Gathering Stalling:** Candidate queueing works for early arrivals, but if mobile switches networks (e.g. mobile radio wake-up latency), ICE gathering state changes are not surfaced to the user.
  2. **Cleanup Integrity:** Peer connections must explicitly remove all event listeners and close active media streams on unmount to prevent background battery drain on mobile devices.

