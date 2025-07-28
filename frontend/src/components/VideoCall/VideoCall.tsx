import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { WebRTCClient, PeerInfo } from '../WebRTC/WebRTCClient';

const VideoCallContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a1a;
  color: white;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #333;
  border-bottom: 1px solid #444;
`;

const RoomInfo = styled.div`
  h2 {
    margin: 0;
    font-size: 1.2rem;
    color: #fff;
  }
  
  p {
    margin: 0.5rem 0 0 0;
    color: #ccc;
    font-size: 0.9rem;
  }
`;

const ConnectionStatus = styled.div<{ connected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.connected ? '#4CAF50' : '#f44336'};
  }
`;

const VideoArea = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: #000;
  padding: 1rem;
`;

const VideoGrid = styled.div<{ videoCount: number }>`
  display: grid;
  gap: 10px;
  width: 100%;
  height: 100%;
  grid-template-columns: ${props => {
    if (props.videoCount === 1) return '1fr';
    if (props.videoCount === 2) return '1fr 1fr';
    if (props.videoCount <= 4) return '1fr 1fr';
    return '1fr 1fr 1fr';
  }};
  grid-template-rows: ${props => {
    if (props.videoCount <= 2) return '1fr';
    if (props.videoCount <= 4) return '1fr 1fr';
    return 'repeat(auto-fit, minmax(200px, 1fr))';
  }};
`;

const VideoContainer = styled.div<{ isLocal?: boolean }>`
  position: relative;
  background: #333;
  border-radius: 8px;
  overflow: hidden;
  border: ${props => props.isLocal ? '2px solid #4CAF50' : '1px solid #555'};
  min-height: 200px;
`;

const VideoElement = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const VideoPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #333;
  color: #ccc;
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

const ControlsContainer = styled.div`
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1rem;
  z-index: 100;
