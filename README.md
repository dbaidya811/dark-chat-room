# Chat Room App

A real-time chat application where users can create shareable links and chat together. Built with React, Node.js, and Socket.IO.

## Features

- 🚀 **Instant Setup**: Create a chat room in seconds
- 🔗 **Shareable Links**: Share your room link with anyone to invite them
- 💬 **Real-time Chat**: Messages appear instantly for all participants
- 👥 **User Management**: See who's online in real-time
- ⌨️ **Typing Indicators**: Know when someone is typing
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Beautiful gradient design with glassmorphism effects

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **UUID** - Unique room ID generation

### Frontend
- **React** - UI library
- **React Router** - Client-side routing
- **Socket.IO Client** - Real-time communication
- **CSS3** - Styling with modern features

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chat-room-app
   ```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```

   This will install dependencies for:
   - Root project (concurrently)
   - Backend server
   - Frontend client

## Running the Application

### Development Mode (Recommended)

Run both frontend and backend simultaneously:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend client on `http://localhost:3000`

### Running Separately

**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run client
```

## How to Use

### Creating a Chat Room

1. Open the application in your browser (`http://localhost:3000`)
2. Enter your name in the input field
3. Click "Create New Room"
4. Copy the generated room link
5. Share the link with others you want to invite

### Joining a Chat Room

1. Click on a shared room link, or
2. Enter your name and click "Join Room"
3. Start chatting!

### Features in the Chat Room

- **Real-time messaging**: Type and send messages instantly
- **User list**: See all online users in the sidebar
- **Typing indicators**: Know when someone is typing
- **Connection status**: See if you're connected to the server
- **Share link**: Copy the room link to share with others
- **System messages**: Automatic notifications when users join/leave

## Project Structure

```
chat-room-app/
├── server/                 # Backend server
│   ├── index.js           # Main server file
│   └── package.json       # Server dependencies
├── client/                # Frontend React app
│   ├── public/            # Static files
│   ├── src/               # React source code
│   │   ├── components/    # React components
│   │   │   ├── Home.js    # Home page component
│   │   │   ├── Home.css   # Home page styles
│   │   │   ├── ChatRoom.js # Chat room component
│   │   │   └── ChatRoom.css # Chat room styles
│   │   ├── App.js         # Main app component
│   │   ├── App.css        # App styles
│   │   ├── index.js       # React entry point
│   │   └── index.css      # Global styles
│   └── package.json       # Client dependencies
├── package.json           # Root package.json
└── README.md             # This file
```

## API Endpoints

### Backend API

- `POST /api/create-room` - Create a new chat room
- `GET /api/room/:roomId` - Get room information

### Socket.IO Events

**Client to Server:**
- `join-room` - Join a chat room
- `send-message` - Send a message
- `typing` - Typing indicator

**Server to Client:**
- `room-data` - Room information and messages
- `new-message` - New message received
- `user-joined` - User joined the room
- `user-left` - User left the room
- `user-typing` - User typing indicator
- `error` - Error message

## Customization

### Changing the Port

**Backend port** (default: 5000):
Edit `server/index.js`:
```javascript
const PORT = process.env.PORT || 5000;
```

**Frontend port** (default: 3000):
Edit `client/package.json`:
```json
{
  "scripts": {
    "start": "PORT=3000 react-scripts start"
  }
}
```

### Styling

The application uses CSS with utility classes. Main style files:
- `client/src/index.css` - Global styles
- `client/src/App.css` - App-specific styles
- `client/src/components/Home.css` - Home page styles
- `client/src/components/ChatRoom.css` - Chat room styles

## Deployment

### Backend Deployment

1. Set up a Node.js hosting service (Heroku, Vercel, Railway, etc.)
2. Deploy the `server/` directory
3. Set environment variables if needed

### Frontend Deployment

1. Build the React app:
   ```bash
   cd client
   npm run build
   ```
2. Deploy the `build/` folder to a static hosting service
3. Update the Socket.IO connection URL in `ChatRoom.js` to point to your backend

### Environment Variables

Create a `.env` file in the server directory:
```env
PORT=5000
NODE_ENV=production
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Change the port in `server/index.js`
   - Kill processes using the port

2. **Socket.IO connection failed**
   - Check if the backend server is running
   - Verify the Socket.IO URL in `ChatRoom.js`

3. **Room not found**
   - Rooms are stored in memory and reset when server restarts
   - Create a new room after server restart

### Development Tips

- Use browser developer tools to debug Socket.IO connections
- Check the server console for connection logs
- Use React Developer Tools for component debugging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions, please open an issue on the repository. 