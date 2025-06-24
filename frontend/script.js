const socket = io();

const homeContainer = document.getElementById('home-container');
const nameInput = document.getElementById('name-input');
const createRoomBtn = document.getElementById('create-room-btn');
const roomLinkContainer = document.getElementById('room-link-container');
const roomLinkInput = document.getElementById('room-link');

const videoChatContainer = document.getElementById('video-chat-container');
const localVideo = document.getElementById('localVideo');
const remoteVideos = document.getElementById('remote-videos');
const endCallBtn = document.getElementById('endCall');
const micBtn = document.getElementById('mic-btn');
const videoBtn = document.getElementById('video-btn');
const screenShareBtn = document.getElementById('screen-share-btn');

// Modal elements
const nameModal = document.getElementById('name-modal');
const nameInputModal = document.getElementById('name-input-modal');
const joinBtnModal = document.getElementById('join-btn-modal');

let localStream;
let peerConnections = {};
let userNames = {};
let room_id;
let user_name;
let isMicOn = true;
let isVideoOn = true;
let isScreenSharing = false;

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
};

createRoomBtn.addEventListener('click', () => {
    user_name = nameInput.value.trim();
    if (user_name) {
        sessionStorage.setItem('userName', user_name);
        room_id = Math.random().toString(36).substring(2, 7);
        const roomLink = `${window.location.origin}/?room=${room_id}`;
        window.history.pushState({ path: roomLink }, '', roomLink);
        roomLinkInput.value = roomLink;
        roomLinkContainer.style.display = 'block';
        createRoomBtn.disabled = true;
        joinRoom(room_id, user_name);
    }
});

endCallBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    socket.disconnect();
    window.location.href = '/';
});

micBtn.addEventListener('click', toggleMic);
videoBtn.addEventListener('click', toggleVideo);
screenShareBtn.addEventListener('click', toggleScreenShare);

function joinRoom(roomId, userName) {
    room_id = roomId;
    user_name = userName;
    homeContainer.style.display = 'none';
    videoChatContainer.style.display = 'flex';

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            localVideo.srcObject = stream;
            localVideo.style.border = '2px solid green'; // Mic is on by default

            if (stream.getAudioTracks().length === 0) {
                alert('Could not find a microphone. Other users will not be able to hear you.');
                localVideo.style.border = '2px solid red';
            }
            if (stream.getVideoTracks().length === 0) {
                alert('Could not find a camera. Other users will not be able to see you.');
            }

            socket.emit('join_room', { room_id: roomId, user_name: userName });
        })
        .catch(error => {
            console.error('Error accessing media devices.', error);
            alert(`Could not access your camera or microphone. Please check your browser permissions and ensure no other application is using them. Error: ${error.message}`);
        });
}

window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');

    if (roomIdFromUrl) {
        user_name = sessionStorage.getItem('userName');
        if (user_name) {
            joinRoom(roomIdFromUrl, user_name);
        } else {
            nameModal.style.display = 'flex';
        }
    }
};

joinBtnModal.addEventListener('click', () => {
    const name = nameInputModal.value.trim();
    if (name) {
        user_name = name;
        sessionStorage.setItem('userName', user_name);
        nameModal.style.display = 'none';
        
        const urlParams = new URLSearchParams(window.location.search);
        const roomIdFromUrl = urlParams.get('room');
        if (roomIdFromUrl) {
            joinRoom(roomIdFromUrl, user_name);
        }
    }
});


// --- WebRTC Signaling ---

socket.on('other_users', (otherUsers) => {
    console.log('Other users in room:', otherUsers);
    otherUsers.forEach(user => {
        userNames[user.id] = user.name;
        createPeerConnection(user.id, true);
    });
});

socket.on('user_joined', ({ user_id, user_name }) => {
    console.log('User joined:', user_name, user_id);
    userNames[user_id] = user_name;
});

socket.on('offer', async ({ from, offer }) => {
    console.log('Received offer from', from);
    const pc = await createPeerConnection(from, false);
    if (!pc) return;
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, answer });
    } catch (err) {
        console.error('Error handling offer:', err);
    }
});

socket.on('answer', ({ from, answer }) => {
    console.log('Received answer from', from);
    if (peerConnections[from]) {
        peerConnections[from].setRemoteDescription(new RTCSessionDescription(answer))
            .catch(err => console.error('Error setting remote description for answer:', err));
    }
});

socket.on('ice_candidate', ({ from, candidate }) => {
    if (peerConnections[from]) {
        peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate))
            .catch(err => console.error('Error adding received ICE candidate:', err));
    }
});

socket.on('user_left', (user_id) => {
    console.log('User left:', user_id);
    if (peerConnections[user_id]) {
        peerConnections[user_id].close();
        delete peerConnections[user_id];
    }
    delete userNames[user_id];
    const remoteVideoBox = document.getElementById(user_id);
    if (remoteVideoBox) {
        remoteVideoBox.remove();
    }
});

