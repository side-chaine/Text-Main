/**
 * Main App for beLive application
 * Connects all components and handles main functionality
 * 
 * Required components:
 * - DragBoundaryController (js/drag-boundary-controller.js)
 * - BlockLoopControl (js/block-loop-control.js)
 * - AudioEngine, LyricsDisplay, TrackCatalog, etc.
 */

class App {
    constructor() {
        console.log('Initializing beLive App');
        
        // --- ЭТАП 1: ИНЪЕКЦИЯ ЗАВИСИМОСТЕЙ ---
        // Инициализируем StateManager и ViewManager в правильном порядке
        
        if (window.StateManager) {
            this.stateManager = new window.StateManager();
            console.log('StateManager component ready');
        } else {
            console.error('FATAL: StateManager class not found');
            return; // Прерываем выполнение, если критический компонент отсутствует
        }

        if (window.ViewManager) {
            this.viewManager = new window.ViewManager();
            this.viewManager.init(this.stateManager, this); // Инъекция зависимостей
            console.log('ViewManager component ready');
            
            // Инициализируем обработчики событий для переключения экранов
            this.viewManager.initEventHandlers();
            console.log('🎯 ViewManager event handlers initialized');
        } else {
            console.error('FATAL: ViewManager class not found');
            return; // Прерываем выполнение
        }
        // --- КОНЕЦ ЭТАПА 1 ---
        
        this.initComplete = false;
        this.lyricsEnabled = true;
        this.isSyncing = false; // Добавляем флаг синхронизации
        this.currentMode = 'concert'; // Устанавливаем режим по умолчанию при инициализации
        this.previousMode = null;
        
        // BPM контроль для режима репетиции
        this.currentBPM = 100; // Добавляем инициализацию BPM
        this.bpmControl = {
            currentRate: 1.0, // 100% - оригинальная скорость
            minRate: 0.5,     // 50% - минимальная скорость
            maxRate: 2.0,     // 200% - максимальная скорость
            step: 0.05        // 5% - шаг изменения
        };
        
        // Ensure all required components exist
        if (!window.audioEngine || !window.lyricsDisplay || !window.trackCatalog) {
            console.error('Required components not loaded');
            return;
        }
        
        // Save component references
        this.audioEngine = window.audioEngine;
        this.lyricsDisplay = window.lyricsDisplay;
        this.trackCatalog = window.trackCatalog;
        
        // Initialize MarkerManager if available
        if (window.markerManager) {
            this.markerManager = window.markerManager;
        } else {
            console.warn('MarkerManager not found, creating placeholder');
            this.markerManager = { setMarkers: () => console.warn('MarkerManager not available') };
        }
        
        // Initialize WordAligner
        if (window.WordAlignerV2) {
            this.wordAligner = new window.WordAlignerV2();
            // Делаем доступным глобально для совместимости
            window.wordAligner = this.wordAligner;
            // Subscribe to progress events from WordAligner
            this.wordAligner.addEventListener('model-loading-progress', (event) => {
                this._handleWordAlignmentProgress(event.detail);
            });
        } else {
            console.warn('WordAlignerV2 not found, creating placeholder');
            this.wordAligner = { alignWords: () => Promise.reject(new Error('WordAlignerV2 not available')) };
            window.wordAligner = this.wordAligner;
        }
        
        // Initialize WaveformEditor reference
        if (window.waveformEditor) {
            this.waveformEditor = window.waveformEditor;
        } else {
            console.warn('WaveformEditor not found, creating placeholder');
            this.waveformEditor = { show: () => console.warn('WaveformEditor not available'), setMarkers: () => {} };
        }
        
        // Create UI helper object for notifications
        this.ui = {
            showNotification: (message, type = 'info') => {
                console.log(`App: Уведомление (${type}): ${message}`);
                if (window.liveMode && typeof window.liveMode.showNotification === 'function') {
                    window.liveMode.showNotification(message, type);
                } else if (typeof showNotification === 'function') {
                    showNotification(message, type);
                } else {
                    console.warn('No notification system available');
                }
            }
        };
        
        // Initialize UI
        this._initUI();
        
        // Initialize event listeners
        this._setupEventListeners();
        
        // Setup audio update interval
        this._setupAudioUpdateInterval();
        
        // Initialize reload button
        this._initReloadButton();
        
        // Initialize marker editor button
        this._initMarkerEditorButton();
        
        // Initialize style manager
        this._initStyleManager();
        this.textStyleManager = window.textStyleManager;
        
        // Initialize LiveMode when the page is ready
        window.addEventListener('DOMContentLoaded', () => {
            this._initLiveMode();
        });
        
        // Initialize microphone controls
        this._initMicrophoneControls();

        // LoopBlockManager (legacy) отключен. Кнопка Loop используется для новой логики (позже).
        // Initialize BlockLoopControl
        if (window.BlockLoopControl && window.markerManager) {
            this.blockLoopControl = new BlockLoopControl(this.audioEngine, this.lyricsDisplay, window.markerManager);
            console.log('BlockLoopControl component ready');
        } else {
            console.warn('BlockLoopControl class or MarkerManager not found');
        }

        // Initialize MaskSystem
        if (window.MaskSystem) {
            this.maskSystem = new MaskSystem();
            // Отключаем логирование для уменьшения спама в консоли
            this.maskSystem.setConsoleLogging(false);
            window.maskSystem = this.maskSystem;
            console.log('🎭 MaskSystem component ready');
        } else {
            console.warn('MaskSystem class not found');
        }

        // Initialize LoopBlock controls
        this._initLoopBlockControls();
        
        // Initialize mask controls
        this._initMaskControls();
        
        // Initialize Live Feed functionality
        this._initLiveFeedConcept();
        
        // Show Live Feed as starting page
        this._showLiveFeedConcept();
        
        this.initComplete = true;
        console.log('beLive App initialized');
        
        // Экспортируем экземпляр app глобально
        window.app = this;
        
        // Show welcome message if no tracks
        this._showWelcomeIfNoTracks();

        // Инициализация менеджера фона для караоке
        const karaokeImages = [
            'Karaoke/yichen-wang-aBeTfQ65ycQ-unsplash.jpg',
            'Karaoke/boliviainteligente-NFY0BeronrE-unsplash.jpg',
            'Karaoke/prince-abid-LeZItQhwFks-unsplash.jpg',
            'Karaoke/bruno-cervera-Gi6-m_t_W-E-unsplash.jpg',
            'Karaoke/kane-reinholdtsen-LETdkk7wHQk-unsplash.jpg',
            'Karaoke/pexels-amit-batra-3062797-4658541.jpg',
            'Karaoke/pexels-clemlep-13659549.jpg',
            'Karaoke/pexels-capturexpression-26530062.jpg',
            'Karaoke/pexels-pixabay-164960.jpg',
            'Karaoke/pexels-katriengrevendonck-2101487.jpg',
            'Karaoke/pexels-suvan-chowdhury-37305-144429.jpg',
            'Karaoke/pexels-pixabay-164879.jpg'
        ];
        this.karaokeBackgroundManager = new KaraokeBackgroundManager(karaokeImages);

        // Инициализация менеджера фона для репетиции (статичный фон, без слайдшоу)
        const rehearsalImages = [
            'Rehearsal/dj_naushniki_ustanovka_122020_2560x1440.jpg',
            'Rehearsal/didzhej_muzyka_diskoteka_160929_2560x1440.jpg',
            'Rehearsal/gitara_bas_gitara_struny_106722_2560x1440.jpg',
            'Rehearsal/muzykalnyj_instrument_muzyka_udarnye_106370_2560x1440.jpg',
            'Rehearsal/noty_griaznyj_bumaga_124163_2560x1440.jpg',
            'Rehearsal/krolik_naushniki_muzyka_130283_2560x1440.jpg',
            'Rehearsal/soty_obem_zheleznyj_167098_2560x1440.jpg',
            'Rehearsal/dvoichnyj_kod_kod_tsifry_147523_2560x1440.jpg',
            'Rehearsal/fotoapparat_obektiv_remeshok_145518_1600x900.jpg',
            'Rehearsal/naushniki_knigi_obrazovanie_121501_2560x1600.jpg',
            'Rehearsal/naushniki_ustanovka_muzyka_104587_1280x1024.jpg'
        ];
        this.rehearsalBackgroundManager = new RehearsalBackgroundManager(rehearsalImages, 0);
    }
    
    initCatalogV2() {
        if (window.CatalogV2) {
            window.catalogV2 = new CatalogV2();
        } else {
            console.error("CatalogV2 class not found. Make sure catalog-v2.js is loaded before app.js");
        }
    }
    
    _initUI() {
        // Set play/pause button state
        this.playPauseBtn = document.getElementById('play-pause');
        
        // Set volume sliders
        this.instrumentalVolumeSlider = document.getElementById('instrumental-volume');
        this.vocalsVolumeSlider = document.getElementById('vocals-volume');
        
        // Get time display and progress bar elements
        this.timeDisplay = document.getElementById('time-display');
        this.progressBarContainer = document.getElementById('progress-bar-container');
        this.progressBar = document.getElementById('progress-bar');
        this.progressTooltip = document.getElementById('progress-tooltip');
        
        // Initialize volume values
        if (this.instrumentalVolumeSlider) {
            this.instrumentalVolumeSlider.value = 100;
        }
        
        if (this.vocalsVolumeSlider) {
            this.vocalsVolumeSlider.value = 100;
        }
        
        // Initialize progress bar
        this._initProgressBar();

        // Scale controls
        this.scaleDownBtn = document.getElementById('scale-down');
        this.scaleUpBtn = document.getElementById('scale-up');
        this.scaleValueBtn = document.getElementById('scale-value'); // Renamed from scaleValue
        
        // BPM controls (режим репетиции) - ИСПРАВЛЕНО: bpm вместо bmp
        this.bpmDownBtn = document.getElementById('bpm-down');
        this.bpmUpBtn = document.getElementById('bpm-up');
        this.bpmValueBtn = document.getElementById('bpm-value');
        this.bpmControls = document.getElementById('bpm-controls');
        
        // Инициализация BPM системы
        this.currentBPM = 100; // 100% - оригинальная скорость
        this._updateBPMDisplay();
    }
    
