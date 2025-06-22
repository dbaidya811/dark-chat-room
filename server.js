const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3001;

// Store active rooms and users
const rooms = new Map();
const clients = new Map();
const peerIds = new Map(); // ws => peerId

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

// Create HTTP server
const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // Parse URL to separate pathname and query string
    const parsedUrl = url.parse(req.url);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    let filePath = '.' + pathname;
    
    // Default to index.html for root path
    if (filePath === './' || filePath === './index.html') {
        filePath = './index.html';
    }
    
    // Security: prevent directory traversal
    if (filePath.includes('..')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath).toLowerCase();
    let contentType = mimeTypes[extname] || 'application/octet-stream';

    // Add charset for text files
    if (contentType.startsWith('text/')) {
        contentType += '; charset=utf-8';
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found - serve index.html for SPA routing
                if (pathname === '/' && query) {
                    // This is a room link with query parameters
                    fs.readFile('./index.html', (err, htmlContent) => {
                        if (err) {
                            res.writeHead(404, { 'Content-Type': 'text/html' });
                            res.end('<h1>404 - File Not Found</h1><p>The requested file could not be found.</p>');
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(htmlContent, 'utf-8');
                        }
                    });
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <head>
                                <title>404 - File Not Found</title>
                                <style>
                                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: white; }
                                    h1 { color: #4a9eff; }
                                    a { color: #4a9eff; text-decoration: none; }
                                    a:hover { text-decoration: underline; }
                                </style>
                            </head>
                            <body>
                                <h1>404 - File Not Found</h1>
                                <p>The requested file could not be found.</p>
                                <a href="/">Go to Dark Chat Room</a>
                            </body>
                        </html>
                    `);
                }
            } else {
                // Server error
                console.error('Server error:', error);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <head>
                            <title>500 - Server Error</title>
                            <style>
                                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a1a; color: white; }
                                h1 { color: #ff4757; }
                            </style>
                        </head>
                        <body>
                            <h1>500 - Server Error</h1>
                            <p>An internal server error occurred.</p>
                        </body>
                    </html>
                `);
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Create WebSocket server
const wss = new WebSocket.Server({
    server,
    maxPayload: 10 * 1024 * 1024 // 10 MB limit for WebSocket messages
});

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection established');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Received WebSocket message:', data.type, data);
            handleWebSocketMessage(ws, data);
        } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        handleClientDisconnect(ws);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        handleClientDisconnect(ws);
    });
});

