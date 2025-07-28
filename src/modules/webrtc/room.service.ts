import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RoomInfo, PeerInfo } from '../../interfaces/webrtc.interface';
import { MediasoupService } from './mediasoup.service';

//In memory room management
@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private rooms = new Map<string, RoomInfo>();

  constructor(private readonly mediasoupService: MediasoupService) {}

  async createRoom(roomName: string): Promise<RoomInfo> {
    const roomId = uuidv4();

    try {
      const router = await this.mediasoupService.createRouter(roomId);

      const room: RoomInfo = {
        id: roomId,
        name: roomName,
        peers: new Map(),
        router,
        recording: {
          isRecording: false,
        },
      };

      this.rooms.set(roomId, room);
      this.logger.log(`Room created: ${roomName} (${roomId})`);

      return room;
    } catch (error) {
      this.logger.error(`Failed to create room ${roomName}:`, error);
      throw error;
    }
  }

  getRoom(roomId: string): RoomInfo | undefined {
    return this.rooms.get(roomId);
  }

  getRoomByName(roomName: string): RoomInfo | undefined {
    for (const room of this.rooms.values()) {
      if (room.name === roomName) {
        return room;
      }
    }
    return undefined;
  }

  getAllRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  async joinRoom(
    roomId: string,
    peerId: string,
    peerName: string,
  ): Promise<PeerInfo> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    if (room.peers.has(peerId)) {
      throw new Error(`Peer ${peerId} already in room`);
    }

    const peer: PeerInfo = {
      id: peerId,
      name: peerName,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    room.peers.set(peerId, peer);
    this.logger.log(`Peer ${peerName} (${peerId}) joined room ${room.name}`);

    return peer;
  }

  leaveRoom(roomId: string, peerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const peer = room.peers.get(peerId);
    if (!peer) {
      return false;
    }

    // Close all peer's transports
    for (const transport of peer.transports.values()) {
      transport.close();
    }

    // Close all peer's producers
    for (const producer of peer.producers.values()) {
      producer.close();
    }

    // Close all peer's consumers
    for (const consumer of peer.consumers.values()) {
      consumer.close();
    }

    room.peers.delete(peerId);
    this.logger.log(`Peer ${peer.name} (${peerId}) left room ${room.name}`);

    // If room is empty, clean it up
    if (room.peers.size === 0) {
      this.closeRoom(roomId);
    }

    return true;
  }

  closeRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // Close all peer connections
    for (const peer of room.peers.values()) {
      this.leaveRoom(roomId, peer.id);
    }

    // Remove router
    this.mediasoupService.removeRouter(roomId);

    this.rooms.delete(roomId);
    this.logger.log(`Room ${room.name} (${roomId}) closed`);

    return true;
  }

  getPeer(roomId: string, peerId: string): PeerInfo | undefined {
    const room = this.rooms.get(roomId);
    return room?.peers.get(peerId);
  }

  getRoomPeers(roomId: string): PeerInfo[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.peers.values()) : [];
  }

  getRoomPeersExcept(roomId: string, excludePeerId: string): PeerInfo[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return Array.from(room.peers.values()).filter(
      (peer) => peer.id !== excludePeerId,
    );
  }

  updateRoomRecordingStatus(
    roomId: string,
    isRecording: boolean,
    recordingId?: string,
    filePath?: string,
  ) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.recording.isRecording = isRecording;
      room.recording.recordingId = recordingId;
      room.recording.filePath = filePath;
      if (isRecording) {
        room.recording.startTime = new Date();
      }
    }
  }

  isRoomRecording(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    return room?.recording.isRecording || false;
  }

  getRoomStats(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      roomId: room.id,
      roomName: room.name,
      peersCount: room.peers.size,
      isRecording: room.recording.isRecording,
      recordingStartTime: room.recording.startTime,
      peers: Array.from(room.peers.values()).map((peer) => ({
        id: peer.id,
        name: peer.name,
        producersCount: peer.producers.size,
        consumersCount: peer.consumers.size,
        transportsCount: peer.transports.size,
      })),
    };
  }
}
