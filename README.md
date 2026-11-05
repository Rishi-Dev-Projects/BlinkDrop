# BlinkDrop: Direct Peer-to-Peer File Transfer

BlinkDrop is a browser-to-browser file transfer application built with WebRTC DataChannels. Binary file payloads stream directly between connected devices without passing through or storing on intermediary cloud servers.

## Key Architecture & Features

* **Direct WebRTC DataChannel Streaming:** Files are sliced into adaptive binary frames (16 KB for mobile devices, up to 32 KB on desktop) and transferred directly between peers over SCTP.
* **Backpressure Management:** Monitors buffer backpressure (`bufferedAmountLowThreshold` at 256 KB) with asynchronous throttling to prevent dropped frames or memory exhaustion on mobile receivers.
* **Camera QR Code Pairing & Scanner:** Built-in mobile camera scanner using native `BarcodeDetector` with `jsQR` canvas fallback, strict media track lifecycle management (`track.stop()`), permission error guidance, and manual room code fallback.
* **Dual Signaling Layer:**
  * **Local BroadcastChannel (Zero Config):** Immediate testing across browser tabs or windows on the same machine without external cloud setup.
  * **Firebase Firestore (Cross-Device & WAN):** Reliable cross-network session coordination (SDP offer/answer and ICE candidate exchange) with subcollection message isolation and sender ID filtering. Actual file payloads are strictly prohibited from touching Firebase.
* **Product Integrity Guarantees:**
  * **Real Telemetry:** Transfer speed and progress are calculated strictly from actual received byte deltas and timestamps. Zero simulated numbers.
  * **Two-Phase Transfer Verification:** Recipient validates the full received byte count against the offer specification before sending an explicit verification acknowledgment (`FILE_ACK`). Senders only display a verified complete state upon receiving this confirmation.
  * **Transparent Connection Route:** Actively inspects WebRTC candidate pairs (`getStats()`) to disclose whether the active route is Direct P2P (Host / Srflx) or Relayed (TURN).
* **Anti Slop Compliance:** Designed strictly according to the Anti Slop system rules, including zero em dashes, zero decorative AI card grids, zero emojis, full keyboard navigation, WCAG AA contrast standards, and responsive mobile layout (`min-h-[100dvh]`).

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your desktop browser.

### 3. Build for Production
```bash
npm run build
```

---

## Cross-Device Testing: Android Chrome & Desktop Chrome

### Method A: Local USB Cable with ADB (Recommended for Testing)
Testing between desktop and an Android device (e.g., Samsung Galaxy S25 Ultra) on `localhost`:

1. Connect your Android phone to your PC via USB with USB Debugging enabled.
2. Run port forwarding with the Android SDK platform tools:
   ```bash
   adb reverse tcp:3000 tcp:3000
   ```
3. Start the dev server on your desktop:
   ```bash
   npm run dev
   ```
4. On your Android phone, open Chrome and navigate to `http://localhost:3000`.
   * Because `localhost` is treated as a Secure Context by Android Chrome, camera QR scanning and full WebRTC APIs work out of the box.

### Method B: Local Network (Wi-Fi) with HTTPS
To access BlinkDrop from mobile devices over Wi-Fi, run the development server with basic SSL enabled:

```bash
npm run dev -- --https --host 0.0.0.0 --port 3000
```
Open `https://<YOUR_LOCAL_IP>:3000` on your mobile browser (accept the local self-signed certificate warning). Camera QR scanning requires HTTPS when accessed over a LAN IP address.

### Method C: Cross-Network WAN (Different Wi-Fi or Cellular 5G)
When connecting two devices across separate networks:
1. Click the settings icon in the top right header.
2. Select **Firebase Cloud** signaling mode.
3. Enter your Firebase API Key and Project ID (or provide them via `.env`).
4. Generate a room on Device 1, then scan the QR code or enter the 6-character room code on Device 2.

---

## Running Automated Verification

### 1. Protocol & Telemetry Self-Check
Runs telemetry math assertions, binary framing checks, and signaling routing:
```bash
node --experimental-strip-types scripts/self-check.js
```

### 2. Comprehensive 12-Test Cross-Device Suite
Executes end-to-end browser automation covering all 12 mobile and desktop interoperability scenarios:
```bash
node scripts/verify-mobile-and-cross-device.mjs
```
Verified scenarios:
1. Desktop to Desktop transfer
2. Android (Galaxy S25 Ultra) to Desktop transfer
3. Desktop to Android (Galaxy S25 Ultra) transfer
4. Android to Android transfer
5. Single image transfer with MIME detection
6. Multiple file batch transfer via Send All
7. Large file transfer (1 MB with 16 KB chunks)
8. QR scanner UI and manual fallback
9. Manual room code joining
10. Camera permission denial error handling
11. Network interruption handling
12. Transfer cancellation

---

## Production Deployment Instructions

### Option 1: Vercel (Recommended)
1. Install the Vercel CLI or link via GitHub repository:
   ```bash
   npm install -g vercel
   vercel
   ```
2. Build Settings:
   * **Framework Preset:** Vite
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
3. Environment Variables:
   * `VITE_FIREBASE_API_KEY`: Your Firebase Web API key (optional, for default cloud signaling).
   * `VITE_FIREBASE_PROJECT_ID`: Your Firebase Project ID.
   * `VITE_FIREBASE_APP_ID`: Your Firebase App ID.

### Option 2: Firebase Hosting
1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Deploy using Firebase CLI:
   ```bash
   firebase deploy --only hosting
   ```
3. Deploy Firestore Security Rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Option 3: Static Web Server (Nginx / Caddy / Cloudflare Pages)
Upload the contents of the `dist/` directory to any static web host with HTTPS enabled. Ensure your server configuration serves `index.html` for single-page application routing.
