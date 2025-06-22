// Dark Chat Room - Real-time Chat Application
class DarkChatRoom {
    constructor() {
        this.currentUser = null;
        this.currentRoom = null;
        this.ws = null;
        this.isConnected = false;
        this.typingTimeout = null;
        this.peerConnections = new Map();
        this.localStream = null;
        this.peer = null;
        this.peerId = null;
        this.remoteAudioElements = {};
        this.roomPeerIds = [];
        this.isCallActive = false;
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.checkForRoomLink();
        this.connectWebSocket();
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        console.log('Attempting to connect to WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            
            // If we have a room ID in URL, try to join immediately
            const urlParams = new URLSearchParams(window.location.search);
            const roomId = urlParams.get('room');
            if (roomId && this.currentUser) {
                console.log('Joining room after WebSocket connection:', roomId);
                this.joinRoom(roomId);
            }
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[WS] Received:', data.type, data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket disconnected:', event.code, event.reason);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // Try to reconnect after 3 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    console.log('🔄 Attempting to reconnect WebSocket...');
                    this.connectWebSocket();
                }
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'room_joined':
                this.handleRoomJoined(data.room);
                break;
            case 'new_message':
                this.addMessageToChat(data.message);
                break;
            case 'user_list_update':
                this.updateUserList(data.users);
                break;
            case 'user_typing':
                this.showTypingIndicator(data.userName, data.isTyping);
                break;
            case 'peer_list_update':
                this.roomPeerIds = data.peerIds || [];
                console.log('[PeerJS] Updated peer list:', this.roomPeerIds);
                break;
            case 'call_invite':
                this.showCallInvite(data.from);
                break;
            case 'call_accept':
                this.showNotification(`${data.user.name} accepted the call!`, 'success');
                this.startGroupCall();
                break;
            case 'call_reject':
                this.showNotification(`${data.user.name} rejected the call.`, 'error');
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleRoomJoined(room) {
        this.currentRoom = room;
        
        // Update URL with room ID if not already set
        const currentRoomId = new URLSearchParams(window.location.search).get('room');
        if (currentRoomId !== room.id) {
            const newUrl = `${window.location.origin}?room=${room.id}`;
            window.history.pushState({}, '', newUrl);
            console.log('Updated URL with room ID:', newUrl);
        }
        
        // Add existing messages to chat
        room.messages.forEach(message => {
            this.addMessageToChat(message);
        });
        
        // Update user list
        this.updateUserList(room.users);
        
        // Show chat interface
        this.showChatInterface();
        
        console.log(`Joined room: ${room.id} with ${room.users.length} users`);
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
            statusElement.className = connected ? 'connected' : 'disconnected';
        }
    }

    setupEventListeners() {
        // Name input form
        const nameForm = document.getElementById('name-form');
        if (nameForm) {
            nameForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleNameSubmit();
            });
        }

        // Chat form
        const chatForm = document.getElementById('chat-form');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        // Message input for typing indicator
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.handleTyping();
            });
        }

        // File upload
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e);
            });
        }

        // Copy room link
        const copyLinkBtn = document.getElementById('copy-link');
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', () => {
                this.copyRoomLink();
            });
        }

        // Leave room
        const leaveBtn = document.getElementById('leave-room');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => {
                this.leaveRoom();
            });
        }

        // Create new room
        const newRoomBtn = document.getElementById('new-room');
        if (newRoomBtn) {
            newRoomBtn.addEventListener('click', () => {
                this.createNewRoom();
            });
        }

        // Call controls
        const startCallBtn = document.getElementById('start-call');
        if (startCallBtn) {
            startCallBtn.addEventListener('click', () => {
                console.log('🚨 startGroupCall called');
                this.startGroupCall();
            });
        }

        const endCallBtn = document.getElementById('end-call');
        if (endCallBtn) {
            endCallBtn.addEventListener('click', () => {
                this.endGroupCall();
            });
        }

        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileMenuDropdown = document.getElementById('mobileMenuDropdown');
        if (mobileMenuBtn && mobileMenuDropdown) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenuDropdown.style.display = (mobileMenuDropdown.style.display === 'none' || !mobileMenuDropdown.style.display) ? 'flex' : 'none';
            });
            // Hide dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!mobileMenuBtn.contains(e.target) && !mobileMenuDropdown.contains(e.target)) {
                    mobileMenuDropdown.style.display = 'none';
                }
            });
            // Voice Call
            document.getElementById('mobileStartCall').onclick = () => {
                mobileMenuDropdown.style.display = 'none';
                this.startGroupCall();
            };
            // Copy Link
            document.getElementById('mobileCopyLink').onclick = () => {
                mobileMenuDropdown.style.display = 'none';
                this.copyRoomLink();
            };
            // Leave
            document.getElementById('mobileLeaveRoom').onclick = () => {
                mobileMenuDropdown.style.display = 'none';
                this.leaveRoom();
            };
        }
    }

    checkForRoomLink() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (roomId) {
            // Show join prompt for shared link
            this.showJoinPrompt(roomId);
        } else {
            // Show name input for new room
            this.showNameInput();
        }
    }

    showJoinPrompt(roomId) {
        // Show homepage section and update it for joining
        const homepage = document.getElementById('homepage');
        const welcomeCard = homepage.querySelector('.welcome-card');
        
        welcomeCard.innerHTML = `
            <h2>🌙 Join Dark Chat Room</h2>
            <p>You've been invited to join a chat room!</p>
            <div class="input-group">
                <input type="text" id="join-name" placeholder="Enter your name" required>
                <button id="join-room-btn" class="btn btn-primary">Join Room</button>
            </div>
            <button id="create-new" class="btn btn-secondary">Create New Room Instead</button>
        `;

        // Add event listeners
        const joinBtn = document.getElementById('join-room-btn');
        joinBtn.addEventListener('click', () => {
            this.joinRoom(roomId);
        });

        const createNewBtn = document.getElementById('create-new');
        createNewBtn.addEventListener('click', () => {
            this.showNameInput();
        });
    }

    showNameInput() {
        // Show homepage section with name input
        const homepage = document.getElementById('homepage');
        const welcomeCard = homepage.querySelector('.welcome-card');
        
        welcomeCard.innerHTML = `
            <h2>🌙 Dark Chat Room</h2>
            <p>Enter your name to start chatting</p>
            <div class="input-group">
                <input type="text" id="user-name" placeholder="Your name" required>
                <button id="start-chat-btn" class="btn btn-primary">Start Chatting</button>
            </div>
        `;

        // Add event listener
        const startBtn = document.getElementById('start-chat-btn');
        startBtn.addEventListener('click', () => {
            this.handleNameSubmit();
        });
    }

    handleNameSubmit() {
        const nameInput = document.getElementById('user-name');
        const userName = nameInput.value.trim();
        
        if (userName) {
            this.currentUser = {
                id: this.generateUserId(),
                name: userName
            };
            
            // Create new room
            this.createNewRoom();
        }
    }

    joinRoom(roomId) {
        const nameInput = document.getElementById('join-name');
        const userName = nameInput.value.trim();
        
        console.log('🚪 Attempting to join room:', roomId);
        console.log('👤 User name:', userName);
        console.log('🔌 WebSocket connected:', this.isConnected);
        
        if (userName && this.isConnected) {
            this.currentUser = {
                id: this.generateUserId(),
                name: userName
            };
            
            console.log('📤 Sending join_room message to server...');
            
            // Join existing room via WebSocket (send peerId if available)
            this.ws.send(JSON.stringify({
                type: 'join_room',
                roomId: roomId,
                userId: this.currentUser.id,
                userName: this.currentUser.name,
                isCreator: false,
                peerId: this.peerId || null
            }));
            
            // Store room ID for later use
            this.currentRoomId = roomId;
            this.setupPeer();
        } else if (!userName) {
            console.error('❌ No user name provided');
            this.showNotification('Please enter your name', 'error');
        } else if (!this.isConnected) {
            console.error('❌ WebSocket not connected');
            this.showNotification('Connection lost. Please refresh the page.', 'error');
        }
    }

    createNewRoom() {
        const roomId = this.generateRoomId();
        console.log('🏠 Creating new room with ID:', roomId);
        console.log('👤 Current user:', this.currentUser);
        console.log('🔌 WebSocket connected:', this.isConnected);
        
        if (this.isConnected) {
            console.log('📤 Sending join_room message to server...');
            
            // Join room as creator via WebSocket (send peerId if available)
            this.ws.send(JSON.stringify({
                type: 'join_room',
                roomId: roomId,
                userId: this.currentUser.id,
                userName: this.currentUser.name,
                isCreator: true,
                peerId: this.peerId || null
            }));
            
            // Update URL immediately
            const newUrl = `${window.location.origin}?room=${roomId}`;
            window.history.pushState({}, '', newUrl);
            console.log('🔗 Updated URL to:', newUrl);
            
            // Store room ID for later use
            this.currentRoomId = roomId;
            this.setupPeer();
        } else {
            console.error('❌ WebSocket not connected, cannot create room');
            this.showNotification('Connection lost. Please refresh the page.', 'error');
        }
    }

    showChatInterface() {
        // Hide homepage and show chat room
        const homepage = document.getElementById('homepage');
        const chatRoom = document.getElementById('chatRoom');
        
        homepage.classList.remove('active');
        chatRoom.classList.add('active');
        
        // Update chat interface elements
        const roomName = document.getElementById('roomName');
        const userCount = document.getElementById('userCount');
        const usersList = document.getElementById('usersList');
        const messagesContainer = document.getElementById('messagesContainer');
        const messageInput = document.getElementById('messageInput');
        const sendMessage = document.getElementById('sendMessage');
        const fileInput = document.getElementById('fileInput');
        const startCall = document.getElementById('startCall');
        const leaveRoom = document.getElementById('leaveRoom');
        
        // Add connection status to header
        const headerActions = document.querySelector('.header-actions');
        if (headerActions && !document.getElementById('connection-status')) {
            const statusDiv = document.createElement('div');
            statusDiv.id = 'connection-status';
            statusDiv.className = 'connection-status connected';
            statusDiv.textContent = '🟢 Connected';
            headerActions.insertBefore(statusDiv, headerActions.firstChild);
        }
        
        // Clear existing content
        if (messagesContainer) messagesContainer.innerHTML = '';
        if (usersList) usersList.innerHTML = '';
        
        // Add event listeners
        if (sendMessage) {
            sendMessage.addEventListener('click', () => {
                this.sendMessage();
            });
        }
        
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.handleTyping();
            });
            
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e);
            });
        }
        
        if (leaveRoom) {
            leaveRoom.addEventListener('click', () => {
                this.leaveRoom();
            });
        }
        
        if (startCall) {
            startCall.addEventListener('click', () => {
                this.startGroupCall();
            });
        }
        
        const endCall = document.getElementById('endCall');
        if (endCall) {
            endCall.addEventListener('click', () => {
                this.endGroupCall();
            });
        }

        if (roomName) {
            if (window.innerWidth <= 600) {
                roomName.textContent = 'Chat Room';
            } else {
                roomName.textContent = 'Dark Chat Room';
            }
        }
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const text = messageInput.value.trim();
        
        if (text && this.isConnected) {
            this.ws.send(JSON.stringify({
                type: 'send_message',
                text: text
            }));
            
            messageInput.value = '';
            this.stopTyping();
        }
    }

    handleTyping() {
        if (this.isConnected) {
            this.ws.send(JSON.stringify({
                type: 'user_typing',
                isTyping: true
            }));
            
            // Clear existing timeout
            if (this.typingTimeout) {
                clearTimeout(this.typingTimeout);
            }
            
            // Set timeout to stop typing indicator
            this.typingTimeout = setTimeout(() => {
                this.stopTyping();
            }, 2000);
        }
    }

    stopTyping() {
        if (this.isConnected) {
            this.ws.send(JSON.stringify({
                type: 'user_typing',
                isTyping: false
            }));
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    }

    showTypingIndicator(userName, isTyping) {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            if (isTyping) {
                typingIndicator.querySelector('.typing-text').textContent = `${userName} is typing...`;
                typingIndicator.style.display = 'block';
            } else {
                typingIndicator.style.display = 'none';
            }
        }
    }

    addMessageToChat(message) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        const isOwnMessage = message.sender.id === this.currentUser?.id;
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOwnMessage ? 'own' : ''}`;

        let messageContentHTML = '';

        if (message.type === 'system') {
            messageElement.classList.add('system-message');
            messageContentHTML = `
                <div class="message-content">
                    <span class="message-text">${message.text}</span>
                </div>
            `;
        } else if (message.type === 'file') {
            const file = message.file;
            let filePreviewHTML = '';

            if (file.type.startsWith('image/')) {
                filePreviewHTML = `<img src="${file.content}" alt="${file.name}" class="file-preview image">`;
            } else if (file.type.startsWith('video/')) {
                filePreviewHTML = `<video src="${file.content}" controls class="file-preview video"></video>`;
            }

            messageContentHTML = `
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-sender">${message.sender.name}</span>
                        <span class="message-time">${this.formatTime(message.timestamp)}</span>
                    </div>
                    <div class="message-file">
                        ${filePreviewHTML}
                        <div class="file-info">
                            <i class="fas fa-file-alt"></i>
                            <div class="file-details">
                                <span class="file-name">${file.name}</span>
                                <span class="file-size">${this.formatFileSize(file.size)}</span>
                            </div>
                            <a href="${file.content}" download="${file.name}" class="btn-download" title="Download">
                                <i class="fas fa-download"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        } else { // Regular text message
            messageContentHTML = `
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-sender">${message.sender.name}</span>
                        <span class="message-time">${this.formatTime(message.timestamp)}</span>
                    </div>
                    <div class="message-text">${this.escapeHtml(message.text)}</div>
                </div>
            `;
        }

        messageElement.innerHTML = messageContentHTML;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateUserList(users) {
        const usersList = document.getElementById('usersList');
        const userCount = document.getElementById('userCount');
        
        if (!usersList || !userCount) return;

        usersList.innerHTML = '';
        userCount.textContent = `${users.length} user${users.length !== 1 ? 's' : ''} online`;

        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            
            const isCurrentUser = user.id === this.currentUser?.id;
            const isCreator = user.isCreator;

            // Default DP (first letter of name)
            const dpLetter = user.name ? user.name.charAt(0).toUpperCase() : '?';
            const dpColor = isCreator ? 'gold' : '#007bff';
            const dpBg = isCreator ? 'rgba(255,215,0,0.15)' : 'rgba(0,123,255,0.12)';

            userElement.innerHTML = `
                <div class="user-info ${isCurrentUser ? 'current-user' : ''}">
                    <span class="user-dp" style="background:${dpBg}; color:${dpColor};">
                        ${dpLetter}
                        ${isCreator ? '<i class=\'fas fa-crown creator-crown\'></i>' : ''}
                    </span>
                    <span class="user-name${isCreator ? ' creator-name' : ''}">
                        ${user.name}
                        ${isCurrentUser ? ' (You)' : ''}
                    </span>
                    <span class="user-status">🟢 Online</span>
                </div>
            `;
            
            usersList.appendChild(userElement);
        });
    }

    handleFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            console.log('No files selected.');
            return;
        }

        console.log(`[File Upload] Starting upload for ${files.length} file(s).`);

        Array.from(files).forEach(file => {
            console.log(`[File Upload] Processing file: ${file.name}, Size: ${this.formatFileSize(file.size)}, Type: ${file.type}`);

            const fileSizeLimit = 10 * 1024 * 1024; // 10MB limit (matching server)
            if (file.size > fileSizeLimit) {
                const errorMsg = `File too large: ${file.name}. Max size is 10MB.`;
                console.error(`[File Upload] ${errorMsg}`);
                this.showNotification(errorMsg, 'error');
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                console.log(`[File Upload] Successfully read file: ${file.name}`);
                const fileData = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    content: e.target.result
                };

                if (this.isConnected) {
                    console.log('[File Upload] WebSocket is connected. Sending file data...');
                    try {
                        this.ws.send(JSON.stringify({
                            type: 'send_file',
                            file: fileData
                        }));
                        console.log(`[File Upload] Sent file data for: ${file.name}`);
                        this.showNotification(`Sending file: ${file.name}`, 'info');
                    } catch (error) {
                        console.error('[File Upload] Error sending file via WebSocket:', error);
                        this.showNotification('Error sending file. It might be too large.', 'error');
                    }
                } else {
                    console.error('[File Upload] WebSocket not connected. Cannot send file.');
                    this.showNotification('Not connected. Cannot send file.', 'error');
                }
            };

            reader.onerror = (error) => {
                console.error(`[File Upload] Error reading file: ${file.name}`, error);
                this.showNotification(`Error reading file: ${file.name}`, 'error');
            };

            console.log(`[File Upload] Starting to read file: ${file.name}`);
            reader.readAsDataURL(file);
        });

        event.target.value = '';
    }

    copyRoomLink() {
        let roomId = this.currentRoomId;
        if (!roomId) {
            const urlParams = new URLSearchParams(window.location.search);
            roomId = urlParams.get('room');
        }
        if (roomId) {
            const roomLink = `${window.location.origin}?room=${roomId}`;
            navigator.clipboard.writeText(roomLink).then(() => {
                this.showNotification('Room link copied!', 'success');
            });
        } else {
            this.showNotification('No room link available.', 'error');
        }
    }

    leaveRoom() {
        // Notify server
        if (this.ws && this.currentRoomId && this.currentUser) {
            this.ws.send(JSON.stringify({
                type: 'leave_room',
                roomId: this.currentRoomId,
                userId: this.currentUser.id
            }));
        }
        // Reset state and show homepage
        this.isCallActive = false;
        this.currentRoomId = null;
        this.currentUser = null;
        this.roomPeerIds = [];
        this.hideCallUI && this.hideCallUI();
        document.getElementById('chatRoom').classList.remove('active');
        document.getElementById('homepage').classList.add('active');
        this.showNotification('You left the room.', 'info');
    }

    // --- PeerJS Group Voice Call Logic ---
    setupPeer() {
        if (this.peer) return;
        this.peer = new Peer(undefined, {
            host: '0.peerjs.com',
            port: 443,
            secure: true
        });
        this.peer.on('open', (id) => {
            this.peerId = id;
            console.log('[PeerJS] My peerId:', id);
            // Notify server of my peerId (always include roomId and userId if available)
            if (this.isConnected && this.currentRoomId && this.currentUser && this.currentUser.id) {
                this.ws.send(JSON.stringify({
                    type: 'peer_id',
                    peerId: id,
                    roomId: this.currentRoomId,
                    userId: this.currentUser.id
                }));
            }
        });
        this.peer.on('call', (call) => {
            // Answer incoming call with local audio stream
            if (this.localStream) {
                call.answer(this.localStream);
            } else {
                call.answer();
            }
            call.on('stream', (remoteStream) => {
                this.addRemoteAudio(call.peer, remoteStream);
            });
            call.on('close', () => {
                this.removeRemoteAudio(call.peer);
            });
        });
    }

    addRemoteAudio(peerId, stream) {
        if (this.remoteAudioElements[peerId]) return;
        const audio = document.createElement('audio');
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.controls = false;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.remoteAudioElements[peerId] = audio;
        console.log('[PeerJS] Added remote audio for', peerId);
    }

    removeRemoteAudio(peerId) {
        const audio = this.remoteAudioElements[peerId];
        if (audio) {
            audio.pause();
            audio.srcObject = null;
            audio.remove();
            delete this.remoteAudioElements[peerId];
            console.log('[PeerJS] Removed remote audio for', peerId);
        }
    }

    // --- Group Call Invite Logic ---
    startGroupCall() {
        if (this.isCallActive) return;
        this.isCallActive = true;
        this.showNotification('Voice call started!', 'info');
        // Get audio stream
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then((stream) => {
                this.localStream = stream;
                // Publish own audio to peers
                this.publishAudioToPeers(stream);
                this.showCallUI();
            })
            .catch((err) => {
                this.showNotification('Microphone access denied!', 'error');
                this.isCallActive = false;
            });
    }

    publishAudioToPeers(stream) {
        // Send audio to all peers in the room (except self)
        if (!this.peer) return;
        for (const peerId of this.roomPeerIds) {
            if (peerId !== this.peerId) {
                const call = this.peer.call(peerId, stream);
                call.on('stream', (remoteStream) => {
                    this.addRemoteAudio(peerId, remoteStream);
                });
            }
        }
    }

    endGroupCall() {
        this.isCallActive = false;
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        // Remove remote audio
        for (const peerId in this.remoteAudioElements) {
            const audio = this.remoteAudioElements[peerId];
            if (audio) audio.remove();
        }
        this.remoteAudioElements = {};
        this.showNotification('Voice call ended.', 'info');
        this.hideCallUI();
    }

    showCallUI() {
        // Show End Call button
        let endBtn = document.getElementById('endCall');
        if (!endBtn) {
            endBtn = document.createElement('button');
            endBtn.id = 'endCall';
            endBtn.className = 'btn btn-danger';
            endBtn.innerHTML = '<i class="fas fa-phone-slash"></i> End Call';
            endBtn.onclick = () => this.endGroupCall();
            document.querySelector('.header-actions').appendChild(endBtn);
        } else {
            endBtn.style.display = 'inline-block';
        }
    }

    hideCallUI() {
        const endBtn = document.getElementById('endCall');
        if (endBtn) endBtn.style.display = 'none';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    generateRoomId() {
        return 'room_' + Math.random().toString(36).substr(2, 9);
    }

    showCallInvite(fromUser) {
        // Show notification with Accept button
        const notif = document.createElement('div');
        notif.className = 'call-invite-notification';
        notif.innerHTML = `<b>${fromUser.userName}</b> is inviting you to a group call. <button id="acceptCallBtn">Accept</button>`;
        document.body.appendChild(notif);
        document.getElementById('acceptCallBtn').onclick = () => {
            notif.remove();
            this.acceptGroupCall();
        };
        // Optionally, auto-remove after some time
        setTimeout(() => { if (notif.parentNode) notif.remove(); }, 20000);
    }

    acceptGroupCall() {
        // Start PeerJS call logic (same as previous startGroupCall)
        if (this.isCallActive) return;
        this.isCallActive = true;
        this.setupPeer();
        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
            .then(stream => {
                this.localStream = stream;
                // UI updates
                const startCallBtn = document.getElementById('startCall');
                const endCallBtn = document.getElementById('endCall');
                const callStatus = document.getElementById('callStatus');
                if (startCallBtn) startCallBtn.style.display = 'none';
                if (endCallBtn) endCallBtn.style.display = 'block';
                if (callStatus) callStatus.style.display = 'flex';
                this.showNotification('Voice call started!', 'success');
                // Notify server of my peerId (if not already sent)
                if (this.peerId && this.isConnected && this.currentRoomId) {
                    this.ws.send(JSON.stringify({
                        type: 'peer_id',
                        peerId: this.peerId,
                        roomId: this.currentRoomId,
                        userId: this.currentUser.id
                    }));
                }
                // Call all other peers in the room
                this.roomPeerIds.forEach(pid => {
                    if (pid !== this.peerId) {
                        const call = this.peer.call(pid, stream);
                        call.on('stream', (remoteStream) => {
                            this.addRemoteAudio(pid, remoteStream);
                        });
                        call.on('close', () => {
                            this.removeRemoteAudio(pid);
                        });
                        this.peerConnections.set(pid, call);
                    }
                });
            });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new DarkChatRoom();
    window.app = app;

    // Mobile leave button logic only
    const mobileLeaveRoom = document.getElementById('mobileLeaveRoom');
    const leaveRoom = document.getElementById('leaveRoom');
    if (mobileLeaveRoom) {
        mobileLeaveRoom.onclick = (e) => {
            e.preventDefault();
            if (leaveRoom) leaveRoom.click(); // trigger desktop leave logic
        };
    }
}); 