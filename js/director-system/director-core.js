/**
 * Director System Core - Главный контроллер системы режиссера
 * Интегрируется с существующей архитектурой beLive
 * 🎬 РЕЖИССЕР: AI-powered система создания музыкальных шоу
 */

class DirectorSystem {
    constructor() {
        console.log('🎬 Инициализация системы режиссера...');
        
        // Интеграция с существующими системами beLive
        this.audioEngine = null;
        this.maskSystem = null;
        this.lyricsDisplay = null;
        this.trackCatalog = null;
        
        // Новые компоненты системы режиссера
        this.aiContextEngine = null;
        this.reactiveEffectsRenderer = null;
        this.trainTimelineController = null;
        this.avatarParticipantSystem = null;
        this.priorityArbiter = null;
        
        // Состояние системы
        this.isInitialized = false;
        this.currentTrack = null;
        this.isDirectorModeActive = false;
        
        // UI компоненты
        this.directorPage = null;
        this.trainVisualization = null;
        this.effectsSuggestionsPanel = null;
    }
    
    /**
     * Инициализация с существующими системами beLive
     */
    async initialize(existingSystems = {}) {
        try {
            console.log('🎬 Подключение к существующим системам beLive...');
            
            // Подключаемся к существующим системам
            this.audioEngine = existingSystems.audioEngine || window.audioEngine;
            this.maskSystem = existingSystems.maskSystem || window.maskSystem;
            this.lyricsDisplay = existingSystems.lyricsDisplay || window.lyricsDisplay;
            this.trackCatalog = existingSystems.trackCatalog || window.trackCatalog;
            
            if (!this.audioEngine) {
                throw new Error('AudioEngine не найден - требуется для работы режиссера');
            }
            
            // Инициализируем новые компоненты (пока заглушки)
            await this._initializeDirectorComponents();
            
            // Подключаемся к событиям существующих систем
            this._setupExistingSystemsIntegration();
            
            this.isInitialized = true;
            console.log('✅ Система режиссера инициализирована');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации системы режиссера:', error);
            throw error;
        }
    }
    
    /**
     * Инициализация новых компонентов режиссера
     * @private
     */
    async _initializeDirectorComponents() {
        console.log('🎬 Инициализация компонентов режиссера...');
        
        // TODO: Gemini подключается здесь для AIContextEngine
        // this.aiContextEngine = new AIContextEngine();
        
        // TODO: Gemini подключается здесь для ReactiveEffectsRenderer  
        // this.reactiveEffectsRenderer = new ReactiveEffectsRenderer();
        
        // Мои компоненты
        if (typeof TrainTimelineController !== 'undefined') {
            this.trainTimelineController = new TrainTimelineController();
        }
        
        if (typeof AvatarParticipantSystem !== 'undefined') {
            this.avatarParticipantSystem = new AvatarParticipantSystem();
        }
        
        if (typeof PriorityArbiter !== 'undefined') {
            this.priorityArbiter = new PriorityArbiter();
        }
        
        console.log('🎬 Компоненты режиссера готовы (базовая инициализация)');
    }
    
    /**
     * Интеграция с событиями существующих систем
     * @private
     */
    _setupExistingSystemsIntegration() {
        console.log('🎬 Настройка интеграции с существующими системами...');
        
        // Подключаемся к событиям AudioEngine
        if (this.audioEngine && this.audioEngine.onPositionUpdate) {
            this.audioEngine.onPositionUpdate((currentTime) => {
                this._handleAudioPositionUpdate(currentTime);
            });
        }
        
        // Подключаемся к событиям TrackCatalog
        if (this.trackCatalog) {
            document.addEventListener('track-loaded', (event) => {
                this._handleTrackLoaded(event.detail);
            });
        }
        
        // Подключаемся к событиям MaskSystem (если доступна)
        if (this.maskSystem && this.maskSystem.onMaskChange) {
            this.maskSystem.onMaskChange((maskData) => {
                this._handleMaskChange(maskData);
            });
        }
        
        console.log('🎬 Интеграция с существующими системами настроена');
    }
    
