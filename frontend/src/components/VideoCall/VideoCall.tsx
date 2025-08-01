import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { WebRTCClient, PeerInfo } from '../WebRTC/WebRTCClient';
import VideoGrid from './VideoGrid';
import ParticipantsList from './participantsList';

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
  serverUrl = 'http://localhost:3000' 
}) => {
  const [webrtcClient, setWebrtcClient] = useState<WebRTCClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<PeerInfo[]>([]);
  const participantsRef = React.useRef<PeerInfo[]>([]);
  const [localPeerId, setLocalPeerId] = useState<string | null>(null);
  // Track recently processed peer IDs to prevent duplicates
  const recentlyProcessedPeers = React.useRef<Set<string>>(new Set());
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, RemoteStream>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [hasVideoEverBeenEnabled, setHasVideoEverBeenEnabled] = useState(false);
  const [hasAudioEverBeenEnabled, setHasAudioEverBeenEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Waiting to start');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const clientRef = useRef<WebRTCClient | null>(null);

  // Add a custom setParticipants function to track all changes
  const setParticipantsWithLogging = (newParticipants: PeerInfo[] | ((prev: PeerInfo[]) => PeerInfo[])) => {
    setParticipants((prev) => {
      const next = typeof newParticipants === 'function' ? newParticipants(prev) : newParticipants;
      
      // Final safeguard: filter out local peer from participants list
      const filteredNext = next.filter(p => p.id !== localPeerId);
      
      console.log('🔄 Participants state changed:', {
        from: prev.map(p => ({ id: p.id, name: p.name })),
        to: filteredNext.map(p => ({ id: p.id, name: p.name })),
        count: { from: prev.length, to: filteredNext.length },
        localPeerId
      });
      
      return filteredNext;
    });
  };

  const initializeWebRTC = async () => {
    try {
      setError(null);
      setConnectionStatus('Connecting to server...');
      
      console.log('🚀 Initializing WebRTC client...');
      const client = new WebRTCClient(serverUrl);
      clientRef.current = client;
      setWebrtcClient(client);

      // Set up event handlers
      client.onJoined = (peerId: string) => {
        console.log('🎯 Setting localPeerId:', peerId);
        setLocalPeerId(peerId);
      };

      client.onPeerJoined = (peer: PeerInfo) => {
        console.log('👥 Peer joined event received:', peer, 'localPeerId:', localPeerId);
        console.log('👥 Current participants before adding:', participantsRef.current.map(p => ({ id: p.id, name: p.name })));
        console.log('👥 recentlyProcessedPeers:', Array.from(recentlyProcessedPeers.current));
        
        // Check if we've recently processed this peer to prevent duplicates
        if (recentlyProcessedPeers.current.has(peer.id)) {
          console.log('⚠️ Peer recently processed, skipping duplicate:', peer.id, peer.name);
          return;
        }
        
        setParticipantsWithLogging((prev) => {
          // Skip if localPeerId is not set yet
          if (!localPeerId) {
            console.log('localPeerId not set yet, skipping peerJoined event for:', peer.id);
            return prev;
          }
          // Do not add if this is the local peer
          if (peer.id === localPeerId) {
            console.log('⚠️ LOCAL PEER DETECTED IN PEERJOINED EVENT - skipping:', peer.id, peer.name);
            return prev;
          }
          // Only add if not already present
          if (prev.some((p) => p.id === peer.id)) {
            console.log('Peer already in list, skipping:', peer.id);
            return prev;
          }
          console.log('✅ Adding new peer to participants:', peer.name, peer.id);
          
          // Mark this peer as recently processed
          recentlyProcessedPeers.current.add(peer.id);
          // Remove from recently processed after 1 second (reduced from 5 seconds)
          setTimeout(() => {
            recentlyProcessedPeers.current.delete(peer.id);
            console.log('🔄 Removed peer from recentlyProcessedPeers:', peer.id);
          }, 1000);
          
          const newParticipants = [...prev, peer];
          // Deduplicate by id
          const deduped = Array.from(new Map(newParticipants.map(p => [p.id, p])).values());
          participantsRef.current = deduped;
          console.log('Updated participants after peerJoined:', deduped);
          
          // Update any existing streams for this peer with their proper name
          setRemoteStreams((prevStreams) => {
            const newStreams = new Map(prevStreams);
            for (const [key, stream] of newStreams) {
              if (stream.peerId === peer.id) {
                newStreams.set(key, {
                  ...stream,
                  name: peer.name,
                });
              }
            }
            return newStreams;
          });
          
          return deduped;
        });
      };

      // Listen for the full participant list on join
      client.onParticipantList = (peers: PeerInfo[]) => {
        console.log('📋 Received full participant list:', peers);
        console.log('📋 Participant IDs:', peers.map(p => p.id));
        console.log('📋 Participant names:', peers.map(p => p.name));
        console.log('📋 Full participant details:', JSON.stringify(peers, null, 2));
        console.log('📋 Current localPeerId:', localPeerId);
        
        // Check if local peer is in the received list
        const localPeerInList = peers.find(p => p.id === localPeerId);
        if (localPeerInList) {
          console.warn('⚠️ LOCAL PEER FOUND IN PARTICIPANT LIST:', localPeerInList);
        }
        
        // Check for duplicates in the received list
        const duplicateIds = peers.filter((peer, index) => 
          peers.findIndex(p => p.id === peer.id) !== index
        );
        if (duplicateIds.length > 0) {
          console.warn('⚠️ DUPLICATES FOUND IN PARTICIPANT LIST:', duplicateIds);
        }
        
        // Deduplicate by id
        const deduped = Array.from(new Map(peers.map(p => [p.id, p])).values());
        console.log('📋 Deduplicated list:', deduped);
        console.log('📋 Deduplicated IDs:', deduped.map(p => p.id));
        
        setParticipantsWithLogging(deduped);
        participantsRef.current = deduped;
      };

      client.onPeerLeft = (peerId: string) => {
        console.log('👋 Peer left:', peerId);
        setParticipantsWithLogging((prev) => {
          const updated = prev.filter((p) => p.id !== peerId);
          participantsRef.current = updated;
          console.log('Updated participants after peer left:', updated);
          return updated;
        });
        setRemoteStreams((prev) => {
          const newStreams = new Map(prev);
          for (const [key, stream] of newStreams) {
            if (stream.peerId === peerId) {
              console.log('Removing stream for peer:', peerId, 'key:', key);
              newStreams.delete(key);
            }
          }
          console.log('Updated remoteStreams after peer left:', newStreams);
          return newStreams;
        });
      };

      client.onNewStream = (peerId: string, stream: MediaStream, kind: string) => {
        console.log('📹 [STREAM DEBUG] New stream from peer:', peerId, kind);
        console.log('📹 [STREAM DEBUG] Current participants:', participantsRef.current.map(p => ({ id: p.id, name: p.name })));
        
        setRemoteStreams((prev) => {
          const newStreams = new Map(prev);
          const key = `${peerId}-${kind}`;
          // Use participantsRef to get latest participants
          const participant = participantsRef.current.find((p) => p.id === peerId);
          if (!participant) {
            console.log('⚠️ [STREAM DEBUG] Stream received for unknown peer:', peerId, 'kind:', kind, '- waiting for peer to be added');
            // Don't create unknown participant, just store the stream temporarily
            newStreams.set(key, {
              peerId,
              stream,
              kind: kind as 'video' | 'audio',
              name: peerId, // Use peerId as temporary name
            });
          } else {
            console.log('✅ [STREAM DEBUG] Stream received for known peer:', participant.name, 'kind:', kind);
            newStreams.set(key, {
              peerId,
              stream,
              kind: kind as 'video' | 'audio',
              name: participant.name,
            });
          }
          return newStreams;
        });
      };

      client.onLocalStreamReady = (stream: MediaStream, kind: 'video' | 'audio') => {
        console.log(`📹 Local ${kind} stream ready`);
        if (kind === 'video') {
          // Add event listeners to video track to detect ended or inactive
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.onended = () => {
              console.warn('⚠️ Local video track ended');
              setLocalVideoStream(null);
              setIsVideoEnabled(false);
              setError('Your camera video track ended unexpectedly.');
              // Optionally try to re-enable webcam after short delay
              setTimeout(() => {
                if (clientRef.current) {
                  clientRef.current.enableWebcam().catch((err) => {
                    console.error('Failed to re-enable webcam:', err);
                    setError('Failed to re-enable webcam after video track ended.');
                  });
                }
              }, 3000);
            };
            videoTrack.addEventListener('inactive', () => {
              console.warn('⚠️ Local video track inactive');
              setLocalVideoStream(null);
              setIsVideoEnabled(false);
              setError('Your camera video track became inactive.');
              // Optionally try to re-enable webcam after short delay
              setTimeout(() => {
                if (clientRef.current) {
                  clientRef.current.enableWebcam().catch((err) => {
                    console.error('Failed to re-enable webcam:', err);
                    setError('Failed to re-enable webcam after video track became inactive.');
                  });
                }
              }, 3000);
            });
          }
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
      const joinData = await client.joinRoom(roomName, userName);

      // Start camera and microphone
      setConnectionStatus('Starting camera...');
      try {
        await client.enableWebcam();
        setIsVideoEnabled(true);
        setHasVideoEverBeenEnabled(true);
        console.log('📹 Camera enabled');
      } catch (err) {
        console.log('📹 Camera failed, continuing without video');
      }

      setConnectionStatus('Starting microphone...');
      try {
        console.log('🎤 [VIDEOCALL DEBUG] Attempting to enable microphone...');
        const audioStream = await client.enableMicrophone();
        setIsAudioEnabled(true);
        setHasAudioEverBeenEnabled(true);
        console.log(audioStream)
        console.log('🎤 [VIDEOCALL DEBUG] Microphone enabled successfully, stream:', audioStream);
        console.log('🎤 [VIDEOCALL DEBUG] Audio tracks:', audioStream.getAudioTracks());
      } catch (err) {
        console.error('🎤 [VIDEOCALL ERROR] Microphone failed:', err);
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
    if (!webrtcClient) {
      console.error('❌ WebRTC client not available');
      return;
    }

    try {
      console.log('🔄 Toggling video...', { 
        currentState: isVideoEnabled,
        hasVideoEverBeenEnabled,
        localVideoStream: !!localVideoStream
      });
      
      if (isVideoEnabled) {
        await webrtcClient.disableWebcam();
        // Don't set localVideoStream to null - keep the stream but it's disabled
        setIsVideoEnabled(false);
        console.log('📹 Video disabled');
      } else {
        const stream = await webrtcClient.enableWebcam();
        setLocalVideoStream(stream);
        setIsVideoEnabled(true);
        setHasVideoEverBeenEnabled(true);
        console.log('📹 Video enabled, stream:', stream);
      }
    } catch (error) {
      console.error('❌ Error toggling video:', error);
      setError(`Failed to toggle video: ${error}`);
    }
  };

  const handleToggleAudio = async () => {
    if (!webrtcClient) {
      console.error('❌ WebRTC client not available');
      alert("vghjk")
      return;
    }

    try {
      console.log('🔄 [AUDIO TOGGLE DEBUG] Toggling audio...', { 
        currentState: isAudioEnabled,
        hasAudioEverBeenEnabled,
        localAudioStream: !!localAudioStream
      });
      
      if (isAudioEnabled) {
        console.log('🔄 [AUDIO TOGGLE DEBUG] Disabling audio...');
        await webrtcClient.disableMicrophone();
        // Don't set localAudioStream to null - keep the stream but it's disabled
        setIsAudioEnabled(false);
        console.log('🎤 [AUDIO TOGGLE DEBUG] Audio disabled');
      } else {
        console.log('🔄 [AUDIO TOGGLE DEBUG] Enabling audio...');
        const stream = await webrtcClient.enableMicrophone();

        setLocalAudioStream(stream);
        setIsAudioEnabled(true);
        setHasAudioEverBeenEnabled(true);
        console.log('🎤 [AUDIO TOGGLE DEBUG] Audio enabled, stream:', stream);
        console.log('🎤 [AUDIO TOGGLE DEBUG] Audio tracks:', stream.getAudioTracks());
      }
    } catch (error) {
      console.error('❌ [AUDIO TOGGLE ERROR] Error toggling audio:', error);
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
    if (!hasStarted) {
      initializeWebRTC();
    }
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []); // Remove participants from dependency array

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

  return (
    <VideoCallContainer>
      <Header>
          <RoomInfo>
            <h2>{roomName}</h2>
            <p>{participants.length} participant{participants.length !== 1 ? 's' : ''}</p>
          </RoomInfo>
        <ConnectionStatus connected={isConnected}>
          {connectionStatus}
        </ConnectionStatus>
      </Header>

      <VideoArea>
        <VideoGrid
          localVideoStream={localVideoStream}
          localAudioStream={localAudioStream}
          remoteStreams={remoteStreams}
          participants={participants}
          userName={userName}
          isVideoEnabled={isVideoEnabled}
          isAudioEnabled={isAudioEnabled}
          hasVideoEverBeenEnabled={hasVideoEverBeenEnabled}
          hasAudioEverBeenEnabled={hasAudioEverBeenEnabled}
        />
        
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
