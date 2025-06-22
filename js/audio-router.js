/**
 * AudioRouter - Система роутинга аудио для локального мониторинга
 * Часть проекта "Кракен" - Phase 1 Одиссеи
 */
class AudioRouter {
    constructor() {
        this.audioContext = null;
        this.mainOutput = null;
        this.monitorOutput = null;
        this.splitter = null;
        this.devices = new Map();
        this.isInitialized = false;
        
        // Настройки по умолчанию
        this.settings = {
            mainDeviceId: 'default',
            monitorDeviceId: null,
            monitorEnabled: false,
            monitorVolume: 0.8,
            mainVolume: 1.0
        };
    }

    /**
     * Инициализация AudioRouter
     */
    async initialize(audioContext) {
        try {
            this.audioContext = audioContext;
            await this.loadDevices();
            await this.createAudioGraph();
            this.isInitialized = true;
            console.log('🐙 AudioRouter инициализирован');
            return true;
        } catch (error) {
            console.error('❌ Ошибка инициализации AudioRouter:', error);
            return false;
        }
    }

    /**
     * Загрузка доступных аудио устройств
     */
    async loadDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices.clear();
            
            devices.forEach(device => {
                if (device.kind === 'audiooutput') {
                    this.devices.set(device.deviceId, {
                        id: device.deviceId,
                        label: device.label || `Устройство ${device.deviceId.slice(0, 8)}`,
                        kind: device.kind
                    });
                }
            });
            
            console.log(`🎵 Найдено ${this.devices.size} аудио устройств`);
            return Array.from(this.devices.values());
        } catch (error) {
            console.error('❌ Ошибка загрузки устройств:', error);
            return [];
        }
    }

    /**
     * Создание аудио графа для роутинга
     */
    async createAudioGraph() {
        if (!this.audioContext) {
            throw new Error('AudioContext не инициализирован');
        }

        // Создаем сплиттер для разделения сигнала
        this.splitter = this.audioContext.createChannelSplitter(2);
        
        // Создаем узлы для основного и мониторного выходов
        this.mainOutput = this.audioContext.createGain();
        this.monitorOutput = this.audioContext.createGain();
        
        // Настраиваем уровни
        this.mainOutput.gain.value = this.settings.mainVolume;
        this.monitorOutput.gain.value = this.settings.monitorVolume;
        
        // Соединяем граф
        this.splitter.connect(this.mainOutput);
        this.splitter.connect(this.monitorOutput);
        
        console.log('🔗 Аудио граф создан');
    }

    /**
     * Подключение источника аудио
     */
    connectSource(sourceNode) {
        if (!this.isInitialized || !sourceNode) {
            console.warn('⚠️ AudioRouter не инициализирован или источник не задан');
            return false;
        }

        try {
            sourceNode.connect(this.splitter);
            console.log('🎵 Источник подключен к роутеру');
            return true;
        } catch (error) {
            console.error('❌ Ошибка подключения источника:', error);
            return false;
        }
    }

    /**
     * Установка основного устройства вывода
     */
    async setMainDevice(deviceId) {
        try {
            if (!this.devices.has(deviceId) && deviceId !== 'default') {
                throw new Error(`Устройство ${deviceId} не найдено`);
            }

            // Подключаем к основному выходу
            this.mainOutput.connect(this.audioContext.destination);
            
            // Если поддерживается setSinkId
            if (this.audioContext.setSinkId) {
                await this.audioContext.setSinkId(deviceId);
                console.log(`🔊 Основное устройство: ${this.getDeviceLabel(deviceId)}`);
            }
            
            this.settings.mainDeviceId = deviceId;
            this.saveSettings();
            return true;
        } catch (error) {
            console.error('❌ Ошибка установки основного устройства:', error);
            return false;
        }
    }

    /**
     * Установка устройства мониторинга
     */
    async setMonitorDevice(deviceId) {
        try {
            if (!deviceId) {
                this.settings.monitorEnabled = false;
                this.settings.monitorDeviceId = null;
                console.log('🎧 Мониторинг отключен');
                return true;
            }

            if (!this.devices.has(deviceId)) {
                throw new Error(`Устройство ${deviceId} не найдено`);
            }

            // Создаем отдельный AudioContext для мониторинга (если нужно)
            // Это позволит использовать setSinkId независимо
            this.settings.monitorDeviceId = deviceId;
            this.settings.monitorEnabled = true;
            
            console.log(`🎧 Устройство мониторинга: ${this.getDeviceLabel(deviceId)}`);
            this.saveSettings();
            return true;
        } catch (error) {
            console.error('❌ Ошибка установки устройства мониторинга:', error);
            return false;
        }
    }

    /**
     * Управление уровнями
     */
    setMainVolume(volume) {
        if (this.mainOutput) {
            this.mainOutput.gain.value = Math.max(0, Math.min(1, volume));
            this.settings.mainVolume = volume;
            this.saveSettings();
        }
    }

    setMonitorVolume(volume) {
        if (this.monitorOutput) {
            this.monitorOutput.gain.value = Math.max(0, Math.min(1, volume));
            this.settings.monitorVolume = volume;
            this.saveSettings();
        }
    }

    /**
     * Получение информации об устройстве
     */
    getDeviceLabel(deviceId) {
        if (deviceId === 'default') return 'Системное по умолчанию';
        const device = this.devices.get(deviceId);
        return device ? device.label : 'Неизвестное устройство';
    }

    /**
     * Получение списка устройств для UI
     */
    getDevicesList() {
        const devices = Array.from(this.devices.values());
        devices.unshift({
            id: 'default',
            label: 'Системное по умолчанию',
            kind: 'audiooutput'
        });
        return devices;
    }

    /**
     * Сохранение настроек
     */
    saveSettings() {
        try {
            localStorage.setItem('audioRouter_settings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить настройки:', error);
        }
    }

    /**
     * Загрузка настроек
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('audioRouter_settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
                console.log('📱 Настройки загружены');
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить настройки:', error);
        }
    }

    /**
     * Получение текущих настроек
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Проверка поддержки setSinkId
     */
    static isSetSinkIdSupported() {
        return 'setSinkId' in HTMLMediaElement.prototype;
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioRouter;
} 