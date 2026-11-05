import { SignalingMessage, FirebaseConfig } from '../types';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  Firestore,
  Unsubscribe,
  query,
  limit
} from 'firebase/firestore';

export interface SignalingChannel {
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
  private db: Firestore;
  private roomId: string;
  private localPeerId: string;
  private messageListeners: Set<(message: SignalingMessage) => void> = new Set();
  private unsubs: Unsubscribe[] = [];

  constructor(config: FirebaseConfig, roomId: string, localPeerId?: string) {
    this.roomId = roomId;
    this.localPeerId = localPeerId || '';
    let app: FirebaseApp;
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(config);
    }
    this.db = getFirestore(app);
    this.initListeners();
  }

  private initListeners() {
    // Session coordination messages subcollection (join, offer, answer, leave)
    const messagesCol = collection(this.db, 'blinkdrop_rooms', this.roomId, 'messages');
    const msgQuery = query(messagesCol, limit(50));

    const unsubMessages = onSnapshot(msgQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data() as SignalingMessage;
          // Filter out self-sent messages
          if (msg && msg.senderId !== this.localPeerId) {
            this.messageListeners.forEach((fn) => fn(msg));
          }
        }
      });
    });
    this.unsubs.push(unsubMessages);

    // Candidates subcollection
    const candidatesCol = collection(this.db, 'blinkdrop_rooms', this.roomId, 'candidates');
    const candQuery = query(candidatesCol, limit(100));

    const unsubCandidates = onSnapshot(candQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data() as SignalingMessage;
          if (msg && msg.senderId !== this.localPeerId) {
            this.messageListeners.forEach((fn) => fn(msg));
          }
        }
      });
    });
    this.unsubs.push(unsubCandidates);
  }

  async send(message: SignalingMessage): Promise<void> {
    if (!this.localPeerId) {
      this.localPeerId = message.senderId;
    }

    if (message.type === 'candidate') {
      const candidatesCol = collection(this.db, 'blinkdrop_rooms', this.roomId, 'candidates');
      await addDoc(candidatesCol, message);
    } else {
      const messagesCol = collection(this.db, 'blinkdrop_rooms', this.roomId, 'messages');
      await addDoc(messagesCol, message);
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
