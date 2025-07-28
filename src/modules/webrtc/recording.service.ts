import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as ffmpeg from 'fluent-ffmpeg';
import { mediasoupConfig } from '../../config/mediasoup.config';
import { RecordingInfo } from '../../interfaces/webrtc.interface';
import { MediasoupService } from './mediasoup.service';
import { RoomService } from './room.service';

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);
  private recordings = new Map<string, RecordingInfo>();
  private activeRecorders = new Map<string, ffmpeg.FfmpegCommand>();

  constructor(
    private readonly mediasoupService: MediasoupService,
    private readonly roomService: RoomService,
  ) {
    this.ensureRecordingDirectory();
  }

  private ensureRecordingDirectory(): void {
    const recordingPath = mediasoupConfig.recording.outputPath;
    if (!fs.existsSync(recordingPath)) {
      fs.mkdirSync(recordingPath, { recursive: true });
      this.logger.log(`Created recording directory: ${recordingPath}`);
    }
  }

  async startRecording(roomId: string): Promise<RecordingInfo> {
    const room = this.roomService.getRoom(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    if (this.roomService.isRoomRecording(roomId)) {
      throw new Error(`Room ${roomId} is already being recorded`);
    }

    const recordingId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording-${room.name}-${timestamp}.${mediasoupConfig.recording.format}`;
    const filePath = path.join(mediasoupConfig.recording.outputPath, filename);

    const recordingInfo: RecordingInfo = {
      id: recordingId,
      roomId,
      filePath,
      startTime: new Date(),
      status: 'recording',
      participants: Array.from(room.peers.keys()),
    };

    try {
      // Create plain transport for recording
      const plainTransport = await this.mediasoupService.createPlainTransport(
        room.router,
      );

      // Start FFmpeg recording process
      await this.startFFmpegRecording(recordingId, plainTransport, filePath);

      this.recordings.set(recordingId, recordingInfo);
      this.roomService.updateRoomRecordingStatus(
        roomId,
        true,
        recordingId,
        filePath,
      );

      this.logger.log(
        `Started recording for room ${room.name} (${recordingId})`,
      );
      return recordingInfo;
    } catch (error) {
      this.logger.error(`Failed to start recording for room ${roomId}:`, error);
      recordingInfo.status = 'failed';
      throw error;
    }
  }

  async stopRecording(recordingId: string): Promise<RecordingInfo> {
    const recording = this.recordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording ${recordingId} not found`);
    }

    if (recording.status !== 'recording') {
      throw new Error(`Recording ${recordingId} is not active`);
    }

    try {
      // Stop FFmpeg process
      const recorder = this.activeRecorders.get(recordingId);
      if (recorder) {
        recorder.kill('SIGINT');
        this.activeRecorders.delete(recordingId);
      }

      recording.endTime = new Date();
      recording.status = 'stopped';

      this.roomService.updateRoomRecordingStatus(recording.roomId, false);

      this.logger.log(`Stopped recording ${recordingId}`);
      return recording;
    } catch (error) {
      this.logger.error(`Failed to stop recording ${recordingId}:`, error);
      recording.status = 'failed';
      throw error;
    }
  }

  private async startFFmpegRecording(
    recordingId: string,
    plainTransport: any,
    filePath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const command = ffmpeg()
          .input(`rtp://127.0.0.1:${plainTransport.port}`)
          .inputOptions(['-protocol_whitelist', 'file,rtp,udp', '-f', 'rtp'])
          .videoCodec(mediasoupConfig.recording.videoCodec)
          .audioCodec(mediasoupConfig.recording.audioCodec)
          .outputOptions([
            '-f',
            mediasoupConfig.recording.format,
            '-preset',
            'medium',
            '-crf',
            '23',
            '-maxrate',
            '1000k',
            '-bufsize',
            '2000k',
          ])
          .output(filePath);

        command.on('start', (commandLine) => {
          this.logger.log(`FFmpeg started: ${commandLine}`);
          this.activeRecorders.set(recordingId, command);
          resolve();
        });

        command.on('error', (error) => {
          this.logger.error(
            `FFmpeg error for recording ${recordingId}:`,
            error,
          );
          this.activeRecorders.delete(recordingId);
          reject(error);
        });

        command.on('end', () => {
          this.logger.log(`FFmpeg finished recording ${recordingId}`);
          this.activeRecorders.delete(recordingId);

          const recording = this.recordings.get(recordingId);
          if (recording && recording.status === 'stopped') {
            recording.status = 'completed';
          }
        });

        command.run();
      } catch (error) {
        reject(error);
      }
    });
  }

  getRecording(recordingId: string): RecordingInfo | undefined {
    return this.recordings.get(recordingId);
  }

  getAllRecordings(): RecordingInfo[] {
    return Array.from(this.recordings.values());
  }

  getRoomRecordings(roomId: string): RecordingInfo[] {
    return Array.from(this.recordings.values()).filter(
      (recording) => recording.roomId === roomId,
    );
  }

  deleteRecording(recordingId: string): boolean {
    const recording = this.recordings.get(recordingId);
    if (!recording) {
      return false;
    }

    // Stop recording if still active
    if (recording.status === 'recording') {
      this.stopRecording(recordingId);
    }

    // Delete file
    try {
      if (fs.existsSync(recording.filePath)) {
        fs.unlinkSync(recording.filePath);
        this.logger.log(`Deleted recording file: ${recording.filePath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete recording file:`, error);
    }

    this.recordings.delete(recordingId);
    return true;
  }

  getRecordingStats() {
    const total = this.recordings.size;
    const active = Array.from(this.recordings.values()).filter(
      (recording) => recording.status === 'recording',
    ).length;
    const completed = Array.from(this.recordings.values()).filter(
      (recording) => recording.status === 'completed',
    ).length;
    const failed = Array.from(this.recordings.values()).filter(
      (recording) => recording.status === 'failed',
    ).length;

    return {
      total,
      active,
      completed,
      failed,
      recordings: Array.from(this.recordings.values()),
    };
  }

  // Helper method to get recording file stream for download
  getRecordingStream(recordingId: string): fs.ReadStream | null {
    const recording = this.recordings.get(recordingId);
    if (!recording || !fs.existsSync(recording.filePath)) {
      return null;
    }
    return fs.createReadStream(recording.filePath);
  }

  // Helper method to check recording file size
  getRecordingFileSize(recordingId: string): number | null {
    const recording = this.recordings.get(recordingId);
    if (!recording || !fs.existsSync(recording.filePath)) {
      return null;
    }

    try {
      const stats = fs.statSync(recording.filePath);
      return stats.size;
    } catch (error) {
      return null;
    }
  }
}
