import React from 'react';
import styled from 'styled-components';
import { PeerInfo } from '../WebRTC/WebRTCClient';

const Container = styled.div`
  padding: 1rem;
  border-bottom: 1px solid #444;
`;

const Title = styled.h3`
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #fff;
  font-weight: 600;
`;

const ParticipantItem = styled.div<{ isCurrentUser?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: ${props => props.isCurrentUser ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
  border-radius: 8px;
  border: ${props => props.isCurrentUser ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid transparent'};
  transition: background-color 0.2s ease;
  
  &:hover {
    background: ${props => props.isCurrentUser ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 255, 255, 0.1)'};
  }
`;

const Avatar = styled.div<{ isCurrentUser?: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => props.isCurrentUser ? '#4CAF50' : '#666'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: bold;
  color: white;
  flex-shrink: 0;
`;

const ParticipantInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ParticipantName = styled.div<{ isCurrentUser?: boolean }>`
  font-weight: ${props => props.isCurrentUser ? '600' : '500'};
  color: ${props => props.isCurrentUser ? '#4CAF50' : '#fff'};
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ParticipantStatus = styled.div`
  font-size: 0.7rem;
  color: #ccc;
  margin-top: 2px;
`;

const StatusIndicator = styled.div<{ status: 'online' | 'speaking' | 'muted' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => {
    switch (props.status) {
      case 'online': return '#4CAF50';
      case 'speaking': return '#FF9800';
      case 'muted': return '#f44336';
      default: return '#666';
    }
  }};
  flex-shrink: 0;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #666;
  font-size: 0.9rem;
  padding: 2rem 1rem;
`;

const ParticipantCount = styled.div`
  color: #ccc;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
`;

interface ExtendedPeerInfo extends PeerInfo {
  isCurrentUser?: boolean;
  status?: 'online' | 'speaking' | 'muted';
}

interface ParticipantsListProps {
  participants: ExtendedPeerInfo[];
  currentUserId: string;
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({
  participants,
  currentUserId,
}) => {
  console.log('🎨 ParticipantsList rendering:', {
    participants: participants.map(p => ({ id: p.id, name: p.name })),
    currentUserId,
    count: participants.length
  });
  
  // Check for duplicates in the props
  const duplicateIds = participants.filter((participant, index) => 
    participants.findIndex(p => p.id === participant.id) !== index
  );
  if (duplicateIds.length > 0) {
    console.warn('⚠️ DUPLICATES IN PARTICIPANTS PROPS:', duplicateIds);
  }
  
  // Check if current user is in the participants list
  const currentUserInList = participants.find(p => p.id === currentUserId);
  if (currentUserInList) {
    console.warn('⚠️ CURRENT USER FOUND IN PARTICIPANTS PROPS:', currentUserInList);
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getParticipantStatus = (participant: ExtendedPeerInfo): 'online' | 'speaking' | 'muted' => {
    if (participant.status) {
      return participant.status;
    }
    // Default to online for now - in a real app, this would be based on actual audio/video state
    return 'online';
  };

  const sortedParticipants = [...participants].sort((a, b) => {
    // Current user first
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    // Then sort alphabetically
    return a.name.localeCompare(b.name);
  });

  return (
    <Container>
      <Title>Participants</Title>
      
      <ParticipantCount>
        {participants.length} participant{participants.length !== 1 ? 's' : ''}
      </ParticipantCount>

      {participants.length === 0 ? (
        <EmptyState>
          No other participants yet
        </EmptyState>
      ) : (
        sortedParticipants.map((participant) => {
          const isCurrentUser = participant.id === currentUserId;
          const status = getParticipantStatus(participant);
          
          return (
            <ParticipantItem
              key={participant.id}
              isCurrentUser={isCurrentUser}
            >
              <Avatar isCurrentUser={isCurrentUser}>
                {getInitials(participant.name)}
              </Avatar>
              
              <ParticipantInfo>
                <ParticipantName isCurrentUser={isCurrentUser}>
                  {participant.name}
                  {isCurrentUser && ' (You)'}
                </ParticipantName>
                <ParticipantStatus>
                  {status === 'speaking' && 'Speaking...'}
                  {status === 'muted' && 'Muted'}
                  {status === 'online' && !isCurrentUser && 'Online'}
                  {status === 'online' && isCurrentUser && 'Connected'}
                </ParticipantStatus>
              </ParticipantInfo>
              
              <StatusIndicator status={status} />
            </ParticipantItem>
          );
        })
      )}
    </Container>
  );
};

export default ParticipantsList;