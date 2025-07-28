import {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup/node/lib/types';

export interface PeerInfo {
  id: string;
  name: string;
  device?: any;
  rtpCapabilities?: RtpCapabilities;
  transports: Map<string, any>;
  producers: Map<string, any>;
  consumers: Map<string, any>;
}

export interface RoomInfo {
  id: string;
  name: string;
  peers: Map<string, PeerInfo>;
  router?: any;
  audioLevelObserver?: any;
  recording: {
    isRecording: boolean;
    recordingId?: string;
    startTime?: Date;
    filePath?: string;
  };
}

export interface ProducerOptions {
  peerId: string;
  transportId: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
  appData?: any;
}

export interface ConsumerOptions {
  peerId: string;
  producerId: string;
  rtpCapabilities: RtpCapabilities;
}

export interface TransportOptions {
  peerId: string;
  direction: 'send' | 'recv';
  sctpCapabilities?: any;
}

export interface WebRTCConfig {
  mediasoup: {
    worker: {
      rtcMinPort: number;
      rtcMaxPort: number;
      logLevel: string;
      logTags: string[];
    };
    router: {
      mediaCodecs: any[];
    };
    webRtcTransport: {
      listenIps: Array<{
        ip: string;
        announcedIp?: string;
      }>;
      maxIncomingBitrate: number;
      initialAvailableOutgoingBitrate: number;
    };
    plainTransport: {
      listenIp: {
        ip: string;
        announcedIp?: string;
      };
      rtcpMux: boolean;
      comedia: true;
    };
  };
  recording: {
    outputPath: string;
    videoCodec: string;
    audioCodec: string;
    format: string;
  };
}

export interface RecordingInfo {
  id: string;
  roomId: string;
  filePath: string;
  startTime: Date;
  endTime?: Date;
  status: 'recording' | 'stopped' | 'processing' | 'completed' | 'failed';
  participants: string[];
}
