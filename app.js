let socket = null;
let roomId = null;
let audioPlayer = document.getElementById('audioPlayer');
let playlist = [];
let currentSongIndex = 0;
let isPlaying = false;

// Функция для создания комнаты
function createRoom() {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    document.getElementById('roomId').value = roomId;
    initializeSocket();
    alert(`Комната создана! ID: ${roomId}\nОтправьте этот ID другу`);
}

// Функция для присоединения к комнате
function joinRoom() {
    roomId = document.getElementById('roomId').value.trim();
    if (!roomId) {
        alert('Введите ID комнаты');
        return;
    }
    initializeSocket();
}

// Инициализация WebSocket
function initializeSocket() {
    // Замените на ваш сервер WebSocket
    socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        console.log('Подключено к серверу');
        socket.emit('join-room', roomId);
        document.getElementById('player').style.display = 'block';
    });
    
    socket.on('user-joined', (userId) => {
        console.log(`Пользователь ${userId} присоединился`);
        addUserToList(userId);
    });
    
    socket.on('user-left', (userId) => {
        console.log(`Пользователь ${userId} покинул комнату`);
        removeUserFromList(userId);
    });
    
    socket.on('sync-state', (state) => {
        console.log('Получено состояние:', state);
        // Синхронизация состояния проигрывателя
        if (state.playlist) {
            playlist = state.playlist;
            updatePlaylistUI();
        }
        if (state.currentSongIndex !== undefined) {
            currentSongIndex = state.currentSongIndex;
            loadSong(currentSongIndex);
        }
        if (state.isPlaying !== undefined) {
            if (state.isPlaying && audioPlayer.paused) {
                audioPlayer.play();
            } else if (!state.isPlaying && !audioPlayer.paused) {
                audioPlayer.pause();
            }
        }
    });
    
    socket.on('play', () => {
        audioPlayer.play();
    });
    
    socket.on('pause', () => {
        audioPlayer.pause();
    });
    
    socket.on('seek', (time) => {
        audioPlayer.currentTime = time;
    });
    
    socket.on('new-song', (songData) => {
        playlist.push(songData);
        updatePlaylistUI();
        if (playlist.length === 1) {
            loadSong(0);
        }
    });
}

// Функции управления проигрывателем
function togglePlay() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        socket.emit('play');
    } else {
        audioPlayer.pause();
        socket.emit('pause');
    }
}

function loadSong(index) {
    if (index < 0 || index >= playlist.length) return;
    
    currentSongIndex = index;
    const song = playlist[index];
    
    if (song.type === 'file') {
        // Для локальных файлов
        audioPlayer.src = song.url;
    } else {
        // Для стриминговых сервисов (YouTube, Spotify и т.д.)
        // Здесь можно добавить интеграцию с API
    }
    
    document.getElementById('songTitle').textContent = song.title;
    document.getElementById('songArtist').textContent = song.artist;
    
    updatePlaylistUI();
}

function updatePlaylistUI() {
    const playlistElement = document.getElementById('playlist');
    playlistElement.innerHTML = '';
    
    playlist.forEach((song, index) => {
        const li = document.createElement('li');
        li.textContent = `${song.title} - ${song.artist}`;
        li.classList.toggle('active', index === currentSongIndex);
        li.onclick = () => loadSong(index);
        playlistElement.appendChild(li);
    });
}

// Обработчики событий
document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        const songData = {
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Локальный файл',
            url: url,
            type: 'file'
        };
        
        playlist.push(songData);
        updatePlaylistUI();
        
        if (socket) {
            socket.emit('new-song', songData);
        }
        
        if (playlist.length === 1) {
            loadSong(0);
        }
    }
});

audioPlayer.addEventListener('timeupdate', () => {
    // Можно добавить синхронизацию времени
});

audioPlayer.addEventListener('seeked', () => {
    if (socket) {
        socket.emit('seek', audioPlayer.currentTime);
    }
});

document.getElementById('volume').addEventListener('input', (e) => {
    audioPlayer.volume = e.target.value / 100;
});

// Вспомогательные функции
function addUserToList(userId) {
    const usersList = document.getElementById('usersList');
    const li = document.createElement('li');
    li.id = `user-${userId}`;
    li.textContent = userId;
    usersList.appendChild(li);
}

function removeUserFromList(userId) {
    const userElement = document.getElementById(`user-${userId}`);
    if (userElement) {
        userElement.remove();
    }
}