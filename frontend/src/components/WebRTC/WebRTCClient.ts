import { Device } from 'mediasoup-client';
import {
  Transport,
  Producer,
  Consumer,
  RtpCapabilities,
} from 'mediasoup-client/lib/types';
import { io, Socket } from 'socket.io-client';

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

  constructor(serverUrl: string) {
    console.log('🔗 Connecting to WebRTC server:', serverUrl);
    this.socket = io(`${serverUrl}/webrtc`, {
      transports: ['websocket'],
      timeout: 10000,
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

    this.socket.on('joined', this.handleJoined.bind(this));
    this.socket.on('existingPeers', this.handleExistingPeers.bind(this));
    this.socket.on('peerJoined', this.handlePeerJoined.bind(this));
    this.socket.on('peerLeft', this.handlePeerLeft.bind(this));
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
      }, 10000);

      this.socket.emit('join', { roomName, peerName });

      this.socket.once('joined', async (data) => {
        clearTimeout(timeout);
        try {
          console.log(
            '✅ Joined room successfully, loading device capabilities',
          );
          await this.device.load({
            routerRtpCapabilities: data.rtpCapabilities,
          });
          console.log('✅ Device loaded with RTP capabilities');
          resolve();
        } catch (error) {
          console.error('❌ Failed to load device:', error);
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
      console.log('📹 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      console.log('✅ Camera access granted');

      if (this.onLocalStreamReady) {
        this.onLocalStreamReady(stream, 'video');
      }

      await this.createSendTransport();
      await this.produce(stream.getVideoTracks()[0], 'video');

      return stream;
    } catch (error) {
      console.error('❌ Failed to enable webcam:', error);
      throw new Error(`Failed to enable webcam: ${error}`);
    }
  }

  async enableMicrophone(): Promise<MediaStream> {
    try {
      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log('✅ Microphone access granted');

      if (this.onLocalStreamReady) {
        this.onLocalStreamReady(stream, 'audio');
      }

      await this.createSendTransport();
      await this.produce(stream.getAudioTracks()[0], 'audio');

      return stream;
    } catch (error) {
      console.error('❌ Failed to enable microphone:', error);
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
  }

  async disableMicrophone(): Promise<void> {
    const audioProducer = Array.from(this.producers.values()).find(
      (p) => p.kind === 'audio',
    );

    if (audioProducer) {
      audioProducer.close();
      this.producers.delete(audioProducer.id);
    }
  }

  async startRecording(): Promise<void> {
    console.log('🔴 Starting recording...');
    this.socket.emit('startRecording');
  }

  async stopRecording(recordingId: string): Promise<void> {
    console.log('⏹️ Stopping recording...');
    this.socket.emit('stopRecording', { recordingId });
  }

  private async createSendTransport(): Promise<void> {
    if (this.sendTransport) return;

    return new Promise((resolve, reject) => {
      console.log('🚀 Creating send transport...');

      this.socket.emit('createTransport', {
        peerId: this.socket.id,
        direction: 'send',
      });

      this.socket.once('transportCreated', async (data) => {
        try {
          console.log('✅ Send transport created');
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
                  peerId: this.socket.id,
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
      console.log('📡 Creating receive transport...');

      this.socket.emit('createTransport', {
        peerId: this.socket.id,
        direction: 'recv',
      });

      this.socket.once('transportCreated', async (data) => {
        try {
          console.log('✅ Receive transport created');
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
    if (!this.sendTransport) {
      throw new Error('Send transport not created');
    }

    console.log(`🎬 Starting to produce ${kind}`);
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
    console.log(`✅ ${kind} producer created:`, producer.id);
  }

  private async consume(peerId: string, producerId: string): Promise<void> {
    await this.createRecvTransport();

    console.log('🎬 Starting to consume from peer:', peerId);
    this.socket.emit('consume', {
      peerId: this.socket.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });
  }

  // Socket event handlers
  private handleJoined(data: any): void {
    console.log('✅ Successfully joined room:', data);
  }

  private handleExistingPeers(data: { peers: PeerInfo[] }): void {
    console.log('👥 Existing peers:', data.peers);
    data.peers.forEach((peer) => {
      if (this.onPeerJoined) {
        this.onPeerJoined(peer);
      }
    });
  }

  private handlePeerJoined(data: PeerInfo): void {
    console.log('👤 New peer joined:', data);
    if (this.onPeerJoined) {
      this.onPeerJoined(data);
    }
  }

  private handlePeerLeft(data: { peerId: string }): void {
    console.log('👋 Peer left:', data.peerId);
    if (this.onPeerLeft) {
      this.onPeerLeft(data.peerId);
    }
  }

  private handleTransportCreated(data: any): void {
    console.log('🚚 Transport created:', data.transportId);
  }

  private handleTransportConnected(data: any): void {
    console.log('🔗 Transport connected:', data.transportId);
  }

  private handleProduced(data: any): void {
    console.log('🎬 Producer created:', data.producerId);
  }

  private handleNewProducer(data: {
    peerId: string;
    producerId: string;
    kind: string;
  }): void {
    console.log('📺 New producer from peer:', data);
    this.consume(data.peerId, data.producerId);
  }

  private handleConsumed(data: any): void {
    console.log('🎭 Consumer created:', data);
    const { consumerId, producerId, kind, rtpParameters } = data;

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
        this.onNewStream(data.peerId || 'unknown', stream, kind);
      }
    });
  }

  private handleConsumerResumed(data: { consumerId: string }): void {
    console.log('▶️ Consumer resumed:', data.consumerId);
  }

  private handleRecordingStarted(data: {
    recordingId: string;
    startTime: Date;
  }): void {
    console.log('🔴 Recording started:', data);
    if (this.onRecordingStarted) {
      this.onRecordingStarted(data.recordingId, data.startTime);
    }
  }

  private handleRecordingStopped(data: {
    recordingId: string;
    endTime: Date;
  }): void {
    console.log('⏹️ Recording stopped:', data);
    if (this.onRecordingStopped) {
      this.onRecordingStopped(data.recordingId, data.endTime);
    }
  }

  private handleError(data: { message: string }): void {
    console.error('❌ Server error:', data.message);
    if (this.onError) {
      this.onError(data.message);
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting WebRTC client...');

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
