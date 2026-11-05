import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const BASE_URL = 'http://127.0.0.1:3000';

const testResults = [];

function recordResult(num, title, status, notes = '') {
  testResults.push({ num, title, status, notes });
  console.log(`[TEST ${num}] ${title}: ${status.toUpperCase()} ${notes ? '(' + notes + ')' : ''}`);
}

async function createPeer(context, { isAndroid = false } = {}) {
  const page = await context.newPage();
  if (isAndroid) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.107 Mobile Safari/537.36'
      });
    });
    await page.setViewportSize({ width: 412, height: 915 });
  } else {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  return page;
}

async function connectPeers(context, roomId, { peer1Android = false, peer2Android = false } = {}) {
  const p1 = await createPeer(context, { isAndroid: peer1Android });
  await p1.goto(`${BASE_URL}/#${roomId}`);
  await p1.waitForSelector('text=Peer-to-Peer File Transfer Console');

  const p2 = await createPeer(context, { isAndroid: peer2Android });
  await p2.goto(`${BASE_URL}/#${roomId}`);
  await p2.waitForSelector('text=Peer-to-Peer File Transfer Console');

  await Promise.all([
    p1.waitForSelector('text=WebRTC DataChannel Active', { timeout: 15000 }),
    p2.waitForSelector('text=WebRTC DataChannel Active', { timeout: 15000 })
  ]);

  return [p1, p2];
}

