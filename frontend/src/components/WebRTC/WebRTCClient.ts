import { Device } from 'mediasoup-client';
import {
  Transport,
  Producer,
  Consumer,
  RtpCapabilities,
} from 'mediasoup-client/lib/types';
import { io, Socket } from 'socket.io-client';
import { Stream } from 'stream';

export interface PeerInfo {
  id: string;
  name: string;
}

export class WebRTCClient {
  private socket: Socket;
  private device: Device;
  private sendTransport?: Transport;
  private recvTransport?: Transport;
  private producers = new Map<string, Producer>();
  private consumers = new Map<string, Consumer>();
  private peerId: string | null = null;
  // Add stream tracking
  private localVideoStream: MediaStream | null = null;
  private localAudioStream: MediaStream | null = null;

  public onPeerJoined?: (peer: PeerInfo) => void;
  public onPeerLeft?: (peerId: string) => void;
  public onNewStream?: (
    peerId: string,
    stream: MediaStream,
    kind: string,
  ) => void;
  public onRecordingStarted?: (recordingId: string, startTime: Date) => void;
  public onRecordingStopped?: (recordingId: string, endTime: Date) => void;
  public onError?: (error: string) => void;
  public onLocalStreamReady?: (
    stream: MediaStream,
    kind: 'video' | 'audio',
  ) => void;
  public onParticipantList?: (participants: PeerInfo[]) => void;
  public onJoined?: (peerId: string) => void;

  constructor(serverUrl: string) {
    console.log('🔗 Connecting to WebRTC server:', serverUrl);
    this.socket = io(`${serverUrl}/webrtc`, {
      transports: ['websocket'],
      timeout: 1000000,
    });
    this.device = new Device();
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('connect', () => {
      console.log('✅ Connected to signaling server');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from signaling server');
    });

    this.socket.on('joined', (data) => {
      // Set peerId immediately to fix race condition
      this.peerId = data.peerId;
      if (this.onJoined) {
        this.onJoined(data.peerId);
      }
      this.handleJoined(data);
    });
    this.socket.on('existingPeers', this.handleExistingPeers.bind(this));
    this.socket.on('peerJoined', this.handlePeerJoined.bind(this));
    this.socket.on('peerLeft', this.handlePeerLeft.bind(this));
    // Add listener for participantList
    this.socket.on('participantList', (data) => {
      if (this.onParticipantList) {
        this.onParticipantList(data.participants);
      }
    });
    this.socket.on('transportCreated', this.handleTransportCreated.bind(this));
    this.socket.on(
      'transportConnected',
      this.handleTransportConnected.bind(this),
    );
    this.socket.on('produced', this.handleProduced.bind(this));
    this.socket.on('newProducer', this.handleNewProducer.bind(this));
    this.socket.on('consumed', this.handleConsumed.bind(this));
    this.socket.on('consumerResumed', this.handleConsumerResumed.bind(this));
    this.socket.on('recordingStarted', this.handleRecordingStarted.bind(this));
    this.socket.on('recordingStopped', this.handleRecordingStopped.bind(this));
    this.socket.on('error', this.handleError.bind(this));
  }

