/**
 * Catalog V2 - Новый каталог на основе catalog-design-test.html
 */

console.log('🔄 ЗАГРУЗКА: catalog-v2.js начинает загрузку...');

class CatalogV2 {
    constructor() {
        this.overlay = null;
        this.isOpen = false;
        this.tracks = [];
        this.db = null;
        this.uploadSession = {
            instrumental: null,
            vocal: null,
            lyrics: null
        };
        
        this.init();
        console.log('🎵 CatalogV2 инициализирован');
    }
    
    init() {
        this.overlay = document.getElementById('catalog-v2-overlay');
        
        if (!this.overlay) {
            console.error('❌ CatalogV2: Overlay не найден');
            return;
        }
        
        this.setupEventListeners();
        this.initDatabase();
    }
    
    initDatabase() {
        const DB_NAME = 'TextAppDB';
        const DB_VERSION = 5;
        const openMain = () => indexedDB.open(DB_NAME, DB_VERSION);
        const openRecovery = (name) => indexedDB.open(name, 1);

        const request = openMain();
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('tracks')) {
                const s = db.createObjectStore('tracks', { keyPath: 'id' });
                s.createIndex('title', 'title', { unique: false });
            }
            if (!db.objectStoreNames.contains('app_state')) db.createObjectStore('app_state', { keyPath: 'key' });
            if (!db.objectStoreNames.contains('temp_audio_files')) db.createObjectStore('temp_audio_files', { keyPath: 'id' });
        };
        request.onsuccess = (event) => {
            this.db = event.target.result;
            console.log('🎵 CatalogV2: База данных подключена');
            this.loadTracksFromDB();
        };
        request.onerror = () => {
            console.warn('❌ CatalogV2: Ошибка подключения. Пробуем пересоздать базу...');
            const del = indexedDB.deleteDatabase(DB_NAME);
            del.onsuccess = () => {
                const retry = openMain();
                retry.onupgradeneeded = request.onupgradeneeded;
                retry.onsuccess = (ev2) => { this.db = ev2.target.result; this.loadTracksFromDB(); };
                retry.onerror = () => {
                    const recovery = 'TextAppDB_Recovery_' + Date.now();
                    const rec = openRecovery(recovery);
                    rec.onupgradeneeded = (e3) => {
                        const db = e3.target.result;
                        const s = db.createObjectStore('tracks', { keyPath: 'id' });
                        s.createIndex('title', 'title', { unique: false });
                        db.createObjectStore('app_state', { keyPath: 'key' });
                        db.createObjectStore('temp_audio_files', { keyPath: 'id' });
                    };
                    rec.onsuccess = (e3) => { this.db = e3.target.result; this.loadTracksFromDB(); };
                    rec.onerror = (e3) => console.error('💥 CatalogV2: Recovery DB open failed:', e3);
                };
            };
        };
    }
    
    async loadTracksFromDB() {
        if (!this.db) {
            console.error('❌ CatalogV2: База данных не инициализирована');
            return;
        }
        
        try {
            const transaction = this.db.transaction(['tracks'], 'readonly');
            const store = transaction.objectStore('tracks');
            const request = store.getAll();
            
            request.onsuccess = () => {
                this.tracks = request.result || [];
                console.log(`🎵 CatalogV2: Загружено ${this.tracks.length} треков`);
                
                // 🎯 Обновляем "Мою музыку" при первой загрузке
                this.renderMyMusic();
                
                // 🎯 Также обновляем основной каталог для синхронизации
                if (window.trackCatalog && this.tracks.length > 0) {
                    // Проверяем есть ли новые треки, которых нет в основном каталоге
                    this.tracks.forEach(track => {
                        const existsInMain = window.trackCatalog.tracks.find(t => t.id === track.id);
                        if (!existsInMain) {
                            window.trackCatalog.tracks.push(track);
                            console.log(`✅ CatalogV2: Трек "${track.title}" синхронизирован с основным каталогом`);
                        }
                    });
                }
            };
            
            request.onerror = () => {
                console.error('❌ CatalogV2: Ошибка загрузки треков');
            };
        } catch (error) {
            console.error('❌ CatalogV2: Ошибка при работе с базой данных:', error);
        }
    }
    
    renderMyMusic() {
        const myMusicContent = this.overlay.querySelector('.my-music-content');
        if (!myMusicContent) return;
        
        // 🎯 ИСПОЛЬЗУЕМ треки из основного каталога (window.trackCatalog.tracks)
        let allTracks = [];
        
        if (window.trackCatalog && window.trackCatalog.tracks) {
            allTracks = window.trackCatalog.tracks;
        }
        
        if (allTracks.length === 0) {
            myMusicContent.innerHTML = '<p class="empty-state">Загрузите треки через "Upload Track" →</p>';
            return;
        }
        
        // Группируем треки по исполнителям/альбомам
        const groupedTracks = this.groupTracksByArtist(allTracks);
        
        let html = '';
        for (const [artist, tracks] of Object.entries(groupedTracks)) {
            html += `
                <div class="artist-group">
                    <div class="artist-header" onclick="this.parentElement.classList.toggle('expanded')">
                        <span class="artist-name">🎵 ${artist}</span>
                        <span class="track-count">(${tracks.length})</span>
                        <span class="expand-icon">▼</span>
                    </div>
                    <div class="artist-tracks">
                        ${tracks.map(track => `
                            <div class="track-item" data-track-id="${track.id}">
                                <span class="track-title">${track.title}</span>
                                <div class="track-actions">
                                    <button class="track-action-btn play-btn" title="Играть">▶</button>
                                    <button class="track-action-btn add-btn" title="Добавить в плейлист">➕</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        myMusicContent.innerHTML = html;
        console.log(`🎵 CatalogV2: "Моя музыка" обновлена, отображено ${allTracks.length} треков`);
    }
    
    groupTracksByArtist(tracksArray = null) {
        const grouped = {};
        
        // Используем переданный массив или this.tracks как fallback
        const tracks = tracksArray || this.tracks;
        
        tracks.forEach(track => {
            // Пытаемся определить исполнителя из названия или метаданных
            let artist = 'Неизвестный исполнитель';
            
            if (track.artist) {
                artist = track.artist;
            } else if (track.title) {
                // Пытаемся извлечь исполнителя из названия (формат "Исполнитель - Песня")
                const dashIndex = track.title.indexOf(' - ');
                if (dashIndex > 0) {
                    artist = track.title.substring(0, dashIndex);
                }
            }
            
            if (!grouped[artist]) {
                grouped[artist] = [];
            }
            grouped[artist].push(track);
        });
        
        return grouped;
    }
    
    setupEventListeners() {
        // Кнопка тестирования
        const testBtn = document.getElementById('catalog-v2-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.open());
        }
        
        // Стильный крестик для закрытия (псевдоэлемент)
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                // Проверяем клик по контейнеру в области крестика
                const container = this.overlay.querySelector('.catalog-v2-container');
                if (container && e.target === container) {
                    const rect = container.getBoundingClientRect();
                    const clickX = e.clientX;
                    const clickY = e.clientY;
                    
                    // Область крестика (top: 15px, right: 20px, размер: 35px)
                    const closeAreaLeft = rect.right - 20 - 35;
                    const closeAreaTop = rect.top + 15;
                    const closeAreaRight = rect.right - 20;
                    const closeAreaBottom = rect.top + 15 + 35;
                    
                    if (clickX >= closeAreaLeft && clickX <= closeAreaRight &&
                        clickY >= closeAreaTop && clickY <= closeAreaBottom) {
                        this.close();
                        return;
                    }
                }
                
                // Закрытие по клику на фон
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Кнопка очистки IndexedDB
        const clearDbBtn = document.getElementById('clear-indexeddb-btn');
        if (clearDbBtn) {
            clearDbBtn.addEventListener('click', () => {
                if (confirm('⚠️ ВНИМАНИЕ! Это удалит ВСЕ сохраненные треки и данные.\n\nПродолжить очистку базы данных?')) {
                    this.clearIndexedDB();
                }
            });
        }
        
        // НОВЫЙ ФУНКЦИОНАЛ: Табы и переключатели
        this.setupTabsAndToggles();
    }
    
    setupTabsAndToggles() {
        // Управление табами в центральной колонке
        this.overlay.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                this.switchTab(e.target);
            }
            
            if (e.target.classList.contains('toggle-btn')) {
                this.switchToggle(e.target);
            }
            
            // Обработчики для кнопок треков
            if (e.target.classList.contains('play-btn')) {
                this.playTrack(e.target);
            }
            
            if (e.target.classList.contains('add-btn')) {
                this.addToPlaylist(e.target);
            }
        });
        
        // Обработчики для Upload Mode
        this.setupUploadMode();
    }
    
    setupUploadMode() {
        const fileInputs = {
            instrumental: document.getElementById('instrumental-input'),
            vocal: document.getElementById('vocal-input'),
            lyrics: document.getElementById('lyrics-input'),
            json: document.getElementById('json-input')
        };
        
        const uploadCells = {
            instrumental: document.querySelector('.upload-cell[data-type="instrumental"]'),
            vocal: document.querySelector('.upload-cell[data-type="vocal"]'),
            lyrics: document.querySelector('.upload-cell[data-type="lyrics"]'),
            json: document.querySelector('.upload-cell[data-type="json"]')
        };
        
        const saveButton = document.getElementById('upload-save');
        const cancelButton = document.getElementById('upload-cancel');
        
        // Обработка выбора файлов
        Object.keys(fileInputs).forEach(type => {
            const input = fileInputs[type];
            const cell = uploadCells[type];
            
            if (input && cell) {
                // Клик по ячейке открывает файловый диалог
                cell.addEventListener('click', () => {
                    input.click();
                });
                
                // Обработка выбора файла
                input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.handleFileSelect(type, file, cell);
                    }
                });
                
                // Drag & Drop
                cell.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    cell.classList.add('drag-over');
                });
                
                cell.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    cell.classList.remove('drag-over');
                });
                
                cell.addEventListener('drop', (e) => {
                    e.preventDefault();
                    cell.classList.remove('drag-over');
                    
                    const file = e.dataTransfer.files[0];
                    if (file) {
                        input.files = e.dataTransfer.files;
                        this.handleFileSelect(type, file, cell);
                    }
                });
            }
        });
        
        // Кнопки управления
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveTrack());
        }
        
        if (cancelButton) {
            cancelButton.addEventListener('click', () => this.cancelUpload());
        }
    }
    
    switchTab(clickedTab) {
        const tabName = clickedTab.dataset.tab;
        
        // Убираем active у всех табов
        this.overlay.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Убираем active у всех панелей
        this.overlay.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Активируем выбранный таб и панель
        clickedTab.classList.add('active');
        const targetPanel = this.overlay.querySelector(`#${tabName}-panel`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
        
        console.log(`🔄 CatalogV2: Переключен на таб ${tabName}`);
    }
    
    switchToggle(clickedToggle) {
        const mode = clickedToggle.dataset.mode;
        
        // Убираем active у всех переключателей
        this.overlay.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Скрываем все режимы
        this.overlay.querySelectorAll('.search-mode-content, .upload-mode-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Активируем выбранный переключатель и режим
        clickedToggle.classList.add('active');
        const targetContent = this.overlay.querySelector(`.${mode}-mode-content`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        console.log(`🔄 CatalogV2: Переключен на режим ${mode}`);
    }
    
    playTrack(button) {
        const trackItem = button.closest('.track-item');
        if (!trackItem) return;
        
        const trackId = parseInt(trackItem.dataset.trackId);
        
        // 🎯 ИЩЕМ трек в ОБЪЕДИНЕННОМ массиве (основной каталог + новые треки CatalogV2)
        let track = null;
        
        // Сначала ищем в основном каталоге
        if (window.trackCatalog && window.trackCatalog.tracks) {
            track = window.trackCatalog.tracks.find(t => t.id === trackId);
        }
        
        // Если не найден в основном, ищем в CatalogV2
        if (!track) {
            track = this.tracks.find(t => t.id === trackId);
        }
        
        if (!track) {
            console.error('❌ CatalogV2: Трек не найден в обоих каталогах, ID:', trackId);
            this.showNotification('❌ Трек не найден');
            return;
        }
        
        console.log(`🎵 CatalogV2: Загружается трек "${track.title}" (ID: ${trackId})`);
        
        // Закрываем каталог
        this.close();
        
        // Загружаем трек через существующий API
        if (window.trackCatalog && typeof window.trackCatalog.loadTrack === 'function') {
            // Используем массив треков из оригинального TrackCatalog для правильного индекса
            const originalTrackIndex = window.trackCatalog.tracks.findIndex(t => t.id === trackId);
            if (originalTrackIndex !== -1) {
                console.log(`🎵 CatalogV2: Найден индекс ${originalTrackIndex} в оригинальном каталоге`);
                window.trackCatalog.loadTrack(originalTrackIndex);
            } else {
                console.error('❌ CatalogV2: Трек не найден в оригинальном каталоге');
                this.showNotification('❌ Трек не синхронизирован с основным каталогом');
            }
        } else {
            console.error('❌ CatalogV2: TrackCatalog API недоступен');
            this.showNotification('❌ TrackCatalog API недоступен');
        }
    }
    
    addToPlaylist(button) {
        const trackItem = button.closest('.track-item');
        if (!trackItem) return;
        
        const trackId = parseInt(trackItem.dataset.trackId);
        
        // 🎯 ИЩЕМ трек аналогично playTrack
        let track = null;
        
        // Сначала ищем в основном каталоге
        if (window.trackCatalog && window.trackCatalog.tracks) {
            track = window.trackCatalog.tracks.find(t => t.id === trackId);
        }
        
        // Если не найден в основном, ищем в CatalogV2
        if (!track) {
            track = this.tracks.find(t => t.id === trackId);
        }
        
        if (!track) {
            console.error('❌ CatalogV2: Трек не найден для плейлиста, ID:', trackId);
            this.showNotification('❌ Трек не найден');
            return;
        }
        
        console.log(`➕ CatalogV2: Добавление трека "${track.title}" в "Мою музыку"`);
        
        // 🎯 ДОБАВЛЯЕМ трек в "Мою музыку" (renderMyMusic обновится)
        this.renderMyMusic();
        this.showNotification(`✅ Трек "${track.title}" добавлен в "Мою музыку"`);
        
        // Визуальная обратная связь
        button.textContent = '✅';
        button.disabled = true;
        
        setTimeout(() => {
            button.textContent = '➕';
            button.disabled = false;
        }, 2000);
    }
    
    handleFileSelect(type, file, cell) {
        // Показываем анимацию загрузки
        cell.classList.add('processing');
        
        setTimeout(() => {
            cell.classList.remove('processing');
            cell.classList.add('file-selected');
            
            // Обновляем UI ячейки
            this.updateCellUI(cell, file);
            
            // Сохраняем файл в сессию
            if (type === 'instrumental') {
                this.uploadSession.instrumental = file;
            } else if (type === 'vocal') {
                this.uploadSession.vocal = file;
            } else if (type === 'lyrics') {
                this.uploadSession.lyrics = file;
            } else if (type === 'json') {
                this.uploadSession.json = file;
                // Пробуем прочитать JSON и валидировать
                this.readFileAsText(file).then(text => {
                    try {
                        const data = JSON.parse(text);
                        if (Array.isArray(data)) {
                            this.uploadSession.jsonMarkers = data;
                        } else if (data && Array.isArray(data.markers)) {
                            this.uploadSession.jsonMarkers = data.markers;
                        } else {
                            this.showNotification('❌ JSON должен содержать массив markers');
                            this.uploadSession.jsonMarkers = null;
                        }
                    } catch (e) {
                        console.error('JSON parse error:', e);
                        this.showNotification('❌ Некорректный JSON файл');
                        this.uploadSession.jsonMarkers = null;
                    }
                });
            }
            
            // Обновляем состояние кнопки сохранения
            this.updateSaveButton();
            
            console.log(`🎵 Файл выбран для ${type}:`, file.name);
        }, 800);
    }
    
    updateCellUI(cell, file) {
        // Обновляем текст в ячейке
        const dropText = cell.querySelector('.drop-text');
        if (dropText) {
            dropText.textContent = '✅ Файл загружен';
        }
        
        // Добавляем имя файла
        let fileName = cell.querySelector('.file-name');
        if (!fileName) {
            fileName = document.createElement('div');
            fileName.className = 'file-name';
            cell.appendChild(fileName);
        }
        fileName.textContent = file.name;
    }
    
    updateSaveButton() {
        const saveButton = document.getElementById('upload-save');
        if (saveButton) {
            const hasInstrumental = this.uploadSession.instrumental !== null;
            saveButton.disabled = !hasInstrumental;
            
            if (hasInstrumental) {
                saveButton.textContent = '💾 Сохранить трек';
            } else {
                saveButton.textContent = '💾 Выберите инструментал';
            }
        }
    }
    
    cancelUpload() {
        // Очищаем сессию
        this.uploadSession = {
            instrumental: null,
            vocal: null,
            lyrics: null
        };
        
        // Сбрасываем UI всех ячеек
        const cells = document.querySelectorAll('.upload-cell');
        cells.forEach(cell => {
            cell.classList.remove('file-selected', 'processing');
            
            const dropText = cell.querySelector('.drop-text');
            const fileLabel = cell.querySelector('.file-label');
            const fileName = cell.querySelector('.file-name');
            
            if (dropText) {
                dropText.textContent = 'Перетащите файл или нажмите для выбора';
            }
            
            if (fileName) {
                fileName.remove();
            }
        });
        
        // Очищаем input'ы
        const inputs = document.querySelectorAll('.upload-mode-content .file-input');
        inputs.forEach(input => {
            input.value = '';
        });
        
        // Сбрасываем кнопку сохранения
        this.updateSaveButton();
        
        console.log('🔄 Upload session сброшена');
    }
    
    async saveTrack() {
        console.log('💾 CatalogV2: Сохранение трека...');
        
        if (!this.uploadSession.instrumental) {
            this.showNotification('❌ Выберите инструментальную дорожку');
            return;
        }
        
        // 🎯 КРИТИЧНО: Проверяем готовность базы данных
        if (!window.trackCatalog.db) {
            console.warn('🔄 CatalogV2: База данных не готова, ожидаем инициализации...');
            
            // Ждём инициализации базы данных (максимум 5 секунд)
            let attempts = 0;
            const maxAttempts = 50; // 50 попыток по 100мс = 5 секунд
            
            while (!window.trackCatalog.db && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
                console.log(`🔄 CatalogV2: Попытка ${attempts}/${maxAttempts} ожидания базы данных...`);
            }
            
            if (!window.trackCatalog.db) {
                console.error('❌ CatalogV2: База данных не инициализировалась за 5 секунд');
                this.showNotification('❌ Ошибка: база данных недоступна');
                return;
            }
            
            console.log('✅ CatalogV2: База данных готова!');
        }
        
        try {
            // Показываем индикатор загрузки
            const saveBtn = document.getElementById('upload-save');
            if (saveBtn) {
                saveBtn.textContent = '⏳ Сохранение...';
                saveBtn.disabled = true;
            }
            
            console.log('🔧 CatalogV2: Обработка файлов...');
            
            // Читаем все файлы
            const instrumentalData = await this.readFileAsArrayBuffer(this.uploadSession.instrumental);
            const instrumentalType = this.uploadSession.instrumental.type;
            
            let vocalsData = null;
            let vocalsType = null;
            if (this.uploadSession.vocal) {
                vocalsData = await this.readFileAsArrayBuffer(this.uploadSession.vocal);
                vocalsType = this.uploadSession.vocal.type;
                console.log('✅ CatalogV2: Вокал прочитан');
            }
            
            let lyricsFileName = null;
            let lyricsOriginalContent = null;
            if (this.uploadSession.lyrics) {
                lyricsOriginalContent = await this.readFileAsText(this.uploadSession.lyrics);
                lyricsFileName = this.uploadSession.lyrics.name;
                console.log('✅ CatalogV2: Текст прочитан');
            }
            
            console.log('✅ CatalogV2: Инструментал прочитан');
            
            // Создаем объект трека
            const trackTitle = this.uploadSession.instrumental.name.replace(/\.[^/.]+$/, "");
            const trackData = {
                id: Date.now(),
                title: trackTitle,
                instrumentalData: instrumentalData,
                instrumentalType: instrumentalType,
                vocalsData: vocalsData,
                vocalsType: vocalsType,
                lyricsFileName: lyricsFileName,
                dateAdded: new Date().toISOString(),
                lyricsOriginalContent: lyricsOriginalContent,
                // 🎯 ВАЖНО: Добавляем пустой массив блоков для последующего редактирования
                blocksData: [],
                lyrics: lyricsOriginalContent, // Изначально lyrics = оригинальному тексту
                lastModified: new Date().toISOString(),
                // Если приложены маркеры JSON — сохраняем их сразу
                syncMarkers: Array.isArray(this.uploadSession?.jsonMarkers) ? this.uploadSession.jsonMarkers : []
            };
            
            console.log('📝 CatalogV2: Данные трека готовы:', trackTitle);
            
            // Сохраняем в IndexedDB
            console.log('🔄 CatalogV2: Сохранение в IndexedDB...');
            const savedTrack = await window.trackCatalog._saveTrackToDB(trackData);
            console.log('✅ CatalogV2: Трек сохранен в IndexedDB с ID:', savedTrack.id);
            
            // Добавляем в массив основного каталога
            window.trackCatalog.tracks.push(savedTrack);
            this.tracks.push(savedTrack);
            console.log('✅ CatalogV2: Трек добавлен в локальный массив');

            // Если есть маркеры — применяем в UI сразу
            try {
                if (savedTrack.syncMarkers && savedTrack.syncMarkers.length > 0 && window.markerManager) {
                    window.markerManager.setMarkers(savedTrack.syncMarkers);
                }
            } catch (e) { console.warn('Не удалось применить маркеры из JSON сразу:', e); }

            // 🎯 ВАЖНО: Добавляем трек в результаты поиска, а НЕ в "Мою музыку"
            this.addTrackToSearchResults(savedTrack);
            console.log('✅ CatalogV2: Трек добавлен в результаты поиска');
            
            // Показываем уведомление
            this.showNotification(`✅ Трек "${trackTitle}" успешно сохранен!`);
            console.log('🔔 CatalogV2: ✅ Трек "' + trackTitle + '" успешно сохранен!');
            
            // Очищаем форму
            this.cancelUpload();
            
            // 🎯 НОВОЕ: Автоматически открываем редактор блоков для нового трека
            console.log('🎯 CatalogV2: Открываем редактор блоков для обработки трека');
            setTimeout(() => {
                this.openBlockEditorForTrack(savedTrack);
            }, 500); // Небольшая задержка для завершения UI обновлений
            
        } catch (error) {
            console.error('❌ CatalogV2: Ошибка при сохранении трека:', error);
            this.showNotification('❌ Ошибка при сохранении трека');
            
            // Восстанавливаем кнопку
            const saveBtn = document.getElementById('upload-save');
            if (saveBtn) {
                saveBtn.textContent = '💾 Сохранить трек';
                saveBtn.disabled = false;
            }
        }
    }
    
    // 🎯 НОВАЯ ФУНКЦИЯ: Добавление трека в результаты поиска
    addTrackToSearchResults(track) {
        // Переключаемся на режим поиска
        this.switchToggle(document.querySelector('.toggle-btn[data-mode="search"]'));
        
        // Находим контейнер результатов поиска
        const searchResults = document.querySelector('.search-results');
        if (!searchResults) return;
        
        // Убираем пустое состояние
        const emptyState = searchResults.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Создаем элемент трека
        const trackElement = document.createElement('div');
        trackElement.className = 'search-result-item track-item';
        trackElement.setAttribute('data-track-id', track.id); // 🎯 ВАЖНО: добавляем ID трека
        trackElement.innerHTML = `
            <div class="track-title">${track.title}</div>
            <div class="track-actions">
                <button class="track-action-btn play-btn" data-track-id="${track.id}">▶</button>
                <button class="track-action-btn add-btn" data-track-id="${track.id}">➕</button>
            </div>
        `;
        
        // 🎯 ВАЖНО: НЕ добавляем отдельные обработчики, используем делегирование событий
        
        // Добавляем в начало списка
        if (searchResults.firstChild && !searchResults.firstChild.classList?.contains('empty-state')) {
            searchResults.insertBefore(trackElement, searchResults.firstChild);
        } else {
            searchResults.appendChild(trackElement);
        }
        
        // Анимация появления
        trackElement.style.opacity = '0';
        trackElement.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            trackElement.style.transition = 'all 0.3s ease';
            trackElement.style.opacity = '1';
            trackElement.style.transform = 'translateY(0)';
        }, 100);
    }
    
    // 🗑️ ФУНКЦИЯ ОЧИСТКИ IndexedDB
    async clearIndexedDB() {
        console.log('🗑️ CatalogV2: Очистка IndexedDB...');
        
        try {
            const deleteRequest = indexedDB.deleteDatabase('TextAppDB');
            
            deleteRequest.onsuccess = () => {
                console.log('✅ CatalogV2: IndexedDB полностью очищен');
                this.showNotification('✅ База данных очищена');
                
                // Перезагружаем страницу для полного сброса
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            };
            
            deleteRequest.onerror = (event) => {
                console.error('❌ CatalogV2: Ошибка очистки IndexedDB:', event);
                this.showNotification('❌ Ошибка очистки базы данных');
            };
            
        } catch (error) {
            console.error('❌ CatalogV2: Критическая ошибка очистки:', error);
        }
    }
    
    // 🎯 НОВЫЙ МЕТОД: Открытие редактора блоков для трека
    async openBlockEditorForTrack(track) {
        console.log('🎯 CatalogV2: Подготовка редактора блоков для трека:', track.title);
        
        try {
            // Закрываем каталог
            this.close();
            
            // Загружаем трек в основное приложение
            console.log('🔄 CatalogV2: Загружаем трек в приложение...');
            await this.loadTrackIntoApp(track);
            
            // Небольшая задержка для завершения загрузки
            const startTs = performance.now();
            const maxWaitMs = 5000;
            const waitReady = async () => {
                const ready = window.waveformEditor
                    && typeof window.waveformEditor._openNewBlockEditor === 'function'
                    && window.waveformEditor.currentTrackId === track.id;
                if (ready) {
                    console.log('🎯 CatalogV2: WaveformEditor готов. Открываем Block Editor');
                    window.waveformEditor._openNewBlockEditor();
                    return;
                }
                if (performance.now() - startTs > maxWaitMs) {
                    console.warn('⚠️ CatalogV2: Не удалось дождаться готовности WaveformEditor для Block Editor');
                    this.showNotification('⚠️ Редактор блоков недоступен: таймаут ожидания');
                    return;
                }
                setTimeout(waitReady, 150);
            };
            waitReady();
            
        } catch (error) {
            console.error('❌ CatalogV2: Ошибка при открытии редактора блоков:', error);
            this.showNotification('❌ Ошибка открытия редактора блоков');
        }
    }
    
    // 🔄 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Загрузка трека в приложение
    async loadTrackIntoApp(track) {
        if (!window.trackCatalog || typeof window.trackCatalog.loadTrack !== 'function') {
            throw new Error('TrackCatalog недоступен');
        }
        
        // 🎯 ПРИНУДИТЕЛЬНО ПЕРЕЗАГРУЖАЕМ ТРЕКИ ИЗ БД ДЛЯ ПОЛУЧЕНИЯ СВЕЖИХ ДАННЫХ
        console.log('🔄 CatalogV2: Принудительно перезагружаем треки из IndexedDB для получения актуальных блоков...');
        await window.trackCatalog._loadTracksFromDB();
        
        // Находим индекс трека в основном каталоге
        const trackIndex = window.trackCatalog.tracks.findIndex(t => t.id === track.id);
        if (trackIndex === -1) {
            throw new Error('Трек не найден в основном каталоге');
        }
        
        // 🎯 ПРОВЕРЯЕМ НАЛИЧИЕ БЛОКОВ В ТРЕКЕ
        const foundTrack = window.trackCatalog.tracks[trackIndex];
        console.log(`🔍 CatalogV2: Найден трек "${foundTrack.title}":`, {
            hasBlocksData: !!foundTrack.blocksData,
            blocksCount: foundTrack.blocksData ? foundTrack.blocksData.length : 0,
            hasLyrics: !!foundTrack.lyrics,
            lastModified: foundTrack.lastModified
        });
        
        console.log(`🔄 CatalogV2: Загружаем трек с индексом ${trackIndex}`);
        await window.trackCatalog.loadTrack(trackIndex);
        
        return trackIndex;
    }
    
    async readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }
    
    async readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }
    
    showNotification(message) {
        // Используем систему уведомлений приложения если доступна
        if (window.app && typeof window.app.showNotification === 'function') {
            // Определяем тип уведомления по первому символу
            const type = message.startsWith('✅') ? 'success' : 
                        message.startsWith('❌') ? 'error' : 'info';
            const cleanMessage = message.replace(/^[✅❌ℹ️]+\s*/, '');
            window.app.showNotification(cleanMessage, type);
        } else {
            // Fallback - console.log с красивым форматированием
            const bgColor = message.startsWith('✅') ? 'background: #4CAF50; color: white;' :
                           message.startsWith('❌') ? 'background: #f44336; color: white;' :
                           'background: #2196F3; color: white;';
            console.log(`%c🔔 CatalogV2: ${message}`, bgColor + ' padding: 4px 8px; border-radius: 4px;');
        }
    }
    
    open() {
        if (!this.overlay) return;
        
        this.overlay.classList.remove('hidden');
        this.isOpen = true;
        
        console.log('📁 CatalogV2: Overlay открыт');
    }
    
    close() {
        if (!this.overlay) return;
        
        this.overlay.classList.add('hidden');
        this.isOpen = false;
        
        console.log('🔄 CatalogV2: Overlay закрыт');
    }
}

console.log('✅ ЗАГРУЗКА: catalog-v2.js загружен, класс CatalogV2 определен');
window.CatalogV2 = CatalogV2; 