import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { PeerInfo } from '../WebRTC/WebRTCClient';

const GridContainer = styled.div<{ count: number }>`
  display: grid;
  gap: 8px;
  padding: 1rem;
  height: 100%;
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
  min-height: 150px;
  border: ${props => props.isLocal ? '2px solid #4CAF50' : '1px solid #444'};
`;

const VideoElement = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
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
}

interface VideoTileProps {
  stream?: MediaStream;
  participantName: string;
  isLocal?: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  participantName,
  isLocal = false,
  hasVideo,
  hasAudio,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream && hasVideo) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasVideo]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <VideoContainer isLocal={isLocal}>
      {hasVideo && stream ? (
        <VideoElement
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Mute local video to avoid feedback
        />
      ) : (
        <PlaceholderContainer>
          <AvatarIcon>
            {getInitials(participantName)}
          </AvatarIcon>
          <div>{participantName}</div>
        </PlaceholderContainer>
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
}) => {
  // Group remote streams by participant
  const participantStreams = new Map<string, { video?: MediaStream; audio?: MediaStream }>();
  
  remoteStreams.forEach((streamInfo) => {
    const { peerId, stream, kind } = streamInfo;
    if (!participantStreams.has(peerId)) {
      participantStreams.set(peerId, {});
    }
    const streams = participantStreams.get(peerId)!;
    if (kind === 'video') {
      streams.video = stream;
    } else if (kind === 'audio') {
      streams.audio = stream;
    }
  });

  // Calculate total number of video tiles (local + remote participants)
  const totalParticipants = 1 + participants.length;

  return (
    <GridContainer count={totalParticipants}>
      {/* Local video tile */}
      <VideoTile
        stream={localVideoStream || undefined}
        participantName={userName}
        isLocal={true}
        hasVideo={isVideoEnabled}
        hasAudio={isAudioEnabled}
      />
      
      {/* Remote video tiles */}
      {participants.map((participant) => {
        const streams = participantStreams.get(participant.id);
        const hasVideo = !!streams?.video;
        const hasAudio = !!streams?.audio;
        
        return (
          <VideoTile
            key={participant.id}
            stream={streams?.video || streams?.audio}
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