    _setupEventListeners() {
        document.addEventListener('model-loading-progress', (e) => {
            const progress = e.detail;
            const button = document.getElementById('sync-words-btn');
            if (!button) {
                console.error('APP: sync-words-btn not found!');
                return;
            }

            if ((progress.status === 'download' || progress.status === 'progress') && typeof progress.progress === 'number') {
                const percentage = progress.progress.toFixed(2);
                button.textContent = `Загрузка... ${percentage}%`;
            } else if (progress.status === 'ready' || progress.status === 'done') {
                button.textContent = '✨ Sync Words';
            }
        });

        const syncWordsBtn = document.getElementById('sync-words-btn');
        if (syncWordsBtn) {
            syncWordsBtn.addEventListener('click', () => this._handleWordAlignment());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => this._handleKeyboardShortcut(event));
        
        // Play button
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', this._togglePlayPause.bind(this));
        }
        
        // Mode buttons
        document.querySelectorAll('.mode-button').forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                this._handleModeChange(mode);
            });
        });
        
        // Volume sliders
        if (this.instrumentalVolumeSlider) {
            this.instrumentalVolumeSlider.addEventListener('input', () => {
                this.audioEngine.setInstrumentalVolume(this.instrumentalVolumeSlider.value / 100);
            });
        }
        
        if (this.vocalsVolumeSlider) {
            this.vocalsVolumeSlider.addEventListener('input', () => {
                this.audioEngine.setVocalsVolume(this.vocalsVolumeSlider.value / 100);
            });
        }
        
        // Scale controls listeners
        if (this.scaleDownBtn) {
            this.scaleDownBtn.addEventListener('click', () => {
                if (this._isScalingAllowed()) {
                    window.textStyleManager.decreaseScale();
                    this._updateScaleDisplay();
                }
            });
        }

        if (this.scaleUpBtn) {
            this.scaleUpBtn.addEventListener('click', () => {
                if (this._isScalingAllowed()) {
                    window.textStyleManager.increaseScale();
                    this._updateScaleDisplay();
                }
            });
        }
        
        if (this.scaleValueBtn) {
            this.scaleValueBtn.addEventListener('click', () => {
                if (this._isScalingAllowed()) {
                    window.textStyleManager.resetScale();
                    this._updateScaleDisplay();
                }
            });
        }
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', this._handleKeyboardShortcut.bind(this));
        
        // Add listener for when a track is fully loaded
        document.addEventListener('track-loaded', this._handleTrackLoaded.bind(this));
        
        // Word Alignment Button  
        const alignBtn = document.getElementById('word-align-btn');
        if (alignBtn) {
            alignBtn.addEventListener('click', () => this._handleWordAlignment());
        }

        // 🔧 ИСПРАВЛЕНО: Убрал дублированный код, используем централизованный метод
        this._initTransportToggle();

        // 🔧 НОВЫЙ: Реинициализация transport controls после каждой загрузки трека
        document.addEventListener('track-loaded', () => {
            console.log('🔄 Track loaded, reinitializing transport controls');
            this._initTransportToggle();
        });

        // BPM controls listeners (только в режиме репетиции)
        if (this.bpmDownBtn) {
            this.bpmDownBtn.addEventListener('click', () => {
                this._decreaseBPM();
            });
        }

        if (this.bpmUpBtn) {
            this.bpmUpBtn.addEventListener('click', () => {
                this._increaseBPM();
            });
        }
        
        if (this.bpmValueBtn) {
            this.bpmValueBtn.addEventListener('click', () => {
                this._resetBPM();
            });
        }
    }
    
    _handleKeyboardShortcut(event) {
        // Skip if typing in an input
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Skip if modifiers are pressed (to avoid interfering with browser shortcuts)
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        
        switch (event.code) {
            case 'Space':
                // Let the audio engine handle this
                // We don't want both handlers to react to the space bar
                break;
                
            case 'ArrowLeft':
                // Previous track
                this.trackCatalog.playPreviousTrack();
                break;
                
            case 'ArrowRight':
                // Next track
                this.trackCatalog.playNextTrack();
                break;
                
            default:
                // No action for other keys
                break;
        }
        this._updateScaleControlsState();
    }
    
    _togglePlayPause() {
        if (!this.audioEngine) return;
        
        if (this.audioEngine.isPlaying) {
            this.audioEngine.pause();
        } else {
            this.audioEngine.play();
        }
    }
    
    _initProgressBar() {
        if (!this.progressBarContainer || !this.progressBar || !this.progressTooltip) return;
        
        // Add event listeners for seeking
        this.progressBarContainer.addEventListener('click', (e) => this._handleProgressBarClick(e));
        this.progressBarContainer.addEventListener('mousemove', (e) => this._updateProgressTooltip(e));
        this.progressBarContainer.addEventListener('mouseleave', () => {
            this.progressTooltip.style.opacity = '0';
        });
    }
    
    _handleProgressBarClick(e) {
        if (!this.audioEngine || !this.progressBarContainer) return;
        
        // Calculate click position as a percentage of the bar width
        const rect = this.progressBarContainer.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        
        // Calculate the new time based on the track duration
        const duration = this.audioEngine.duration;
        const newTime = clickPosition * duration;
        
        // Set new position and update UI
        this.audioEngine.setCurrentTime(newTime);
        this._updateProgressBar(newTime, duration);
        
        // Start playback if not already playing
        if (!this.audioEngine.isPlaying) {
            this.audioEngine.play();
        }
    }
    
    _updateProgressTooltip(e) {
        if (!this.audioEngine || !this.progressBarContainer || !this.progressTooltip) return;
        
        // Calculate hover position as a percentage of the bar width
        const rect = this.progressBarContainer.getBoundingClientRect();
        const hoverPosition = (e.clientX - rect.left) / rect.width;
        
        // Calculate the time at the hover position
        const duration = this.audioEngine.duration;
        const hoverTime = hoverPosition * duration;
        
        // Update tooltip text with the time
        this.progressTooltip.textContent = this._formatTime(hoverTime);
        
        // Position the tooltip at the hover position
        this.progressTooltip.style.left = `${hoverPosition * 100}%`;
        this.progressTooltip.style.opacity = '1';
    }
    
    _updateProgressBar(currentTime, duration) {
        if (!this.progressBar || !this.timeDisplay) return;
        
        // Update progress bar width
        const progressPercentage = (currentTime / duration) * 100;
        this.progressBar.style.width = `${progressPercentage}%`;
        
        // Update time display
        this.timeDisplay.textContent = `${this._formatTime(currentTime)} / ${this._formatTime(duration)}`;
    }
    
    _formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }
    
    _setupAudioUpdateInterval() {
        // Update lyrics position and transport controls every 50ms
        setInterval(() => {
            if (!this.audioEngine || !this.lyricsDisplay) return;
            
            // Get current playback time and duration
            const currentTime = this.audioEngine.getCurrentTime();
            const duration = this.audioEngine.duration;
            
            // Update lyrics position
            if (this.lyricsEnabled) {
                this.lyricsDisplay.updateLyricPosition(currentTime);
            }
            
            // Update play/pause button text
            if (this.playPauseBtn) {
                this.playPauseBtn.textContent = this.audioEngine.isPlaying ? 'Pause' : 'Play';
            }
            
            // Update progress bar and time display
            this._updateProgressBar(currentTime, duration);
        }, 50);
    }
    
    _showWelcomeIfNoTracks() {
        // Show welcome message if no tracks in catalog
        const lyricsContainer = document.getElementById('lyrics-display');
        
        if (lyricsContainer && (!this.trackCatalog.tracks || this.trackCatalog.tracks.length === 0)) {
            lyricsContainer.innerHTML = `
                <div class="welcome-message">
                    <h1>Welcome to beLIVE</h1>
                    <p>Your lyrics assistant for live performances</p>
                    <p>Click the Catalog button to start adding tracks</p>
                </div>
            `;
        }
    }
    
    _initReloadButton() {
        const reloadButton = document.getElementById('reload-app');
        if (reloadButton) {
            reloadButton.addEventListener('click', () => {
                // Reload the page
                window.location.reload();
            });
        }
    }
    
    /**
     * Initialize marker editor button
     */
    _initMarkerEditorButton() {
        const markerEditorBtn = document.getElementById('marker-editor-btn');
        const syncBtn = document.getElementById('sync-btn');

        if (markerEditorBtn) {
            markerEditorBtn.addEventListener('click', () => this._toggleMarkerEditor());
        }

        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                // Получаем текущий трек через currentTrackIndex
                const currentTrack = this.trackCatalog.currentTrackIndex >= 0 && 
                                   this.trackCatalog.currentTrackIndex < this.trackCatalog.tracks.length 
                                   ? this.trackCatalog.tracks[this.trackCatalog.currentTrackIndex] 
                                   : null;
                
                // 🔄 ПОКАЗЫВАЕМ СТИЛЬНЫЙ ИНДИКАТОР ЗАГРУЗКИ
                const originalText = syncBtn.textContent;
                const originalWidth = syncBtn.offsetWidth; // Сохраняем ширину
                syncBtn.disabled = true;
                syncBtn.textContent = 'Загрузка...';
                syncBtn.style.width = `${originalWidth}px`; // Фиксируем ширину
                syncBtn.style.cursor = 'wait';
                syncBtn.style.opacity = '0.7';
                syncBtn.style.background = 'linear-gradient(135deg, #1a1a1a, #333)';
                syncBtn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
                
                try {
                    if (currentTrack && currentTrack.vocalsData) {
                        console.log(`APP: Создаем вокальный URL для синхронизации трека: ${currentTrack.title}`);
                        
                        // Создаем blob URL для вокальных данных
                        const vocalsBlob = new Blob([currentTrack.vocalsData], { type: currentTrack.vocalsType });
                        const vocalsUrl = URL.createObjectURL(vocalsBlob);
                        
                        // Загружаем высококачественные аудиоданные для редактора
                        await this.waveformEditor.loadAudioForSync(vocalsUrl);
                        console.log("APP: Аудио для WaveformEditor загружено, открываем редактор.");
                        
                        // Очищаем временный URL после использования
                        setTimeout(() => URL.revokeObjectURL(vocalsUrl), 1000);
                        
                    } else {
                        console.warn("APP: Нет вокальных данных, открываем редактор с mock данными.");
                    }
                    
                    // Открываем редактор
                    this.waveformEditor.show();
                    
                } catch (error) {
                    console.error("APP: Ошибка при загрузке аудио для синхронизации:", error);
                    // Показываем редактор с mock данными при ошибке
                    this.waveformEditor.show();
                } finally {
                    // 🎯 ВОССТАНАВЛИВАЕМ КНОПКУ
                    setTimeout(() => {
                        syncBtn.disabled = false;
                        syncBtn.textContent = originalText;
                        syncBtn.style.width = '';
                        syncBtn.style.cursor = '';
                        syncBtn.style.opacity = '';
                        syncBtn.style.background = '';
                        syncBtn.style.boxShadow = '';
                    }, 500); // Небольшая задержка для плавности
                }
            });
        }
    }
    
    /**
     * Toggle marker editor visibility
     */
    _toggleMarkerEditor() {
        if (window.waveformEditor) {
            window.waveformEditor.toggle();
        }
    }
    
    /**
     * Initialize the text style manager
     */
    _initStyleManager() {
        if (!window.textStyleManager) {
            // Create and initialize text style manager
            window.textStyleManager = new TextStyleManager(this.lyricsDisplay);
            console.log('Text style manager initialized');
        }
        
        // Initialize style selector button
        const styleSelectorBtn = document.getElementById('style-selector-btn');
        if (styleSelectorBtn) {
            styleSelectorBtn.addEventListener('click', () => {
                // The new showStyleSelector handles its own creation and removal
                window.textStyleManager.showStyleSelector();
            });
        }
    }
    
    /**
     * Toggle style selector visibility
     */
    _toggleStyleSelector() {
        // This function is now simplified, as the manager handles the modal lifecycle.
        // The call is made directly from the event listener.
        // Kept for potential future use or debugging, but currently obsolete.
            window.textStyleManager.showStyleSelector();
    }

    /**
     * Initialize microphone controls UI
     * @private
     */
    _initMicrophoneControls() {
        console.log('Initializing Microphone UI...');
        this.micToggleButton = document.getElementById('mic-toggle-btn');
        this.micVolumeSlider = document.getElementById('mic-volume');

        if (!this.micToggleButton || !this.micVolumeSlider) {
            console.error('Microphone UI elements (mic-toggle-btn or mic-volume) not found in the DOM.');
            return;
        }

        this.micToggleButton.addEventListener('click', () => {
            const newState = this.audioEngine.toggleMicrophone();
            this._updateMicToggleButtonState(newState.enabled);
            if(newState.enabled && newState.volume !== undefined) {
                this.micVolumeSlider.value = newState.volume * 100;
            }
        });

        this.micVolumeSlider.addEventListener('input', () => {
            this.audioEngine.setMicrophoneVolume(this.micVolumeSlider.value / 100);
        });
        
        const initialMicState = this.audioEngine.getMicrophoneState ? this.audioEngine.getMicrophoneState() : { enabled: false, volume: 0.7 };
        this._updateMicToggleButtonState(initialMicState.enabled);
        this.micVolumeSlider.value = initialMicState.volume * 100;

        console.log('Microphone UI initialized using existing DOM elements.');
    }

    /**
     * Update microphone toggle button visual state
     * @param {boolean} isEnabled - Current state of the microphone
     * @private
     */
    _updateMicToggleButtonState(isEnabled) {
        if (this.micToggleButton) {
            this.micToggleButton.classList.toggle('active', isEnabled);
            const micControl = this.micToggleButton.closest('.mic-control');

            if (isEnabled) {
                this.micToggleButton.title = 'Microphone ON - Click to disable';
                if (micControl) micControl.style.opacity = '1';
            } else {
                this.micToggleButton.title = 'Microphone OFF - Click to enable';
                if (micControl) micControl.style.opacity = '0.6';
            }
        }
    }

    /**
     * Initialize LoopBlock controls UI
     * @private
     */
    _initLoopBlockControls() {
        console.log('Initializing LoopBlock controls');
        
        // Создаем кнопку управления LoopBlock
        this.loopBlockBtn = document.getElementById('toggle-loopblock-mode');
        
        if (!this.loopBlockBtn) {
            console.error('LoopBlock button not found in the DOM');
            return;
        }
        
        // Наследие отключено. Временно просто транслируем событие для новой логики.
        this.loopBlockBtn.addEventListener('click', () => {
            try {
                document.dispatchEvent(new CustomEvent('bottom-loop-click'));
            } catch (_) {}
        });
    }
    
    /**
     * Инициализирует LoopBlockManager с текущими компонентами
     * @private
     */
    _initializeLoopBlockManager() { /* legacy disabled */ }

    /**
     * Initialize mask controls
     */
    _initMaskControls() {
        // Подключаем обработчик к существующей кнопке в транспортной панели
        const maskBtn = document.getElementById('mask-mode-btn');
        if (maskBtn && this.maskSystem) {
            maskBtn.addEventListener('click', () => {
                this._toggleMaskSystem();
            });
            console.log('🎭 MaskSystem: Обработчик кнопки подключен');
        } else if (!maskBtn) {
            console.warn('🎭 MaskSystem: Кнопка mask-mode-btn не найдена в HTML');
        } else if (!this.maskSystem) {
            console.warn('🎭 MaskSystem: Система масок не инициализирована');
        }
    }
    
    /**
     * Toggle mask system visibility
     */
    _toggleMaskSystem() {
        if (this.maskSystem) {
            // Проверяем, скрыт ли контейнер масок
            const maskControls = this.maskSystem.maskControlsContainer;
            if (maskControls) {
                const isHidden = maskControls.classList.contains('hidden');
                if (isHidden) {
                    console.log('🎭 MaskSystem: Показываю интерфейс');
                    this.maskSystem.showMaskControls();
                    document.getElementById('mask-mode-btn').classList.add('active');
                } else {
                    console.log('🎭 MaskSystem: Скрываю интерфейс');
                    this.maskSystem.hideMaskControls();
                    document.getElementById('mask-mode-btn').classList.remove('active');
                }
            } else {
                console.warn('🎭 MaskSystem: Контейнер масок не найден');
            }
        } else {
            console.warn('🎭 MaskSystem: Система не инициализирована');
        }
    }

    /**
     * Сохраняем текущий режим перед переключением на другой
     * @param {string} newMode - Новый режим, на который переключаемся
     * @private
     */
    _saveCurrentMode(newMode) {
        // Сохраняем текущий режим в свойстве previousMode
        if (this.currentMode && this.currentMode !== newMode) {
            this.previousMode = this.currentMode;
            console.log(`App: Сохраняем предыдущий режим: ${this.previousMode}`);
        }
        
        // Устанавливаем новый текущий режим
        this.currentMode = newMode;
    }
    
    /**
     * Скрытие экрана приветствия
     * @private
     */
    _hideWelcomeScreen() {
        const welcomeScreen = document.querySelector('.welcome-message');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
    }
    
    /**
     * Активация концертного режима
     * @private
     */
    _activateConcertMode() {
        console.log('Activating concert mode');
        
        // Деактивируем Live режим если он активен
        if (window.liveMode && window.liveMode.isActive) {
            window.liveMode.deactivate();
        }
        
        this.karaokeBackgroundManager.stop();
        this.textStyleManager.setStyle('concert');
        this._setLyricsContainerStyle('style-concert');
        this.blockLoopControl.deactivate();
        this._hideLiveFeedConcept();
        
        // Скрываем BPM контроли в концертном режиме
        if (this.bpmControls) {
            this.bpmControls.style.display = 'none';
        }
        
        // CSS классы для режимов
        document.body.classList.add('mode-concert');
        document.body.classList.remove('mode-rehearsal', 'mode-karaoke', 'mode-live');
    }
    
    /**
     * Активация режима караоке
     * @private
     */
    _activateKaraokeMode() {
        console.log('Activating karaoke mode');
        
        if (window.liveMode && window.liveMode.isActive) {
            window.liveMode.deactivate();
        }
        
        this.textStyleManager.setStyle('karaoke');
        this._setLyricsContainerStyle('style-karaoke');
        this.blockLoopControl.deactivate();
        if (this.rehearsalBackgroundManager) this.rehearsalBackgroundManager.stop();
        this._hideLiveFeedConcept();
        
        if (this.bpmControls) {
            this.bpmControls.style.display = 'none';
        }
        
        // Сначала классы режима, потом запуск фона
        document.body.classList.add('mode-karaoke');
        document.body.classList.remove('mode-concert', 'mode-rehearsal', 'mode-live');
        this.karaokeBackgroundManager.start();
    }
    
    /**
     * Активация режима репетиции
     * @private
     */
    _activateRehearsalMode() {
        console.log('Activating rehearsal mode');
        
        if (window.liveMode && window.liveMode.isActive) {
            window.liveMode.deactivate();
        }
        
        this.karaokeBackgroundManager.stop();
        try { document.body.classList.remove('karaoke-active'); } catch(_) {}
        this.textStyleManager.setStyle('rehearsal');
        this._setLyricsContainerStyle(null);
        this.blockLoopControl.activate();
        this._hideLiveFeedConcept();
        
        if (this.bpmControls) {
            this.bpmControls.style.display = 'flex';
        }
        this._updateBPMDisplay();
        
        // Сначала классы режима, потом запуск фона
        document.body.classList.add('mode-rehearsal');
        document.body.classList.remove('mode-concert', 'mode-karaoke', 'mode-live');
        if (this.rehearsalBackgroundManager) {
            this.rehearsalBackgroundManager.start();
            // Привяжем смену фона к смене блоков (только если не луп и не seek)
            this.rehearsalBackgroundManager.bindToBlockChanges(this.lyricsDisplay, this.blockLoopControl, this.audioEngine);
        }
    }
    
    /**
     * Активация Live режима
     * @private
     */
    _activateLiveMode() {
        console.log('Activating live mode');
        this.karaokeBackgroundManager.stop();
        if (this.rehearsalBackgroundManager) this.rehearsalBackgroundManager.stop();
        this.textStyleManager.setStyle('live');
        this._setLyricsContainerStyle('style-live');
        this.blockLoopControl.deactivate();
        this._hideLiveFeedConcept();
        
        // Скрываем BPM контроли в LIVE режиме
        if (this.bpmControls) {
            this.bpmControls.style.display = 'none';
        }
        
        // Инициализация LiveMode если доступен
        if (typeof LiveMode !== 'undefined') {
            this._initLiveMode();
            // ВАЖНО: Активируем Live режим с камерой
        if (window.liveMode) {
                window.liveMode.activate()
                    .then(activated => {
                        if (activated) {
                            console.log('Live режим успешно активирован с камерой');
        } else {
                            console.warn('Не удалось активировать Live режим');
                        }
                    })
                    .catch(error => {
                        console.error('Ошибка активации Live режима:', error);
                    });
            }
        } else {
            console.warn('LiveMode class not available');
        }
        
        // CSS классы для режимов
        document.body.classList.add('mode-live');
        document.body.classList.remove('mode-concert', 'mode-karaoke', 'mode-rehearsal');
    }
    
    /**
     * Переключение на предыдущий режим
     */
    switchToLastMode() {
        console.log(`App: Переключение на предыдущий режим: ${this.previousMode}`);
        this._handleModeChange(this.previousMode || 'live-feed');
    }

    /**
     * Инициализирует LiveMode
     * @private
     */
    _initLiveMode() {
        console.log('Initializing LiveMode without camera activation...');
        
        // Проверяем, доступен ли класс LiveMode
        if (typeof LiveMode === 'undefined') {
            console.warn('LiveMode class not available, skipping initialization');
            return;
        }
        
        try {
            // Создаем глобальный экземпляр LiveMode, но не активируем его
            if (!window.liveMode) {
                window.liveMode = new LiveMode();
                console.log('LiveMode instance created, but not activated');
            }
            
            // Не запрашиваем доступ к камере заранее - только при активации режима
        } catch (error) {
            console.error('Error initializing LiveMode:', error);
        }
    }

    /**
     * Устанавливает активную кнопку режима
     * @param {string} activeButtonIdOrMode - ID активной кнопки или режим
     */
    _setActiveButton(activeButtonIdOrMode) {
        document.querySelectorAll('.mode-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const button = document.querySelector(`.mode-button[data-mode="${activeButtonIdOrMode}"]`);
        if (button) {
            button.classList.add('active');
        } else {
            // Fallback for ID if data-mode not found
            const buttonById = document.getElementById(activeButtonIdOrMode);
            if (buttonById) {
                buttonById.classList.add('active');
            }
        }
    }

    /**
     * Показывает уведомление пользователю
     * @param {string} message - Текст уведомления
     * @param {string} type - Тип уведомления (error, info, success)
     */
    _showNotification(message, type = 'info') {
        console.log(`App: Уведомление (${type}): ${message}`);
        
        // Через LyricsDisplay, если доступен
        if (this.lyricsDisplay && this.lyricsDisplay.statusDisplay) {
            this.lyricsDisplay.statusDisplay.updateStatus(message, type);
            return;
        }
        
        // Через LiveMode, если доступен
        if (window.liveMode && typeof window.liveMode._showErrorMessage === 'function') {
            window.liveMode._showErrorMessage(message, type);
            return;
        }
        
        // Если не найдено подходящего компонента, выводим простое уведомление
        const notificationDiv = document.createElement('div');
        notificationDiv.textContent = message;
        notificationDiv.style.position = 'fixed';
        notificationDiv.style.bottom = '20px';
        notificationDiv.style.left = '50%';
        notificationDiv.style.transform = 'translateX(-50%)';
        notificationDiv.style.padding = '10px 20px';
        notificationDiv.style.borderRadius = '5px';
        notificationDiv.style.color = '#fff';
        notificationDiv.style.zIndex = '9999';
        
        // Устанавливаем цвет в зависимости от типа
        switch (type) {
            case 'error':
                notificationDiv.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
                break;
            case 'success':
                notificationDiv.style.backgroundColor = 'rgba(40, 167, 69, 0.9)';
                break;
            default:
                notificationDiv.style.backgroundColor = 'rgba(0, 123, 255, 0.9)';
        }
        
        document.body.appendChild(notificationDiv);
        
        // Удаляем уведомление через 5 секунд
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.parentNode.removeChild(notificationDiv);
            }
        }, 5000);
    }
    
    /**
     * 🔧 НОВЫЙ: Показывает ошибку загрузки вокальной дорожки
     * @param {string} message - Сообщение об ошибке
     */
    showVocalError(message) {
        console.warn('🎤 Vocal Error:', message);
        this._showNotification(message, 'error');
        
        // Обновляем UI индикатор вокала (если есть)
        const vocalIndicator = document.querySelector('.vocal-indicator');
        if (vocalIndicator) {
            vocalIndicator.classList.add('vocal-unavailable');
            vocalIndicator.title = 'Вокальная дорожка недоступна';
        }
        
        // Деактивируем вокальный слайдер
        if (this.vocalsVolumeSlider) {
            this.vocalsVolumeSlider.disabled = true;
            this.vocalsVolumeSlider.style.opacity = '0.5';
            this.vocalsVolumeSlider.title = 'Вокальная дорожка недоступна';
        }
    }
    
    /**
     * 🔧 НОВЫЙ: Активирует вокальные контролы при успешной загрузке вокала
     */
    enableVocalControls() {
        console.log('🎤 Activating vocal controls');
        
        // Активируем вокальный слайдер
        if (this.vocalsVolumeSlider) {
            this.vocalsVolumeSlider.disabled = false;
            this.vocalsVolumeSlider.style.opacity = '1';
            this.vocalsVolumeSlider.title = 'Громкость вокальной дорожки';
        }
        
        // Обновляем UI индикатор вокала (если есть)
        const vocalIndicator = document.querySelector('.vocal-indicator');
        if (vocalIndicator) {
            vocalIndicator.classList.remove('vocal-unavailable');
            vocalIndicator.classList.add('vocal-available');
            vocalIndicator.title = 'Вокальная дорожка активна';
        }
        
        // Показываем успешное уведомление
        this._showNotification('Вокальная дорожка загружена успешно', 'success');
    }

    /**
     * Initialize Live Feed Concept functionality
     * @private
     */
    _initLiveFeedConcept() {
        console.log('🚀 Инициализация Живой Ленты');
        
        // Получаем элементы
        const liveFeedConcept = document.getElementById('live-feed-concept');
        const backToHallBtn = document.getElementById('back-to-hall');
        const homeBtn = document.getElementById('home-btn');
        
        if (!liveFeedConcept) {
            console.warn('🚀 Элементы Живой Ленты не найдены');
            return;
        }
        
        // Обработчик кнопки домой (возврат в Живую Ленту)
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this._showLiveFeedConcept();
            });
        }
        
        // Обработчик возврата в классический зал (больше не нужен, удаляем кнопку)
        if (backToHallBtn) {
            backToHallBtn.style.display = 'none';
        }
        
        // Инициализация фильтров потоков
        this._initStreamFilters();
        
        // Инициализация интерактивности
        this._initLiveFeedInteractions();
        
        console.log('✅ Живая Лента инициализирована');
    }
    
    /**
     * Show Live Feed Concept
     * @private
     */
    _showLiveFeedConcept() {
        console.log('🚀 Показываю Живую Ленту');
        
        // Деактивируем Live режим если он активен
        if (window.liveMode && window.liveMode.isActive) {
            window.liveMode.deactivate();
        }
        
        // Очищаем интерфейс репетиции при переходе на стартовую страницу
        if (this.blockLoopControl) {
            this.blockLoopControl.deactivate();
        }
        
        const liveFeedConcept = document.getElementById('live-feed-concept');
        const body = document.body;
        
        if (liveFeedConcept) {
            liveFeedConcept.classList.remove('hidden');
            body.classList.add('live-feed-active');
            
            // Запускаем демо обновления
            this._startLiveFeedDemo();
            
            console.log('✅ Живая Лента активирована');
        }
        this._setActiveButton(null); // No mode button active for live feed
    }
    
    /**
     * Hide Live Feed Concept
     * @private
     */
    _hideLiveFeedConcept() {
        console.log('🚀 Скрываю Живую Ленту');
        
        const liveFeedConcept = document.getElementById('live-feed-concept');
        const body = document.body;
        
        if (liveFeedConcept) {
            liveFeedConcept.classList.add('hidden');
            body.classList.remove('live-feed-active');
            
            // Останавливаем демо обновления
            this._stopLiveFeedDemo();
            
            console.log('✅ Возврат в классический зал');
    }
}

