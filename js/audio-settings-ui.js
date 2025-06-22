/**
 * 🐙 КРАКЕН: UI Панель настроек аудио устройств
 * Управляет интерфейсом для настройки AudioRouter
 * Часть проекта "Одиссея" - Phase 1
 */

class AudioSettingsUI {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.audioRouter = audioEngine.audioRouter;
        this.panel = null;
        this.overlay = null;
        this.isVisible = false;
        
        this.init();
    }

    /**
     * Инициализация UI панели
     */
    init() {
        this.createPanel();
        this.bindEvents();
        this.updateDevicesList();
        
        console.log('🎛️ AudioSettingsUI инициализирован');
    }

    /**
     * Создание HTML структуры панели
     */
    createPanel() {
        // Создаем overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'audio-settings-overlay';
        this.overlay.addEventListener('click', () => this.hide());

        // Создаем панель
        this.panel = document.createElement('div');
        this.panel.className = 'audio-settings-panel';
        this.panel.innerHTML = this.getPanelHTML();

        // Добавляем в DOM
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.panel);
    }

    /**
     * HTML разметка панели
     */
    getPanelHTML() {
        return `
            <div class="audio-settings-header">
                <h2 class="audio-settings-title">
                    🎛️ Настройки аудио
                </h2>
                <button class="audio-settings-close" type="button">×</button>
            </div>

            <div class="audio-device-section">
                <div class="device-section-title">
                    🔊 Основной выход
                </div>
                <select class="device-selector" id="main-output-selector">
                    <option value="">Выберите устройство...</option>
                </select>
                <div class="volume-control-section">
                    <span class="volume-label">Громкость:</span>
                    <input type="range" 
                           class="volume-slider" 
                           id="main-volume-slider" 
                           min="0" 
                           max="100" 
                           value="100">
                    <span class="volume-value" id="main-volume-value">100%</span>
                </div>
                <div class="device-status">
                    <div class="status-indicator" id="main-status-indicator"></div>
                    <span id="main-status-text">Не подключено</span>
                </div>
            </div>

            <div class="audio-device-section">
                <div class="device-section-title">
                    🎧 Мониторинг
                </div>
                <select class="device-selector" id="monitor-output-selector">
                    <option value="">Выберите устройство...</option>
                </select>
                <div class="volume-control-section">
                    <span class="volume-label">Громкость:</span>
                    <input type="range" 
                           class="volume-slider" 
                           id="monitor-volume-slider" 
                           min="0" 
                           max="100" 
                           value="80">
                    <span class="volume-value" id="monitor-volume-value">80%</span>
                </div>
                <div class="device-status">
                    <div class="status-indicator" id="monitor-status-indicator"></div>
                    <span id="monitor-status-text">Не подключено</span>
                </div>
            </div>

            <div class="audio-settings-actions">
                <button class="audio-action-btn secondary" id="refresh-devices-btn">
                    🔄 Обновить устройства
                </button>
                <button class="audio-action-btn primary" id="apply-settings-btn">
                    ✅ Применить
                </button>
            </div>
        `;
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        // Закрытие панели
        this.panel.querySelector('.audio-settings-close').addEventListener('click', () => this.hide());
        
        // Селекторы устройств
        const mainSelector = this.panel.querySelector('#main-output-selector');
        const monitorSelector = this.panel.querySelector('#monitor-output-selector');
        
        mainSelector.addEventListener('change', (e) => this.onMainDeviceChange(e.target.value));
        monitorSelector.addEventListener('change', (e) => this.onMonitorDeviceChange(e.target.value));
        
        // Слайдеры громкости
        const mainVolumeSlider = this.panel.querySelector('#main-volume-slider');
        const monitorVolumeSlider = this.panel.querySelector('#monitor-volume-slider');
        
        mainVolumeSlider.addEventListener('input', (e) => this.onMainVolumeChange(e.target.value));
        monitorVolumeSlider.addEventListener('input', (e) => this.onMonitorVolumeChange(e.target.value));
        
        // Кнопки действий
        this.panel.querySelector('#refresh-devices-btn').addEventListener('click', () => this.refreshDevices());
        this.panel.querySelector('#apply-settings-btn').addEventListener('click', () => this.applySettings());
        
        // Клавиатурные сокращения
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * Показать панель
     */
    show() {
        if (this.isVisible) return;
        
        this.updateDevicesList();
        this.loadCurrentSettings();
        
        this.overlay.classList.add('show');
        this.panel.classList.add('show');
        this.isVisible = true;
        
        console.log('🎛️ Панель настроек аудио открыта');
    }

    /**
     * Скрыть панель
     */
    hide() {
        if (!this.isVisible) return;
        
        this.overlay.classList.remove('show');
        this.panel.classList.remove('show');
        this.isVisible = false;
        
        console.log('🎛️ Панель настроек аудио закрыта');
    }

    /**
     * Переключить видимость панели
     */
    toggle() {
        console.log('🎛️ Toggle вызван, текущее состояние:', this.isVisible);
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Обновить список устройств
     */
    async updateDevicesList() {
        try {
            console.log('🎛️ Обновление списка устройств...');
            const devices = this.audioRouter.getDevicesList();
            console.log('🎛️ Получено устройств:', devices.length);
            
            const mainSelector = this.panel.querySelector('#main-output-selector');
            const monitorSelector = this.panel.querySelector('#monitor-output-selector');
            
            // Очищаем селекторы
            mainSelector.innerHTML = '<option value="">Выберите устройство...</option>';
            monitorSelector.innerHTML = '<option value="">Выберите устройство...</option>';
            
            // Добавляем устройства в селекторы
            devices.forEach(device => {
                const option1 = document.createElement('option');
                option1.value = device.id;
                option1.textContent = device.label;
                mainSelector.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = device.id;
                option2.textContent = device.label;
                monitorSelector.appendChild(option2);
            });
            
            console.log('🎛️ Список устройств обновлен');
        } catch (error) {
            console.error('🎛️ Ошибка обновления списка устройств:', error);
        }
    }

    /**
     * Загрузить текущие настройки
     */
    loadCurrentSettings() {
        const settings = this.audioRouter.getSettings();
        
        // Устройства
        const mainSelector = this.panel.querySelector('#main-output-selector');
        const monitorSelector = this.panel.querySelector('#monitor-output-selector');
        
        if (settings.mainDeviceId) {
            mainSelector.value = settings.mainDeviceId;
            this.updateDeviceStatus('main', 'connected');
        }
        
        if (settings.monitorDeviceId) {
            monitorSelector.value = settings.monitorDeviceId;
            this.updateDeviceStatus('monitor', 'connected');
        }
        
        // Громкость
        const mainVolumeSlider = this.panel.querySelector('#main-volume-slider');
        const monitorVolumeSlider = this.panel.querySelector('#monitor-volume-slider');
        
        mainVolumeSlider.value = Math.round(settings.mainVolume * 100);
        monitorVolumeSlider.value = Math.round(settings.monitorVolume * 100);
        
        this.updateVolumeDisplay('main', settings.mainVolume);
        this.updateVolumeDisplay('monitor', settings.monitorVolume);
    }

    /**
     * Обработка изменения основного устройства
     */
    async onMainDeviceChange(deviceId) {
        try {
            if (deviceId) {
                await this.audioRouter.setMainDevice(deviceId);
                this.updateDeviceStatus('main', 'connected');
                console.log(`🔊 Основное устройство изменено: ${deviceId}`);
            } else {
                this.updateDeviceStatus('main', 'disconnected');
            }
        } catch (error) {
            console.error('❌ Ошибка при изменении основного устройства:', error);
            this.updateDeviceStatus('main', 'error');
        }
    }

    /**
     * Обработка изменения устройства мониторинга
     */
    async onMonitorDeviceChange(deviceId) {
        try {
            if (deviceId) {
                await this.audioRouter.setMonitorDevice(deviceId);
                this.updateDeviceStatus('monitor', 'connected');
                console.log(`🎧 Устройство мониторинга изменено: ${deviceId}`);
            } else {
                this.updateDeviceStatus('monitor', 'disconnected');
            }
        } catch (error) {
            console.error('❌ Ошибка при изменении устройства мониторинга:', error);
            this.updateDeviceStatus('monitor', 'error');
        }
    }

    /**
     * Обработка изменения основной громкости
     */
    onMainVolumeChange(value) {
        const volume = parseInt(value) / 100;
        this.audioRouter.setMainVolume(volume);
        this.updateVolumeDisplay('main', volume);
    }

    /**
     * Обработка изменения громкости мониторинга
     */
    onMonitorVolumeChange(value) {
        const volume = parseInt(value) / 100;
        this.audioRouter.setMonitorVolume(volume);
        this.updateVolumeDisplay('monitor', volume);
    }

    /**
     * Обновить отображение громкости
     */
    updateVolumeDisplay(type, volume) {
        const valueElement = this.panel.querySelector(`#${type}-volume-value`);
        valueElement.textContent = `${Math.round(volume * 100)}%`;
    }

    /**
     * Обновить статус устройства
     */
    updateDeviceStatus(type, status) {
        const indicator = this.panel.querySelector(`#${type}-status-indicator`);
        const text = this.panel.querySelector(`#${type}-status-text`);
        
        indicator.className = `status-indicator ${status}`;
        
        switch (status) {
            case 'connected':
                text.textContent = 'Подключено';
                break;
            case 'error':
                text.textContent = 'Ошибка подключения';
                break;
            default:
                text.textContent = 'Не подключено';
        }
    }

    /**
     * Обновить устройства
     */
    async refreshDevices() {
        const btn = this.panel.querySelector('#refresh-devices-btn');
        const originalText = btn.textContent;
        
        btn.textContent = '🔄 Обновление...';
        btn.disabled = true;
        
        try {
            await this.updateDevicesList();
            this.loadCurrentSettings();
        } catch (error) {
            console.error('❌ Ошибка при обновлении устройств:', error);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    /**
     * Применить настройки
     */
    applySettings() {
        this.audioRouter.saveSettings();
        this.hide();
        
        // Показываем уведомление
        this.showNotification('✅ Настройки применены');
        
        console.log('✅ Настройки аудио применены');
    }

    /**
     * Показать уведомление
     */
    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4a9eff, #0066cc);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(74, 158, 255, 0.3);
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Уничтожить UI
     */
    destroy() {
        if (this.panel) {
            this.panel.remove();
        }
        if (this.overlay) {
            this.overlay.remove();
        }
        
        console.log('🎛️ AudioSettingsUI уничтожен');
    }
}

// Добавляем CSS анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioSettingsUI;
} 