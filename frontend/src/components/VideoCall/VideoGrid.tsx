import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { PeerInfo } from '../WebRTC/WebRTCClient';

const GridContainer = styled.div<{ count: number }>`
  display: grid;
  gap: 8px;
  padding: 3rem;
  height: 50%;
  overflow: auto;
  
  grid-template-columns: ${props => {
    if (props.count === 1) return '1fr';
    if (props.count === 2) return '1fr 1fr';
    if (props.count <= 4) return '1fr 1fr';
    if (props.count <= 6) return '1fr 1fr 1fr';
    return '1fr 1fr 1fr 1fr';
  }};
  
  grid-template-rows: ${props => {
    if (props.count <= 2) return '1fr';
    if (props.count <= 4) return '1fr 1fr';
    if (props.count <= 6) return '1fr 1fr';
    return 'repeat(auto-fit, minmax(200px, 1fr))';
  }};
`;

const VideoContainer = styled.div<{ isLocal?: boolean }>`
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
  min-height: 130px;
  border: ${props => props.isLocal ? '2px solid #4CAF50' : '1px solid #444'};
`;

const VideoElement = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const AudioElement = styled.audio`
  display: none;
`;

const AudioIndicator = styled.div<{ isActive: boolean }>`
  position: absolute;
  top: 8px;
  left: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.isActive ? '#4CAF50' : '#f44336'};
`;

const ParticipantLabel = styled.div<{ isLocal?: boolean }>`
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: ${props => props.isLocal ? 'rgba(76, 175, 80, 0.8)' : 'rgba(0, 0, 0, 0.7)'};
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
`;

const PlaceholderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: #333;
  color: #ccc;
`;

const AvatarIcon = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 8px;
`;

const MicMutedIcon = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(244, 67, 54, 0.8);
  color: white;
  padding: 4px;
  border-radius: 4px;
  font-size: 0.7rem;
