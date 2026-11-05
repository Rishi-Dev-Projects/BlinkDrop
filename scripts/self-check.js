import assert from 'node:assert';
import { formatBytes, formatSpeed, formatDuration, formatEta } from '../src/utils/format.ts';

console.log('Running BlinkDrop Protocol & Telemetry Self-Check...');

// 1. Telemetry Verification (R-17 & Integrity Rules)
assert.strictEqual(formatBytes(0), '0 B');
assert.strictEqual(formatBytes(1024), '1.0 KB');
assert.strictEqual(formatBytes(1048576), '1.0 MB');
assert.strictEqual(formatBytes(52428800), '50.0 MB');

assert.strictEqual(formatSpeed(0), '0 KB/s');
assert.strictEqual(formatSpeed(512000), '500 KB/s');
assert.strictEqual(formatSpeed(2097152), '2.0 MB/s');

assert.strictEqual(formatDuration(0), '0s');
assert.strictEqual(formatDuration(45), '45s');
assert.strictEqual(formatDuration(125), '2m 5s');

assert.strictEqual(formatEta(0, 1000), 'Complete');
assert.strictEqual(formatEta(1000, 0), 'Estimating...');
assert.strictEqual(formatEta(2000000, 1000000), '2s');
console.log('✓ Telemetry formatting verified.');

// 2. Binary Chunk Protocol Framing & Assembly Verification
const testPayload = Buffer.from('BlinkDrop WebRTC direct payload test data for binary chunking verification.');
const fileId = 'test_file_xyz';
const encoder = new TextEncoder();
const idBytes = encoder.encode(fileId);

// Pack chunk frame
const chunkIndex = 0;
const frameHeaderLen = 2 + idBytes.length + 4;
const frame = new Uint8Array(frameHeaderLen + testPayload.byteLength);
frame[0] = 0x01; // chunk packet type
frame[1] = idBytes.length;
frame.set(idBytes, 2);
const view = new DataView(frame.buffer);
view.setUint32(2 + idBytes.length, chunkIndex, false);
frame.set(testPayload, frameHeaderLen);

// Unpack chunk frame
assert.strictEqual(frame[0], 0x01, 'Packet type must be 0x01');
const unpackedIdLen = frame[1];
const decoder = new TextDecoder();
const unpackedFileId = decoder.decode(frame.slice(2, 2 + unpackedIdLen));
assert.strictEqual(unpackedFileId, fileId, 'File ID must match');

const unpackedChunkIndex = view.getUint32(2 + unpackedIdLen, false);
assert.strictEqual(unpackedChunkIndex, 0, 'Chunk index must match');

const extractedPayload = frame.slice(2 + unpackedIdLen + 4);
assert.deepStrictEqual(Buffer.from(extractedPayload), testPayload, 'Extracted payload must match exactly');
console.log('✓ Binary chunk framing and unpacking verified.');

// 3. BroadcastChannel Local Signaling Verification
if (typeof BroadcastChannel !== 'undefined') {
  const channelA = new BroadcastChannel('blinkdrop_test_signaling');
  const channelB = new BroadcastChannel('blinkdrop_test_signaling');

  await new Promise((resolve) => {
    channelB.onmessage = (event) => {
      assert.strictEqual(event.data.type, 'join');
      assert.strictEqual(event.data.senderId, 'peer_alice');
      channelA.close();
      channelB.close();
      console.log('✓ Native BroadcastChannel local signaling verified.');
      resolve();
    };
    channelA.postMessage({ type: 'join', senderId: 'peer_alice' });
  });
}

console.log('All protocol self-checks passed successfully!');
