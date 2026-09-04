const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Настройка Socket.IO для Railway
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

// Отдача статических файлов
app.use(express.static(path.join(__dirname)));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Проверка здоровья для Railway
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);
    
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Пользователь ${socket.id} присоединился к комнате ${roomId}`);
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                users: new Set(),
                state: {
                    playlist: [],
                    currentSongIndex: 0,
                    currentTime: 0,
                    isPlaying: false
                }
            });
        }
        
        const room = rooms.get(roomId);
        room.users.add(socket.id);
        
        // Отправляем текущее состояние новому пользователю
        socket.emit('sync-state', {
            playlist: room.state.playlist,
            currentSongIndex: room.state.currentSongIndex,
            currentTime: room.state.currentTime,
            isPlaying: room.state.isPlaying
        });
        
        // Отправляем список пользователей
        io.to(roomId).emit('users-update', Array.from(room.users));
        
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
        
        socket.on('song-change', (index) => {
            room.state.currentSongIndex = index;
            room.state.currentTime = 0;
            socket.to(roomId).emit('song-change', index);
        });
        
        socket.on('add-song', (songData) => {
            room.state.playlist.push(songData);
            io.to(roomId).emit('add-song', songData);
        });
        
        socket.on('disconnect', () => {
            room.users.delete(socket.id);
            io.to(roomId).emit('users-update', Array.from(room.users));
            
            if (room.users.size === 0) {
                rooms.delete(roomId);
                console.log(`Комната ${roomId} удалена`);
            }
        });
    });
});

// Используем порт от Railway
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});