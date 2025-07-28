import React from 'react';
import styled from 'styled-components';

const ControlsContainer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: 2rem 1rem 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
`;

const ControlButton = styled.button<{ 
  isActive?: boolean; 
  variant?: 'primary' | 'danger' | 'success' | 'secondary' 
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s ease;
  
  background: ${props => {
    if (props.variant === 'danger') return '#f44336';
    if (props.variant === 'success') return '#4CAF50';
    if (props.variant === 'primary') return '#2196F3';
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

const RecordingButton = styled(ControlButton)<{ isRecording: boolean }>`
  background: ${props => props.isRecording ? '#f44336' : '#FF9800'};
  position: relative;
  
  ${props => props.isRecording && `
    &::after {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
      top: 8px;
      right: 8px;
      animation: blink 1s infinite;
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `}
`;

const SidebarToggle = styled(ControlButton)`
  margin-left: auto;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const Tooltip = styled.div<{ visible: boolean }>`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  white-space: nowrap;
  opacity: ${props => props.visible ? 1 : 0};
  pointer-events: none;
  transition: opacity 0.2s ease;
  margin-bottom: 0.5rem;
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(0, 0, 0, 0.8);
  }
`;

const TooltipButton = styled.div`
  position: relative;
  
  &:hover ${Tooltip} {
    opacity: 1;
  }
`;

interface ControlPanelProps {
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onLeaveCall: () => void;
  onToggleSidebar: () => void;
  isRecording: boolean;
  sidebarOpen: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  isVideoEnabled,
  isAudioEnabled,
  onToggleVideo,
  onToggleAudio,
  onStartRecording,
  onStopRecording,
  onLeaveCall,
  onToggleSidebar,
  isRecording,
  sidebarOpen,
}) => {
  return (
    <ControlsContainer>
      <ControlGroup>
        <TooltipButton>
          <ControlButton
            isActive={isAudioEnabled}
            onClick={onToggleAudio}
            aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioEnabled ? '🎤' : '🔇'}
          </ControlButton>
          <Tooltip visible={false}>
            {isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          </Tooltip>
        </TooltipButton>

        <TooltipButton>
          <ControlButton
            isActive={isVideoEnabled}
            onClick={onToggleVideo}
            aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? '📹' : '📵'}
          </ControlButton>
          <Tooltip visible={false}>
            {isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          </Tooltip>
        </TooltipButton>
      </ControlGroup>

      <ControlGroup>
        <TooltipButton>
          <RecordingButton
            isRecording={isRecording}
            onClick={isRecording ? onStopRecording : onStartRecording}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? '⏹️' : '🔴'}
          </RecordingButton>
          <Tooltip visible={false}>
            {isRecording ? 'Stop recording' : 'Start recording'}
          </Tooltip>
        </TooltipButton>

        <TooltipButton>
          <ControlButton
            variant="danger"
            onClick={onLeaveCall}
            aria-label="Leave call"
          >
            📞
          </ControlButton>
          <Tooltip visible={false}>
            Leave call
          </Tooltip>
        </TooltipButton>
      </ControlGroup>

      <SidebarToggle
        isActive={sidebarOpen}
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? '▶️' : '◀️'}
      </SidebarToggle>
    </ControlsContainer>
  );
};

export default ControlPanel;