/**
     * Initialize stream filters
     * @private
     */
    _initStreamFilters() {
        const filterTabs = document.querySelectorAll('.filter-tabs .tab');
        
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Убираем активный класс у всех табов
                filterTabs.forEach(t => t.classList.remove('active'));
                
                // Добавляем активный класс к нажатому табу
                tab.classList.add('active');
                
                // Фильтруем потоки
                const filter = tab.dataset.filter;
                this._filterStreams(filter);
            });
        });
    }
    
    /**
     * Filter streams by type
     * @param {string} filter - Filter type
     * @private
     */
    _filterStreams(filter) {
        const streamCards = document.querySelectorAll('.stream-card');
        
        streamCards.forEach(card => {
            const cardType = card.dataset.type;
            
            if (filter === 'all' || cardType === filter) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
        
        console.log(`🔍 Фильтр применен: ${filter}`);
    }
    
    /**
     * Initialize Live Feed interactions
     * @private
     */
    _initLiveFeedInteractions() {
        // Quick action buttons
        const quickBtns = document.querySelectorAll('.quick-btn');
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                if (mode) {
                    console.log(`🚀 Быстрый переход в режим: ${mode}`);
                    this._handleModeChange(mode);
        }
            });
        });
        
        // Stream interaction buttons
        const joinBtns = document.querySelectorAll('.join-btn');
        const watchBtns = document.querySelectorAll('.watch-btn');
        
        joinBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this._showDemoMessage('🎵 Присоединение к потоку...', 'info');
            });
        });
        
        watchBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this._showDemoMessage('👁️ Просмотр потока...', 'info');
            });
        });
        
        // Friend join buttons
        const friendJoinBtns = document.querySelectorAll('.friend-join-btn');
        friendJoinBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this._showDemoMessage('👥 Присоединение к другу...', 'info');
            });
        });
    }
    
    /**
     * Start Live Feed demo updates
     * @private
     */
    _startLiveFeedDemo() {
        // Обновление счетчиков зрителей
        this.liveFeedDemoInterval = setInterval(() => {
            const viewerCounts = document.querySelectorAll('.viewer-count');
            viewerCounts.forEach(count => {
                if (count.textContent.includes('K')) {
                    const current = parseFloat(count.textContent.replace('K', ''));
                    const change = (Math.random() - 0.5) * 0.1;
                    const newValue = Math.max(0.1, current + change);
                    count.textContent = newValue.toFixed(1) + 'K';
                } else {
                    const current = parseInt(count.textContent);
                    const change = Math.floor((Math.random() - 0.5) * 20);
                    const newValue = Math.max(1, current + change);
                    count.textContent = newValue.toString();
                }
            });
        }, 3000);
        
        // Обновление прогресса
        this.progressDemoInterval = setInterval(() => {
            const progressText = document.querySelector('.progress-text');
            if (progressText) {
                const current = progressText.textContent.split('/');
                let completed = parseInt(current[0]);
                const total = parseInt(current[1]);
                
                if (Math.random() > 0.7 && completed < total) {
                    completed++;
                    progressText.textContent = `${completed}/${total}`;
                    
                    // Обновляем кольцо прогресса
                    const ring = document.querySelector('.progress-ring');
                    if (ring) {
                        const percentage = (completed / total) * 360;
                        ring.style.background = `conic-gradient(#ff3366 0deg ${percentage}deg, rgba(255, 255, 255, 0.1) ${percentage}deg 360deg)`;
                    }
                }
            }
        }, 5000);
    }
    
    /**
     * Stop Live Feed demo updates
     * @private
     */
    _stopLiveFeedDemo() {
        if (this.liveFeedDemoInterval) {
            clearInterval(this.liveFeedDemoInterval);
            this.liveFeedDemoInterval = null;
        }
        
        if (this.progressDemoInterval) {
            clearInterval(this.progressDemoInterval);
            this.progressDemoInterval = null;
    }
}

