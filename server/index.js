const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store active rooms and their data
const rooms = new Map();

// Generate a unique room ID
app.post('/api/create-room', (req, res) => {
  const roomId = uuidv4().substring(0, 8);
  const roomData = {
    id: roomId,
    users: [],
    messages: [],
    createdAt: new Date()
  };
  
  rooms.set(roomId, roomData);
  res.json({ roomId, roomUrl: `http://localhost:3000/room/${roomId}` });
});

// Get room data
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json(room);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('join-room', ({ roomId, username }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    socket.join(roomId);
    
    // Add user to room
    const user = { id: socket.id, username, joinedAt: new Date() };
    room.users.push(user);
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', user);
    
    // Send room data to the joining user
    socket.emit('room-data', room);
    
    console.log(`${username} joined room ${roomId}`);
  });

  // Handle new messages
  socket.on('send-message', ({ roomId, message, username, attachment }) => {
    const room = rooms.get(roomId);
    
    if (!room) return;

    const messageData = {
      id: uuidv4(),
      text: message,
      username,
      userId: socket.id,
      timestamp: new Date(),
      attachment: attachment || null
    };

    room.messages.push(messageData);
    
    // Broadcast message to all users in the room
    io.to(roomId).emit('new-message', messageData);
  });

  // Handle user typing
  socket.on('typing', ({ roomId, username, isTyping }) => {
    socket.to(roomId).emit('user-typing', { username, isTyping });
  });

  // Group Voice Call Signaling
  socket.on('voice-join', ({ roomId }) => {
    socket.join(`voice-${roomId}`);
    // Notify others in the room
    socket.to(`voice-${roomId}`).emit('voice-user-joined', { userId: socket.id });
  });

  socket.on('voice-leave', ({ roomId }) => {
    socket.leave(`voice-${roomId}`);
    socket.to(`voice-${roomId}`).emit('voice-user-left', { userId: socket.id });
  });

  socket.on('voice-send-offer', ({ to, from, offer }) => {
    io.to(to).emit('voice-receive-offer', { from, offer });
  });

  socket.on('voice-send-answer', ({ to, from, answer }) => {
    io.to(to).emit('voice-receive-answer', { from, answer });
  });

  socket.on('voice-send-ice', ({ to, from, candidate }) => {
    io.to(to).emit('voice-receive-ice', { from, candidate });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from all rooms they were in
    rooms.forEach((room, roomId) => {
      const userIndex = room.users.findIndex(user => user.id === socket.id);
      if (userIndex !== -1) {
        const user = room.users[userIndex];
        room.users.splice(userIndex, 1);
        
        // Notify others in the room
        socket.to(roomId).emit('user-left', user);
      }
    });

    // Voice call leave notification
    io.emit('voice-user-left', { userId: socket.id });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 