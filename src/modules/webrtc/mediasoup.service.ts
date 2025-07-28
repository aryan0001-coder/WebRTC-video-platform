import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import { Worker, Router } from 'mediasoup/node/lib/types';
import { mediasoupConfig } from '../../config/mediasoup.config';
import { getIceConfiguration } from '../../config/ice.config';

//SFU Management Service
@Injectable()
export class MediasoupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediasoupService.name);
  private worker: Worker;
  private readonly routers = new Map<string, Router>();

  async onModuleInit() {
    await this.createWorker();
    this.logger.log('Mediasoup service initialized');
  }

  async onModuleDestroy() {
    if (this.worker) {
      this.worker.close();
    }
    this.logger.log('Mediasoup service destroyed');
  }

  private async createWorker(): Promise<void> {
    try {
      this.worker = await mediasoup.createWorker({
        rtcMinPort: mediasoupConfig.mediasoup.worker.rtcMinPort,
        rtcMaxPort: mediasoupConfig.mediasoup.worker.rtcMaxPort,
        logLevel: mediasoupConfig.mediasoup.worker.logLevel as any,
        logTags: mediasoupConfig.mediasoup.worker.logTags as any,
      });

      this.worker.on('died', (error) => {
        this.logger.error('Mediasoup worker died:', error);
        setTimeout(() => process.exit(1), 2000);
      });

      this.logger.log(`Mediasoup worker created [pid:${this.worker.pid}]`);
    } catch (error) {
      this.logger.error('Failed to create mediasoup worker:', error);
      throw error;
    }
  }

  async createRouter(roomId: string): Promise<Router> {
    try {
      if (this.routers.has(roomId)) {
        return this.routers.get(roomId)!;
      }

      const router = await this.worker.createRouter({
        mediaCodecs: mediasoupConfig.mediasoup.router.mediaCodecs,
      });

      this.routers.set(roomId, router);
      this.logger.log(`Router created for room: ${roomId}`);

      return router;
    } catch (error) {
      this.logger.error(`Failed to create router for room ${roomId}:`, error);
      throw error;
    }
  }

  async createWebRtcTransport(router: Router, direction: 'send' | 'recv') {
    try {
      const transport = await router.createWebRtcTransport({
        listenIps: mediasoupConfig.mediasoup.webRtcTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        ...(direction === 'send' && {
          maxIncomingBitrate:
            mediasoupConfig.mediasoup.webRtcTransport.maxIncomingBitrate,
        }),
        ...(direction === 'recv' && {
          initialAvailableOutgoingBitrate:
            mediasoupConfig.mediasoup.webRtcTransport
              .initialAvailableOutgoingBitrate,
        }),
      });

      // Get ICE configuration for client
      const iceConfiguration = getIceConfiguration();

      return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        iceServers: iceConfiguration.iceServers, // Add ICE servers for client
        transport,
      };
    } catch (error) {
      this.logger.error('Failed to create WebRTC transport:', error);
      throw error;
    }
  }

  async createPlainTransport(router: Router) {
    try {
      const transport = await router.createPlainTransport({
        listenIp: mediasoupConfig.mediasoup.plainTransport.listenIp,
        rtcpMux: mediasoupConfig.mediasoup.plainTransport.rtcpMux,
        comedia: mediasoupConfig.mediasoup.plainTransport.comedia,
      });

      return {
        id: transport.id,
        ip: transport.tuple.localIp,
        port: transport.tuple.localPort,
        rtcpPort: transport.rtcpTuple
          ? transport.rtcpTuple.localPort
          : undefined,
        transport,
      };
    } catch (error) {
      this.logger.error('Failed to create plain transport:', error);
      throw error;
    }
  }

  getRouter(roomId: string): Router | undefined {
    return this.routers.get(roomId);
  }

  removeRouter(roomId: string): void {
    const router = this.routers.get(roomId);
    if (router) {
      router.close();
      this.routers.delete(roomId);
      this.logger.log(`Router removed for room: ${roomId}`);
    }
  }

  getWorkerResourceUsage() {
    return this.worker.getResourceUsage;
  }

  getRouterRtpCapabilities(roomId: string) {
    const router = this.routers.get(roomId);
    return router ? router.rtpCapabilities : null;
  }
}
