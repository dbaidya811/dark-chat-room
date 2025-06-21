import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './ChatRoom.css';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

const ChatRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState('');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState('');
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const audioRefs = useRef({});
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // Check if room exists
    checkRoomExists();

    return () => {
      newSocket.close();
    };
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;

    // Socket event listeners
    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('room-data', (roomData) => {
      setMessages(roomData.messages || []);
      setUsers(roomData.users || []);
      setIsLoading(false);
    });

    socket.on('new-message', (messageData) => {
      setMessages(prev => [...prev, messageData]);
    });

    socket.on('user-joined', (user) => {
      setUsers(prev => [...prev, user]);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${user.username} joined the chat`,
        username: 'System',
        userId: 'system',
        timestamp: new Date(),
        isSystem: true
      }]);
    });

    socket.on('user-left', (user) => {
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${user.username} left the chat`,
        username: 'System',
        userId: 'system',
        timestamp: new Date(),
        isSystem: true
      }]);
    });

    socket.on('user-typing', ({ username, isTyping }) => {
      if (isTyping) {
        setTypingUsers(prev => [...prev.filter(u => u !== username), username]);
      } else {
        setTypingUsers(prev => prev.filter(u => u !== username));
      }
    });

    socket.on('error', (error) => {
      alert(error.message);
      navigate('/');
    });

    // --- Voice Call Signaling ---
    socket.on('voice-user-joined', async ({ userId }) => {
      if (userId === socket.id) return;
      if (!localStreamRef.current) return;
      
      console.log('New user joined voice call:', userId);
      // Create peer connection
      const peer = createPeer(userId, socket.id);
      if (peer) {
        peersRef.current[userId] = peer;
      }
    });

    socket.on('voice-receive-offer', async ({ from, offer }) => {
      console.log('Received voice offer from:', from);
      const peer = addPeer(from, offer);
      if (peer) {
        peersRef.current[from] = peer;
      }
    });

    socket.on('voice-receive-answer', ({ from, answer }) => {
      console.log('Received voice answer from:', from);
      const peer = peersRef.current[from];
      if (peer) {
        peer.setRemoteDescription(new RTCSessionDescription(answer))
          .catch(err => console.error('Error setting remote description:', err));
      }
    });

    socket.on('voice-receive-ice', ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (peer && candidate) {
        peer.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(err => console.error('Error adding ICE candidate:', err));
      }
    });

    socket.on('voice-user-left', ({ userId }) => {
      console.log('User left voice call:', userId);
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setVoiceParticipants(prev => prev.filter(id => id !== userId));
      
      // Remove audio element
      const audioElement = document.getElementById(`audio-${userId}`);
      if (audioElement) {
        audioElement.remove();
        delete audioRefs.current[userId];
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room-data');
      socket.off('new-message');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('user-typing');
      socket.off('error');
      socket.off('voice-user-joined');
      socket.off('voice-receive-offer');
      socket.off('voice-receive-answer');
      socket.off('voice-receive-ice');
      socket.off('voice-user-left');
    };
  }, [socket, navigate]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup voice call resources on unmount
  useEffect(() => {
    return () => {
      if (isVoiceCallActive) {
        leaveVoiceCall();
      }
    };
  }, [isVoiceCallActive]);

  const checkRoomExists = async () => {
    try {
      const response = await fetch(`/api/room/${roomId}`);
      if (!response.ok) {
        alert('Room not found');
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking room:', error);
      alert('Failed to connect to room');
      navigate('/');
    }
  };

  const joinRoom = () => {
    if (!username.trim()) {
      alert('Please enter your name');
      return;
    }

    socket.emit('join-room', { roomId, username });
    setShowUsernameModal(false);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async () => {
    if (!selectedFile || !isConnected) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate file upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    try {
      // In a real app, you would upload to a cloud service
      // For now, we'll simulate the upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setUploadProgress(100);
      
      // Create file message
      const fileMessage = {
        id: Date.now(),
        text: selectedFile.name,
        username,
        userId: socket.id,
        timestamp: new Date(),
        attachment: {
          type: selectedFile.type.startsWith('image/') ? 'image' : 'file',
          name: selectedFile.name,
          size: selectedFile.size,
          url: filePreview || '#', // In real app, this would be the uploaded file URL
          mimeType: selectedFile.type
        }
      };

      // Send file message
      socket.emit('send-message', {
        roomId,
        message: `📎 ${selectedFile.name}`,
        username,
        attachment: fileMessage.attachment
      });

      // Clear file selection
      removeSelectedFile();
      
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      clearInterval(progressInterval);
    }
  };

  const sendMessage = () => {
    if ((!message.trim() && !selectedFile) || !isConnected) return;

    if (selectedFile) {
      uploadFile();
      return;
    }

    socket.emit('send-message', {
      roomId,
      message: message.trim(),
      username
    });

    setMessage('');
    
    // Clear typing indicator
    socket.emit('typing', { roomId, username, isTyping: false });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleTyping = () => {
    if (!isConnected) return;

    socket.emit('typing', { roomId, username, isTyping: true });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { roomId, username, isTyping: false });
    }, 1000);
  };

  const copyRoomLink = async () => {
    const roomLink = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(roomLink);
      alert('Room link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      const textArea = document.createElement('textarea');
      textArea.value = roomLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Room link copied to clipboard!');
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const openImageModal = (imageUrl) => {
    setModalImage(imageUrl);
    setShowImageModal(true);
  };

  const renderAttachment = (attachment) => {
    if (attachment.type === 'image') {
      return (
        <div className="message-attachment">
          <img 
            src={attachment.url} 
            alt={attachment.name}
            className="attachment-image"
            onClick={() => openImageModal(attachment.url)}
          />
        </div>
      );
    } else {
      return (
        <div className="message-attachment">
          <div className="attachment-file">
            <div className="file-icon">📄</div>
            <div>
              <div className="text-white text-sm font-medium">{attachment.name}</div>
              <div className="text-gray-400 text-xs">{formatFileSize(attachment.size)}</div>
            </div>
          </div>
        </div>
      );
    }
  };

  // --- WebRTC Peer Connection Functions ---
  const createPeer = (userIdToSignal, callerId) => {
    try {
      const peer = new RTCPeerConnection(ICE_SERVERS);
      
      peer.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('voice-send-ice', {
            to: userIdToSignal,
            from: callerId,
            candidate: event.candidate
          });
        }
      };

      peer.ontrack = event => {
        console.log('Received remote stream from:', userIdToSignal);
        setVoiceParticipants(prev => {
          if (!prev.includes(userIdToSignal)) return [...prev, userIdToSignal];
          return prev;
        });
        
        // Create audio element for remote stream
        const audio = document.createElement('audio');
        audio.id = `audio-${userIdToSignal}`;
        audio.autoplay = true;
        audio.srcObject = event.streams[0];
        document.getElementById('voice-audio-container').appendChild(audio);
        audioRefs.current[userIdToSignal] = audio;
      };

      peer.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peer.iceConnectionState);
      };

      peer.onconnectionstatechange = () => {
        console.log('Connection state:', peer.connectionState);
      };

      // Add local stream tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peer.addTrack(track, localStreamRef.current);
        });
      }

      // Create and send offer
      peer.createOffer()
        .then(offer => peer.setLocalDescription(offer))
        .then(() => {
          socket.emit('voice-send-offer', {
            to: userIdToSignal,
            from: callerId,
            offer: peer.localDescription
          });
        })
        .catch(err => {
          console.error('Error creating offer:', err);
        });

      return peer;
    } catch (err) {
      console.error('Error creating peer:', err);
      return null;
    }
  };

  const addPeer = (from, offer) => {
    try {
      const peer = new RTCPeerConnection(ICE_SERVERS);
      
      peer.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('voice-send-ice', {
            to: from,
            from: socket.id,
            candidate: event.candidate
          });
        }
      };

      peer.ontrack = event => {
        console.log('Received remote stream from:', from);
        setVoiceParticipants(prev => {
          if (!prev.includes(from)) return [...prev, from];
          return prev;
        });
        
        // Create audio element for remote stream
        const audio = document.createElement('audio');
        audio.id = `audio-${from}`;
        audio.autoplay = true;
        audio.srcObject = event.streams[0];
        document.getElementById('voice-audio-container').appendChild(audio);
        audioRefs.current[from] = audio;
      };

      peer.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peer.iceConnectionState);
      };

      peer.onconnectionstatechange = () => {
        console.log('Connection state:', peer.connectionState);
      };

      // Set remote description and create answer
      peer.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
          // Add local stream tracks
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
              peer.addTrack(track, localStreamRef.current);
            });
          }
          return peer.createAnswer();
        })
        .then(answer => peer.setLocalDescription(answer))
        .then(() => {
          socket.emit('voice-send-answer', {
            to: from,
            from: socket.id,
            answer: peer.localDescription
          });
        })
        .catch(err => {
          console.error('Error handling offer:', err);
        });

      return peer;
    } catch (err) {
      console.error('Error adding peer:', err);
      return null;
    }
  };

  // --- Voice Call Controls ---
  const startVoiceCall = async () => {
    try {
      console.log('Starting voice call...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      localStreamRef.current = stream;
      setIsVoiceCallActive(true);
      setVoiceParticipants([socket.id]);
      
      // Create audio element for local stream (muted)
      const localAudio = document.createElement('audio');
      localAudio.id = `audio-${socket.id}`;
      localAudio.autoplay = true;
      localAudio.muted = true;
      localAudio.srcObject = stream;
      document.getElementById('voice-audio-container').appendChild(localAudio);
      audioRefs.current[socket.id] = localAudio;
      
      console.log('Voice call started successfully');
      socket.emit('voice-join', { roomId });
    } catch (err) {
      console.error('Error starting voice call:', err);
      alert('Microphone access denied or not available. Please check your browser permissions.');
    }
  };

  const leaveVoiceCall = () => {
    console.log('Leaving voice call...');
    setIsVoiceCallActive(false);
    setVoiceParticipants([]);
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => {
      if (peer) peer.close();
    });
    peersRef.current = {};
    
    // Remove all audio elements
    Object.values(audioRefs.current).forEach(audio => {
      if (audio && audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
    });
    audioRefs.current = {};
    
    socket.emit('voice-leave', { roomId });
    console.log('Voice call ended');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      let isCurrentlyMuted = true;
      
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
        isCurrentlyMuted = !track.enabled;
      });
      
      setIsMuted(isCurrentlyMuted);
      console.log('Microphone', isCurrentlyMuted ? 'muted' : 'unmuted');
    }
  };

  if (showUsernameModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-darker">
        <div className="card max-w-md mx-auto fade-in">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              Join Dark Chat Room
            </h2>
            <p className="text-gray-300">
              Enter your name to join the conversation
            </p>
          </div>

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
                onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
                autoFocus
              />
            </div>

            <button
              onClick={joinRoom}
              className="btn btn-primary w-full"
            >
              Join Room
            </button>

            <button
              onClick={() => navigate('/')}
              className="btn btn-secondary w-full"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-room">
      {/* Header */}
      <div className="chat-header">
        <div className="header-content">
          <div className="room-info">
            <h2 className="room-title">Dark Chat Room</h2>
            <p className="room-id">Room ID: {roomId}</p>
          </div>
          
          <div className="header-actions">
            <div className="connection-status">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
              <span className="status-text">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* Voice Call Button */}
            {!isVoiceCallActive ? (
              <button onClick={startVoiceCall} className="btn btn-success">
                🎤 Start Voice Call
              </button>
            ) : (
              <>
                <button onClick={leaveVoiceCall} className="btn btn-danger">
                  🔴 Leave Voice Call
                </button>
                <button onClick={toggleMute} className="btn btn-secondary">
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <span className="text-gray-300 text-sm">
                  Voice: {voiceParticipants.length} online
                </span>
              </>
            )}
            
            <button onClick={copyRoomLink} className="btn btn-secondary">
              Share Link
            </button>
            
            <button onClick={() => navigate('/')} className="btn btn-secondary">
              Leave Room
            </button>
          </div>
        </div>
      </div>

      <div className="chat-container">
        {/* Users sidebar */}
        <div className="users-sidebar">
          <h3 className="sidebar-title">Online Users ({users.length})</h3>
          <div className="users-list">
            {users.map(user => (
              <div key={user.id} className="user-item">
                <div className="user-avatar">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="user-name">{user.username}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="chat-area">
          {isLoading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p className="text-white">Loading messages...</p>
            </div>
          ) : (
            <>
              <div className="messages-container">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${msg.isSystem ? 'system-message' : msg.userId === socket?.id ? 'own-message' : 'other-message'}`}
                  >
                    {!msg.isSystem && (
                      <div className="message-header">
                        <span className="message-username">{msg.username}</span>
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                      </div>
                    )}
                    <div className="message-content">
                      {msg.text}
                    </div>
                    {msg.attachment && renderAttachment(msg.attachment)}
                  </div>
                ))}
                
                {typingUsers.length > 0 && (
                  <div className="typing-indicator">
                    <span className="typing-text">
                      {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
                    </span>
                    <div className="typing-dots">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* File preview */}
              {selectedFile && (
                <div className="file-preview-container">
                  <div className="file-info">
                    <div className="file-icon">
                      {selectedFile.type.startsWith('image/') ? '🖼️' : '📄'}
                    </div>
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">{selectedFile.name}</div>
                      <div className="text-gray-400 text-xs">{formatFileSize(selectedFile.size)}</div>
                    </div>
                    <button 
                      onClick={removeSelectedFile}
                      className="btn btn-danger text-sm px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>
                  {filePreview && (
                    <img src={filePreview} alt="Preview" className="file-preview" />
                  )}
                  {isUploading && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )}

              <div className="message-input-container">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  disabled={isUploading}
                >
                  📎
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                  className="hidden"
                />
                <input
                  type="text"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="message-input"
                  disabled={!isConnected || isUploading}
                />
                <button
                  onClick={sendMessage}
                  disabled={(!message.trim() && !selectedFile) || !isConnected || isUploading}
                  className="send-button"
                >
                  {isUploading ? 'Uploading...' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && (
        <div className="modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={modalImage} alt="Full size" className="modal-image" />
            <button 
              onClick={() => setShowImageModal(false)}
              className="btn btn-secondary mt-4 w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div id="voice-audio-container" style={{ display: 'none' }}></div>
    </div>
  );
};

export default ChatRoom; 