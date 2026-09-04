const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Отдача статических файлов из текущей папки
app.use(express.static(__dirname));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);
    
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                users: new Set(),
                state: {}
            });
        }
        
        const room = rooms.get(roomId);
        room.users.add(socket.id);
        
        // Отправляем текущее состояние новому пользователю
        socket.emit('sync-state', room.state);
        
        // Уведомляем остальных о новом пользователе
        socket.to(roomId).emit('user-joined', socket.id);
        
        socket.on('disconnect', () => {
            room.users.delete(socket.id);
            socket.to(roomId).emit('user-left', socket.id);
            
            if (room.users.size === 0) {
                rooms.delete(roomId);
            }
        });
        
        // Обработчики событий проигрывателя
        socket.on('play', () => {
            room.state.isPlaying = true;
            socket.to(roomId).emit('play');
        });
        
        socket.on('pause', () => {
            room.state.isPlaying = false;
            socket.to(roomId).emit('pause');
        });
        
        socket.on('seek', (time) => {
            room.state.currentTime = time;
            socket.to(roomId).emit('seek', time);
        });
        
        socket.on('new-song', (songData) => {
            if (!room.state.playlist) {
                room.state.playlist = [];
            }
            room.state.playlist.push(songData);
            socket.to(roomId).emit('new-song', songData);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});