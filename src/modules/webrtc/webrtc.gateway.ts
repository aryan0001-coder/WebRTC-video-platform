import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { MediasoupService } from './mediasoup.service';
import { RoomService } from './room.service';
import { RecordingService } from './recording.service';
import {
  ProducerOptions,
  ConsumerOptions,
  TransportOptions,
} from '../../interfaces/webrtc.interface';

// Web Socket Signalling Gateway
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/webrtc',
})
export class WebRTCGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebRTCGateway.name);
  private peerSockets = new Map<string, Socket>();

  constructor(
    private readonly mediasoupService: MediasoupService,
    private readonly roomService: RoomService,
    private readonly recordingService: RecordingService,
  ) {}

  handleConnection(socket: Socket) {
    const peerId = uuidv4();
    socket.data.peerId = peerId;
    this.peerSockets.set(peerId, socket);
    this.logger.log(`Client connected: ${peerId}`);
  }

  handleDisconnect(socket: Socket) {
    const peerId = socket.data.peerId;
    const roomId = socket.data.roomId;

    if (peerId) {
      this.peerSockets.delete(peerId);
    }

    if (roomId && peerId) {
      this.roomService.leaveRoom(roomId, peerId);
      socket.to(roomId).emit('peerLeft', { peerId });
    }

    this.logger.log(`Client disconnected: ${peerId}`);
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { roomName: string; peerName: string },
  ) {
    try {
      const peerId = socket.data.peerId;
      let room = this.roomService.getRoomByName(data.roomName);

      if (!room) {
        room = await this.roomService.createRoom(data.roomName);
      }

      const peer = await this.roomService.joinRoom(
        room.id,
        peerId,
        data.peerName,
      );

      socket.data.roomId = room.id;
      socket.join(room.id);

      const rtpCapabilities = this.mediasoupService.getRouterRtpCapabilities(
        room.id,
      );

      socket.emit('joined', {
        peerId,
        roomId: room.id,
        rtpCapabilities,
        isRecording: room.recording.isRecording,
      });

      // Notify other peers
      const otherPeers = this.roomService.getRoomPeersExcept(room.id, peerId);
      socket.to(room.id).emit('peerJoined', {
        peerId,
        peerName: data.peerName,
      });

      // Send existing peers to the new peer
      socket.emit('existingPeers', {
        peers: otherPeers.map((p) => ({ id: p.id, name: p.name })),
      });
    } catch (error) {
      this.logger.error('Failed to join room:', error);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('createTransport')
  async handleCreateTransport(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: TransportOptions,
  ) {
    try {
      const roomId = socket.data.roomId;
      const room = this.roomService.getRoom(roomId);

      if (!room) {
        throw new Error('Room not found');
      }

      const peer = this.roomService.getPeer(roomId, data.peerId);
      if (!peer) {
        throw new Error('Peer not found');
      }

      const transportData = await this.mediasoupService.createWebRtcTransport(
        room.router,
        data.direction,
      );

      // Store transport in peer data
      peer.transports.set(transportData.id, transportData.transport);

      socket.emit('transportCreated', {
        transportId: transportData.id,
        iceParameters: transportData.iceParameters,
        iceCandidates: transportData.iceCandidates,
        dtlsParameters: transportData.dtlsParameters,
      });
    } catch (error) {
      this.logger.error('Failed to create transport:', error);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('connectTransport')
  async handleConnectTransport(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { transportId: string; dtlsParameters: any },
  ) {
    try {
      const roomId = socket.data.roomId;
      const peerId = socket.data.peerId;
      const peer = this.roomService.getPeer(roomId, peerId);

      if (!peer) {
        throw new Error('Peer not found');
      }

      const transport = peer.transports.get(data.transportId);
      if (!transport) {
        throw new Error('Transport not found');
      }

      await transport.connect({ dtlsParameters: data.dtlsParameters });
      socket.emit('transportConnected', { transportId: data.transportId });
    } catch (error) {
      this.logger.error('Failed to connect transport:', error);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('produce')
  async handleProduce(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: ProducerOptions,
  ) {
    try {
      const roomId = socket.data.roomId;
      const peer = this.roomService.getPeer(roomId, data.peerId);

      if (!peer) {
        throw new Error('Peer not found');
      }

      const transport = peer.transports.get(data.transportId);
      if (!transport) {
        throw new Error('Transport not found');
      }

      const producer = await transport.produce({
        kind: data.kind,
        rtpParameters: data.rtpParameters,
        appData: data.appData,
      });

      peer.producers.set(producer.id, producer);

      socket.emit('produced', { producerId: producer.id });

      // Notify other peers about new producer
      socket.to(roomId).emit('newProducer', {
        peerId: data.peerId,
        producerId: producer.id,
        kind: data.kind,
      });
    } catch (error) {
      this.logger.error('Failed to produce:', error);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('consume')
  async handleConsume(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: ConsumerOptions,
  ) {
    try {
      const roomId = socket.data.roomId;
      const room = this.roomService.getRoom(roomId);
      const peer = this.roomService.getPeer(roomId, data.peerId);

      if (!room || !peer) {
        throw new Error('Room or peer not found');
      }

      // Find the producer
      const producerPeer = this.roomService
        .getRoomPeers(roomId)
        .find((p) => p.producers.has(data.producerId));

      if (!producerPeer) {
        throw new Error('Producer not found');
      }

      const producer = producerPeer.producers.get(data.producerId);

      // Check if we can consume
      const canConsume = room.router.canConsume({
        producerId: producer.id,
        rtpCapabilities: data.rtpCapabilities,
      });

      if (!canConsume) {
        throw new Error('Cannot consume');
      }

      // Find receive transport
      const recvTransport = Array.from(peer.transports.values()).find(
        (t) => t.appData?.direction === 'recv',
      );

      if (!recvTransport) {
        throw new Error('Receive transport not found');
      }

      const consumer = await recvTransport.consume({
        producerId: producer.id,
        rtpCapabilities: data.rtpCapabilities,
        paused: true,
      });

      peer.consumers.set(consumer.id, consumer);

      socket.emit('consumed', {
        consumerId: consumer.id,
        producerId: producer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (error) {
      this.logger.error('Failed to consume:', error);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('resumeConsumer')
  async handleResumeConsumer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { consumerId: string },
  ) {
    try {
      const roomId = socket.data.roomId;
      const peerId = socket.data.peerId;
      const peer = this.roomService.getPeer(roomId, peerId);

      if (!peer) {
        throw new Error('Peer not found');
      }

      const consumer = peer.consumers.get(data.consumerId);
      if (!consumer) {
        throw new Error('Consumer not found');
      }

      await consumer.resume();
      socket.emit('consumerResumed', { consumerId: data.consumerId });
    } catch (error) {
      this.logger.error('Failed to resume consumer:', error);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('startRecording')
  async handleStartRecording(@ConnectedSocket() socket: Socket) {
    try {
      const roomId = socket.data.roomId;
      const recording = await this.recordingService.startRecording(roomId);

      this.server.to(roomId).emit('recordingStarted', {
        recordingId: recording.id,
        startTime: recording.startTime,
      });
    } catch (error) {
      this.logger.error('Failed to start recording:', error);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('stopRecording')
  async handleStopRecording(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { recordingId: string },
  ) {
    try {
      const recording = await this.recordingService.stopRecording(
        data.recordingId,
      );

      this.server.to(recording.roomId).emit('recordingStopped', {
        recordingId: recording.id,
        endTime: recording.endTime,
        filePath: recording.filePath,
      });
    } catch (error) {
      this.logger.error('Failed to stop recording:', error);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('getRoomStats')
  async handleGetRoomStats(@ConnectedSocket() socket: Socket) {
    try {
      const roomId = socket.data.roomId;
      const stats = this.roomService.getRoomStats(roomId);
      socket.emit('roomStats', stats);
    } catch (error) {
      this.logger.error('Failed to get room stats:', error);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('getRecordings')
  async handleGetRecordings(@ConnectedSocket() socket: Socket) {
    try {
      const roomId = socket.data.roomId;
      const recordings = this.recordingService.getRoomRecordings(roomId);
      socket.emit('recordings', recordings);
    } catch (error) {
      this.logger.error('Failed to get recordings:', error);
      socket.emit('error', { message: error.message });
    }
  }
}
