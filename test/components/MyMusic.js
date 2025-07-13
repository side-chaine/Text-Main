// test/components/MyMusic.js

const myMusicData = [
    {
        artist: "Linkin Park",
        tracks: [
            { title: "New Divide", played: 12, favorite: true },
            { title: "When They Come For Me", played: 8, favorite: false },
        ]
    },
    {
        artist: "Eminem",
        tracks: [
            { title: "Love The Way You Lie", played: 25, favorite: true },
        ]
    },
    {
        artist: "Aerosmith",
        tracks: [
            { title: "Dream On", played: 5, favorite: false },
        ]
    },
    {
        artist: "Queen",
        tracks: [
            { title: "Bohemian Rhapsody", played: 30, favorite: true },
            { title: "Don't Stop Me Now", played: 20, favorite: false },
            { title: "We Will Rock You", played: 15, favorite: false },
        ]
    },
    {
        artist: "Led Zeppelin",
        tracks: [
            { title: "Stairway to Heaven", played: 40, favorite: true },
            { title: "Whole Lotta Love", played: 22, favorite: false },
        ]
    },
    {
        artist: "The Beatles",
        tracks: [
            { title: "Yesterday", played: 18, favorite: false },
            { title: "Hey Jude", played: 28, favorite: true },
        ]
    },
    {
        artist: "Michael Jackson",
        tracks: [
            { title: "Billie Jean", played: 35, favorite: true },
        ]
    },
    {
        artist: "Madonna",
        tracks: [
            { title: "Like a Prayer", played: 10, favorite: false },
        ]
    },
    {
        artist: "Adele",
        tracks: [
            { title: "Rolling in the Deep", played: 23, favorite: true },
        ]
    }
];

function addEventListeners(container) {
    container.addEventListener('click', (event) => {
        const artistHeader = event.target.closest('.artist-header');
        if (artistHeader) {
            const group = artistHeader.closest('.artist-group');
            const trackList = group.querySelector('.track-list');
            
            group.classList.toggle('expanded');
            trackList.classList.toggle('expanded');
            
            if (trackList.classList.contains('expanded')) {
                trackList.style.maxHeight = trackList.scrollHeight + 'px';
            } else {
                trackList.style.maxHeight = null;
            }
            return;
        }

        const playButton = event.target.closest('.play-button');
        if (playButton) {
            const trackTitle = playButton.dataset.trackTitle;
            alert(`Воспроизведение: ${trackTitle}`);
            return;
        }

        const favoriteButton = event.target.closest('.favorite-button');
        if (favoriteButton) {
            const trackTitle = favoriteButton.dataset.trackTitle;
            favoriteButton.classList.toggle('active');
            const isFavorite = favoriteButton.classList.contains('active');
            alert(`${trackTitle} ${isFavorite ? 'добавлен в' : 'удален из'} избранного`);
            return;
        }
    });
}

export function renderMyMusic(container) {
    if (!container) return;
    container.innerHTML = ''; 

    myMusicData.forEach(artistData => {
        const artistGroup = document.createElement('div');
        artistGroup.className = 'artist-group';

        const artistHeader = document.createElement('div');
        artistHeader.className = 'artist-header';
        artistHeader.innerHTML = `<span>${artistData.artist}</span><span>${artistData.tracks.length} трека <span class="toggle-icon">+</span></span>`;
        artistGroup.appendChild(artistHeader);

        const trackList = document.createElement('ul');
        trackList.className = 'track-list';

        artistData.tracks.forEach(track => {
            const trackItem = document.createElement('li');
            trackItem.className = 'track-item';
            const favoriteClass = track.favorite ? 'active' : '';
            trackItem.innerHTML = `
                <span>${track.title} <span class="track-meta-info">(Исполнено ${track.played} раз)${track.played > 20 ? ' 🔥' : ''}</span></span>
                <span class="track-item-controls">
                    <button class="play-button" data-track-title="${track.title}">▶</button>
                    <button class="favorite-button ${favoriteClass}" data-track-title="${track.title}">⭐</button>
                </span>
            `;
            trackList.appendChild(trackItem);
        });
        artistGroup.appendChild(trackList);
        container.appendChild(artistGroup);
    });

    addEventListeners(container);
} 