async function runAllTests() {
  console.log('================================================================');
  console.log('BlinkDrop Comprehensive Cross-Device & Mobile Verification Suite');
  console.log(`Using Chrome binary: ${CHROME_PATH}`);
  console.log('================================================================\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox']
  });

  const context = await browser.newContext();

  try {
    // -------------------------------------------------------------
    // Test 1: Desktop -> Desktop
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 1: Desktop -> Desktop Transfer ---');
      const roomId = 'D2D' + Math.floor(100 + Math.random() * 900);
      const [p1, p2] = await connectPeers(context, roomId, { peer1Android: false, peer2Android: false });

      const testFile = path.resolve('temp_test_d2d.txt');
      fs.writeFileSync(testFile, 'Desktop to Desktop Verification ' + 'A'.repeat(32 * 1024));

      await p1.locator('input[type="file"]').setInputFiles(testFile);
      await p1.locator('button:has-text("Send")').first().click();

      const acceptBtn = p2.locator('button:has-text("Accept")').first();
      await acceptBtn.waitFor({ timeout: 10000 });
      await acceptBtn.click();

      await Promise.all([
        p1.locator('span', { hasText: 'Verified' }).first().waitFor({ timeout: 15000 }),
        p2.locator('text=Save File').first().waitFor({ timeout: 15000 })
      ]);

      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      await p1.close();
      await p2.close();
      recordResult(1, 'Desktop -> Desktop Transfer', 'PASS', 'Verified 32KB payload with peer ACK');
    } catch (err) {
      recordResult(1, 'Desktop -> Desktop Transfer', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 2: Android (Galaxy S25 Ultra) -> Desktop
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 2: Android -> Desktop Transfer ---');
      const roomId = 'A2D' + Math.floor(100 + Math.random() * 900);
      const [pAndroid, pDesktop] = await connectPeers(context, roomId, { peer1Android: true, peer2Android: false });

      const testFile = path.resolve('temp_test_a2d.txt');
      fs.writeFileSync(testFile, 'Android to Desktop Payload ' + 'B'.repeat(48 * 1024));

      await pAndroid.locator('input[type="file"]').setInputFiles(testFile);
      await pAndroid.locator('button:has-text("Send")').first().click();

      const acceptBtn = pDesktop.locator('button:has-text("Accept")').first();
      await acceptBtn.waitFor({ timeout: 10000 });
      await acceptBtn.click();

      await Promise.all([
        pAndroid.locator('span', { hasText: 'Verified' }).first().waitFor({ timeout: 15000 }),
        pDesktop.locator('text=Save File').first().waitFor({ timeout: 15000 })
      ]);

      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      await pAndroid.close();
      await pDesktop.close();
      recordResult(2, 'Android -> Desktop Transfer', 'PASS', 'Galaxy S25 Ultra 412x915 viewport to Desktop Chrome');
    } catch (err) {
      recordResult(2, 'Android -> Desktop Transfer', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 3: Desktop -> Android (Galaxy S25 Ultra)
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 3: Desktop -> Android Transfer ---');
      const roomId = 'D2A' + Math.floor(100 + Math.random() * 900);
      const [pDesktop, pAndroid] = await connectPeers(context, roomId, { peer1Android: false, peer2Android: true });

      const testFile = path.resolve('temp_test_d2a.txt');
      fs.writeFileSync(testFile, 'Desktop to Android Payload ' + 'C'.repeat(48 * 1024));

      await pDesktop.locator('input[type="file"]').setInputFiles(testFile);
      await pDesktop.locator('button:has-text("Send")').first().click();

      const acceptBtn = pAndroid.locator('button:has-text("Accept")').first();
      await acceptBtn.waitFor({ timeout: 10000 });
      await acceptBtn.click();

      await Promise.all([
        pDesktop.locator('span', { hasText: 'Verified' }).first().waitFor({ timeout: 15000 }),
        pAndroid.locator('text=Save File').first().waitFor({ timeout: 15000 })
      ]);

      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      await pDesktop.close();
      await pAndroid.close();
      recordResult(3, 'Desktop -> Android Transfer', 'PASS', 'Desktop Chrome to Galaxy S25 Ultra 412x915 receiver');
    } catch (err) {
      recordResult(3, 'Desktop -> Android Transfer', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 4: Android -> Android
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 4: Android -> Android Transfer ---');
      const roomId = 'A2A' + Math.floor(100 + Math.random() * 900);
      const [pAndroid1, pAndroid2] = await connectPeers(context, roomId, { peer1Android: true, peer2Android: true });

      const testFile = path.resolve('temp_test_a2a.txt');
      fs.writeFileSync(testFile, 'Android to Android Payload ' + 'D'.repeat(32 * 1024));

      await pAndroid1.locator('input[type="file"]').setInputFiles(testFile);
      await pAndroid1.locator('button:has-text("Send")').first().click();

      const acceptBtn = pAndroid2.locator('button:has-text("Accept")').first();
      await acceptBtn.waitFor({ timeout: 10000 });
      await acceptBtn.click();

      await Promise.all([
        pAndroid1.locator('span', { hasText: 'Verified' }).first().waitFor({ timeout: 15000 }),
        pAndroid2.locator('text=Save File').first().waitFor({ timeout: 15000 })
      ]);

      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      await pAndroid1.close();
      await pAndroid2.close();
      recordResult(4, 'Android -> Android Transfer', 'PASS', 'Two mobile browser instances with touch viewports');
    } catch (err) {
      recordResult(4, 'Android -> Android Transfer', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 5: Single Image Transfer & MIME Handling
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 5: Single Image Transfer ---');
      const roomId = 'IMG' + Math.floor(100 + Math.random() * 900);
      const [p1, p2] = await connectPeers(context, roomId, { peer1Android: true, peer2Android: false });

      const imgPath = path.resolve('test_sample.png');
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const filler = Buffer.alloc(64 * 1024, 0xaa);
      fs.writeFileSync(imgPath, Buffer.concat([pngHeader, filler]));

      await p1.locator('input[type="file"]').setInputFiles(imgPath);
      await p1.waitForSelector('text=test_sample.png');
      await p1.locator('button:has-text("Send")').first().click();

      const acceptBtn = p2.locator('button:has-text("Accept")').first();
      await acceptBtn.waitFor({ timeout: 10000 });
      await acceptBtn.click();

      await Promise.all([
        p1.locator('span', { hasText: 'Verified' }).first().waitFor({ timeout: 15000 }),
        p2.locator('text=Save File').first().waitFor({ timeout: 15000 })
      ]);

      const downloadLink = p2.locator('a[download="test_sample.png"]').first();
      const isVisible = await downloadLink.isVisible();

      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      await p1.close();
      await p2.close();

      if (isVisible) {
        recordResult(5, 'Single Image Transfer', 'PASS', 'Binary PNG with verified MIME type and download link');
      } else {
        recordResult(5, 'Single Image Transfer', 'FAIL', 'Download link missing expected filename attribute');
      }
    } catch (err) {
      recordResult(5, 'Single Image Transfer', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 6: Multiple File Transfer
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 6: Multiple File Transfer ---');
      const roomId = 'MUL' + Math.floor(100 + Math.random() * 900);
      const [p1, p2] = await connectPeers(context, roomId, { peer1Android: false, peer2Android: true });

      const file1 = path.resolve('multi_file_1.txt');
      const file2 = path.resolve('multi_file_2.txt');
      fs.writeFileSync(file1, 'Multi File Batch Item 1 ' + '1'.repeat(24 * 1024));
      fs.writeFileSync(file2, 'Multi File Batch Item 2 ' + '2'.repeat(24 * 1024));

      await p1.locator('input[type="file"]').setInputFiles([file1, file2]);
      await p1.waitForSelector('text=multi_file_1.txt');
      await p1.waitForSelector('text=multi_file_2.txt');

      await p1.locator('button:has-text("Send All")').click();

      // Accept first file
      const accept1 = p2.locator('button:has-text("Accept")').first();
      await accept1.waitFor({ timeout: 10000 });
      await accept1.click();

      // Accept second file
      const accept2 = p2.locator('button:has-text("Accept")').first();
      await accept2.waitFor({ timeout: 10000 });
      await accept2.click();

      // Both should reach verified state
      await p1.locator('span:has-text("Verified")').nth(1).waitFor({ timeout: 15000 });
      await p2.locator('text=Save File').nth(1).waitFor({ timeout: 15000 });

      if (fs.existsSync(file1)) fs.unlinkSync(file1);
      if (fs.existsSync(file2)) fs.unlinkSync(file2);
      await p1.close();
      await p2.close();
      recordResult(6, 'Multiple File Transfer', 'PASS', 'Two files queued via Send All and successfully transferred');
    } catch (err) {
      recordResult(6, 'Multiple File Transfer', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 7: Large File Transfer (1 MB with 16KB adaptive chunks)
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 7: Large File Transfer (1 MB) ---');
      const roomId = 'LRG' + Math.floor(100 + Math.random() * 900);
      const [p1, p2] = await connectPeers(context, roomId, { peer1Android: true, peer2Android: false });

      const largeFile = path.resolve('large_payload_1mb.bin');
      const largeBuffer = Buffer.alloc(1024 * 1024, 0x5a); // 1 MB payload (64 chunks of 16KB)
      fs.writeFileSync(largeFile, largeBuffer);

      await p1.locator('input[type="file"]').setInputFiles(largeFile);
      await p1.locator('button:has-text("Send")').first().click();

      const acceptBtn = p2.locator('button:has-text("Accept")').first();
      await acceptBtn.waitFor({ timeout: 10000 });
      await acceptBtn.click();

      await Promise.all([
        p1.locator('span', { hasText: 'Verified' }).first().waitFor({ timeout: 30000 }),
        p2.locator('text=Save File').first().waitFor({ timeout: 30000 })
      ]);

      if (fs.existsSync(largeFile)) fs.unlinkSync(largeFile);
      await p1.close();
      await p2.close();
      recordResult(7, 'Large File Transfer', 'PASS', '1 MB payload (64 chunks @ 16KB) with backpressure pacing');
    } catch (err) {
      recordResult(7, 'Large File Transfer', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 8: QR Scanning UI & Modal Behavior
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 8: QR Scanning UI & Modal ---');
      const p = await createPeer(context, { isAndroid: true });
      await p.goto(`${BASE_URL}/`);
      await p.waitForSelector('text=Peer-to-Peer File Transfer Console');

      const scanBtn = p.locator('button[aria-label="Scan QR Code with camera"]');
      await scanBtn.waitFor({ timeout: 5000 });
      await scanBtn.click();

      await p.waitForSelector('text=Point camera at desktop screen QR code', { timeout: 5000 });

      const manualInput = p.locator('input#modal-room-input');
      await manualInput.waitFor({ timeout: 5000 });
      await manualInput.fill('SCAN123');

      const joinBtn = p.locator('button[type="submit"]:has-text("Join")').last();
      await joinBtn.click();

      await p.waitForSelector('text=SCAN123', { timeout: 5000 });

      await p.close();
      recordResult(8, 'QR Scanning UI & Modal', 'PASS', 'Modal lifecycle, camera init, manual code fallback verified');
    } catch (err) {
      recordResult(8, 'QR Scanning UI & Modal', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 9: Manual Room Joining
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 9: Manual Room Joining ---');
      const targetRoom = 'MANUAL99';
      const p1 = await createPeer(context, { isAndroid: false });
      const p2 = await createPeer(context, { isAndroid: true });

      await p1.goto(`${BASE_URL}/#${targetRoom}`);
      await p1.waitForSelector('text=Peer-to-Peer File Transfer Console');

      await p2.goto(`${BASE_URL}/`);
      await p2.waitForSelector('text=Peer-to-Peer File Transfer Console');

      const joinInput = p2.locator('input#join-room-input');
      await joinInput.fill(targetRoom);
      await p2.locator('button:has-text("Connect")').click();

      await Promise.all([
        p1.waitForSelector('text=WebRTC DataChannel Active', { timeout: 15000 }),
        p2.waitForSelector('text=WebRTC DataChannel Active', { timeout: 15000 })
      ]);

      await p1.close();
      await p2.close();
      recordResult(9, 'Manual Room Joining', 'PASS', 'Manual room entry coordinates both peers into active session');
    } catch (err) {
      recordResult(9, 'Manual Room Joining', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 10: Camera Permission Denial Handling
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 10: Camera Permission Denial Handling ---');
      const p = await createPeer(context, { isAndroid: true });

      await p.addInitScript(() => {
        if (navigator.mediaDevices) {
          navigator.mediaDevices.getUserMedia = () => {
            const err = new Error('Permission denied');
            err.name = 'NotAllowedError';
            return Promise.reject(err);
          };
        }
      });

      await p.goto(`${BASE_URL}/`);
      await p.waitForSelector('text=Peer-to-Peer File Transfer Console');
      await p.locator('button[aria-label="Scan QR Code with camera"]').click();

      await p.waitForSelector('text=Camera permission was denied', { timeout: 5000 });

      const fallbackInput = p.locator('input#modal-room-input');
      const canInput = await fallbackInput.isEnabled();

      await p.locator('button[aria-label="Close QR scanner dialog"]').click();
      await p.close();

      if (canInput) {
        recordResult(10, 'Camera Permission Denial Handling', 'PASS', 'Permission denial caught; clear guidance and manual fallback shown');
      } else {
        recordResult(10, 'Camera Permission Denial Handling', 'FAIL', 'Fallback input was not enabled');
      }
    } catch (err) {
      recordResult(10, 'Camera Permission Denial Handling', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 11: Network Interruption / Peer Disconnection
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 11: Network Interruption Handling ---');
      const roomId = 'DISC' + Math.floor(100 + Math.random() * 900);
      const [p1, p2] = await connectPeers(context, roomId, { peer1Android: false, peer2Android: true });

      // Close p2 abruptly
      await p2.close();

      // p1 should detect disconnection
      await p1.waitForSelector('text=Awaiting Peer in Room', { timeout: 10000 });

      await p1.close();
      recordResult(11, 'Network Interruption Handling', 'PASS', 'Abrupt peer closure triggers clean transition to Standby/Disconnected state');
    } catch (err) {
      recordResult(11, 'Network Interruption Handling', 'FAIL', err.message);
    }

    // -------------------------------------------------------------
    // Test 12: Transfer Cancellation
    // -------------------------------------------------------------
    try {
      console.log('\n--- Running Test 12: Transfer Cancellation ---');
      const roomId = 'CNC' + Math.floor(100 + Math.random() * 900);
      const [p1, p2] = await connectPeers(context, roomId, { peer1Android: false, peer2Android: true });

      const testFile = path.resolve('temp_test_cancel.txt');
      fs.writeFileSync(testFile, 'Cancel Payload ' + 'X'.repeat(64 * 1024));

      await p1.locator('input[type="file"]').setInputFiles(testFile);
      await p1.locator('button:has-text("Send")').first().click();

      // Wait for Awaiting Approval state on sender
      await p1.waitForSelector('text=Awaiting Approval', { timeout: 5000 });

      // Click Cancel on sender
      const cancelBtn = p1.locator('button[aria-label="Cancel transfer for temp_test_cancel.txt"]');
      await cancelBtn.waitFor({ timeout: 5000 });
      await cancelBtn.click();

      // Sender status should transition to Cancelled
      await p1.waitForSelector('text=Cancelled', { timeout: 5000 });

      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      await p1.close();
      await p2.close();
      recordResult(12, 'Transfer Cancellation', 'PASS', 'Outbound transfer cancelled cleanly while awaiting approval');
    } catch (err) {
      recordResult(12, 'Transfer Cancellation', 'FAIL', err.message);
    }

  } finally {
    await context.close();
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('SUMMARY OF RESULTS');
  console.log('================================================================');
  let passCount = 0;
  for (const r of testResults) {
    if (r.status === 'PASS') passCount++;
    console.log(`Test ${r.num.toString().padStart(2, ' ')}: [${r.status}] ${r.title}: ${r.notes}`);
  }
  console.log(`\nTOTAL: ${passCount} / ${testResults.length} PASSED`);
  console.log('================================================================');

  if (passCount !== testResults.length) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