  async joinRoom(roomName: string, peerName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🏠 Joining room:', roomName, 'as', peerName);

      const timeout = setTimeout(() => {
        reject(new Error('Join room timeout - make sure backend is running'));
      }, 1000000);

      this.socket.emit('join', { roomName, peerName });

      this.socket.once('joined', async (data) => {
        clearTimeout(timeout);
        try {
          console.log(' Joined room successfully, loading device capabilities');
          await this.device.load({
            routerRtpCapabilities: data.rtpCapabilities,
          });
          console.log(' Device loaded with RTP capabilities');
          resolve();
        } catch (error) {
          console.error(' Failed to load device:', error);
          reject(error);
        }
      });

      this.socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });
    });
  }

  async enableWebcam(): Promise<MediaStream> {
    try {
      console.log(' Requesting camera access...');

      // Check if we have an existing stream with stopped tracks
      if (this.localVideoStream) {
        const videoTrack = this.localVideoStream.getVideoTracks()[0];
        if (videoTrack && videoTrack.readyState === 'ended') {
          console.log(' Video track was stopped, requesting new stream...');
          this.localVideoStream = null;
        }
      }

      // Request new stream if we don't have one or if tracks are stopped
      if (!this.localVideoStream) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        });
        console.log(' Camera access granted');
        this.localVideoStream = stream;
      } else {
        // Re-enable existing tracks
        const videoTrack = this.localVideoStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = true;
          console.log(' Re-enabled existing video track');
        }
      }

      if (this.onLocalStreamReady) {
        this.onLocalStreamReady(this.localVideoStream, 'video');
      } else {
        console.warn(' onLocalStreamReady callback is not set');
      }

      await this.createSendTransport();
      const videoTrack = this.localVideoStream.getVideoTracks()[0];
      console.log(
        'Video track enabled:',
        videoTrack.enabled,
        'readyState:',
        videoTrack.readyState,
      );

      // Always create a new producer when re-enabling
      console.log(' About to call produce for video track');
      await this.produce(videoTrack, 'video');

      return this.localVideoStream;
    } catch (error) {
      console.error(' Failed to enable webcam:', error);
      throw new Error(`Failed to enable webcam: ${error}`);
    }
  }

  async enableMicrophone(): Promise<MediaStream> {
    try {
      console.log('🎤 [AUDIO DEBUG] Requesting microphone access...');

      // Check if we have an existing stream with stopped tracks
      if (this.localAudioStream) {
        const audioTrack = this.localAudioStream.getAudioTracks()[0];
        if (audioTrack && audioTrack.readyState === 'ended') {
          console.log(
            '🎤 [AUDIO DEBUG] Audio track was stopped, requesting new stream...',
          );
          this.localAudioStream = null;
        }
      }

      // Request new stream if we don't have one or if tracks are stopped
      if (!this.localAudioStream) {
        console.log('🎤 [AUDIO DEBUG] Requesting new audio stream...');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        console.log(
          '🎤 [AUDIO DEBUG] Microphone access granted, stream:',
          stream,
        );
        console.log('🎤 [AUDIO DEBUG] Audio tracks:', stream.getAudioTracks());
        this.localAudioStream = stream;
      } else {
        // Re-enable existing tracks
        const audioTrack = this.localAudioStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          console.log('🎤 [AUDIO DEBUG] Re-enabled existing audio track');
        }
      }

      if (this.onLocalStreamReady) {
        console.log('🎤 [AUDIO DEBUG] Calling onLocalStreamReady for audio');
        this.onLocalStreamReady(this.localAudioStream, 'audio');
      }

      console.log('🎤 [AUDIO DEBUG] Creating send transport...');
      await this.createSendTransport();
      console.log('🎤 [AUDIO DEBUG] Send transport created successfully');

      // Always create a new producer when re-enabling
      console.log('🎤 [AUDIO DEBUG] About to call produce for audio track');
      const audioTrack = this.localAudioStream.getAudioTracks()[0];
      console.log('🎤 [AUDIO DEBUG] Audio track details:', {
        id: audioTrack.id,
        enabled: audioTrack.enabled,
        readyState: audioTrack.readyState,
        muted: audioTrack.muted,
      });

      await this.produce(audioTrack, 'audio');
      console.log('🎤 [AUDIO DEBUG] Audio producer created successfully');

      return this.localAudioStream;
    } catch (error) {
      console.error('🎤 [AUDIO ERROR] Failed to enable microphone:', error);
      console.error('🎤 [AUDIO ERROR] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw new Error(`Failed to enable microphone: ${error}`);
    }
  }

  async disableWebcam(): Promise<void> {
    const videoProducer = Array.from(this.producers.values()).find(
      (p) => p.kind === 'video',
    );

    if (videoProducer) {
      videoProducer.close();
      this.producers.delete(videoProducer.id);
    }

    // Disable the video track instead of stopping it
    if (this.localVideoStream) {
      const videoTrack = this.localVideoStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = false;
        console.log(' Video track disabled (not stopped)');
      }
    }
  }

  async disableMicrophone(): Promise<void> {
    const audioProducer = Array.from(this.producers.values()).find(
      (p) => p.kind === 'audio',
    );

    if (audioProducer) {
      audioProducer.close();
      this.producers.delete(audioProducer.id);
    }

    // Disable the audio track instead of stopping it
    if (this.localAudioStream) {
      const audioTrack = this.localAudioStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
        console.log('🎤 Audio track disabled (not stopped)');
      }
    }
  }

  async startRecording(): Promise<void> {
    console.log(' Starting recording...');
    this.socket.emit('startRecording');
  }

  async stopRecording(recordingId: string): Promise<void> {
    console.log(' Stopping recording...');
    this.socket.emit('stopRecording', { recordingId });
  }

  private async createSendTransport(): Promise<void> {
    console.log(
      ' createSendTransport called, existing transport:',
      !!this.sendTransport,
    );
    if (this.sendTransport) {
      console.log(' Send transport already exists, returning early');
      return;
    }

    return new Promise((resolve, reject) => {
      console.log(' Creating send transport...');

      this.socket.emit('createTransport', {
        peerId: this.peerId,
        direction: 'send',
      });

      this.socket.once('transportCreated', async (data) => {
        try {
          console.log(' Send transport created');
          this.sendTransport = this.device.createSendTransport({
            id: data.transportId,
            iceParameters: data.iceParameters,
            iceCandidates: data.iceCandidates,
            dtlsParameters: data.dtlsParameters,
            iceServers: data.iceServers || [],
          });

          this.sendTransport.on(
            'connect',
            async ({ dtlsParameters }, callback, errback) => {
              try {
                this.socket.emit('connectTransport', {
                  transportId: this.sendTransport!.id,
                  dtlsParameters,
                });

                this.socket.once('transportConnected', () => {
                  callback();
                });
              } catch (error) {
                errback(error as Error);
              }
            },
          );

          this.sendTransport.on(
            'produce',
            async ({ kind, rtpParameters, appData }, callback, errback) => {
              try {
                this.socket.emit('produce', {
                  peerId: this.peerId,
                  transportId: this.sendTransport!.id,
                  kind,
                  rtpParameters,
                  appData,
                });

                this.socket.once('produced', (data) => {
                  callback({ id: data.producerId });
                });
              } catch (error) {
                errback(error as Error);
              }
            },
          );

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async createRecvTransport(): Promise<void> {
    if (this.recvTransport) return;

    return new Promise((resolve, reject) => {
      console.log(' Creating receive transport...');

      this.socket.emit('createTransport', {
        peerId: this.socket.id,
        direction: 'recv',
      });

      this.socket.once('transportCreated', async (data) => {
        try {
          console.log(' Receive transport created');
          this.recvTransport = this.device.createRecvTransport({
            id: data.transportId,
            iceParameters: data.iceParameters,
            iceCandidates: data.iceCandidates,
            dtlsParameters: data.dtlsParameters,
            iceServers: data.iceServers || [],
          });

          this.recvTransport.on(
            'connect',
            async ({ dtlsParameters }, callback, errback) => {
              try {
                this.socket.emit('connectTransport', {
                  transportId: this.recvTransport!.id,
                  dtlsParameters,
                });

                this.socket.once('transportConnected', () => {
                  callback();
                });
              } catch (error) {
                errback(error as Error);
              }
            },
          );

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async produce(
    track: MediaStreamTrack,
    kind: 'audio' | 'video',
  ): Promise<void> {
    console.log(
      `🎬 [PRODUCE DEBUG] produce method called for ${kind}, sendTransport exists:`,
      !!this.sendTransport,
    );
    if (!this.sendTransport) {
      console.error(
        '🎬 [PRODUCE ERROR] Send transport not created for produce',
      );
      throw new Error('Send transport not created');
    }

    // Clean up any existing producers of the same kind
    const existingProducer = Array.from(this.producers.values()).find(
      (p) => p.kind === kind,
    );
    if (existingProducer) {
      console.log(
        `🎬 [PRODUCE DEBUG] Closing existing ${kind} producer:`,
        existingProducer.id,
      );
      existingProducer.close();
      this.producers.delete(existingProducer.id);
    }

    console.log(`🎬 [PRODUCE DEBUG] Starting to produce ${kind}`);
    console.log(`🎬 [PRODUCE DEBUG] Track details:`, {
      id: track.id,
      kind: track.kind,
      enabled: track.enabled,
      readyState: track.readyState,
      muted: track.muted,
    });

    const producer = await this.sendTransport.produce({
      track,
      encodings:
        kind === 'video'
          ? [
              { maxBitrate: 100000 },
              { maxBitrate: 300000 },
              { maxBitrate: 900000 },
            ]
          : undefined,
    });

    this.producers.set(producer.id, producer);
    console.log(`🎬 [PRODUCE DEBUG] ${kind} producer created:`, producer.id);
  }

  private async consume(peerId: string, producerId: string): Promise<void> {
    await this.createRecvTransport();

    console.log(' Starting to consume from peer:', peerId);
    this.socket.emit('consume', {
      peerId: this.socket.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });
  }

  // Socket event handlers
  private handleJoined(data: any): void {
    console.log(' Successfully joined room:', data);
  }

  private handleExistingPeers(data: { peers: PeerInfo[] }): void {
    console.log(' Existing peers:', data.peers);
    data.peers.forEach((peer) => {
      if (this.onPeerJoined) {
        this.onPeerJoined(peer);
      }
    });
  }

  private handlePeerJoined(data: PeerInfo): void {
    console.log(' New peer joined event received by client:', data);
    if (this.onPeerJoined) {
      this.onPeerJoined(data);
    }
  }

  private handlePeerLeft(data: { peerId: string }): void {
    console.log(' Peer left:', data.peerId);
    if (this.onPeerLeft) {
      this.onPeerLeft(data.peerId);
    }
  }

  private handleTransportCreated(data: any): void {
    console.log(' Transport created:', data.transportId);
  }

  private handleTransportConnected(data: any): void {
    console.log(' Transport connected:', data.transportId);
  }

  private handleProduced(data: any): void {
    console.log(' Producer created:', data.producerId);
  }

  private handleNewProducer(data: {
    peerId: string;
    producerId: string;
    kind: string;
  }): void {
    console.log(' New producer from peer:', data);
    this.consume(data.peerId, data.producerId);
  }

  private handleConsumed(data: any): void {
    console.log('🎧 [CONSUME DEBUG] Consumer created:', data);
    const { consumerId, producerId, kind, rtpParameters, peerId } = data;

    console.log('🎧 [CONSUME DEBUG] Peer ID from backend:', peerId);

    this.recvTransport!.consume({
      id: consumerId,
      producerId,
      kind,
      rtpParameters,
    }).then((consumer) => {
      this.consumers.set(consumerId, consumer);

      const stream = new MediaStream([consumer.track]);

      this.socket.emit('resumeConsumer', { consumerId });

      if (this.onNewStream) {
        console.log(
          '🎧 [CONSUME DEBUG] Calling onNewStream with peerId:',
          peerId,
        );
        this.onNewStream(peerId || 'unknown', stream, kind);
      }
    });
  }

  private handleConsumerResumed(data: { consumerId: string }): void {
    console.log(' Consumer resumed:', data.consumerId);
  }

  private handleRecordingStarted(data: {
    recordingId: string;
    startTime: Date;
  }): void {
    console.log(' Recording started:', data);
    if (this.onRecordingStarted) {
      this.onRecordingStarted(data.recordingId, data.startTime);
    }
  }

  private handleRecordingStopped(data: {
    recordingId: string;
    endTime: Date;
  }): void {
    console.log(' Recording stopped:', data);
    if (this.onRecordingStopped) {
      this.onRecordingStopped(data.recordingId, data.endTime);
    }
  }

  private handleError(data: { message: string }): void {
    if (data.message === 'Peer not found') {
      console.warn(' Server warning:', data.message);
      // Optionally, handle cleanup or state update here if needed
      return;
    }
    console.error(' Server error:', data.message);
    if (this.onError) {
      this.onError(data.message);
    }
  }

  disconnect(): void {
    console.log(' Disconnecting WebRTC client...');

    // Close transports
    if (this.sendTransport) {
      this.sendTransport.close();
    }
    if (this.recvTransport) {
      this.recvTransport.close();
    }

    // Disconnect socket
    this.socket.disconnect();
  }
}
