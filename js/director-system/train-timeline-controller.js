/**
 * Train Timeline Controller - Контроллер "паровозика" с эффектами
 * Визуализирует временную шкалу трека с предложенными эффектами
 * 🚂 ПОЕЗД ЭФФЕКТОВ: интерактивная временная шкала
 */

class TrainTimelineController {
    constructor() {
        console.log('🚂 Инициализация контроллера паровозика...');
        
        // Данные трека и структуры
        this.trackData = null;
        this.trackDuration = 0;
        this.currentPosition = 0;
        
        // Структура трека (куплет, припев, бридж и т.д.)
        this.trackStructure = [];
        
        // Эффекты на временной шкале
        this.suggestedEffects = [];
        this.appliedEffects = [];
        this.userEffects = [];
        
        // Состояние воспроизведения
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        
        // UI элементы
        this.trainContainer = null;
        this.trainEngine = null; // "Локомотив" - текущая позиция
        this.wagons = []; // "Вагоны" - сегменты трека с эффектами
        
        // События
        this.onEffectSuggested = null;
        this.onEffectApplied = null;
        this.onPositionChanged = null;
    }
    
    /**
     * Загрузка структуры трека
     * @param {Object} trackData - Данные трека
     */
    loadTrackStructure(trackData) {
        console.log('🚂 Загрузка структуры трека в паровозик:', trackData.title || 'Без названия');
        
        this.trackData = trackData;
        this.trackDuration = trackData.duration || 0;
        this.currentPosition = 0;
        
        // Анализируем структуру трека (заглушка)
        this._analyzeTrackStructure(trackData);
        
        // Создаем базовые сегменты
        this._createTrackSegments();
        
        // Генерируем начальные предложения эффектов
        this._generateInitialEffectSuggestions();
        
        console.log(`🚂 Паровозик готов: ${this.trackStructure.length} сегментов, продолжительность ${this.trackDuration}с`);
    }
    
    /**
     * Анализ структуры трека (упрощенная версия)
     * @param {Object} trackData - Данные трека
     * @private
     */
    _analyzeTrackStructure(trackData) {
        // Базовая структура по времени (пока заглушка)
        const duration = this.trackDuration;
        
        if (duration > 0) {
            // Примерная структура популярной песни
            this.trackStructure = [
                { type: 'intro', start: 0, end: duration * 0.1, label: 'Вступление' },
                { type: 'verse', start: duration * 0.1, end: duration * 0.3, label: 'Куплет 1' },
                { type: 'chorus', start: duration * 0.3, end: duration * 0.5, label: 'Припев 1' },
                { type: 'verse', start: duration * 0.5, end: duration * 0.7, label: 'Куплет 2' },
                { type: 'chorus', start: duration * 0.7, end: duration * 0.9, label: 'Припев 2' },
                { type: 'outro', start: duration * 0.9, end: duration, label: 'Окончание' }
            ];
        } else {
            // Если длительность неизвестна, создаем один сегмент
            this.trackStructure = [
                { type: 'unknown', start: 0, end: 180, label: 'Весь трек' }
            ];
        }
        
        console.log('🚂 Структура трека проанализирована:', this.trackStructure.length, 'сегментов');
    }
    
    /**
     * Создание сегментов трека (вагонов)
     * @private
     */
    _createTrackSegments() {
        this.wagons = this.trackStructure.map((segment, index) => ({
            id: `wagon-${index}`,
            segment: segment,
            effects: [],
            isActive: false,
            suggestedEffects: [],
            userCustomizations: {}
        }));
        
        console.log('🚂 Создано вагонов:', this.wagons.length);
    }
    
    /**
     * Генерация начальных предложений эффектов
     * @private
     */
    _generateInitialEffectSuggestions() {
        console.log('🚂 Генерация предложений эффектов...');
        
        // Базовые предложения эффектов для разных типов сегментов
        const effectTemplates = {
            intro: [
                { type: 'mask', name: 'Элегантная маска', confidence: 0.8, reason: 'Подходит для вступления' },
                { type: 'filter', name: 'Мягкое размытие', confidence: 0.7, reason: 'Создает атмосферу' }
            ],
            verse: [
                { type: 'mask', name: 'Базовая коррекция', confidence: 0.9, reason: 'Естественный вид для куплета' },
                { type: 'lighting', name: 'Мягкий свет', confidence: 0.8, reason: 'Подчеркивает текст' }
            ],
            chorus: [
                { type: 'mask', name: 'Яркая маска', confidence: 0.9, reason: 'Энергия припева' },
                { type: 'effect', name: 'Блестки', confidence: 0.7, reason: 'Динамика припева' },
                { type: 'lighting', name: 'Яркий свет', confidence: 0.8, reason: 'Акцент на припеве' }
            ],
            outro: [
                { type: 'mask', name: 'Финальная маска', confidence: 0.8, reason: 'Завершение выступления' },
                { type: 'filter', name: 'Затемнение', confidence: 0.6, reason: 'Плавное окончание' }
            ]
        };
        
        // Применяем предложения к вагонам
        this.wagons.forEach(wagon => {
            const segmentType = wagon.segment.type;
            const templates = effectTemplates[segmentType] || effectTemplates.verse;
            
            wagon.suggestedEffects = templates.map(template => ({
                ...template,
                id: `effect-${wagon.id}-${template.type}-${Date.now()}`,
                timestamp: wagon.segment.start,
                duration: wagon.segment.end - wagon.segment.start,
                isApplied: false,
                isUserCustomized: false
            }));
        });
        
        console.log('🚂 Предложения эффектов сгенерированы для всех вагонов');
    }
    
