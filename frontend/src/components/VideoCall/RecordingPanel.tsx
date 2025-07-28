import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  padding: 1rem;
`;

const Title = styled.h3`
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #fff;
  font-weight: 600;
`;

const RecordingStatus = styled.div<{ isRecording: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: ${props => props.isRecording ? 'rgba(244, 67, 54, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  border: ${props => props.isRecording ? '1px solid rgba(244, 67, 54, 0.3)' : '1px solid #444'};
  border-radius: 8px;
  margin-bottom: 1rem;
`;

const RecordingIndicator = styled.div<{ isRecording: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.isRecording ? '#f44336' : '#666'};
  
  ${props => props.isRecording && `
    animation: blink 1s infinite;
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `}
`;

const StatusText = styled.div<{ isRecording: boolean }>`
  flex: 1;
  font-size: 0.9rem;
  color: ${props => props.isRecording ? '#f44336' : '#ccc'};
  font-weight: ${props => props.isRecording ? '500' : '400'};
`;

const Timer = styled.div`
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: #f44336;
  font-weight: bold;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'danger' }>`
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  background: ${props => props.variant === 'danger' ? '#f44336' : '#4CAF50'};
  color: white;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const RecordingInfo = styled.div`
  font-size: 0.8rem;
  color: #ccc;
  line-height: 1.4;
  margin-bottom: 1rem;
`;

const FeatureList = styled.ul`
  font-size: 0.8rem;
  color: #ccc;
  margin: 0;
  padding-left: 1.2rem;
  
  li {
    margin-bottom: 0.3rem;
  }
`;

interface RecordingPanelProps {
  isRecording: boolean;
  recordingStartTime: Date | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({
  isRecording,
  recordingStartTime,
  onStartRecording,
  onStopRecording,
}) => {
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');

  useEffect(() => {
    if (!isRecording || !recordingStartTime) {
      setElapsedTime('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = now.getTime() - recordingStartTime.getTime();
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      const formatTime = (num: number) => num.toString().padStart(2, '0');
      
      setElapsedTime(
        `${formatTime(hours)}:${formatTime(minutes % 60)}:${formatTime(seconds % 60)}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  return (
    <Container>
      <Title>Recording</Title>
      
      <RecordingStatus isRecording={isRecording}>
        <RecordingIndicator isRecording={isRecording} />
        <StatusText isRecording={isRecording}>
          {isRecording ? 'Recording in progress' : 'Not recording'}
        </StatusText>
        {isRecording && <Timer>{elapsedTime}</Timer>}
      </RecordingStatus>

      {isRecording ? (
        <ActionButton 
          variant="danger" 
          onClick={onStopRecording}
        >
          Stop Recording
        </ActionButton>
      ) : (
        <ActionButton onClick={onStartRecording}>
          Start Recording
        </ActionButton>
      )}

      <RecordingInfo>
        {isRecording ? (
          <>
            Recording started at {recordingStartTime?.toLocaleTimeString()}. 
            The recording includes all audio and video from the current meeting.
          </>
        ) : (
          <>
            Click "Start Recording" to begin recording the meeting. 
            The recording will include:
          </>
        )}
      </RecordingInfo>

      {!isRecording && (
        <FeatureList>
          <li>All participant video streams</li>
          <li>All participant audio streams</li>
          <li>High quality output format</li>
          <li>Automatic file generation</li>
        </FeatureList>
      )}
    </Container>
  );
};

export default RecordingPanel;