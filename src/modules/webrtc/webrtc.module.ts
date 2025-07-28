import { Module } from '@nestjs/common';
import { WebRTCGateway } from './webrtc.gateway';
import { MediasoupService } from './mediasoup.service';
import { RecordingService } from './recording.service';
import { RoomService } from './room.service';

@Module({
  providers: [WebRTCGateway, MediasoupService, RecordingService, RoomService],
  exports: [MediasoupService, RecordingService, RoomService],
})
export class WebRTCModule {}
