export type SignalingMode = 'broadcast' | 'firebase';

export type SignalingState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type WebRTCConnectionState =
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'ready'
  | 'disconnected'
  | 'failed';

export type CandidateRouteType = 'unknown' | 'direct' | 'relayed';

export type CameraState =
  | 'requesting_permission'
  | 'initializing'
  | 'ready'
  | 'unavailable'
  | 'denied'
  | 'failed';

export interface ConnectionDiagnostics {
  peerId: string;
  remotePeerId: string | null;
  roomId: string;
  connectionRole: 'offerer' | 'answerer' | 'idle';
  signalingState: string;
  iceGatheringState: string;
  iceConnectionState: string;
  peerConnectionState: string;
  dataChannelReadyState: string;
  dataChannelLabel: string;
  connectionCreatedAt: number | null;
  dataChannelOpenedAt: number | null;
  isReadyToTransfer: boolean;
  signalingMode: SignalingMode;
  routeType: CandidateRouteType;
}

export interface PeerDevice {
  id: string;
  name: string;
  os: string;
  browser: string;
  joinedAt: number;
}

export interface FileTransferItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  direction: 'send' | 'receive';
  status:
    | 'staged'
    | 'awaiting_approval'
    | 'transferring'
    | 'verifying'
    | 'completed'
    | 'rejected'
    | 'cancelled'
    | 'failed';
  bytesTransferred: number;
  speedBps: number;
  file?: File;
  blobUrl?: string;
  errorMessage?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface SignalingMessage {
  type: 'join' | 'join-reply' | 'leave' | 'offer' | 'answer' | 'candidate';
  senderId: string;
  senderDevice?: PeerDevice;
  targetId?: string;
  roomId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  timestamp: number;
}

export type DataChannelControlMessage =
  | {
      type: 'FILE_OFFER';
      fileId: string;
      name: string;
      size: number;
      mimeType: string;
      totalChunks: number;
    }
  | {
      type: 'FILE_ACCEPT';
      fileId: string;
    }
  | {
      type: 'FILE_REJECT';
      fileId: string;
      reason?: string;
    }
  | {
      type: 'FILE_DONE';
      fileId: string;
    }
  | {
      type: 'FILE_ACK';
      fileId: string;
      success: boolean;
      error?: string;
    }
  | {
      type: 'FILE_CANCEL';
      fileId: string;
    };

export interface FirebaseConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}