    /**
     * Обработка обновления позиции аудио
     * @param {number} currentTime - Текущее время воспроизведения
     * @private
     */
    _handleAudioPositionUpdate(currentTime) {
        if (!this.isDirectorModeActive) return;
        
        // TODO: Передаем в AIContextEngine для анализа
        if (this.aiContextEngine && this.aiContextEngine.updateTimeContext) {
            this.aiContextEngine.updateTimeContext(currentTime);
        }
        
        // Обновляем паровозик
        if (this.trainTimelineController) {
            this.trainTimelineController.syncWithAudio(currentTime);
        }
    }
    
    /**
     * Обработка загрузки нового трека
     * @param {Object} trackData - Данные загруженного трека
     * @private
     */
    _handleTrackLoaded(trackData) {
        console.log('🎬 Новый трек загружен в режиссер:', trackData.title || 'Без названия');
        this.currentTrack = trackData;
        
        // TODO: Передаем в AIContextEngine для анализа структуры
        if (this.aiContextEngine && this.aiContextEngine.analyzeTrackStructure) {
            this.aiContextEngine.analyzeTrackStructure(trackData);
        }
        
        // Обновляем паровозик с новой структурой трека
        if (this.trainTimelineController) {
            this.trainTimelineController.loadTrackStructure(trackData);
        }
    }
    
    /**
     * Обработка изменения маски пользователем
     * @param {Object} maskData - Данные о примененной маске
     * @private
     */
    _handleMaskChange(maskData) {
        if (!this.isDirectorModeActive) return;
        
        console.log('🎬 Пользователь изменил маску:', maskData);
        
        // TODO: Записываем выбор пользователя для обучения ИИ
        if (this.aiContextEngine && this.aiContextEngine.recordUserChoice) {
            this.aiContextEngine.recordUserChoice('mask', maskData);
        }
    }
    
    /**
     * Активация режима режиссера
     */
    activateDirectorMode() {
        if (!this.isInitialized) {
            console.error('❌ Система режиссера не инициализирована');
            return false;
        }
        
        console.log('🎬 Активация режима режиссера...');
        this.isDirectorModeActive = true;
        
        // Показываем UI режиссера
        this._showDirectorUI();
        
        // Запускаем анализ если трек уже загружен
        if (this.currentTrack && this.aiContextEngine) {
            this.aiContextEngine.startContinuousAnalysis();
        }
        
        return true;
    }
    
    /**
     * Деактивация режима режиссера
     */
    deactivateDirectorMode() {
        console.log('🎬 Деактивация режима режиссера...');
        this.isDirectorModeActive = false;
        
        // Скрываем UI режиссера
        this._hideDirectorUI();
        
        // Останавливаем анализ
        if (this.aiContextEngine && this.aiContextEngine.stopContinuousAnalysis) {
            this.aiContextEngine.stopContinuousAnalysis();
        }
    }
    
    /**
     * Показать UI режиссера
     * @private
     */
    _showDirectorUI() {
        // TODO: Реализация UI (следующий этап)
        console.log('🎬 Показ UI режиссера (TODO: реализация)');
    }
    
    /**
     * Скрыть UI режиссера
     * @private
     */
    _hideDirectorUI() {
        // TODO: Реализация UI (следующий этап)
        console.log('🎬 Скрытие UI режиссера (TODO: реализация)');
    }
    
    /**
     * Получить текущий статус системы
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isActive: this.isDirectorModeActive,
            hasTrack: !!this.currentTrack,
            components: {
                aiContextEngine: !!this.aiContextEngine,
                trainTimelineController: !!this.trainTimelineController,
                avatarParticipantSystem: !!this.avatarParticipantSystem
            }
        };
    }
}

// Экспорт для использования в других модулях
window.DirectorSystem = DirectorSystem; 