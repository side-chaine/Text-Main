/**
 * Director Page - Главная страница режиссера
 * UI компонент для системы режиссера beLive
 * 🎬 РЕЖИССЕРСКАЯ КОНСОЛЬ: интерфейс управления
 */

class DirectorPage {
    constructor(directorSystem) {
        console.log('🎬 Инициализация страницы режиссера...');
        
        this.directorSystem = directorSystem;
        
        // UI элементы
        this.pageContainer = null;
        this.emptyStateContainer = null;
        this.activeStateContainer = null;
        this.trainVisualization = null;
        this.effectsSuggestionsPanel = null;
        this.aiAssistantPanel = null;
        
        // Состояние UI
        this.isVisible = false;
        this.currentView = 'empty'; // 'empty', 'active', 'settings'
        
        // Создаем основную структуру
        this._createPageStructure();
        this._setupEventListeners();
        
        console.log('🎬 Страница режиссера создана');
    }
    
    /**
     * Создание основной структуры страницы
     * @private
     */
    _createPageStructure() {
        // Создаем контейнер страницы режиссера
        this.pageContainer = document.createElement('div');
        this.pageContainer.id = 'director-page';
        this.pageContainer.className = 'director-page hidden';
        this.pageContainer.innerHTML = `
            <div class="director-header">
                <div class="director-title">
                    <h2>🎬 Режиссерская консоль</h2>
                    <div class="director-status">
                        <span class="status-indicator"></span>
                        <span class="status-text">Готов к работе</span>
                    </div>
                </div>
                <div class="director-controls">
                    <button class="director-btn" id="director-settings-btn">⚙️ Настройки</button>
                    <button class="director-btn" id="director-close-btn">✕ Закрыть</button>
                </div>
            </div>
            
            <div class="director-content">
                <!-- Пустое состояние -->
                <div class="director-empty-state" id="director-empty-state">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">🎵</div>
                        <h3>Выберите трек для начала работы</h3>
                        <p>Режиссер поможет создать потрясающее шоу с AI-эффектами</p>
                        <div class="empty-state-actions">
                            <button class="director-btn primary" id="open-catalog-btn">
                                📁 Открыть каталог треков
                            </button>
                            <button class="director-btn secondary" id="director-demo-btn">
                                ✨ Показать демо
                            </button>
                        </div>
                        <div class="empty-state-features">
                            <div class="feature-item">
                                <span class="feature-icon">🚂</span>
                                <span class="feature-text">Умный паровозик эффектов</span>
                            </div>
                            <div class="feature-item">
                                <span class="feature-icon">🤖</span>
                                <span class="feature-text">AI-предложения в реальном времени</span>
                            </div>
                            <div class="feature-item">
                                <span class="feature-icon">🎭</span>
                                <span class="feature-text">Синхронизация с музыкой</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Активное состояние -->
                <div class="director-active-state hidden" id="director-active-state">
                    <div class="director-workspace">
                        <!-- Паровозик с эффектами -->
                        <div class="train-section">
                            <div class="section-header">
                                <h4>🚂 Паровозик эффектов</h4>
                                <div class="train-controls">
                                    <button class="train-btn" id="train-play-btn">▶️</button>
                                    <button class="train-btn" id="train-pause-btn">⏸️</button>
                                    <button class="train-btn" id="train-reset-btn">🔄</button>
                                </div>
                            </div>
                            <div class="train-visualization" id="train-visualization">
                                <!-- Здесь будет визуализация паровозика -->
                            </div>
                        </div>
                        
                        <!-- Панель предложений AI -->
                        <div class="ai-suggestions-section">
                            <div class="section-header">
                                <h4>🤖 AI Ассистент</h4>
                                <div class="ai-status">
                                    <span class="ai-indicator"></span>
                                    <span class="ai-text">Анализирует...</span>
                                </div>
                            </div>
                            <div class="ai-suggestions-panel" id="ai-suggestions-panel">
                                <!-- Здесь будут предложения AI -->
                            </div>
                        </div>
                        
                        <!-- Панель эффектов -->
                        <div class="effects-section">
                            <div class="section-header">
                                <h4>✨ Панель эффектов</h4>
                                <button class="effects-btn" id="add-custom-effect-btn">➕ Добавить</button>
                            </div>
                            <div class="effects-panel" id="effects-panel">
                                <!-- Здесь будут доступные эффекты -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Добавляем в body (скрыто)
        document.body.appendChild(this.pageContainer);
        
        // Получаем ссылки на элементы
        this.emptyStateContainer = document.getElementById('director-empty-state');
        this.activeStateContainer = document.getElementById('director-active-state');
        this.trainVisualization = document.getElementById('train-visualization');
        this.effectsSuggestionsPanel = document.getElementById('ai-suggestions-panel');
        
        console.log('🎬 Структура страницы режиссера создана');
    }
    
    /**
     * Настройка обработчиков событий
     * @private
     */
    _setupEventListeners() {
        // Кнопка закрытия
        const closeBtn = document.getElementById('director-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // Кнопка открытия каталога
        const catalogBtn = document.getElementById('open-catalog-btn');
        if (catalogBtn) {
            catalogBtn.addEventListener('click', () => this._openTrackCatalog());
        }
        
        // Кнопка демо
        const demoBtn = document.getElementById('director-demo-btn');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => this._showDemo());
        }
        
        // Кнопки управления паровозиком
        const playBtn = document.getElementById('train-play-btn');
        const pauseBtn = document.getElementById('train-pause-btn');
        const resetBtn = document.getElementById('train-reset-btn');
        
        if (playBtn) playBtn.addEventListener('click', () => this._handleTrainPlay());
        if (pauseBtn) pauseBtn.addEventListener('click', () => this._handleTrainPause());
        if (resetBtn) resetBtn.addEventListener('click', () => this._handleTrainReset());
        
        // Слушаем события системы режиссера
        if (this.directorSystem) {
            // TODO: Подключить события от DirectorSystem когда они будут готовы
        }
        
        console.log('🎬 Обработчики событий настроены');
    }
    
    /**
     * Показать страницу режиссера
     */
    show() {
        console.log('🎬 Показ страницы режиссера');
        
        this.pageContainer.classList.remove('hidden');
        this.isVisible = true;
        
        // Определяем, какое состояние показать
        if (this.directorSystem && this.directorSystem.currentTrack) {
            this._showActiveState();
        } else {
            this._showEmptyState();
        }
        
        // Активируем режим режиссера в системе
        if (this.directorSystem) {
            this.directorSystem.activateDirectorMode();
        }
    }
    
    /**
     * Скрыть страницу режиссера
     */
    hide() {
        console.log('🎬 Скрытие страницы режиссера');
        
        this.pageContainer.classList.add('hidden');
        this.isVisible = false;
        
        // Деактивируем режим режиссера в системе
        if (this.directorSystem) {
            this.directorSystem.deactivateDirectorMode();
        }
    }
    
    /**
     * Показать пустое состояние
     * @private
     */
    _showEmptyState() {
        console.log('🎬 Показ пустого состояния');
        
        this.currentView = 'empty';
        this.emptyStateContainer.classList.remove('hidden');
        this.activeStateContainer.classList.add('hidden');
    }
    
    /**
     * Показать активное состояние
     * @private
     */
    _showActiveState() {
        console.log('🎬 Показ активного состояния');
        
        this.currentView = 'active';
        this.emptyStateContainer.classList.add('hidden');
        this.activeStateContainer.classList.remove('hidden');
        
        // Инициализируем компоненты активного состояния
        this._initializeActiveComponents();
    }
    
    /**
     * Инициализация компонентов активного состояния
     * @private
     */
    _initializeActiveComponents() {
        // Инициализируем визуализацию паровозика
        this._initializeTrainVisualization();
        
        // Инициализируем панель AI предложений
        this._initializeAISuggestions();
        
        // Инициализируем панель эффектов
        this._initializeEffectsPanel();
    }
    
    /**
     * Инициализация визуализации паровозика
     * @private
     */
    _initializeTrainVisualization() {
        if (!this.trainVisualization) return;
        
        // Базовая визуализация паровозика (заглушка)
        this.trainVisualization.innerHTML = `
            <div class="train-track">
                <div class="train-engine">🚂</div>
                <div class="train-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-time">00:00 / 00:00</div>
                </div>
            </div>
            <div class="train-wagons" id="train-wagons">
                <!-- Вагоны будут добавлены динамически -->
            </div>
        `;
        
        console.log('🚂 Визуализация паровозика инициализирована');
    }
    
    /**
     * Инициализация AI предложений
     * @private
     */
    _initializeAISuggestions() {
        if (!this.effectsSuggestionsPanel) return;
        
        // Базовая панель AI предложений (заглушка)
        this.effectsSuggestionsPanel.innerHTML = `
            <div class="ai-suggestion-item">
                <div class="suggestion-icon">🎭</div>
                <div class="suggestion-content">
                    <div class="suggestion-title">Элегантная маска</div>
                    <div class="suggestion-description">Подходит для вступления</div>
                    <div class="suggestion-confidence">Уверенность: 85%</div>
                </div>
                <div class="suggestion-actions">
                    <button class="suggestion-btn apply">✓ Применить</button>
                    <button class="suggestion-btn dismiss">✕ Отклонить</button>
                </div>
            </div>
        `;
        
        console.log('🤖 AI предложения инициализированы');
    }
    
    /**
     * Инициализация панели эффектов
     * @private
     */
    _initializeEffectsPanel() {
        const effectsPanel = document.getElementById('effects-panel');
        if (!effectsPanel) return;
        
        // Базовая панель эффектов (заглушка)
        effectsPanel.innerHTML = `
            <div class="effects-grid">
                <div class="effect-item" data-effect="mask">
                    <div class="effect-icon">🎭</div>
                    <div class="effect-name">Маски</div>
                </div>
                <div class="effect-item" data-effect="filter">
                    <div class="effect-icon">🌟</div>
                    <div class="effect-name">Фильтры</div>
                </div>
                <div class="effect-item" data-effect="lighting">
                    <div class="effect-icon">💡</div>
                    <div class="effect-name">Освещение</div>
                </div>
                <div class="effect-item" data-effect="particles">
                    <div class="effect-icon">✨</div>
                    <div class="effect-name">Частицы</div>
                </div>
            </div>
        `;
        
        console.log('✨ Панель эффектов инициализирована');
    }
    
    /**
     * Открытие каталога треков
     * @private
     */
    _openTrackCatalog() {
        console.log('🎬 Открытие каталога треков из режиссера');
        
        // Интеграция с существующим каталогом треков
        if (window.trackCatalog && window.trackCatalog.show) {
            window.trackCatalog.show();
        } else {
            // Альтернативный способ - через событие
            document.dispatchEvent(new CustomEvent('open-track-catalog', {
                detail: { source: 'director' }
            }));
        }
    }
    
    /**
     * Показ демо режима
     * @private
     */
    _showDemo() {
        console.log('🎬 Запуск демо режима');
        
        // Создаем демо трек
        const demoTrack = {
            title: 'Демо трек',
            duration: 180,
            artist: 'beLive Demo',
            isDemo: true
        };
        
        // Загружаем демо трек в систему
        if (this.directorSystem) {
            this.directorSystem.currentTrack = demoTrack;
            this._showActiveState();
        }
    }
    
    /**
     * Обработчики управления паровозиком
     * @private
     */
    _handleTrainPlay() {
        console.log('🚂 Воспроизведение паровозика');
        // TODO: Интеграция с аудио системой
    }
    
    _handleTrainPause() {
        console.log('🚂 Пауза паровозика');
        // TODO: Интеграция с аудио системой
    }
    
    _handleTrainReset() {
        console.log('🚂 Сброс паровозика');
        // TODO: Сброс позиции в начало
    }
    
    /**
     * Обновление состояния страницы при загрузке трека
     * @param {Object} trackData - Данные трека
     */
    onTrackLoaded(trackData) {
        console.log('🎬 Трек загружен в режиссер:', trackData.title);
        
        if (this.isVisible) {
            this._showActiveState();
        }
    }
    
    /**
     * Получение текущего состояния страницы
     */
    getPageState() {
        return {
            isVisible: this.isVisible,
            currentView: this.currentView,
            hasTrack: !!(this.directorSystem && this.directorSystem.currentTrack)
        };
    }
}

// Экспорт для использования в других модулях
window.DirectorPage = DirectorPage; 