// Handle WebSocket messages
function handleWebSocketMessage(ws, data) {
    switch (data.type) {
        case 'join_room':
            handleJoinRoom(ws, data);
            break;
        case 'leave_room':
            handleLeaveRoom(ws, data);
            break;
        case 'send_message':
            handleSendMessage(ws, data);
            break;
        case 'user_typing':
            handleUserTyping(ws, data);
            break;
        case 'send_file':
            handleSendFile(ws, data);
            break;
        case 'peer_id':
            // Update peerId for user
            const client = clients.get(ws);
            if (client && client.roomId && client.userId) {
                const room = rooms.get(client.roomId);
                if (room && room.users.has(client.userId)) {
                    room.users.get(client.userId).peerId = data.peerId;
                    // Broadcast updated peerId list to all users in room
                    const peerIds = Array.from(room.users.values()).map(u => u.peerId).filter(Boolean);
                    broadcastToRoom(client.roomId, {
                        type: 'peer_list_update',
                        peerIds
                    });
                }
            }
            break;
        case 'group_call_invite':
            handleGroupCallInvite(ws, data);
            break;
        // Voice Call signaling
        case 'call_invite':
            // Relay to all users in the room except sender
            if (data.roomId) {
                broadcastToRoom(data.roomId, {
                    type: 'call_invite',
                    from: data.from
                }, ws);
            }
            break;
        case 'call_accept':
            // Relay to all users in the room
            if (data.roomId) {
                broadcastToRoom(data.roomId, {
                    type: 'call_accept',
                    user: data.user
                });
            }
            break;
        case 'call_reject':
            // Relay to all users in the room
            if (data.roomId) {
                broadcastToRoom(data.roomId, {
                    type: 'call_reject',
                    user: data.user
                });
            }
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

// Handle client disconnect
function handleClientDisconnect(ws) {
    const client = clients.get(ws);
    if (client) {
        console.log(`Client ${client.userId} disconnected`);
        
        // Remove from room
        if (client.roomId) {
            const room = rooms.get(client.roomId);
            if (room) {
                room.users.delete(client.userId);
                room.messages.push({
                    id: generateId(),
                    text: `${client.userName} left the room`,
                    sender: { name: 'System', id: 'system' },
                    timestamp: new Date().toISOString(),
                    type: 'system'
                });
                
                // Broadcast updated user list
                broadcastToRoom(client.roomId, {
                    type: 'user_list_update',
                    users: Array.from(room.users.values())
                });
                
                // Broadcast system message
                broadcastToRoom(client.roomId, {
                    type: 'new_message',
                    message: room.messages[room.messages.length - 1]
                });
                
                // Remove room if empty
                if (room.users.size === 0) {
                    rooms.delete(client.roomId);
                    console.log(`Room ${client.roomId} deleted (empty)`);
                }
            }
        }
        
        clients.delete(ws);
    }
}

// Handle join room
function handleJoinRoom(ws, data) {
    const { roomId, userId, userName, isCreator, peerId } = data;
    
    console.log(`👤 User ${userName} (${userId}) joining room ${roomId} as ${isCreator ? 'creator' : 'member'}`);
    console.log(`[DEBUG] handleJoinRoom: peerId from client:`, peerId);
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
        console.log(`🏠 Creating new room: ${roomId}`);
        rooms.set(roomId, {
            id: roomId,
            users: new Map(),
            messages: [],
            createdAt: new Date().toISOString()
        });
    } else {
        console.log(`🏠 Joining existing room: ${roomId}`);
    }
    
    const room = rooms.get(roomId);
    
    // Add user to room (now with peerId)
    const user = {
        id: userId,
        name: userName,
        isCreator: isCreator || false,
        joinedAt: new Date().toISOString(),
        peerId: peerId || null
    };
    console.log(`[DEBUG] handleJoinRoom: user object to add:`, user);
    
    room.users.set(userId, user);
    console.log(`[DEBUG] handleJoinRoom: current users in room:`, Array.from(room.users.values()));
    
    // Store client info
    clients.set(ws, {
        userId: userId,
        userName: userName,
        roomId: roomId
    });
    
    // Send room data to joining user
    const roomData = {
        type: 'room_joined',
        room: {
            id: roomId,
            users: Array.from(room.users.values()),
            messages: room.messages
        }
    };
    
    console.log(`📤 Sending room data to user ${userName}:`, roomData);
    ws.send(JSON.stringify(roomData));
    
    // Add system message for new user (except creator)
    if (!isCreator) {
        const systemMessage = {
            id: generateId(),
            text: `${userName} joined the room`,
            sender: { name: 'System', id: 'system' },
            timestamp: new Date().toISOString(),
            type: 'system'
        };
        
        room.messages.push(systemMessage);
        console.log(`📝 Added system message: ${userName} joined the room`);
        
        // Broadcast system message to all users in room
        broadcastToRoom(roomId, {
            type: 'new_message',
            message: systemMessage
        });
    }
    
    // Broadcast updated user list to all users in room
    const userListUpdate = {
        type: 'user_list_update',
        users: Array.from(room.users.values())
    };
    
    console.log(`📤 Broadcasting user list update to room ${roomId}:`, userListUpdate);
    broadcastToRoom(roomId, userListUpdate);
    // Broadcast peer list (in case someone already has peerId)
    broadcastPeerList(roomId);
}

// Handle leave room
function handleLeaveRoom(ws, data) {
    const client = clients.get(ws);
    if (client && client.roomId) {
        const room = rooms.get(client.roomId);
        if (room) {
            room.users.delete(client.userId);
            
            const systemMessage = {
                id: generateId(),
                text: `${client.userName} left the room`,
                sender: { name: 'System', id: 'system' },
                timestamp: new Date().toISOString(),
                type: 'system'
            };
            
            room.messages.push(systemMessage);
            
            // Broadcast system message
            broadcastToRoom(client.roomId, {
                type: 'new_message',
                message: systemMessage
            });
            
            // Broadcast updated user list
            broadcastToRoom(client.roomId, {
                type: 'user_list_update',
                users: Array.from(room.users.values())
            });
            
            // Remove room if empty
            if (room.users.size === 0) {
                rooms.delete(client.roomId);
                console.log(`Room ${client.roomId} deleted (empty)`);
            }
        }
        
        clients.delete(ws);
    }
}

// Handle send message
function handleSendMessage(ws, data) {
    const client = clients.get(ws);
    if (client && client.roomId) {
        const room = rooms.get(client.roomId);
        if (room) {
            const message = {
                id: generateId(),
                text: data.text,
                sender: {
                    id: client.userId,
                    name: client.userName
                },
                timestamp: new Date().toISOString(),
                type: 'text'
            };
            
            room.messages.push(message);
            
            // Broadcast message to all users in room
            broadcastToRoom(client.roomId, {
                type: 'new_message',
                message: message
            });
        }
    }
}

// Handle user typing
function handleUserTyping(ws, data) {
    const client = clients.get(ws);
    if (client && client.roomId) {
        // Broadcast typing indicator to other users in room
        broadcastToRoom(client.roomId, {
            type: 'user_typing',
            userId: client.userId,
            userName: client.userName,
            isTyping: data.isTyping
        }, ws); // Exclude sender
    }
}

// Handle send file
function handleSendFile(ws, data) {
    const client = clients.get(ws);
    if (client && client.roomId) {
        const room = rooms.get(client.roomId);
        if (room) {
            const fileMessage = {
                id: generateId(),
                file: data.file,
                sender: {
                    id: client.userId,
                    name: client.userName
                },
                timestamp: new Date().toISOString(),
                type: 'file'
            };
            
            room.messages.push(fileMessage);
            
            // Broadcast file message to all users in room
            broadcastToRoom(client.roomId, {
                type: 'new_message',
                message: fileMessage
            });
        }
    }
}

// Handle group call invite
function handleGroupCallInvite(ws, data) {
    const client = clients.get(ws);
    if (client && client.roomId && client.userName) {
        // Broadcast call_invite to all users in the room except the initiator
        broadcastToRoom(client.roomId, {
            type: 'call_invite',
            from: {
                userId: client.userId,
                userName: client.userName
            }
        }, ws); // exclude initiator
        console.log(`[DEBUG] Group call invite sent by ${client.userName} (${client.userId}) to room ${client.roomId}`);
    }
}

// Broadcast message to all users in a room
function broadcastToRoom(roomId, message, excludeWs = null) {
    const room = rooms.get(roomId);
    if (room) {
        wss.clients.forEach((client) => {
            if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
                const clientInfo = clients.get(client);
                if (clientInfo && clientInfo.roomId === roomId) {
                    client.send(JSON.stringify(message));
                }
            }
        });
    }
}

function broadcastPeerList(roomId) {
    console.log('[DEBUG] broadcastPeerList called for room:', roomId);
    const room = rooms.get(roomId);
    if (!room) {
        console.log('[DEBUG] broadcastPeerList: room not found!');
        return;
    }
    // Collect all peerIds in the room
    const peerIdList = Array.from(room.users.values())
        .map(u => u.peerId)
        .filter(Boolean);
    console.log('[DEBUG] broadcastPeerList: peerIdList to send:', peerIdList);
    broadcastToRoom(roomId, {
        type: 'peer_list_update',
        peerIds: peerIdList
    });
}

// Utility function to generate IDs
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Start server
server.listen(PORT, () => {
    console.log(`🌙 Dark Chat Room server running at http://localhost:${PORT}`);
    console.log(`📱 Open this URL in your browser to start chatting!`);
    console.log(`🔗 Share the URL with friends to test the room functionality`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`🔌 WebSocket server ready for real-time communication`);
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please try a different port or stop the existing server.`);
        console.log(`💡 You can run: netstat -ano | findstr :${PORT} to find the process using the port`);
    } else {
        console.error('Server error:', error);
    }
    process.exit(1);
}); 