`;

interface RemoteStream {
  peerId: string;
  stream: MediaStream;
  kind: 'video' | 'audio';
}

interface VideoGridProps {
  localVideoStream: MediaStream | null;
  localAudioStream: MediaStream | null;
  remoteStreams: Map<string, RemoteStream>;
  participants: PeerInfo[];
  userName: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  hasVideoEverBeenEnabled: boolean;
  hasAudioEverBeenEnabled: boolean;
}

interface VideoTileProps {
  videoStream?: MediaStream;
  audioStream?: MediaStream;
  participantName: string;
  isLocal?: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  videoStream,
  audioStream,
  participantName,
  isLocal = false,
  hasVideo,
  hasAudio,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  console.log('🎬 VideoTile render:', {
    participantName,
    isLocal,
    hasVideo,
    hasAudio,
    videoStream: !!videoStream,
    audioStream: !!audioStream
  });

  useEffect(() => {
    console.log('🎬 VideoTile useEffect - videoStream changed:', !!videoStream, 'videoRef.current:', !!videoRef.current);
    
    if (videoRef.current && videoStream) {
      console.log('🎬 Setting video srcObject for:', participantName);
      videoRef.current.srcObject = videoStream;
      
      // Add event listeners to monitor video element state
      const videoElement = videoRef.current;
      const onLoadedMetadata = () => console.log('🎬 Video loaded metadata for:', participantName);
      const onCanPlay = () => console.log('🎬 Video can play for:', participantName);
      const onPlay = () => console.log('🎬 Video started playing for:', participantName);
      const onError = (e: Event) => console.error('🎬 Video error for:', participantName, e);
      
      videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.addEventListener('canplay', onCanPlay);
      videoElement.addEventListener('play', onPlay);
      videoElement.addEventListener('error', onError);
      
      // Only try to play if the video is not already playing
      if (videoElement.paused) {
        videoElement.play().then(() => {
          console.log('🎬 Video play() succeeded for:', participantName);
        }).catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('🎬 Video play() failed for:', participantName, error);
          }
        });
      }
      
      return () => {
        videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        videoElement.removeEventListener('canplay', onCanPlay);
        videoElement.removeEventListener('play', onPlay);
        videoElement.removeEventListener('error', onError);
      };
    }
  }, [videoStream, participantName]);

  // Monitor video element creation/destruction
  useEffect(() => {
    console.log('🎬 VideoTile video element ref changed:', !!videoRef.current, 'for:', participantName);
  }, [videoRef.current, participantName]);

  // Log what's being rendered
  useEffect(() => {
    console.log('🎬 VideoTile render state:', {
      participantName,
      isLocal,
      hasVideo,
      hasAudio,
      videoStream: !!videoStream,
      audioStream: !!audioStream,
      willRenderVideo: hasVideo && !!videoStream
    });
  }, [participantName, isLocal, hasVideo, hasAudio, videoStream, audioStream]);

  useEffect(() => {
    console.log('🎧 [AUDIO DEBUG] Audio stream changed for:', participantName, 'stream:', !!audioStream, 'isLocal:', isLocal);
    
          if (audioRef.current && audioStream) {
        console.log('🎧 [AUDIO DEBUG] Setting audio srcObject for:', participantName);
        audioRef.current.srcObject = audioStream;
        
        // Add event listeners to monitor audio element state
        const audioElement = audioRef.current;
        
        // Set volume for remote audio (local audio should be muted)
        if (!isLocal) {
          audioElement.volume = 1.0; // Full volume for remote audio
          console.log('🎧 [AUDIO DEBUG] Set volume to 1.0 for remote audio:', participantName);
        }
      const onLoadedMetadata = () => console.log('🎧 [AUDIO DEBUG] Audio loaded metadata for:', participantName);
      const onCanPlay = () => console.log('🎧 [AUDIO DEBUG] Audio can play for:', participantName);
      const onPlay = () => console.log('🎧 [AUDIO DEBUG] Audio started playing for:', participantName);
      const onError = (e: Event) => console.error('🎧 [AUDIO DEBUG] Audio error for:', participantName, e);
      
      audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
      audioElement.addEventListener('canplay', onCanPlay);
      audioElement.addEventListener('play', onPlay);
      audioElement.addEventListener('error', onError);
      
      // Try to play the audio
      audioElement.play().then(() => {
        console.log('🎧 [AUDIO DEBUG] Audio play() succeeded for:', participantName);
        console.log('🎧 [AUDIO DEBUG] Audio element state:', {
          muted: audioElement.muted,
          volume: audioElement.volume,
          paused: audioElement.paused,
          readyState: audioElement.readyState
        });
      }).catch((error) => {
        console.error('🎧 [AUDIO DEBUG] Audio play() failed for:', participantName, error);
      });
      
      return () => {
        audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        audioElement.removeEventListener('canplay', onCanPlay);
        audioElement.removeEventListener('play', onPlay);
        audioElement.removeEventListener('error', onError);
      };
    }
  }, [audioStream, participantName, isLocal]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <VideoContainer isLocal={isLocal}>
      {/* Always render video element if we have a stream, but control visibility with CSS */}
      {videoStream && (
        <VideoElement
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Mute local video to avoid feedback
          style={{ 
            display: hasVideo ? 'block' : 'none',
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      )}
      
      {/* Show placeholder when no video or video is disabled */}
      {(!videoStream || !hasVideo) && (
        <PlaceholderContainer>
          <AvatarIcon>
            {getInitials(participantName)}
          </AvatarIcon>
          <div>{participantName}</div>
        </PlaceholderContainer>
      )}

      {/* Always render audio element if we have a stream, but control muted state */}
      {audioStream && (
        <AudioElement
          ref={audioRef}
          autoPlay
          playsInline
          muted={isLocal} // Mute local audio to avoid echo, play remote audio
        />
      )}

      <AudioIndicator isActive={hasAudio} />

      {!hasAudio && (
        <MicMutedIcon>🔇</MicMutedIcon>
      )}

      <ParticipantLabel isLocal={isLocal}>
        {isLocal ? `${participantName} (You)` : participantName}
      </ParticipantLabel>
    </VideoContainer>
  );
};

const VideoGrid: React.FC<VideoGridProps> = ({
  localVideoStream,
  localAudioStream,
  remoteStreams,
  participants,
  userName,
  isVideoEnabled,
  isAudioEnabled,
  hasVideoEverBeenEnabled,
  hasAudioEverBeenEnabled,
}) => {
  // Debug logging to check for local peer in participants
  console.log(' VideoGrid render - participants:', participants.map(p => ({ id: p.id, name: p.name })));
  console.log(' VideoGrid render - userName:', userName);
  console.log('VideoGrid render - localVideoStream:', !!localVideoStream, 'isVideoEnabled:', isVideoEnabled);
  console.log(' VideoGrid render - localAudioStream:', !!localAudioStream, 'isAudioEnabled:', isAudioEnabled);
  
  // Group remote streams by participant
  const participantStreams = new Map<string, { video?: MediaStream; audio?: MediaStream }>();
  
  console.log('🎧 [STREAM DEBUG] Processing remote streams:', Array.from(remoteStreams.entries()).map(([key, stream]) => ({
    key,
    peerId: stream.peerId,
    kind: stream.kind,
    hasStream: !!stream.stream
  })));
  
  remoteStreams.forEach((streamInfo) => {
    const { peerId, stream, kind } = streamInfo;
    console.log('🎧 [STREAM DEBUG] Processing stream for peerId:', peerId, 'kind:', kind);
    
    if (!participantStreams.has(peerId)) {
      participantStreams.set(peerId, {});
    }
    const streams = participantStreams.get(peerId)!;
    if (kind === 'video') {
      streams.video = stream;
      console.log('🎧 [STREAM DEBUG] Set video stream for peerId:', peerId);
    } else if (kind === 'audio') {
      streams.audio = stream;
      console.log('🎧 [STREAM DEBUG] Set audio stream for peerId:', peerId);
    }
  });
  
  console.log('🎧 [STREAM DEBUG] Final participant streams:', Array.from(participantStreams.entries()).map(([peerId, streams]) => ({
    peerId,
    hasVideo: !!streams.video,
    hasAudio: !!streams.audio
  })));

  // Calculate total number of video tiles (local + remote participants)
  const totalParticipants = 1 + participants.length;

  return (
    <GridContainer count={totalParticipants}>
      {/* Local video tile */}
      <VideoTile
        videoStream={localVideoStream || undefined}
        audioStream={localAudioStream || undefined}
        participantName={userName}
        isLocal={true}
        hasVideo={isVideoEnabled}
        hasAudio={isAudioEnabled}
      />
      
      {/* Remote video tiles */}
      {participants
        .filter(participant => participant.name !== userName) // Prevent local peer duplication
        .map((participant) => {
          const streams = participantStreams.get(participant.id);
          const hasVideo = !!streams?.video;
          const hasAudio = !!streams?.audio;
          
          console.log('🎧 [RENDER DEBUG] Rendering remote participant:', participant.name, participant.id, { 
            hasVideo, 
            hasAudio,
            streams: streams ? { hasVideo: !!streams.video, hasAudio: !!streams.audio } : 'no streams'
          });
          
          return (
            <VideoTile
              key={participant.id}
              videoStream={streams?.video}
              audioStream={streams?.audio}
              participantName={participant.name}
              hasVideo={hasVideo}
              hasAudio={hasAudio}
            />
          );
        })}
    </GridContainer>
  );
};

export default VideoGrid;