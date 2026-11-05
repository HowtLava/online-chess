const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const registeredUsers = new Map(); // username -> hashed password
const onlineUsers = new Map();     // username -> socketId
const rooms = {};

io.on('connection', (socket) => {
  let currentUser = null;

  // Handle Registration
  socket.on('register', async ({ username, password }) => {
    if (!username || !password) {
      return socket.emit('auth-error', 'Username and password required.');
    }
    if (registeredUsers.has(username)) {
      return socket.emit('auth-error', 'Username already taken.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    registeredUsers.set(username, hashedPassword);
    socket.emit('auth-success', { message: 'Account created! Now click Log In.', username });
  });

  // Handle Login
  socket.on('login', async ({ username, password }) => {
    const hashedPassword = registeredUsers.get(username);
    if (!hashedPassword) {
      return socket.emit('auth-error', 'Account not found. Click Register first.');
    }

    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (!isMatch) {
      return socket.emit('auth-error', 'Incorrect password.');
    }

    currentUser = username;
    onlineUsers.set(username, socket.id);
    socket.emit('login-success', { username });
    io.emit('online-users-update', Array.from(onlineUsers.keys()));
  });

  // Rooms & Moves
  socket.on('create-room', () => {
    const roomCode = Math.random().toString(36).substring(2, 7);
    rooms[roomCode] = { players: [socket.id] };
    socket.join(roomCode);
    socket.emit('room-created', roomCode);
  });

  socket.on('join-room', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.players.length === 1) {
      room.players.push(socket.id);
      socket.join(roomCode);
      socket.emit('joined-room', roomCode);
      io.to(roomCode).emit('player-joined', { roomCode });
    } else {
      socket.emit('error-message', 'Room is full or invalid.');
    }
  });

  socket.on('make-move', (data) => {
    socket.to(data.roomCode).emit('move-made', data.move);
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      onlineUsers.delete(currentUser);
      io.emit('online-users-update', Array.from(onlineUsers.keys()));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});