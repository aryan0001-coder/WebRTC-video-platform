import React, { useState } from 'react';
import Landing from './components/Landing/Landing';
import VideoCall from './components/VideoCall/VideoCall';

type AppState = 'landing' | 'call';

function App() {
  const [currentState, setCurrentState] = useState<AppState>('landing');
  const [roomName, setRoomName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  const handleJoinCall = (room: string, user: string) => {
    setRoomName(room);
    setUserName(user);
    setCurrentState('call');
  };

  const handleLeaveCall = () => {
    setCurrentState('landing');
    setRoomName('');
    setUserName('');
  };

  // Determine server URL based on environment
  const getServerUrl = () => {
    if (process.env.NODE_ENV === 'production') {
      // In production, use the same domain
      return window.location.origin;
    }
    // In development, use localhost
    return process.env.REACT_APP_SERVER_URL || 'http://localhost:3000';
  };

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      {currentState === 'landing' ? (
        <Landing onJoinCall={handleJoinCall} />
      ) : (
        <VideoCall
          roomName={roomName}
          userName={userName}
          serverUrl={getServerUrl()}
        />
      )}
    </div>
  );
}

export default App;