/**
     * Show demo message
     * @param {string} message - Message text
     * @param {string} type - Message type
     * @private
     */
    _showDemoMessage(message, type = 'info') {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.className = 'live-feed-notification';
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px 30px;
            border-radius: 10px;
            font-size: 1.1rem;
            z-index: 10000;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        // Добавляем CSS анимацию
        if (!document.getElementById('live-feed-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'live-feed-notification-styles';
            style.textContent = `
                @keyframes fadeInOut {
                    0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    10%, 90% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 2 секунды
    setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 2000);
    }

    /**
     * Обработчик события загрузки трека
     * @param {Object} event - Событие загрузки трека
     * @private
     */
    _handleTrackLoaded(event) {
        this._hideLiveFeedConcept();

        // Принудительно обновляем стиль и элементы управления при загрузке трека
        if (this.textStyleManager) {
            // Устанавливаем стиль для текущего активного режима, чтобы все было синхронизировано
            this.textStyleManager.setStyle(this.currentMode);
        }

        this._updateScaleControlsState(); // Включаем или выключаем кнопки
        this._updateScaleDisplay();      // Обновляем отображаемый процент
    }

    /**
     * Checks if font scaling is allowed in the current mode.
     * @returns {boolean}
     * @private
     */
    _isScalingAllowed() {
        // Scaling is allowed if lyrics are loaded and we are not in a mode that disables it
        return this.lyricsDisplay.hasLyrics();
    }

    /**
     * Updates the UI display for the font scale.
     * @private
     */
    _updateScaleDisplay() {
        if (!this.scaleValueBtn) return;
        
            const scale = window.textStyleManager.getFontScale();
        this.scaleValueBtn.textContent = `${Math.round(scale * 100)}%`;
    }

    /**
     * Enables or disables scale controls based on the current mode.
     * @private
     */
    _updateScaleControlsState() {
        const allowed = this._isScalingAllowed();
        if (this.scaleDownBtn) this.scaleDownBtn.disabled = !allowed;
        if (this.scaleUpBtn) this.scaleUpBtn.disabled = !allowed;
        if (this.scaleValueBtn) this.scaleValueBtn.disabled = !allowed;
    }

    // Добавим метод для управления классом контейнера
    _setLyricsContainerStyle(styleClass) {
        const container = document.getElementById('lyrics-container');
        if (!container) {
            console.error('Lyrics container not found!');
            return;
        };

        // Удаляем все предыдущие классы стилей, чтобы избежать конфликтов
        const styleClasses = ['style-karaoke', 'style-concert', 'style-rehearsal']; // и другие, если есть
        styleClasses.forEach(cls => container.classList.remove(cls));

        if (styleClass) {
            container.classList.add(styleClass);
            console.log(`Applied style class to lyrics-container: ${styleClass}`);
        }
    }

    _handleModeChange(mode) {
        if (this.currentMode === mode) return;

        console.log(`Switching to ${mode} mode`);

        if (window.waveformEditor && window.waveformEditor.isVisible) {
            window.waveformEditor.hide();
        }

        this._saveCurrentMode(mode);
        this._setActiveButton(mode);

        switch (mode) {
            case 'concert':
                this._activateConcertMode();
                break;
            case 'karaoke':
                this._activateKaraokeMode();
                break;
            case 'rehearsal':
                this._activateRehearsalMode();
                break;
            case 'live':
                this._activateLiveMode();
                break;
            case 'live-feed':
                 this._showLiveFeedConcept();
                 break;
            default:
                console.warn(`Unknown mode: ${mode}`);
                this._showLiveFeedConcept(); // Fallback to live feed
        }

        this._updateScaleDisplay();
        this._updateScaleControlsState();
    }

    async _handleWordAlignment() {
        if (this.isSyncing) return;

        this.isSyncing = true;
        const syncButton = document.getElementById('align-words-btn');
        const originalButtonText = syncButton.innerHTML;
        syncButton.disabled = true;
        syncButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Подготовка...`;

        try {
            const track = this.trackCatalog.getCurrentTrack();
            console.log('App: Sync started - track check:', {
                hasTrack: !!track,
                trackTitle: track?.title,
                hasInstrumentalData: !!track?.instrumentalData,
                hasVocalsData: !!track?.vocalsData,
                instrumentalDataSize: track?.instrumentalData?.byteLength,
                vocalsDataSize: track?.vocalsData?.byteLength,
                instrumentalType: track?.instrumentalType,
                vocalsType: track?.vocalsType
            });
            
            if (!track) {
                this.ui.showNotification('Сначала загрузите аудиофайл.', 'warning');
                throw new Error('Аудиофайл не загружен.');
            }

            // 🎯 ИСПРАВЛЕНИЕ: Приоритет вокальной дорожке для AI синхронизации
            let audioData, audioType;
            if (track.vocalsData && track.vocalsType) {
                audioData = track.vocalsData;
                audioType = track.vocalsType;
                console.log('🎤 Используем ВОКАЛЬНУЮ дорожку для AI синхронизации');
            } else if (track.instrumentalData && track.instrumentalType) {
                audioData = track.instrumentalData;
                audioType = track.instrumentalType;
                console.log('🎵 Используем инструментальную дорожку (вокальная недоступна)');
            } else {
                this.ui.showNotification('Аудиоданные недоступны для синхронизации.', 'warning');
                throw new Error('Аудиоданные недоступны.');
            }

            const lyricsText = this.lyricsDisplay.fullText;
            console.log('App: Lyrics check:', {
                hasLyricsText: !!lyricsText,
                lyricsLength: lyricsText?.length,
                lyricsPreview: lyricsText?.substring(0, 100)
            });
            
            if (!lyricsText) {
                this.ui.showNotification('Текст песни отсутствует.', 'warning');
                throw new Error('Текст песни отсутствует.');
            }

            // Создаем Blob из выбранных аудиоданных
            const audioBlob = new Blob([audioData], { type: audioType });
            console.log(`App: Created audio blob from track data:`, {
                size: audioBlob.size,
                type: audioBlob.type,
                title: track.title,
                source: track.vocalsData ? 'vocals' : 'instrumental'
            });

            // Диагностика аудио данных
            console.log(`🎵 АУДИО ДИАГНОСТИКА:`, {
                originalArrayBuffer: audioData.byteLength,
                blobSize: audioBlob.size,
                audioType: audioType,
                trackDuration: track.duration || 'неизвестно',
                sampleRate: track.sampleRate || 'неизвестно',
                audioSource: track.vocalsData ? '🎤 ВОКАЛЬНАЯ ДОРОЖКА' : '🎵 ИНСТРУМЕНТАЛЬНАЯ ДОРОЖКА'
            });

            // Проверяем качество аудио через AudioContext
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                console.log(`🎵 АНАЛИЗ АУДИО БУФЕРА:`, {
                    duration: audioBuffer.duration,
                    sampleRate: audioBuffer.sampleRate,
                    numberOfChannels: audioBuffer.numberOfChannels,
                    length: audioBuffer.length
                });

                // Анализ громкости
                const channelData = audioBuffer.getChannelData(0);
                let maxAmplitude = 0;
                let rmsSum = 0;
                for (let i = 0; i < channelData.length; i++) {
                    const sample = Math.abs(channelData[i]);
                    maxAmplitude = Math.max(maxAmplitude, sample);
                    rmsSum += sample * sample;
                }
                const rmsAmplitude = Math.sqrt(rmsSum / channelData.length);
                
                console.log(`📊 АНАЛИЗ ГРОМКОСТИ:`, {
                    maxAmplitude: maxAmplitude.toFixed(4),
                    rmsAmplitude: rmsAmplitude.toFixed(4),
                    isSilent: maxAmplitude < 0.001,
                    isQuiet: rmsAmplitude < 0.01
                });

                if (maxAmplitude < 0.001) {
                    this.ui.showNotification('⚠️ Аудио слишком тихое для анализа', 'warning');
            return;
        }
        
                audioContext.close();
            } catch (error) {
                console.error('Ошибка анализа аудио:', error);
                this.ui.showNotification('❌ Ошибка анализа аудио: ' + error.message, 'error');
            return;
        }
        
            this.ui.showNotification('Запуск AI синхронизации...', 'info');
            console.log('App: Starting word alignment with:', {
                lyricsLength: lyricsText.length,
                audioBlobSize: audioBlob.size,
                audioBlobType: audioBlob.type
            });
            
            this.wordAligner.addEventListener('result', (event) => {
                const words = event.detail;
                console.log(`App: Синхронизация завершена, результат:`, words);

                if (!Array.isArray(words) || words.length === 0) {
                    console.error("Результат синхронизации пуст или имеет неверный формат.");
                    this.ui.showNotification("Ошибка: AI не вернул распознанные слова.", "error");
            return;
        }
        
                // =================================================================
                // 🔬 РЕЖИМ ДИАГНОСТИКИ: "ЖИВАЯ РАСШИФРОВКА"
                // =================================================================
                console.log("🔬 ЗАПУСК ТЕСТА: 'ЖИВАЯ РАСШИФРОВКА'");
                this.ui.showNotification("Запущен тест распознавания AI...", "info");

                const wordsPerLine = 7; // Группируем по 7 слов для наглядности
                const testLines = [];
                const testMarkers = [];

                for (let i = 0; i < words.length; i += wordsPerLine) {
                    const chunk = words.slice(i, i + wordsPerLine);
                    if (chunk.length > 0) {
                        const lineText = chunk.map(w => w.word).join(' ');
                        const firstWord = chunk.find(w => w && typeof w.start === 'number');
                        
                        if (lineText && firstWord) {
                            const lineIndex = testLines.length;
                            testLines.push(lineText);
                            testMarkers.push({
                                line: lineText,
                                time: firstWord.start,
                                lineIndex: lineIndex,
                                source: 'diag-test',
                                color: '#FFC107' // Яркий желтый для диагностики
                            });
                        }
                    }
                }

                console.log(`🔬 Тест: Создано ${testLines.length} строк и ${testMarkers.length} маркеров.`);

                // Загружаем диагностический текст в дисплей
                const testBlock = {
                    name: "AI Raw Transcript",
                    lines: testLines,
                    id: `diag-block-${Date.now()}`
                };
                this.lyricsDisplay.loadBlocks([testBlock]);

                // Устанавливаем диагностические маркеры
                this.markerManager.setMarkers(testMarkers);

                // Показываем редактор с результатом теста
                this.waveformEditor.show();
                this.ui.showNotification("🔬 Тест завершен. Проверьте результат.", "success");
                
                // =================================================================
                // ปกติ อัลกอริทึม "ТРЕЗУБЕЦ" ถูกปิดใช้งานชั่วคราว
                // =================================================================
                /*
                console.log(`App: Тип результата: ${typeof words}`);
                if (typeof words === 'object' && words !== null && !Array.isArray(words)) {
                    console.log(`App: Ключи результата:`, Object.keys(words));
                }
                if (Array.isArray(words)) {
                     console.log(`App: Получен прямой массив слов: ${words.length}`);
                }

                const finalMarkers = this._convertWordsToLineMarkers(words);
                
                this.markerManager.setMarkers(finalMarkers);
                this.visualizeSyncedWords(finalMarkers);

                this.ui.showNotification("✨ Синхронизация завершена успешно!", "success", 4000);
                this.liveMode.notify('✨ Синхронизация завершена успешно!', 'success');
                this.waveformEditor.show();
                */

            }, {
                once: true
            });

            // Обработка ошибок выравнивания
            this.wordAligner.addEventListener('alignment-error', (event) => {
                console.error('App: Alignment error:', event.detail);
                this._showNotification(`Ошибка синхронизации: ${event.detail.message}`, 'error');
            });

            // Запускаем процесс выравнивания. Результат будет обработан в 'alignment-complete'
            await this.wordAligner.alignWords(lyricsText, audioBlob);

        } catch (error) {
            console.error('App: Word alignment failed', error);
            this.ui.showNotification(`Ошибка синхронизации: ${error.message}`, 'error');
        } finally {
            this.isSyncing = false;
                syncButton.disabled = false;
            syncButton.innerHTML = originalButtonText;
        }
    }

    /**
     * Handle progress updates from WordAligner
     * @param {Object} payload - Progress data from worker
     */
    _handleWordAlignmentProgress(payload) {
        const syncButton = document.getElementById('align-words-btn');
        if (!syncButton) return;

        console.log('App: WordAlignment progress update:', payload);

        // Update button text based on progress with detailed stages
        if (payload.status === 'loading') {
            const progress = payload.progress || 0;
            syncButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Загрузка AI модели: ${Math.round(progress)}%`;
        } else if (payload.status === 'ready') {
            syncButton.innerHTML = `<i class="fas fa-cog fa-spin"></i> Подготовка аудио...`;
        } else if (payload.status === 'processing') {
            syncButton.innerHTML = `<i class="fas fa-brain fa-pulse"></i> AI анализ речи...`;
        } else if (payload.status === 'aligning') {
            syncButton.innerHTML = `<i class="fas fa-sync fa-spin"></i> Синхронизация слов...`;
        } else if (payload.status === 'finalizing') {
            syncButton.innerHTML = `<i class="fas fa-check-circle fa-spin"></i> Завершение...`;
        } else {
            // Fallback for unknown status
            syncButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Обработка...`;
        }
    }

    /**
     * "Универсальный Нормализатор" для слов и фраз.
     * Приводит текст к единому формату для сравнения.
     * @param {string} text - Входной текст.
     * @returns {string} Нормализованный текст.
     */
    _universalNormalizer(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .replace(/'|\'/g, '') // Удаляет апострофы (e.g., "it's" -> "its")
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ') // Заменяет пунктуацию на пробелы
            .replace(/\s+/g, ' ') // Сжимает несколько пробелов в один
            .trim();
    }

    /**
     * Создает "Атлас Текста" - подробную карту всех фраз (n-грамм) и их статистических весов.
     * @param {string[]} lyricsLines - Массив строк текста песни.
     * @returns {Map<string, {score: number, lineIndexes: number[], length: number}>} - Карта фраз.
     */
    _buildTextAtlas(lyricsLines) {
        console.log('🗺️ Создание "Атласа Текста"...');
        const phrases = new Map();
        const wordFrequencies = new Map();
        let totalWords = 0;

        const normalizedLines = lyricsLines.map(line => 
            this._universalNormalizer(line).split(' ')
        );

        // 1. Подсчет частоты слов для расчета уникальности
        normalizedLines.forEach(words => {
            words.forEach(word => {
                if (!word) return;
                wordFrequencies.set(word, (wordFrequencies.get(word) || 0) + 1);
                totalWords++;
            });
        });

        // 2. Генерация N-грамм и сбор информации о них
        const minLength = 2;
        const maxLength = 7;
        normalizedLines.forEach((words, lineIndex) => {
            for (let i = 0; i < words.length; i++) {
                let currentPhrase = '';
                for (let j = i; j < words.length && j < i + maxLength; j++) {
                    currentPhrase = (j === i) ? words[j] : `${currentPhrase} ${words[j]}`;
                    const phraseLength = j - i + 1;
                    if (phraseLength < minLength) continue;

                    if (!phrases.has(currentPhrase)) {
                        phrases.set(currentPhrase, { occurrences: [], lineIndexes: new Set() });
                    }
                    phrases.get(currentPhrase).occurrences.push({ lineIndex, wordStartIndex: i });
                    phrases.get(currentPhrase).lineIndexes.add(lineIndex);
                }
            }
        });
        
        // 3. Расчет "Коэффициента Доверия" для каждой фразы
        const atlas = new Map();
        phrases.forEach((data, phrase) => {
            const phraseWords = phrase.split(' ');
            const length = phraseWords.length;
            const frequency = data.occurrences.length;

            // Расчет бонуса за уникальность (чем реже слова, тем выше бонус)
            let rarityScore = 0;
            phraseWords.forEach(word => {
                rarityScore += 1 / (wordFrequencies.get(word) || 1);
            });
            const uniquenessBonus = rarityScore / length;

            // Формула "Trust Score"
            const score = (Math.pow(length, 2) * (1 + uniquenessBonus)) / (1 + Math.pow(frequency - 1, 2));

            atlas.set(phrase, {
                score: score,
                lineIndexes: Array.from(data.lineIndexes),
                length: length,
                frequency: frequency
            });
        });

        // Сортировка по убыванию Trust Score для удобства отладки
        const sortedAtlas = new Map([...atlas.entries()].sort((a, b) => b[1].score - a[1].score));

        console.log(`🗺️ Атлас создан: ${sortedAtlas.size} уникальных фраз.`)
        // console.log('Топ-10 фраз:', [...sortedAtlas.entries()].slice(0, 10));

        return sortedAtlas;
    }

    /**
     * Ищет фразы с высоким "Trust Score" (Титанов) в потоке слов от AI.
     * @param {Array} aiWords - Массив объектов слов, полученных от AI.
     * @param {Map<string, object>} textAtlas - "Атлас Текста".
     * @returns {Array} Массив найденных "Титанов".
     */
    _huntForTitans(aiWords, textAtlas) {
        console.log('🏹 Охота на Титанов началась...');
        const foundTitans = [];
        const usedWordIndexes = new Set();
        const TITAN_THRESHOLD = 10; // Порог "Trust Score" для Титанов
        const MAX_PHRASE_LENGTH = 7;
        const MIN_PHRASE_LENGTH = 2;

        // Создаем карту нормализованных слов с обратной ссылкой на индекс оригинального слова
        const wordMap = [];
        aiWords.forEach((originalWordObj, originalIndex) => {
            if (!originalWordObj || typeof originalWordObj.word !== 'string') return;

            const normalizedSubWords = this._universalNormalizer(originalWordObj.word.replace(/\\n/g, ' ')).split(' ');
            normalizedSubWords.forEach(subWord => {
                if (subWord) {
                    wordMap.push({
                        text: subWord,
                        originalIndex: originalIndex 
                    });
                }
            });
        });
       
        for (let i = 0; i < wordMap.length; i++) {
            if (usedWordIndexes.has(i)) continue;

            // Ищем самую длинную возможную фразу, начиная с текущего слова
            for (let len = MAX_PHRASE_LENGTH; len >= MIN_PHRASE_LENGTH; len--) {
                if (i + len > wordMap.length) continue;

                const currentPhrase = wordMap.slice(i, i + len).map(w => w.text).join(' ');
                const phraseData = textAtlas.get(currentPhrase);

                if (phraseData && phraseData.score >= TITAN_THRESHOLD) {
                    // 🏆 ТИТАН НАЙДЕН!
                    const originalWordIndex = wordMap[i].originalIndex;
                    const originalWord = aiWords[originalWordIndex];

                    if (!originalWord || typeof originalWord.start !== 'number') {
                         console.warn(`⚠️ Пропускаем титан "${currentPhrase}" из-за невалидного оригинального слова или времени начала.`);
                         continue;
                    }

                    const startTime = originalWord.start;
                    console.log(`🏆 ТИТАН найден: "${currentPhrase}" [Score: ${phraseData.score.toFixed(2)}] → в ${startTime.toFixed(2)}s`);

                    foundTitans.push({
                        phrase: currentPhrase,
                        time: startTime,
                        lineIndexes: phraseData.lineIndexes,
                        score: phraseData.score,
                        source: 'titan'
                    });

                    // Помечаем все слова в этой фразе как использованные
                    for (let k = 0; k < len; k++) {
                        usedWordIndexes.add(i + k);
                    }
                    
                    // Мы нашли самую длинную и лучшую фразу для этой позиции, переходим к следующему неиспользованному слову
                    break; 
                }
            }
        }
        
        console.log(`🏹 Охота завершена. Найдено ${foundTitans.length} титанов.`);
        return foundTitans;
    }

    /**
     * Собирает финальный массив маркеров, используя "Титанов" как основу и интерполируя пробелы.
     * @param {Array} titans - Массив найденных "Титанов".
     * @param {Array<string>} lyricsLines - Массив строк текста песни.
     * @param {Array} aiWords - Оригинальный массив слов от AI.
     * @returns {Array} Финальный массив маркеров.
     */
    _buildFinalMarkers(titans, lyricsLines) {
        console.log('🏗️ Сборка финальных маркеров...');
        const finalMarkers = [];
        const anchorMarkers = [];
        const usedLineIndexes = new Set();
    
        // Шаг 1: Создаем карту всех возможных позиций для каждой уникальной фразы титана.
        const phrasePositions = new Map();
        titans.forEach(titan => {
            if (!phrasePositions.has(titan.phrase)) {
                const positions = [];
                lyricsLines.forEach((line, index) => {
                    if (this._universalNormalizer(line).includes(titan.phrase)) {
                        positions.push(index);
                    }
                });
                phrasePositions.set(titan.phrase, positions);
            }
        });
    
        let lastLineIndex = -1;
    
        // Шаг 2: "Умный" проход по титанам для расстановки якорей.
        titans.forEach(titan => {
            const possibleLines = phrasePositions.get(titan.phrase);
            if (!possibleLines || possibleLines.length === 0) {
                // Этого не должно произойти, если титаны строятся из текста, но на всякий случай.
            return;
        }

            // Ищем первую доступную позицию, которая идет после последнего якоря.
            const targetLineIndex = possibleLines.find(p => p > lastLineIndex && !usedLineIndexes.has(p));
    
            if (targetLineIndex !== undefined) {
                // Якорь найден!
                console.log(`⚓ Маркер-якорь установлен: строка ${targetLineIndex} в ${titan.time.toFixed(2)}s для фразы "${titan.phrase}"`);
                const marker = {
                    line: lyricsLines[targetLineIndex],
                    time: titan.time,
                    lineIndex: targetLineIndex,
                    source: 'titan'
                };
                anchorMarkers.push(marker);
                usedLineIndexes.add(targetLineIndex);
                // Обновляем позицию последнего якоря, чтобы следующий искался после текущего.
                // Сортируем массив якорей по lineIndex, чтобы lastLineIndex всегда был максимальным из уже найденных.
                anchorMarkers.sort((a, b) => a.lineIndex - b.lineIndex);
                lastLineIndex = anchorMarkers[anchorMarkers.length-1].lineIndex;
            } else {
                console.log(`🟡 Титан-призрак отброшен: не найдено свободной строки для "${titan.phrase}" после строки ${lastLineIndex}. Время: ${titan.time.toFixed(2)}s`);
            }
        });
    
        // Финальная сортировка якорей по индексу строки.
        anchorMarkers.sort((a, b) => a.lineIndex - b.lineIndex);
    
        console.log(`✅ Создано ${anchorMarkers.length} опорных маркеров из титанов.`);
    
        if (anchorMarkers.length === 0) {
            console.warn("Не найдено ни одного опорного маркера. Интерполяция невозможна.");
            return [];
        }
    
        // Шаг 3: Интерполяция. Заполняем пробелы между якорями.
        let currentAnchorIndex = 0;
        for (let i = 0; i < lyricsLines.length; i++) {
            const nextAnchor = anchorMarkers.find(a => a.lineIndex === i);
    
            if (nextAnchor) {
                // Это строка-якорь, добавляем ее как есть.
                finalMarkers.push(nextAnchor);
                currentAnchorIndex = anchorMarkers.indexOf(nextAnchor);
            } else {
                // Это строка, которую нужно интерполировать.
                const prevAnchor = anchorMarkers[currentAnchorIndex];
                const nextAnchorAfter = anchorMarkers[currentAnchorIndex + 1];
    
                if (prevAnchor && nextAnchorAfter) {
                    const linesBetween = nextAnchorAfter.lineIndex - prevAnchor.lineIndex;
                    const timeBetween = nextAnchorAfter.time - prevAnchor.time;
                    const linesFromPrev = i - prevAnchor.lineIndex;
    
                    const estimatedTime = prevAnchor.time + (timeBetween / linesBetween) * linesFromPrev;
    
                    console.log(`... Интерполяция для строки ${i} в ${estimatedTime.toFixed(2)}s`);
                    finalMarkers.push({
                        line: lyricsLines[i],
                        time: estimatedTime,
                        lineIndex: i,
                        source: 'interpolated'
                    });
                } else {
                   // Пропускаем строки до первого якоря или после последнего, их положение нельзя вычислить.
                }
            }
        }
    
        console.log(`🏗️ Сборка завершена. Всего создано ${finalMarkers.length} маркеров.`);
        console.log("Итоговые маркеры:", finalMarkers);
        return finalMarkers;
    }

    /**
     * Преобразует массив слов от AI в маркеры строк для MarkerManager
     * @param {Array} words - Массив слов с временными метками
     * @returns {Array} Массив маркеров строк
     */
    _convertWordsToLineMarkers(words) {
        if (!Array.isArray(words) || words.length === 0) {
            return [];
        }

        // Получаем текст песни по строкам
        const lyricsLines = this.lyricsDisplay ? this.lyricsDisplay.lyrics : [];
        if (lyricsLines.length === 0) {
            console.warn('No lyrics lines available for conversion');
            return [];
        }

        // 🔱 ЭТАП 1: Создание "Атласа Текста"
        const textAtlas = this._buildTextAtlas(lyricsLines);
        
        // Временный вывод для отладки
        console.table([...textAtlas.entries()].slice(0, 20).map(([phrase, data]) => ({
            "Фраза": phrase,
            "Trust Score": data.score.toFixed(2),
            "Длина": data.length,
            "Частота": data.frequency,
            "Строки": data.lineIndexes.join(', ')
        })));

        // 🔱 ЭТАП 2: "Охота на Титанов"
        const titans = this._huntForTitans(words, textAtlas);
        console.table(titans.map(t => ({
            "Фраза (Титан)": t.phrase,
            "Время": t.time.toFixed(2),
            "Score": t.score.toFixed(2),
            "Кандидаты (строки)": t.lineIndexes.join(', ')
        })));


        // 🔱 ЭТАП 3: Сборка финальных маркеров
        const finalMarkers = this._buildFinalMarkers(titans, lyricsLines);
        
        console.log("Итоговые маркеры:", finalMarkers);
        return finalMarkers;
    }

    /**
     * Создает маркеры на основе временного распределения слов
     * @param {Array} words - Массив слов
     * @param {Array} lyricsLines - Строки текста
     * @returns {Array} Маркеры строк
     */
    _createTimeBasedMarkers(words, lyricsLines) {
        const markers = [];
        const totalDuration = Math.max(...words.map(w => w.end || w.start + 1));
        const timePerLine = totalDuration / lyricsLines.length;

        lyricsLines.forEach((line, index) => {
            const estimatedTime = index * timePerLine;
            
            // Находим ближайшее слово по времени
            const nearestWord = words.reduce((closest, word) => {
                const wordTime = word.start || 0;
                const closestTime = closest ? closest.start || 0 : Infinity;
                return Math.abs(wordTime - estimatedTime) < Math.abs(closestTime - estimatedTime) ? word : closest;
            }, null);

            if (nearestWord) {
                markers.push({
                    id: `time-marker-${index}`,
                    lineIndex: index,
                    time: nearestWord.start || estimatedTime,
                    text: line,
                    blockType: 'verse',
                    color: '#FF9800', // Оранжевый для временных маркеров
                    confidence: 0.5,
                    source: 'time-based'
                });
            }
        });

        return markers.sort((a, b) => a.time - b.time);
    }

    /**
     * Визуализирует синхронизированные слова в тексте
     * @param {Array} markers - Массив маркеров с синхронизированными словами
     */
    _visualizeSyncedWords(markers) {
        console.log('🎨 Визуализация синхронизированных слов:', markers);
        
        if (!markers || !Array.isArray(markers)) {
            console.warn('Нет маркеров для визуализации');
            return;
        }

        const lyricsDisplay = document.getElementById('lyrics-display');
        if (!lyricsDisplay) return;

        const lyricLines = lyricsDisplay.querySelectorAll('.lyric-line');
        
        markers.forEach(marker => {
            if (marker.lineIndex >= 0 && marker.lineIndex < lyricLines.length) {
                const line = lyricLines[marker.lineIndex];
                
                // Добавляем класс для индикации типа синхронизации
                if (marker.source === 'ai') {
                    line.classList.add('ai-synced');
                } else if (marker.source === 'time-based') {
                    line.classList.add('time-based');
                }
                
                // Добавляем индикатор качества синхронизации
                if (marker.confidence) {
                    const qualityIndicator = document.createElement('div');
                    qualityIndicator.className = 'sync-quality-indicator';
                    
                    if (marker.confidence > 0.8) {
                        qualityIndicator.classList.add('sync-quality-high');
                    } else if (marker.confidence > 0.5) {
                        qualityIndicator.classList.add('sync-quality-medium');
            } else {
                        qualityIndicator.classList.add('sync-quality-low');
                    }
                    
                    line.style.position = 'relative';
                    line.appendChild(qualityIndicator);
                }
                
                // Если есть данные о словах, подсвечиваем их
                if (marker.words && Array.isArray(marker.words)) {
                    this._highlightWordsInLine(line, marker.words);
                }
            }
        });
        
        console.log('✅ Визуализация синхронизированных слов завершена');
    }

    /**
     * Подсвечивает отдельные слова в строке
     * @param {HTMLElement} lineElement - Элемент строки текста
     * @param {Array} words - Массив слов с временными метками
     */
    _highlightWordsInLine(lineElement, words) {
        if (!words || words.length === 0) return;
        
        const originalText = lineElement.textContent;
        let highlightedHTML = originalText;
        
        // Сортируем слова по времени начала
        const sortedWords = words.sort((a, b) => a.start - b.start);
        
        // Заменяем каждое слово на подсвеченную версию
        sortedWords.forEach((word, index) => {
            if (word.text && word.text.trim()) {
                const wordRegex = new RegExp(`\\b${word.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                highlightedHTML = highlightedHTML.replace(wordRegex, (match) => {
                    return `<span class="word-sync-highlight" data-start="${word.start}" data-end="${word.end}" data-confidence="${word.confidence || 0.5}">${match}</span>`;
                });
            }
        });
        
        // Обновляем содержимое строки только если были изменения
        if (highlightedHTML !== originalText) {
            lineElement.innerHTML = highlightedHTML;
            
            // Добавляем обработчики событий для подсвеченных слов
            const highlightedWords = lineElement.querySelectorAll('.word-sync-highlight');
            highlightedWords.forEach(wordElement => {
                wordElement.addEventListener('click', (e) => {
                    const startTime = parseFloat(e.target.dataset.start);
                    if (!isNaN(startTime) && this.audioEngine) {
                        this.audioEngine.setCurrentTime(startTime);
                        console.log(`🎯 Переход к времени: ${startTime}s`);
                    }
                });
                
                wordElement.addEventListener('mouseenter', (e) => {
                    const confidence = parseFloat(e.target.dataset.confidence);
                    const startTime = parseFloat(e.target.dataset.start);
                    const endTime = parseFloat(e.target.dataset.end);
                    
                    e.target.title = `Время: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s\nТочность: ${(confidence * 100).toFixed(0)}%`;
                });
            });
        }
    }

    /**
     * 🔧 ИСПРАВЛЕНО: Централизованная инициализация transport toggle с защитой от дублирования
     */
    _initTransportToggle() {
        const toggleBtn = document.getElementById('transport-toggle');
        const transportControls = document.getElementById('transport-controls');

        if (!toggleBtn || !transportControls) {
            console.error('Transport toggle button or controls panel not found.');
            return;
        }

        // 🔧 ЗАЩИТА: Удаляем существующие обработчики перед добавлением новых
        if (this._transportToggleHandler) {
            toggleBtn.removeEventListener('click', this._transportToggleHandler);
        }

        // Создаем новый обработчик и сохраняем ссылку для cleanup
        this._transportToggleHandler = () => {
            transportControls.classList.toggle('is-open');
            console.log(`🎛️ Transport controls: ${transportControls.classList.contains('is-open') ? 'открыты' : 'закрыты'}`);
        };

        toggleBtn.addEventListener('click', this._transportToggleHandler);
        console.log('🎛️ Transport toggle инициализирован');
    }

    /**
     * 🔧 НОВЫЙ: Cleanup метод для transport controls
     */
    _cleanupTransportToggle() {
        const toggleBtn = document.getElementById('transport-toggle');
        if (toggleBtn && this._transportToggleHandler) {
            toggleBtn.removeEventListener('click', this._transportToggleHandler);
            this._transportToggleHandler = null;
            console.log('🧹 Transport toggle очищен');
        }
    }

    /**
     * Методы управления BPM
     */
    
    /**
     * Уменьшение BPM на 5%
     * @private
     */
    _decreaseBPM() {
        if (this.currentBPM > 50) { // Минимальный лимит 50%
            this.currentBPM -= 5;
            this._applyBPMChange();
            this._updateBPMDisplay();
        }
    }
    
    /**
     * Увеличение BPM на 5%
     * @private
     */
    _increaseBPM() {
        if (this.currentBPM < 200) { // Максимальный лимит 200%
            this.currentBPM += 5;
            this._applyBPMChange();
            this._updateBPMDisplay();
        }
    }
    
    /**
     * Сброс BPM к 100%
     * @private
     */
    _resetBPM() {
        this.currentBPM = 100;
        this._applyBPMChange();
        this._updateBPMDisplay();
    }
    
    /**
     * Применение изменения BPM к аудио движку
     * @private
     */
    _applyBPMChange() {
        if (this.audioEngine && this.audioEngine.setPlaybackRate) {
            const rate = this.currentBPM / 100;
            this.audioEngine.setPlaybackRate(rate);
        }
    }
    
    /**
     * Обновление отображения BPM
     * @private
     */
    _updateBPMDisplay() {
        if (this.bpmValueBtn) {
            this.bpmValueBtn.textContent = `${this.currentBPM}%`;
        }
    }
}

let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 50; // Максимум 5 секунд ожидания

// === РАСШИРЕННАЯ ДИАГНОСТИКА КОМПОНЕНТОВ ===
function diagnoseComponents() {
    console.log('🔬 === ГЛУБОКАЯ ДИАГНОСТИКА КОМПОНЕНТОВ ===');
    
    const components = {
        audioEngine: window.audioEngine,
        lyricsDisplay: window.lyricsDisplay,
        trackCatalog: window.trackCatalog,
        StateManager: window.StateManager,
        ViewManager: window.ViewManager
    };
    
    for (const [name, component] of Object.entries(components)) {
        console.log(`🔍 ${name}:`, {
            exists: !!component,
            type: typeof component,
            constructor: component?.constructor?.name,
            isClass: component?.prototype ? 'Да' : 'Нет',
            properties: component ? Object.getOwnPropertyNames(component) : 'N/A',
            // ДОБАВЛЯЕМ ТОЧНОЕ ЗНАЧЕНИЕ
            exactValue: component,
            // ПРОВЕРЯЕМ БУЛЕВО ЗНАЧЕНИЕ
            booleanCheck: !component ? 'FALSY!' : 'TRUTHY'
        });
    }
    
    // ТОЧНАЯ ПРОВЕРКА УСЛОВИЯ ИЗ IF-STATEMENT
    console.log('🎯 ТОЧНАЯ ПРОВЕРКА УСЛОВИЯ:');
    console.log('!window.audioEngine:', !window.audioEngine);
    console.log('!window.lyricsDisplay:', !window.lyricsDisplay);
    console.log('!window.trackCatalog:', !window.trackCatalog);
    console.log('!window.StateManager:', !window.StateManager);
    console.log('!window.ViewManager:', !window.ViewManager);
    
    const condition = !window.audioEngine || !window.lyricsDisplay || !window.trackCatalog || !window.StateManager || !window.ViewManager;
    console.log('🔥 РЕЗУЛЬТАТ ПОЛНОГО УСЛОВИЯ:', condition);
    
    // Дополнительная проверка глобального пространства имен
    console.log('🌐 Глобальное пространство window содержит:');
    const relevantKeys = Object.keys(window).filter(key => 
        key.includes('Manager') || key.includes('Engine') || key.includes('Display') || key.includes('Catalog')
    );
    console.log('Релевантные ключи:', relevantKeys);
    
    console.log('🔬 === КОНЕЦ ДИАГНОСТИКИ ===');
}

function initializeApp() {
    initAttempts++;
    
    if (initAttempts > MAX_INIT_ATTEMPTS) {
        console.error('Не удалось инициализировать приложение после', MAX_INIT_ATTEMPTS, 'попыток');
        console.error('Проверьте загрузку всех необходимых скриптов');
        
        // ДОБАВЛЯЕМ ФИНАЛЬНУЮ ДИАГНОСТИКУ ПЕРЕД СДАЧЕЙ
        console.error('🚨 ФИНАЛЬНАЯ ДИАГНОСТИКА ПЕРЕД ЗАВЕРШЕНИЕМ:');
        diagnoseComponents();
        return;
    }
    
    // Check if all required components are loaded
    // --- ИСПРАВЛЕНИЕ: Добавляем проверку критических компонентов ---
    if (!window.audioEngine || !window.lyricsDisplay || !window.trackCatalog || !window.StateManager || !window.ViewManager) {
        // ДОБАВЛЯЕМ ДИАГНОСТИКУ НА КАЖДОЙ ПОПЫТКЕ
        if (initAttempts % 10 === 1) { // Каждые 10 попыток
            diagnoseComponents();
        }
        
        console.warn('Components not ready yet, retrying in 100ms (attempt', initAttempts, '/', MAX_INIT_ATTEMPTS, ')');
        console.warn('Missing components:', {
            audioEngine: !!window.audioEngine,
            lyricsDisplay: !!window.lyricsDisplay, 
            trackCatalog: !!window.trackCatalog,
            StateManager: !!window.StateManager,
            ViewManager: !!window.ViewManager
        });
        setTimeout(initializeApp, 100);
        return;
    }
    
    // Additional check for optional components (markerManager создается автоматически)
        if (!window.markerManager) {
        console.warn('MarkerManager not ready, retrying in 300ms (attempt', initAttempts, '/', MAX_INIT_ATTEMPTS, ')');
        setTimeout(initializeApp, 300);
        return;
        }
        
    console.log('All components ready, initializing app...');
    
    try {
        // Initialize the main app
        window.app = new App();
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Start initialization process after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, waiting for components');
    // Give components a moment to initialize
    setTimeout(initializeApp, 300);
});

/**
 * Show notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (info, success, error, warning)
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
        notification.classList.add('notification-hidden');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
    
    notification.appendChild(closeBtn);
    
    // Add to document
    let notificationsContainer = document.querySelector('.notifications-container');
    if (!notificationsContainer) {
        notificationsContainer = document.createElement('div');
        notificationsContainer.className = 'notifications-container';
        document.body.appendChild(notificationsContainer);
    }
    notificationsContainer.appendChild(notification);
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        notification.classList.add('notification-hidden');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

/**
 * Глобальная функция для включения/выключения логирования MaskSystem
 * Использование в консоли: toggleMaskLogging(true) или toggleMaskLogging(false)
 */
window.toggleMaskLogging = function(enabled) {
    if (window.app && window.app.maskSystem) {
        window.app.maskSystem.setConsoleLogging(enabled);
        console.log(`🎭 Логирование MaskSystem ${enabled ? 'включено' : 'выключено'}`);
    } else {
        console.warn('MaskSystem не найден');
    }
};

// Экспортируем app глобально для доступа к функциям
window.app = null; 
// Глобальные функции для быстрого доступа в консоли разработчика
window.addAudioToTrack = function() {
    if (window.trackCatalog) {
        window.trackCatalog.quickAddAudioToLastTrack();
    } else {
        console.error('TrackCatalog не инициализирован');
    }
};

window.openCatalog = function() {
    if (window.trackCatalog) {
        window.trackCatalog.openCatalog();
    } else {
        console.error('TrackCatalog не инициализирован');
    }
}; 
