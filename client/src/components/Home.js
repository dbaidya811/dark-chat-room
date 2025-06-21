import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const [username, setUsername] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');
  const [showRoomUrl, setShowRoomUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const createRoom = async () => {
    if (!username.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        setRoomUrl(data.roomUrl);
        setShowRoomUrl(true);
        setIsCreating(true);
      } else {
        alert('Failed to create room');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = () => {
    if (!username.trim()) {
      alert('Please enter your name');
      return;
    }
    navigate(`/room/${roomUrl.split('/').pop()}`);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      alert('Room link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = roomUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Room link copied to clipboard!');
    }
  };

  return (
    <div className="home-container min-h-screen flex items-center justify-center">
      <div className="container">
        <div className="card max-w-md mx-auto fade-in">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              Dark Chat Room
            </h1>
            <p className="text-gray-300">
              Create a room and share the link to start chatting
            </p>
          </div>

          {!isCreating ? (
            <div className="space-y-4">
              <div>
                <label className="block text-white font-medium mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your name"
                  className="input"
                  onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                />
              </div>

              <button
                onClick={createRoom}
                disabled={isLoading}
                className="btn btn-primary w-full"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="spinner"></div>
                    Creating Room...
                  </div>
                ) : (
                  'Create New Room'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-dark rounded-lg p-4 border border-white/10">
                <h3 className="text-white font-medium mb-2">Room Created!</h3>
                <p className="text-gray-300 text-sm mb-3">
                  Share this link with others to invite them to the chat:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={roomUrl}
                    readOnly
                    className="input text-sm"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="btn btn-secondary text-sm px-3 py-2"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <button
                onClick={joinRoom}
                className="btn btn-primary w-full"
              >
                Join Room
              </button>

              <button
                onClick={() => {
                  setIsCreating(false);
                  setShowRoomUrl(false);
                  setRoomUrl('');
                }}
                className="btn btn-secondary w-full"
              >
                Create Another Room
              </button>
            </div>
          )}
        </div>

        {/* Features section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="card feature-card text-center">
            <div className="feature-icon">🚀</div>
            <h3 className="text-white font-medium mb-2">Instant Setup</h3>
            <p className="text-gray-300 text-sm">
              Create a room in seconds and start chatting immediately
            </p>
          </div>
          
          <div className="card feature-card text-center">
            <div className="feature-icon">🔗</div>
            <h3 className="text-white font-medium mb-2">Shareable Links</h3>
            <p className="text-gray-300 text-sm">
              Share your room link with anyone to invite them to chat
            </p>
          </div>
          
          <div className="card feature-card text-center">
            <div className="feature-icon">💬</div>
            <h3 className="text-white font-medium mb-2">Real-time Chat</h3>
            <p className="text-gray-300 text-sm">
              Messages appear instantly for all participants
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home; 