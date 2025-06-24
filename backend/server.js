const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

app.get('/room/:room', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const users = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join_room', ({ room_id, user_name }) => {
        socket.join(room_id);
        users[socket.id] = { name: user_name };
        console.log(`User ${user_name} (${socket.id}) joined room ${room_id}`);
        
        const clientsInRoom = io.sockets.adapter.rooms.get(room_id);
        const otherUsers = [];
        if (clientsInRoom) {
            clientsInRoom.forEach(clientId => {
                if (clientId !== socket.id && users[clientId]) {
                    otherUsers.push({ id: clientId, name: users[clientId].name });
                }
            });
        }

        socket.emit('other_users', otherUsers);
        socket.to(room_id).emit('user_joined', { user_id: socket.id, user_name: user_name });
    });

    socket.on('offer', ({ to, offer }) => {
        socket.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }) => {
        socket.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice_candidate', ({ to, candidate }) => {
        socket.to(to).emit('ice_candidate', { from: socket.id, candidate });
    });

    socket.on('video_state_changed', ({ room_id, isVideoOn }) => {
        socket.to(room_id).emit('video_state_changed', { user_id: socket.id, isVideoOn: isVideoOn });
    });

    socket.on('disconnecting', () => {
        delete users[socket.id];
        const rooms = Object.keys(socket.rooms);
        rooms.forEach(room => {
            if (room !== socket.id) {
                socket.to(room).emit('user_left', socket.id);
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
