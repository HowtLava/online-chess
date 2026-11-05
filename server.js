const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
  socket.on('createGame', () => {
    const roomId = Math.random().toString(36).substring(2, 7);
    rooms[roomId] = { players: [socket.id] };
    socket.join(roomId);
    socket.emit('gameCreated', { roomId, color: 'white' });
  });

  socket.on('joinGame', (roomId) => {
    if (rooms[roomId] && rooms[roomId].players.length === 1) {
      rooms[roomId].players.push(socket.id);
      socket.join(roomId);
      socket.emit('gameJoined', { roomId, color: 'black' });
      io.to(roomId).emit('playerJoined');
    } else {
      socket.emit('error', 'Room full or invalid');
    }
  });

  socket.on('makeMove', ({ roomId, move }) => {
    socket.to(roomId).emit('moveMade', move);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));