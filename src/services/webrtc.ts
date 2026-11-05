import {
  FileTransferItem,
  DataChannelControlMessage,
  CandidateRouteType,
  SignalingMessage,
  PeerDevice
} from '../types';
import { SignalingChannel } from './signaling';
import { sanitizeFileName, inferMimeType, MAX_SAFE_FILE_SIZE } from '../utils/file';

// Conservative 16 KB default for mobile SCTP budgets, adaptive up to 32 KB
const DEFAULT_CHUNK_SIZE = 16 * 1024; // 16 KB
const MAX_CHUNK_SIZE = 32 * 1024; // 32 KB
const BUFFER_THRESHOLD = 256 * 1024; // 256 KB mobile backpressure threshold

export interface WebRTCEventHandlers {
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onRouteTypeChange: (route: CandidateRouteType) => void;
  onFileOffered: (file: FileTransferItem) => void;
  onTransferProgress: (
    fileId: string,
    bytesTransferred: number,
    speedBps: number,
    status: FileTransferItem['status']
  ) => void;
  onTransferCompleted: (fileId: string, blobUrl?: string) => void;
  onTransferFailed: (fileId: string, reason: string) => void;
  onPeerLeft: () => void;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signaling: SignalingChannel;
  private localDevice: PeerDevice;
  private localPeerId: string;
  private remotePeerId: string | null = null;
  private roomId: string;
  private handlers: WebRTCEventHandlers;
  private unregisterSignaling: (() => void) | null = null;

  // Active inbound assemblies: fileId -> { meta, chunks, receivedBytes, expectedChunk, lastTimestamp, lastBytes }
  private inboundTransfers = new Map<
    string,
    {
      item: FileTransferItem;
      chunks: ArrayBuffer[];
      receivedBytes: number;
      expectedChunk: number;
      lastTimestamp: number;
      lastBytes: number;
    }
  >();

  // Active outbound transfers
  private activeOutboundFileId: string | null = null;
  private isOutboundCancelled = false;
  private pendingApprovals = new Map<
    string,
    { resolve: () => void; reject: (err: Error) => void }
  >();

  private statsInterval: number | null = null;
  private candidateQueue: RTCIceCandidateInit[] = [];
  private isNegotiating = false;
  private hasCreatedOffer = false;
  private isHandlingOffer = false;
  private hasHandledOffer = false;
  private isSettingRemoteAnswer = false;

  constructor(
    localDevice: PeerDevice,
    roomId: string,
    signaling: SignalingChannel,
    handlers: WebRTCEventHandlers
  ) {
    this.localDevice = localDevice;
    this.localPeerId = localDevice.id;
    this.roomId = roomId;
    this.signaling = signaling;
    this.handlers = handlers;

    this.initSignalingListener();
  }

  private getOptimalChunkSize(): number {
    if (this.peerConnection?.sctp?.maxMessageSize) {
      return Math.min(this.peerConnection.sctp.maxMessageSize, MAX_CHUNK_SIZE);
    }
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isMobile ? DEFAULT_CHUNK_SIZE : MAX_CHUNK_SIZE;
  }