    /**
     * Синхронизация с аудио позицией
     * @param {number} currentTime - Текущее время воспроизведения
     */
    syncWithAudio(currentTime) {
        const previousPosition = this.currentPosition;
        this.currentPosition = currentTime;
        
        // Определяем активный сегмент
        const activeWagon = this._findActiveWagon(currentTime);
        
        if (activeWagon) {
            // Обновляем активный вагон
            this._updateActiveWagon(activeWagon, previousPosition);
            
            // Проверяем, нужно ли применить эффекты
            this._checkEffectTriggers(currentTime);
        }
        
        // Уведомляем о изменении позиции
        if (this.onPositionChanged) {
            this.onPositionChanged(currentTime, activeWagon);
        }
    }
    
    /**
     * Поиск активного вагона по времени
     * @param {number} currentTime - Текущее время
     * @returns {Object|null} - Активный вагон или null
     * @private
     */
    _findActiveWagon(currentTime) {
        return this.wagons.find(wagon => 
            currentTime >= wagon.segment.start && 
            currentTime < wagon.segment.end
        ) || null;
    }
    
    /**
     * Обновление активного вагона
     * @param {Object} activeWagon - Активный вагон
     * @param {number} previousPosition - Предыдущая позиция
     * @private
     */
    _updateActiveWagon(activeWagon, previousPosition) {
        // Сбрасываем активность всех вагонов
        this.wagons.forEach(wagon => wagon.isActive = false);
        
        // Устанавливаем активность текущего вагона
        activeWagon.isActive = true;
        
        // Логируем переход между сегментами
        const previousWagon = this._findActiveWagon(previousPosition);
        if (previousWagon && previousWagon.id !== activeWagon.id) {
            console.log(`🚂 Переход: ${previousWagon.segment.label} → ${activeWagon.segment.label}`);
        }
    }
    
    /**
     * Проверка триггеров эффектов
     * @param {number} currentTime - Текущее время
     * @private
     */
    _checkEffectTriggers(currentTime) {
        this.wagons.forEach(wagon => {
            wagon.suggestedEffects.forEach(effect => {
                // Проверяем, нужно ли активировать эффект
                if (!effect.isApplied && 
                    currentTime >= effect.timestamp && 
                    currentTime < effect.timestamp + effect.duration) {
                    
                    this._triggerEffect(effect, wagon);
                }
            });
        });
    }
    
    /**
     * Активация эффекта
     * @param {Object} effect - Эффект для активации
     * @param {Object} wagon - Вагон с эффектом
     * @private
     */
    _triggerEffect(effect, wagon) {
        console.log(`🚂 Активация эффекта: ${effect.name} в ${wagon.segment.label}`);
        
        effect.isApplied = true;
        
        // Уведомляем о применении эффекта
        if (this.onEffectApplied) {
            this.onEffectApplied(effect, wagon);
        }
    }
    
    /**
     * Добавление пользовательского эффекта
     * @param {number} timestamp - Время применения эффекта
     * @param {Object} effectData - Данные эффекта
     */
    addUserEffect(timestamp, effectData) {
        console.log(`🚂 Пользователь добавил эффект в ${timestamp}с:`, effectData.name);
        
        const userEffect = {
            ...effectData,
            id: `user-effect-${Date.now()}`,
            timestamp: timestamp,
            isUserCustomized: true,
            isApplied: false
        };
        
        // Находим подходящий вагон
        const targetWagon = this._findActiveWagon(timestamp);
        if (targetWagon) {
            targetWagon.suggestedEffects.push(userEffect);
            this.userEffects.push(userEffect);
        }
        
        return userEffect;
    }
    
    /**
     * Получение текущего состояния паровозика
     */
    getTrainState() {
        const activeWagon = this._findActiveWagon(this.currentPosition);
        
        return {
            currentPosition: this.currentPosition,
            trackDuration: this.trackDuration,
            activeWagon: activeWagon,
            totalWagons: this.wagons.length,
            appliedEffectsCount: this.appliedEffects.length,
            suggestedEffectsCount: this.suggestedEffects.length,
            progress: this.trackDuration > 0 ? this.currentPosition / this.trackDuration : 0
        };
    }
    
    /**
     * Получение всех вагонов с их состоянием
     */
    getAllWagons() {
        return this.wagons.map(wagon => ({
            ...wagon,
            isCurrentlyActive: wagon.isActive,
            effectsCount: wagon.suggestedEffects.length,
            appliedEffectsCount: wagon.suggestedEffects.filter(e => e.isApplied).length
        }));
    }
}

// Экспорт для использования в других модулях
window.TrainTimelineController = TrainTimelineController; 