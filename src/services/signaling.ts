import { SignalingMessage, SignalingMode, FirebaseConfig } from '../types';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  Firestore,
  Unsubscribe,
  query,
  limit
} from 'firebase/firestore';

export interface SignalingChannel {
  readonly mode: SignalingMode;
  send(message: SignalingMessage): Promise<void>;
  onMessage(callback: (message: SignalingMessage) => void): () => void;
  close(): void;
}

/**
 * Local BroadcastChannel Signaling
 * Zero-config, zero-dependency native browser channel for immediate testing
 * between multiple tabs or browser windows on the same machine.
 */
export class BroadcastSignalingChannel implements SignalingChannel {
  readonly mode: SignalingMode = 'broadcast';
  private channel: BroadcastChannel | null = null;
  private messageListeners: Set<(message: SignalingMessage) => void> = new Set();
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private roomId: string;
  private channelName: string;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.channelName = `blinkdrop_room_${roomId}`;

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.channelName);
      this.channel.onmessage = (event) => {
        try {
          const msg = event.data as SignalingMessage;
          if (msg && msg.roomId === this.roomId) {
            this.messageListeners.forEach((listener) => listener(msg));
          }
        } catch {
          // ignore corrupted messages
        }
      };
    }

    // localStorage fallback for cross-window events
    this.storageHandler = (event: StorageEvent) => {
      if (event.key === this.channelName && event.newValue) {
        try {
          const msg = JSON.parse(event.newValue) as SignalingMessage;
          if (msg && msg.roomId === this.roomId) {
            this.messageListeners.forEach((listener) => listener(msg));
          }
        } catch {
          // ignore parsing error
        }
      }
    };
    window.addEventListener('storage', this.storageHandler);
  }

  async send(message: SignalingMessage): Promise<void> {
    if (this.channel) {
      this.channel.postMessage(message);
    }
    // Also trigger storage event for cross-browser synchronization
    try {
      localStorage.setItem(this.channelName, JSON.stringify(message));
    } catch {
      // ignore storage quota errors
    }
  }

  onMessage(callback: (message: SignalingMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }
    this.messageListeners.clear();
  }
}

/**
 * Firebase Firestore Signaling
 * Real cross-device / cross-network WebRTC coordination.
 * Strictly exchanges SDP offers, answers, and ICE candidate network coordinates.
 * Never carries file data payloads (integrity rule).
 */
export class FirebaseSignalingChannel implements SignalingChannel {
  readonly mode: SignalingMode = 'firebase';
  private db: Firestore;
  private roomId: string;
  private localPeerId: string;
  private messageListeners: Set<(message: SignalingMessage) => void> = new Set();
  private unsubs: Unsubscribe[] = [];
  private sessionStartTime: number;

  constructor(config: FirebaseConfig, roomId: string, localPeerId?: string) {
    this.roomId = roomId;
    this.localPeerId = localPeerId || '';
    this.sessionStartTime = Date.now() - 15000; // Ignore stale messages older than 15s before joining

    let app: FirebaseApp;
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(config);
    }
    this.db = getFirestore(app);
    this.touchRoomDocument();
    this.initListeners();
  }

  private async touchRoomDocument() {
    try {
      const roomRef = doc(this.db, 'blinkdrop_rooms', this.roomId);
      await setDoc(roomRef, { roomId: this.roomId, updatedAt: Date.now() }, { merge: true });
    } catch (err) {
      console.warn('[FirebaseSignaling] Room touch notice:', err);
    }
  }

  private initListeners() {
    // Session coordination messages subcollection (join, offer, answer, leave)
    const messagesCol = collection(this.db, 'blinkdrop_rooms', this.roomId, 'messages');
    const msgQuery = query(messagesCol, limit(50));

    const unsubMessages = onSnapshot(
      msgQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const msg = change.doc.data() as SignalingMessage;
            // Filter self messages and stale history
            if (msg && msg.senderId !== this.localPeerId && msg.timestamp >= this.sessionStartTime) {
              this.messageListeners.forEach((fn) => fn(msg));
            }
          }
        });
      },
      (err) => {
        console.error('[FirebaseSignaling] Messages listener error:', err);
      }
    );
    this.unsubs.push(unsubMessages);

    // Candidates subcollection
    const candidatesCol = collection(this.db, 'blinkdrop_rooms', this.roomId, 'candidates');
    const candQuery = query(candidatesCol, limit(100));

    const unsubCandidates = onSnapshot(
      candQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const msg = change.doc.data() as SignalingMessage;
            if (msg && msg.senderId !== this.localPeerId && msg.timestamp >= this.sessionStartTime) {
              this.messageListeners.forEach((fn) => fn(msg));
            }
          }
        });
      },
      (err) => {
        console.error('[FirebaseSignaling] Candidates listener error:', err);
      }
    );
    this.unsubs.push(unsubCandidates);
  }

  async send(message: SignalingMessage): Promise<void> {
    if (!this.localPeerId) {
      this.localPeerId = message.senderId;
    }

    // STRICT SANITIZATION:
    // Firestore rejects `undefined` values and non-plain object prototypes (e.g. RTCSessionDescription).
    // Ensure all documents sent to Firestore are plain JSON maps without undefined properties.
    const cleanDoc: Record<string, any> = {
      type: message.type,
      senderId: message.senderId,
      roomId: this.roomId,
      timestamp: message.timestamp || Date.now()
    };

    if (message.targetId) {
      cleanDoc.targetId = String(message.targetId);
    }

    if (message.senderDevice) {
      const dev = message.senderDevice;
      cleanDoc.senderDevice = {
        id: String(dev.id),
        name: String(dev.name),
        os: String(dev.os),
        browser: String(dev.browser),
        joinedAt: Number(dev.joinedAt)
      };
    }

    if (message.sdp) {
      cleanDoc.sdp = {
        type: String(message.sdp.type),
        sdp: String(message.sdp.sdp)
      };
    }

    if (message.candidate) {
      const cand = message.candidate;
      const cleanCandidate: Record<string, any> = {};
      if (cand.candidate !== undefined && cand.candidate !== null) {
        cleanCandidate.candidate = String(cand.candidate);
      }
      if (cand.sdpMid !== undefined && cand.sdpMid !== null) {
        cleanCandidate.sdpMid = String(cand.sdpMid);
      }
      if (cand.sdpMLineIndex !== undefined && cand.sdpMLineIndex !== null) {
        cleanCandidate.sdpMLineIndex = Number(cand.sdpMLineIndex);
      }
      if (cand.usernameFragment !== undefined && cand.usernameFragment !== null) {
        cleanCandidate.usernameFragment = String(cand.usernameFragment);
      }
      cleanDoc.candidate = cleanCandidate;
    }

    try {
      if (message.type === 'candidate') {
        const candidatesCol = collection(this.db, 'blinkdrop_rooms', this.roomId, 'candidates');
        await addDoc(candidatesCol, cleanDoc);
      } else {
        const messagesCol = collection(this.db, 'blinkdrop_rooms', this.roomId, 'messages');
        await addDoc(messagesCol, cleanDoc);
      }
    } catch (err: any) {
      console.error(`[FirebaseSignaling] Failed to send ${message.type}:`, err?.message || err);
      throw err;
    }
  }

  onMessage(callback: (message: SignalingMessage) => void): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  close(): void {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    this.messageListeners.clear();
  }
}