`;

const ControlButton = styled.button<{ 
  isActive?: boolean; 
  variant?: 'danger' | 'recording' 
}>`
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s ease;
  
  background: ${props => {
    if (props.variant === 'danger') return '#f44336';
    if (props.variant === 'recording') return '#FF9800';
    return props.isActive ? '#4CAF50' : '#666';
  }};
  color: white;
  
  &:hover {
    transform: scale(1.1);
    opacity: 0.9;
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const StartButton = styled.button`
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 1rem;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(76, 175, 80, 0.3);
  }
`;

const ErrorMessage = styled.div`
  background: #f44336;
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem;
  text-align: center;
`;

const StatusMessage = styled.div`
  text-align: center;
  color: #ccc;
  font-size: 1.1rem;
  line-height: 1.6;
  max-width: 500px;
`;

interface VideoCallProps {
  roomName: string;
  userName: string;
  serverUrl?: string;
}

interface RemoteStream {
  peerId: string;
  stream: MediaStream;
  kind: 'video' | 'audio';
  name?: string;
}

const VideoCall: React.FC<VideoCallProps> = ({ 
  roomName, 
  userName, 
  serverUrl = 'http://localhost:3001' 
}) => {
  const [webrtcClient, setWebrtcClient] = useState<WebRTCClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<PeerInfo[]>([]);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, RemoteStream>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Waiting to start');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const clientRef = useRef<WebRTCClient | null>(null);

  const initializeWebRTC = async () => {
    try {
      setError(null);
      setConnectionStatus('Connecting to server...');
      
      console.log('🚀 Initializing WebRTC client...');
      const client = new WebRTCClient(serverUrl);
      clientRef.current = client;
      setWebrtcClient(client);

      // Set up event handlers
      client.onPeerJoined = (peer: PeerInfo) => {
        console.log('👥 Peer joined:', peer);
        setParticipants(prev => [...prev.filter(p => p.id !== peer.id), peer]);
      };

      client.onPeerLeft = (peerId: string) => {
        console.log('👋 Peer left:', peerId);
        setParticipants(prev => prev.filter(p => p.id !== peerId));
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          for (const [key, stream] of newStreams) {
            if (stream.peerId === peerId) {
              newStreams.delete(key);
            }
          }
          return newStreams;
        });
      };

      client.onNewStream = (peerId: string, stream: MediaStream, kind: string) => {
        console.log('📹 New stream from peer:', peerId, kind);
        const participant = participants.find(p => p.id === peerId);
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          const key = `${peerId}-${kind}`;
          newStreams.set(key, {
            peerId,
            stream,
            kind: kind as 'video' | 'audio',
            name: participant?.name || 'Unknown',
          });
          return newStreams;
        });
      };

      client.onLocalStreamReady = (stream: MediaStream, kind: 'video' | 'audio') => {
        console.log(`📹 Local ${kind} stream ready`);
        if (kind === 'video') {
          setLocalVideoStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } else {
          setLocalAudioStream(stream);
        }
      };

      client.onRecordingStarted = (recordingId: string, startTime: Date) => {
        console.log('🔴 Recording started:', recordingId);
        setIsRecording(true);
        setRecordingId(recordingId);
      };

      client.onRecordingStopped = (recordingId: string, endTime: Date) => {
        console.log('⏹️ Recording stopped:', recordingId);
        setIsRecording(false);
        setRecordingId(null);
      };

      client.onError = (error: string) => {
        console.error('❌ WebRTC Error:', error);
        setError(error);
      };

      // Join the room
      setConnectionStatus('Joining room...');
      await client.joinRoom(roomName, userName);
      console.log('✅ Successfully joined room');
      
      setIsConnected(true);
      setConnectionStatus('Connected');

      // Start camera and microphone
      setConnectionStatus('Starting camera...');
      try {
        await client.enableWebcam();
        setIsVideoEnabled(true);
        console.log('📹 Camera enabled');
      } catch (err) {
        console.log('📹 Camera failed, continuing without video');
      }

      setConnectionStatus('Starting microphone...');
      try {
        await client.enableMicrophone();
        setIsAudioEnabled(true);
        console.log('🎤 Microphone enabled');
      } catch (err) {
        console.log('🎤 Microphone failed, continuing without audio');
      }

      setConnectionStatus('Ready');
      setHasStarted(true);

    } catch (error) {
      console.error('💥 Failed to initialize WebRTC:', error);
      setError(`Failed to join room: ${error}`);
      setConnectionStatus('Connection failed');
    }
  };

  const handleToggleVideo = async () => {
    if (!webrtcClient) return;

    try {
      if (isVideoEnabled) {
        await webrtcClient.disableWebcam();
        setLocalVideoStream(null);
        setIsVideoEnabled(false);
      } else {
        await webrtcClient.enableWebcam();
        setIsVideoEnabled(true);
      }
    } catch (error) {
      setError(`Failed to toggle video: ${error}`);
    }
  };

  const handleToggleAudio = async () => {
    if (!webrtcClient) return;

    try {
      if (isAudioEnabled) {
        await webrtcClient.disableMicrophone();
        setLocalAudioStream(null);
        setIsAudioEnabled(false);
      } else {
        await webrtcClient.enableMicrophone();
        setIsAudioEnabled(true);
      }
    } catch (error) {
      setError(`Failed to toggle audio: ${error}`);
    }
  };

  const handleStartRecording = async () => {
    if (!webrtcClient) return;

    try {
      await webrtcClient.startRecording();
    } catch (error) {
      setError(`Failed to start recording: ${error}`);
    }
  };

  const handleStopRecording = async () => {
    if (!webrtcClient || !recordingId) return;

    try {
      await webrtcClient.stopRecording(recordingId);
    } catch (error) {
      setError(`Failed to stop recording: ${error}`);
    }
  };

  const handleLeaveCall = () => {
    if (webrtcClient) {
      webrtcClient.disconnect();
    }
    window.location.reload();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  // Update remote video elements when streams change
  useEffect(() => {
    remoteStreams.forEach((streamInfo, key) => {
      const videoElement = remoteVideoRefs.current.get(key);
      if (videoElement && streamInfo.kind === 'video') {
        videoElement.srcObject = streamInfo.stream;
      }
    });
  }, [remoteStreams]);

  if (!hasStarted) {
    return (
      <VideoCallContainer>
        <Header>
          <RoomInfo>
            <h2>{roomName}</h2>
            <p>Ready to join</p>
          </RoomInfo>
          <ConnectionStatus connected={false}>
            {connectionStatus}
          </ConnectionStatus>
        </Header>

        <VideoArea>
          <StatusMessage>
            <h3>🎥 Ready to Join Video Call</h3>
            <p>
              Welcome <strong>{userName}</strong> to room "<strong>{roomName}</strong>"!
            </p>
            <p>
              Click the button below to connect to the WebRTC server<br/>
              and start your video call with SFU architecture.
            </p>
            
            {error && <ErrorMessage>{error}</ErrorMessage>}
            
            <StartButton onClick={initializeWebRTC}>
              🚀 Connect & Start Call
            </StartButton>
            
            <p style={{ fontSize: '0.9rem', marginTop: '1rem', color: '#999' }}>
              Using mediasoup SFU • Server: {serverUrl}
            </p>
          </StatusMessage>
        </VideoArea>
      </VideoCallContainer>
    );
  }

  // Calculate total video streams for grid layout
  const remoteVideoStreams = Array.from(remoteStreams.values()).filter(s => s.kind === 'video');
  const totalVideoStreams = (localVideoStream ? 1 : 0) + remoteVideoStreams.length;

  return (
    <VideoCallContainer>
      <Header>
        <RoomInfo>
          <h2>{roomName}</h2>
          <p>{participants.length + 1} participant{participants.length !== 0 ? 's' : ''}</p>
        </RoomInfo>
        <ConnectionStatus connected={isConnected}>
          {connectionStatus}
        </ConnectionStatus>
      </Header>

      <VideoArea>
        <VideoGrid videoCount={Math.max(totalVideoStreams, 1)}>
          {/* Local video */}
          <VideoContainer isLocal={true}>
            {isVideoEnabled && localVideoStream ? (
              <VideoElement
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
              />
            ) : (
              <VideoPlaceholder>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  {isVideoEnabled ? '📹' : '📵'}
                </div>
                <div>
                  {isVideoEnabled ? 'Camera Loading...' : 'Camera Off'}
                </div>
              </VideoPlaceholder>
            )}
            <ParticipantLabel isLocal={true}>
              {userName} (You)
            </ParticipantLabel>
          </VideoContainer>

          {/* Remote videos */}
          {remoteVideoStreams.map((streamInfo) => {
            const key = `${streamInfo.peerId}-video`;
            return (
              <VideoContainer key={key}>
                <VideoElement
                  ref={(el) => {
                    if (el) {
                      remoteVideoRefs.current.set(key, el);
                      el.srcObject = streamInfo.stream;
                    }
                  }}
                  autoPlay
                  playsInline
                />
                <ParticipantLabel>
                  {streamInfo.name || 'Remote User'}
                </ParticipantLabel>
              </VideoContainer>
            );
          })}
        </VideoGrid>
        
        <ControlsContainer>
          <ControlButton
            isActive={isAudioEnabled}
            onClick={handleToggleAudio}
            title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioEnabled ? '🎤' : '🔇'}
          </ControlButton>

          <ControlButton
            isActive={isVideoEnabled}
            onClick={handleToggleVideo}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? '📹' : '📵'}
          </ControlButton>

          <ControlButton
            variant="recording"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            title={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? '⏹️' : '🔴'}
          </ControlButton>

          <ControlButton
            variant="danger"
            onClick={handleLeaveCall}
            title="Leave call"
          >
            📞
          </ControlButton>
        </ControlsContainer>
      </VideoArea>
      
      {error && (
        <ErrorMessage>
          {error}
        </ErrorMessage>
      )}
    </VideoCallContainer>
  );
};

export default VideoCall;