import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebRTCModule } from './modules/webrtc/webrtc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WebRTCModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
