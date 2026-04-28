const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', (roomId) => {
    let room = rooms[roomId];
    if (!room) {
      room = { players: [] };
      rooms[roomId] = room;
    }

    if (room.players.length >= 2) {
      socket.emit('roomFull', roomId);
      return;
    }

    socket.join(roomId);
    room.players.push(socket.id);
    console.log(`User ${socket.id} joined room ${roomId}`);

    if (room.players.length === 2) {
      const isPlayer1Sente = Math.random() < 0.5;
      const player1Id = room.players[0];
      const player2Id = room.players[1];

      io.to(player1Id).emit('gameStart', { role: isPlayer1Sente ? 'SENTE' : 'GOTE' });
      io.to(player2Id).emit('gameStart', { role: !isPlayer1Sente ? 'SENTE' : 'GOTE' });
      
      console.log(`Room ${roomId} started.`);
    } else {
      socket.emit('waitingForOpponent');
    }
  });

  socket.on('playerAction', (data) => {
    const joinedRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    if (joinedRooms.length > 0) {
      const roomId = joinedRooms[0];
      socket.to(roomId).emit('opponentAction', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.indexOf(socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        socket.to(roomId).emit('opponentDisconnected');
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