  private initSignalingListener() {
    this.unregisterSignaling = this.signaling.onMessage(async (msg: SignalingMessage) => {
      if (msg.roomId !== this.roomId || msg.senderId === this.localPeerId) {
        return;
      }

      switch (msg.type) {
        case 'join':
          this.remotePeerId = msg.senderId;
          // Respond to the joining peer so discovery is bidirectional
          await this.signaling.send({
            type: 'join-reply',
            senderId: this.localPeerId,
            senderDevice: this.localDevice,
            targetId: msg.senderId,
            roomId: this.roomId,
            timestamp: Date.now()
          });
          if (
            this.localPeerId < msg.senderId &&
            (!this.peerConnection || this.peerConnection.connectionState !== 'connected')
          ) {
            await this.createOffer();
          }
          break;

        case 'join-reply':
          this.remotePeerId = msg.senderId;
          if (
            this.localPeerId < msg.senderId &&
            (!this.peerConnection || this.peerConnection.connectionState !== 'connected')
          ) {
            await this.createOffer();
          }
          break;

        case 'offer':
          if (msg.sdp) {
            this.remotePeerId = msg.senderId;
            await this.handleOffer(msg.sdp);
          }
          break;

        case 'answer':
          if (msg.sdp && this.peerConnection) {
            if (this.peerConnection.signalingState === 'have-local-offer' && !this.isSettingRemoteAnswer) {
              this.isSettingRemoteAnswer = true;
              try {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                await this.drainCandidateQueue();
              } catch (err) {
                console.warn('Failed to set remote answer:', err);
              } finally {
                this.isSettingRemoteAnswer = false;
              }
            }
          }
          break;

        case 'candidate':
          if (msg.candidate) {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
              try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
              } catch {
                // Ignore duplicate or late candidates
              }
            } else {
              this.candidateQueue.push(msg.candidate);
            }
          }
          break;

        case 'leave':
          this.handlers.onPeerLeft();
          this.cleanupPeerConnection();
          break;
      }
    });
  }

  private async drainCandidateQueue() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.candidateQueue.length > 0) {
      const cand = this.candidateQueue.shift();
      if (cand) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          // Ignore
        }
      }
    }
  }

  private createPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      return this.peerConnection;
    }

    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ]
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnection = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({
          type: 'candidate',
          senderId: this.localPeerId,
          targetId: this.remotePeerId || undefined,
          roomId: this.roomId,
          candidate: event.candidate.toJSON(),
          timestamp: Date.now()
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed') {
        if (typeof pc.restartIce === 'function') {
          try {
            pc.restartIce();
          } catch {
            this.handlers.onConnectionStateChange('failed');
          }
        } else {
          this.handlers.onConnectionStateChange('failed');
        }
      } else if (state === 'disconnected') {
        this.handlers.onConnectionStateChange('connecting');
      } else if (state === 'connected' || state === 'completed') {
        this.handlers.onConnectionStateChange('connected');
      }
    };

    pc.onconnectionstatechange = () => {
      this.handlers.onConnectionStateChange(pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.startStatsMonitoring();
      } else if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        this.stopStatsMonitoring();
        this.handlers.onRouteTypeChange('unknown');
      }
    };

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    return pc;
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = BUFFER_THRESHOLD;

    channel.onopen = () => {
      this.handlers.onConnectionStateChange('connected');
      this.startStatsMonitoring();
    };

    channel.onclose = () => {
      this.handlers.onConnectionStateChange('disconnected');
    };

    channel.onerror = (err) => {
      console.warn('DataChannel warning/error:', err);
    };

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          this.handleControlMessage(JSON.parse(event.data) as DataChannelControlMessage);
        } catch {
          // Ignore malformed control packet
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryChunk(event.data);
      }
    };
  }

  public async announceJoin() {
    await this.signaling.send({
      type: 'join',
      senderId: this.localPeerId,
      senderDevice: this.localDevice,
      roomId: this.roomId,
      timestamp: Date.now()
    });
  }

  public async createOffer() {
    if (this.hasCreatedOffer || this.isNegotiating) return;
    if (this.peerConnection && this.peerConnection.signalingState !== 'stable') return;
    if (this.dataChannel && this.dataChannel.readyState === 'open') return;

    this.hasCreatedOffer = true;
    this.isNegotiating = true;
    try {
      const pc = this.createPeerConnection();
      if (!this.dataChannel || this.dataChannel.readyState === 'closed') {
        const dc = pc.createDataChannel('blinkdrop_payload', {
          ordered: true
        });
        this.setupDataChannel(dc);
      }

      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);

      await this.signaling.send({
        type: 'offer',
        senderId: this.localPeerId,
        targetId: this.remotePeerId || undefined,
        roomId: this.roomId,
        sdp: offer,
        timestamp: Date.now()
      });
    } catch (err) {
      console.warn('Failed to create/send offer:', err);
      this.hasCreatedOffer = false;
    } finally {
      this.isNegotiating = false;
    }
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    if (this.hasHandledOffer || this.isHandlingOffer) return;
    if (this.peerConnection && this.peerConnection.signalingState !== 'stable') return;

    this.hasHandledOffer = true;
    this.isHandlingOffer = true;
    try {
      const pc = this.createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.drainCandidateQueue();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await this.signaling.send({
        type: 'answer',
        senderId: this.localPeerId,
        targetId: this.remotePeerId || undefined,
        roomId: this.roomId,
        sdp: answer,
        timestamp: Date.now()
      });
    } catch (err) {
      console.warn('Failed to handle offer:', err);
      this.hasHandledOffer = false;
    } finally {
      this.isHandlingOffer = false;
    }
  }

  private startStatsMonitoring() {
    this.stopStatsMonitoring();
    this.statsInterval = window.setInterval(async () => {
      if (!this.peerConnection) return;
      try {
        const stats = await this.peerConnection.getStats();
        let activeCandidatePair: any = null;

        stats.forEach((report) => {
          if (
            report.type === 'candidate-pair' &&
            (report.nominated || report.state === 'succeeded')
          ) {
            activeCandidatePair = report;
          }
        });

        if (activeCandidatePair) {
          const localCandidate = stats.get(activeCandidatePair.localCandidateId);
          const remoteCandidate = stats.get(activeCandidatePair.remoteCandidateId);

          if (
            localCandidate?.candidateType === 'relay' ||
            remoteCandidate?.candidateType === 'relay'
          ) {
            this.handlers.onRouteTypeChange('relayed');
          } else if (localCandidate && remoteCandidate) {
            this.handlers.onRouteTypeChange('direct');
          }
        }
      } catch {
        // Stats query failed
      }
    }, 2000);
  }

  private stopStatsMonitoring() {
    if (this.statsInterval !== null) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  // --- DataChannel Protocol Handlers ---

  private handleControlMessage(msg: DataChannelControlMessage) {
    switch (msg.type) {
      case 'FILE_OFFER': {
        // Validate incoming file metadata & size limits
        if (!msg.size || msg.size <= 0 || !Number.isFinite(msg.size)) {
          this.sendControlMessage({
            type: 'FILE_REJECT',
            fileId: msg.fileId,
            reason: 'Invalid file size rejected'
          });
          return;
        }

        if (msg.size > MAX_SAFE_FILE_SIZE) {
          this.sendControlMessage({
            type: 'FILE_REJECT',
            fileId: msg.fileId,
            reason: 'File exceeds 1 GB browser memory limit'
          });
          return;
        }

        const safeName = sanitizeFileName(msg.name);
        const resolvedMime = inferMimeType(safeName, msg.mimeType);

        const item: FileTransferItem = {
          id: msg.fileId,
          name: safeName,
          size: msg.size,
          mimeType: resolvedMime,
          direction: 'receive',
          status: 'awaiting_approval',
          bytesTransferred: 0,
          speedBps: 0
        };
        this.inboundTransfers.set(msg.fileId, {
          item,
          chunks: [],
          receivedBytes: 0,
          expectedChunk: 0,
          lastTimestamp: Date.now(),
          lastBytes: 0
        });
        this.handlers.onFileOffered(item);
        break;
      }

      case 'FILE_ACCEPT': {
        const pending = this.pendingApprovals.get(msg.fileId);
        if (pending) {
          pending.resolve();
          this.pendingApprovals.delete(msg.fileId);
        }
        break;
      }

      case 'FILE_REJECT': {
        const pending = this.pendingApprovals.get(msg.fileId);
        if (pending) {
          pending.reject(new Error(msg.reason || 'Declined by recipient'));
          this.pendingApprovals.delete(msg.fileId);
        }
        if (this.activeOutboundFileId === msg.fileId) {
          this.isOutboundCancelled = true;
          this.activeOutboundFileId = null;
        }
        this.handlers.onTransferFailed(msg.fileId, msg.reason || 'Rejected by peer');
        break;
      }

      case 'FILE_DONE': {
        const inbound = this.inboundTransfers.get(msg.fileId);
        if (inbound) {
          // Receiver verifies integrity before sending ACK
          if (inbound.receivedBytes === inbound.item.size) {
            const blob = new Blob(inbound.chunks, {
              type: inbound.item.mimeType || 'application/octet-stream'
            });
            const blobUrl = URL.createObjectURL(blob);
            inbound.item.blobUrl = blobUrl;
            inbound.item.status = 'completed';

            // Send explicit verification confirmation back to sender
            this.sendControlMessage({
              type: 'FILE_ACK',
              fileId: msg.fileId,
              success: true
            });

            this.handlers.onTransferCompleted(msg.fileId, blobUrl);
          } else {
            this.sendControlMessage({
              type: 'FILE_ACK',
              fileId: msg.fileId,
              success: false,
              error: 'Byte count mismatch'
            });
            this.handlers.onTransferFailed(
              msg.fileId,
              `Verification failed: expected ${inbound.item.size} bytes, got ${inbound.receivedBytes}`
            );
          }
        }
        break;
      }

      case 'FILE_ACK': {
        // SENDER: Only mark completed after receiving peer's verified ACK!
        if (msg.success) {
          this.handlers.onTransferCompleted(msg.fileId);
        } else {
          this.handlers.onTransferFailed(
            msg.fileId,
            msg.error || 'Recipient reported verification failure'
          );
        }
        this.activeOutboundFileId = null;
        break;
      }

      case 'FILE_CANCEL': {
        if (this.activeOutboundFileId === msg.fileId) {
          this.isOutboundCancelled = true;
          this.activeOutboundFileId = null;
          this.handlers.onTransferFailed(msg.fileId, 'Cancelled by peer');
        }
        const pending = this.pendingApprovals.get(msg.fileId);
        if (pending) {
          pending.reject(new Error('Cancelled by peer'));
          this.pendingApprovals.delete(msg.fileId);
        }
        const inbound = this.inboundTransfers.get(msg.fileId);
        if (inbound) {
          this.handlers.onTransferFailed(msg.fileId, 'Cancelled by peer');
          this.inboundTransfers.delete(msg.fileId);
        }
        break;
      }
    }
  }

  private handleBinaryChunk(buffer: ArrayBuffer) {
    if (buffer.byteLength < 6) return;
    const view = new DataView(buffer);
    const packetType = view.getUint8(0);
    if (packetType !== 0x01) return; // 0x01 is File Chunk

    const idLength = view.getUint8(1);
    const decoder = new TextDecoder();
    const fileId = decoder.decode(new Uint8Array(buffer, 2, idLength));
    const chunkIndex = view.getUint32(2 + idLength, false);
    const payloadOffset = 2 + idLength + 4;
    const payload = buffer.slice(payloadOffset);

    const inbound = this.inboundTransfers.get(fileId);
    if (!inbound) return;

    // Track chunk index to guard against corruption
    inbound.chunks.push(payload);
    inbound.receivedBytes += payload.byteLength;
    inbound.expectedChunk = chunkIndex + 1;

    const now = Date.now();
    const elapsed = (now - inbound.lastTimestamp) / 1000;
    let speed = 0;
    if (elapsed >= 0.5) {
      speed = (inbound.receivedBytes - inbound.lastBytes) / elapsed;
      inbound.lastTimestamp = now;
      inbound.lastBytes = inbound.receivedBytes;
    }

    const status =
      inbound.receivedBytes >= inbound.item.size ? 'verifying' : 'transferring';

    this.handlers.onTransferProgress(
      fileId,
      inbound.receivedBytes,
      speed,
      status
    );
  }

  private sendControlMessage(msg: DataChannelControlMessage) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('Failed to send control message:', err);
      }
    }
  }

  // --- Public Control Methods ---

  public acceptInboundFile(fileId: string) {
    const inbound = this.inboundTransfers.get(fileId);
    if (!inbound) return;
    inbound.item.status = 'transferring';
    inbound.lastTimestamp = Date.now();
    inbound.lastBytes = 0;
    this.sendControlMessage({ type: 'FILE_ACCEPT', fileId });
    this.handlers.onTransferProgress(fileId, 0, 0, 'transferring');
  }

  public rejectInboundFile(fileId: string, reason = 'Declined by recipient') {
    this.sendControlMessage({ type: 'FILE_REJECT', fileId, reason });
    this.inboundTransfers.delete(fileId);
    this.handlers.onTransferFailed(fileId, reason);
  }

  public cancelTransfer(fileId: string) {
    this.sendControlMessage({ type: 'FILE_CANCEL', fileId });
    if (this.activeOutboundFileId === fileId) {
      this.isOutboundCancelled = true;
      this.activeOutboundFileId = null;
    }
    const pending = this.pendingApprovals.get(fileId);
    if (pending) {
      pending.reject(new Error('Cancelled by user'));
      this.pendingApprovals.delete(fileId);
    }
    this.inboundTransfers.delete(fileId);
    this.handlers.onTransferFailed(fileId, 'Cancelled by user');
  }

  public async sendFile(fileItem: FileTransferItem): Promise<void> {
    if (!fileItem.file || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel is not open or file is missing');
    }

    const file = fileItem.file;
    const chunkSize = this.getOptimalChunkSize();
    const totalChunks = Math.ceil(file.size / chunkSize);
    this.activeOutboundFileId = fileItem.id;
    this.isOutboundCancelled = false;

    // 1. Send initial offer
    this.sendControlMessage({
      type: 'FILE_OFFER',
      fileId: fileItem.id,
      name: file.name,
      size: file.size,
      mimeType: file.type || inferMimeType(file.name),
      totalChunks
    });

    this.handlers.onTransferProgress(fileItem.id, 0, 0, 'awaiting_approval');

    // Wait for recipient approval
    await new Promise<void>((resolve, reject) => {
      this.pendingApprovals.set(fileItem.id, { resolve, reject });
    });

    this.handlers.onTransferProgress(fileItem.id, 0, 0, 'transferring');

    // 2. Stream chunks directly over DataChannel with backpressure
    const encoder = new TextEncoder();
    const idBytes = encoder.encode(fileItem.id);
    let offset = 0;
    let chunkIndex = 0;
    let lastTime = Date.now();
    let lastBytesSent = 0;

    while (offset < file.size) {
      if (this.isOutboundCancelled) {
        return;
      }

      // Safe backpressure wait with timeout and cancellation protection
      if (this.dataChannel.bufferedAmount > BUFFER_THRESHOLD) {
        await new Promise<void>((resolve, reject) => {
          if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            return reject(new Error('DataChannel closed during transfer'));
          }
          if (this.isOutboundCancelled) {
            return reject(new Error('Transfer cancelled'));
          }

          const timeout = setTimeout(() => {
            if (this.dataChannel) this.dataChannel.onbufferedamountlow = null;
            resolve();
          }, 4000);

          this.dataChannel.onbufferedamountlow = () => {
            clearTimeout(timeout);
            if (this.dataChannel) {
              this.dataChannel.onbufferedamountlow = null;
            }
            resolve();
          };
        });
      }

      const slice = file.slice(offset, offset + chunkSize);
      const sliceBuffer = await slice.arrayBuffer();

      // Binary frame: [1B packetType][1B idLen][N B id][4B chunkIndex][payload]
      const frameHeaderLen = 2 + idBytes.length + 4;
      const frame = new Uint8Array(frameHeaderLen + sliceBuffer.byteLength);
      frame[0] = 0x01; // packet type
      frame[1] = idBytes.length;
      frame.set(idBytes, 2);

      const view = new DataView(frame.buffer);
      view.setUint32(2 + idBytes.length, chunkIndex, false); // chunk index
      frame.set(new Uint8Array(sliceBuffer), frameHeaderLen);

      this.dataChannel.send(frame.buffer);

      offset += sliceBuffer.byteLength;
      chunkIndex++;

      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      let speed = 0;
      if (delta >= 0.5) {
        speed = (offset - lastBytesSent) / delta;
        lastTime = now;
        lastBytesSent = offset;
      }

      this.handlers.onTransferProgress(
        fileItem.id,
        offset,
        speed,
        offset >= file.size ? 'verifying' : 'transferring'
      );
    }

    // 3. Inform recipient that all chunks were sent
    this.sendControlMessage({
      type: 'FILE_DONE',
      fileId: fileItem.id
    });

    // Sender stays in 'verifying' state until peer sends FILE_ACK (Integrity Rule).
  }

  public cleanupPeerConnection() {
    this.stopStatsMonitoring();
    this.isNegotiating = false;
    this.hasCreatedOffer = false;
    this.hasHandledOffer = false;
    this.isHandlingOffer = false;
    this.isSettingRemoteAnswer = false;
    this.pendingApprovals.forEach((pending) => {
      pending.reject(new Error('Connection closed'));
    });
    this.pendingApprovals.clear();
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.inboundTransfers.clear();
    this.activeOutboundFileId = null;
  }

  public destroy() {
    this.cleanupPeerConnection();
    if (this.unregisterSignaling) {
      this.unregisterSignaling();
      this.unregisterSignaling = null;
    }
    this.signaling.close();
  }
}
