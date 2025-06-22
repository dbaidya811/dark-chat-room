# Dark Chat Room

A modern, real-time group chat web application with group voice call, file sharing, and a beautiful mobile-friendly UI. Messages are saved for your session (reload-safe), but cleared when you leave the site.

## Features
- **Real-time group text chat**
- **File sharing** (images, videos, docs)
- **Group voice call** (invite and talk with all users in the room)
- **Responsive/mobile-friendly UI**
- **Session message persistence** (reload-safe, but messages clear when you close the tab/browser)
- **Copy room link & leave room**

## Setup & Installation
1. **Requirements:**
   - Node.js (v14 or higher recommended)

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the server:**
   ```bash
   node server.js
   ```

4. **Open in browser:**
   - Go to [http://localhost:3001](http://localhost:3001)

## Usage
- **Create or join a room:**
  - Open the site, enter a username, and join/create a room.
  - Share the room link to invite others.
- **Text chat:**
  - Type and send messages. Messages are saved for your session (reload-safe).
- **File sharing:**
  - Attach and send images, videos, or documents.
- **Voice call:**
  - Click the Voice Call button (or use the mobile menu) to start a group call.
  - Others will get an invite and can join the call.
- **Mobile tips:**
  - Hamburger menu (top right) for actions on mobile.
  - Header and input bar stay fixed; chat area scrolls.

## Credits
- UI/UX: Inspired by modern chat apps (WhatsApp, Discord)
- Icons: [Font Awesome](https://fontawesome.com/) & [Flaticon](https://flaticon.com/)
- Voice/peer: [PeerJS](https://peerjs.com/)

## License
MIT 