socket.on('video_state_changed', ({ user_id, isVideoOn }) => {
    console.log(`User ${user_id} video state changed to: ${isVideoOn}`);
    const videoBox = document.getElementById(user_id);
    if (videoBox) {
        const videoElement = videoBox.querySelector('video');
        const iconElement = videoBox.querySelector('.video-off-icon');
        if (videoElement) videoElement.style.display = isVideoOn ? 'block' : 'none';
        if (iconElement) iconElement.style.display = isVideoOn ? 'none' : 'block';
    }
});

async function createPeerConnection(targetUserId, isInitiator) {
    if (!localStream) {
        console.error('Local stream not available yet.');
        return;
    }
    const pc = new RTCPeerConnection(servers);
    peerConnections[targetUserId] = pc;

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice_candidate', { to: targetUserId, candidate: event.candidate });
        }
    };

    pc.ontrack = (event) => {
        let videoBox = document.getElementById(targetUserId);
        if (!videoBox) {
            videoBox = document.createElement('div');
            videoBox.id = targetUserId;
            videoBox.className = 'video-box';

            const remoteVideo = document.createElement('video');
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;

            const nameTag = document.createElement('div');
            nameTag.className = 'name-tag';
            nameTag.textContent = userNames[targetUserId] || 'Guest';

            const videoOffIcon = document.createElement('img');
            videoOffIcon.className = 'video-off-icon';
            videoOffIcon.src = 'https://cdn-icons-png.flaticon.com/512/17446/17446833.png';
            videoOffIcon.style.display = 'none';

            videoBox.appendChild(remoteVideo);
            videoBox.appendChild(nameTag);
            videoBox.appendChild(videoOffIcon);
            remoteVideos.appendChild(videoBox);
        }
        
        const videoElement = videoBox.querySelector('video');
        if (videoElement) {
            videoElement.srcObject = event.streams[0];
        }
    };

    if (isInitiator) {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', { to: targetUserId, offer });
        } catch (err) {
            console.error('Error creating offer:', err);
        }
    }
    
    return pc;
}

function toggleMic() {
    if (!localStream) {
        console.error('Cannot toggle mic, localStream is not available.');
        return;
    }
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
        console.error('Cannot toggle mic, no audio tracks found.');
        alert('No microphone track found to toggle.');
        return;
    }

    isMicOn = !isMicOn;
    console.log(`Toggling mic. New state: ${isMicOn ? 'ON' : 'OFF'}`);
    audioTracks.forEach(track => track.enabled = isMicOn);

    localVideo.style.border = isMicOn ? '2px solid green' : '2px solid red';

    micBtn.innerHTML = isMicOn ?
        `<i class="fa-solid fa-microphone"></i>` :
        `<i class="fa-solid fa-microphone-slash"></i>`;
}

function toggleVideo() {
    if (!localStream) {
        console.error('Cannot toggle video, localStream is not available.');
        return;
    }
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) {
        console.error('Cannot toggle video, no video tracks found.');
        return;
    }

    isVideoOn = !isVideoOn;
    console.log(`Toggling video. New state: ${isVideoOn ? 'ON' : 'OFF'}`);
    videoTracks.forEach(track => track.enabled = isVideoOn);

    socket.emit('video_state_changed', { room_id: room_id, isVideoOn: isVideoOn });

    videoBtn.innerHTML = isVideoOn ?
        `<i class="fa-solid fa-video"></i>` :
        `<i class="fa-solid fa-video-slash"></i>`;
}

async function toggleScreenShare() {
    if (!isScreenSharing) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            isScreenSharing = true;
            const screenTrack = screenStream.getVideoTracks()[0];
            await replaceTrack(screenTrack);
            screenShareBtn.style.backgroundColor = '#0a84ff';

            screenTrack.onended = () => {
                isScreenSharing = false;
                const cameraTrack = localStream.getVideoTracks()[0];
                replaceTrack(cameraTrack);
                screenShareBtn.style.backgroundColor = '#2c2c2e';
            };
        } catch (err) {
            console.error('Error sharing screen:', err);
        }
    } else {
        isScreenSharing = false;
        const cameraTrack = localStream.getVideoTracks()[0];
        await replaceTrack(cameraTrack);
        screenShareBtn.style.backgroundColor = '#2c2c2e';
    }
}

async function replaceTrack(newTrack) {
    for (const peerId in peerConnections) {
        const pc = peerConnections[peerId];
        const sender = pc.getSenders().find(s => s.track.kind === newTrack.kind);
        if (sender) {
            await sender.replaceTrack(newTrack);
        }
    }
    // also update local video display if it's a video track
    if (newTrack.kind === 'video') {
        const newStream = new MediaStream([newTrack, ...localStream.getAudioTracks()]);
        localVideo.srcObject = newStream;
    }
}
