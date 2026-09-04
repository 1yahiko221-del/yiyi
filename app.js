let socket = null;
let roomId = null;
let audioPlayer = document.getElementById('audioPlayer');
let playlist = [];
let currentSongIndex = 0;
let isPlaying = false;
let isHost = false;

// Функция для создания комнаты
function createRoom() {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('roomId').value = roomId;
    isHost = true;
    initializeSocket();
}

// Функция для присоединения к комнате
function joinRoom() {
    roomId = document.getElementById('roomId').value.trim();
    if (!roomId) {
        alert('Введите ID комнаты');
        return;
    }
    isHost = false;
    initializeSocket();
}

// Инициализация WebSocket
function initializeSocket() {
    // Используем относительный путь для Socket.IO
    socket = io();
    
    socket.on('connect', () => {
        console.log('Подключено к серверу');
        socket.emit('join-room', roomId);
        document.getElementById('player').style.display = 'block';
    });
    
    socket.on('connect_error', (error) => {
        console.error('Ошибка подключения:', error);
        alert('Не удалось подключиться к серверу. Попробуйте обновить страницу.');
    });
    
    socket.on('sync-state', (state) => {
        console.log('Получено состояние:', state);
        
        // Обновляем плейлист
        if (state.playlist) {
            playlist = state.playlist;
            updatePlaylistUI();
        }
        
        // Загружаем текущий трек
        if (state.currentSongIndex !== undefined && playlist.length > 0) {
            currentSongIndex = state.currentSongIndex;
            loadSong(currentSongIndex);
        }
        
        // Синхронизируем время
        if (state.currentTime !== undefined && !audioPlayer.paused) {
            audioPlayer.currentTime = state.currentTime;
        }
        
        // Синхронизируем воспроизведение
        if (state.isPlaying !== undefined) {
            if (state.isPlaying && audioPlayer.paused && playlist.length > 0) {
                audioPlayer.play();
            } else if (!state.isPlaying && !audioPlayer.paused) {
                audioPlayer.pause();
            }
        }
    });
    
    socket.on('users-update', (users) => {
        updateUsersList(users);
    });
    
    socket.on('play', () => {
        if (playlist.length > 0) {
            audioPlayer.play();
        }
    });
    
    socket.on('pause', () => {
        audioPlayer.pause();
    });
    
    socket.on('seek', (time) => {
        audioPlayer.currentTime = time;
    });
    
    socket.on('song-change', (index) => {
        currentSongIndex = index;
        if (playlist.length > 0) {
            loadSong(index);
        }
    });
    
    socket.on('add-song', (songData) => {
        playlist.push(songData);
        updatePlaylistUI();
        if (playlist.length === 1) {
            loadSong(0);
        }
    });
}

// Загрузка песни
function loadSong(index) {
    if (index < 0 || index >= playlist.length) return;
    
    currentSongIndex = index;
    const song = playlist[index];
    
    if (song.type === 'file') {
        audioPlayer.src = song.url;
    }
    
    document.getElementById('songTitle').textContent = song.title || 'Без названия';
    document.getElementById('songArtist').textContent = song.artist || 'Неизвестный исполнитель';
    
    // Если плеер был в паузе, не начинаем автоматически
    if (audioPlayer.paused) {
        updatePlaylistUI();
        return;
    }
    
    audioPlayer.load();
    audioPlayer.play().catch(e => console.log('Автовоспроизведение заблокировано'));
    updatePlaylistUI();
}

// Переключение воспроизведения
function togglePlay() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        socket.emit('play');
    } else {
        audioPlayer.pause();
        socket.emit('pause');
    }
}

// Обновление списка плейлиста
function updatePlaylistUI() {
    const playlistElement = document.getElementById('playlist');
    playlistElement.innerHTML = '';
    
    playlist.forEach((song, index) => {
        const li = document.createElement('li');
        li.textContent = `${song.title || 'Без названия'} - ${song.artist || 'Неизвестный'}`;
        li.classList.toggle('active', index === currentSongIndex);
        li.onclick = () => {
            if (socket) {
                currentSongIndex = index;
                loadSong(index);
                socket.emit('song-change', index);
            }
        };
        playlistElement.appendChild(li);
    });
}

// Обновление списка пользователей
function updateUsersList(users) {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';
    users.forEach(userId => {
        const li = document.createElement('li');
        li.textContent = userId.substring(0, 8) + '...';
        usersList.appendChild(li);
    });
}

// Загрузка файла
document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && socket) {
        const url = URL.createObjectURL(file);
        const songData = {
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Локальный файл',
            url: url,
            type: 'file'
        };
        
        socket.emit('add-song', songData);
        e.target.value = ''; // Сброс input
    }
});

// Обработчики аудиоплеера
audioPlayer.addEventListener('play', () => {
    if (socket) {
        socket.emit('play');
    }
});

audioPlayer.addEventListener('pause', () => {
    if (socket) {
        socket.emit('pause');
    }
});

audioPlayer.addEventListener('seeked', () => {
    if (socket) {
        socket.emit('seek', audioPlayer.currentTime);
    }
});

// Громкость
document.getElementById('volume').addEventListener('input', (e) => {
    audioPlayer.volume = e.target.value / 100;
});

// Обработчик отключения
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
});

console.log('Приложение загружено!');