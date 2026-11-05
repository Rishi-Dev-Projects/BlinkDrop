import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log(`Starting Two-Device E2E WebRTC Verification using: ${CHROME_PATH}`);

async function runTest() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox']
  });

  try {
    const roomId = 'E2E' + Math.floor(100 + Math.random() * 900);
    const roomUrl = `http://127.0.0.1:3000/#${roomId}`;

    console.log(`\n1. Creating Sender (Device 1) in room ${roomId}...`);
    const context = await browser.newContext();
    const page1 = await context.newPage();
    page1.on('console', (msg) => console.log(`[Device 1 Console] ${msg.text()}`));
    page1.on('pageerror', (err) => console.error(`[Device 1 Error]`, err));
    await page1.goto(roomUrl);
    await page1.waitForSelector('text=Peer-to-Peer File Transfer Console');

    console.log(`\n2. Creating Receiver (Device 2) in room ${roomId}...`);
    const page2 = await context.newPage();
    page2.on('console', (msg) => console.log(`[Device 2 Console] ${msg.text()}`));
    page2.on('pageerror', (err) => console.error(`[Device 2 Error]`, err));
    await page2.goto(roomUrl);
    await page2.waitForSelector('text=Peer-to-Peer File Transfer Console');

    console.log('\n3. Waiting for WebRTC DataChannel connection between peers...');
    await Promise.all([
      page1.waitForSelector('text=WebRTC DataChannel Active', { timeout: 15000 }),
      page2.waitForSelector('text=WebRTC DataChannel Active', { timeout: 15000 })
    ]);
    console.log('✓ WebRTC DataChannel successfully established between Device 1 and Device 2!');

    // 4. Create a test payload file on Device 1
    console.log('\n4. Staging a test file on Device 1...');
    const testFilePath = path.resolve('temp_e2e_transfer_sample.txt');
    const sampleContent = 'BlinkDrop P2P Verification Payload: ' + 'X'.repeat(128 * 1024); // 128KB payload
    fs.writeFileSync(testFilePath, sampleContent);

    const fileInput = await page1.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    await page1.waitForSelector('text=temp_e2e_transfer_sample.txt');
    console.log('✓ File staged in queue on Device 1.');

    // 5. Send file from Device 1
    console.log('\n5. Initiating transfer from Device 1...');
    const sendButton = await page1.locator('button:has-text("Send")').first();
    await sendButton.click();

    // 6. Device 2 receives offer and accepts
    console.log('\n6. Device 2 awaiting incoming file offer...');
    const acceptLocator = page2.locator('button:has-text("Accept")').first();
    await acceptLocator.waitFor({ timeout: 10000 });
    console.log('✓ Incoming file offer detected on Device 2. Clicking Accept...');
    await acceptLocator.click();

    // 7. Monitor transfer and verification on both peers
    console.log('\n7. Streaming chunks and verifying delivery confirmation...');
    await Promise.all([
      page1.locator('span', { hasText: 'Verified' }).first().waitFor({ timeout: 15000 }),
      page2.locator('text=Save File').first().waitFor({ timeout: 15000 })
    ]);

    console.log('✓ Sender (Device 1) received peer verification ACK: status is Verified!');
    console.log('✓ Receiver (Device 2) confirmed complete payload reassembly: Save File ready!');

    // Clean up temporary file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }

    console.log('\n=============================================');
    console.log('SUCCESS: Two-Device WebRTC Transfer Verified!');
    console.log('=============================================');
  } finally {
    await browser.close();
  }
}

runTest().catch((err) => {
  console.error('\nE2E Verification Failed:', err);
  process.exit(1);
});
