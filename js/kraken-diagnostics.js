/**
 * 🐙 КРАКЕН: Система диагностики и отладки
 * Помогает понять как работает AudioRouter и настройки аудио
 */

class KrakenDiagnostics {
    constructor() {
        this.isEnabled = true;
        this.logHistory = [];
        this.maxLogHistory = 100;
        
        this.init();
    }

    init() {
        this.createDiagnosticsPanel();
        this.setupKeyboardShortcut();
        this.interceptAudioRouterLogs();
        
        console.log('🔍 КРАКЕН: Диагностика активирована (Ctrl+Shift+D для открытия)');
    }

    /**
     * Создание панели диагностики
     */
    createDiagnosticsPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'kraken-diagnostics';
        this.panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            height: 500px;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #4a9eff;
            border-radius: 10px;
            color: #fff;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            z-index: 10000;
            display: none;
            flex-direction: column;
        `;

        this.panel.innerHTML = `
            <div style="padding: 10px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: #4a9eff;">🐙 КРАКЕН Диагностика</h3>
                <button id="close-diagnostics" style="background: none; border: none; color: #fff; font-size: 16px; cursor: pointer;">×</button>
            </div>
            
            <div style="padding: 10px; border-bottom: 1px solid #333;">
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <button id="test-audio-devices" style="background: #4a9eff; border: none; color: #fff; padding: 5px 10px; border-radius: 5px; cursor: pointer;">Тест устройств</button>
                    <button id="test-audio-routing" style="background: #4a9eff; border: none; color: #fff; padding: 5px 10px; border-radius: 5px; cursor: pointer;">Тест роутинга</button>
                    <button id="clear-logs" style="background: #666; border: none; color: #fff; padding: 5px 10px; border-radius: 5px; cursor: pointer;">Очистить</button>
                </div>
                
                <div id="audio-status" style="font-size: 11px; color: #aaa;">
                    Статус: Загрузка...
                </div>
            </div>
            
            <div id="diagnostics-log" style="flex: 1; padding: 10px; overflow-y: auto; background: rgba(0, 0, 0, 0.5);">
                <div style="color: #4a9eff;">🐙 КРАКЕН готов к диагностике...</div>
            </div>
        `;

        document.body.appendChild(this.panel);
        this.bindPanelEvents();
    }

    /**
     * Привязка событий панели
     */
    bindPanelEvents() {
        this.panel.querySelector('#close-diagnostics').addEventListener('click', () => this.hide());
        this.panel.querySelector('#test-audio-devices').addEventListener('click', () => this.testAudioDevices());
        this.panel.querySelector('#test-audio-routing').addEventListener('click', () => this.testAudioRouting());
        this.panel.querySelector('#clear-logs').addEventListener('click', () => this.clearLogs());
    }

    /**
     * Настройка клавиатурного сокращения
     */
    setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Перехват логов AudioRouter
     */
    interceptAudioRouterLogs() {
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        console.log = (...args) => {
            originalLog.apply(console, args);
            this.addLog('INFO', args.join(' '));
        };

        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.addLog('WARN', args.join(' '));
        };

        console.error = (...args) => {
            originalError.apply(console, args);
            this.addLog('ERROR', args.join(' '));
        };
    }

    /**
     * Добавление лога
     */
    addLog(level, message) {
        if (!this.isEnabled) return;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            level,
            message
        };

        this.logHistory.push(logEntry);
        
        // Ограничиваем историю
        if (this.logHistory.length > this.maxLogHistory) {
            this.logHistory.shift();
        }

        // Обновляем отображение если панель открыта
        if (this.panel && this.panel.style.display !== 'none') {
            this.updateLogDisplay();
        }
    }

    /**
     * Обновление отображения логов
     */
    updateLogDisplay() {
        const logContainer = this.panel.querySelector('#diagnostics-log');
        
        logContainer.innerHTML = this.logHistory
            .filter(entry => entry.message.includes('🐙') || entry.message.includes('AudioRouter') || entry.message.includes('КРАКЕН'))
            .slice(-20) // Показываем последние 20 записей
            .map(entry => {
                const color = {
                    'INFO': '#4a9eff',
                    'WARN': '#ffa500',
                    'ERROR': '#ff4444'
                }[entry.level] || '#fff';

                return `<div style="color: ${color}; margin-bottom: 2px;">
                    [${entry.timestamp}] ${entry.level}: ${entry.message}
                </div>`;
            })
            .join('');

        // Прокрутка вниз
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    /**
     * Тест аудио устройств
     */
    async testAudioDevices() {
        this.addLog('INFO', '🔍 Начинаем тест аудио устройств...');
        
        try {
            // Проверяем доступность AudioRouter
            if (!window.audioEngine || !window.audioEngine.audioRouter) {
                this.addLog('ERROR', '❌ AudioRouter не найден!');
                return;
            }

            const audioRouter = window.audioEngine.audioRouter;
            this.addLog('INFO', `✅ AudioRouter найден, статус: ${audioRouter.isInitialized ? 'инициализирован' : 'не инициализирован'}`);

            // Получаем список устройств
            const devices = await audioRouter.getAvailableDevices();
            this.addLog('INFO', `📱 Найдено устройств: ${devices.length}`);
            
            devices.forEach((device, index) => {
                this.addLog('INFO', `  ${index + 1}. ${device.label || 'Без названия'} (${device.deviceId.substring(0, 8)}...)`);
            });

            // Проверяем текущие настройки
            const settings = audioRouter.getSettings();
            this.addLog('INFO', `⚙️ Основное устройство: ${settings.mainDeviceId || 'не выбрано'}`);
            this.addLog('INFO', `⚙️ Устройство мониторинга: ${settings.monitorDeviceId || 'не выбрано'}`);
            this.addLog('INFO', `🔊 Основная громкость: ${Math.round(settings.mainVolume * 100)}%`);
            this.addLog('INFO', `🎧 Громкость мониторинга: ${Math.round(settings.monitorVolume * 100)}%`);

        } catch (error) {
            this.addLog('ERROR', `❌ Ошибка тестирования: ${error.message}`);
        }
    }

    /**
     * Тест аудио роутинга
     */
    async testAudioRouting() {
        this.addLog('INFO', '🔍 Начинаем тест аудио роутинга...');
        
        try {
            const audioEngine = window.audioEngine;
            if (!audioEngine) {
                this.addLog('ERROR', '❌ AudioEngine не найден!');
                return;
            }

            this.addLog('INFO', `🎵 AudioEngine статус: ${audioEngine.isPlaying ? 'играет' : 'остановлен'}`);
            this.addLog('INFO', `⏱️ Текущее время: ${audioEngine.getCurrentTime().toFixed(2)}с`);
            this.addLog('INFO', `📏 Длительность: ${audioEngine.duration.toFixed(2)}с`);

            // Проверяем подключение к роутеру
            const audioRouter = audioEngine.audioRouter;
            if (audioRouter && audioRouter.isInitialized) {
                this.addLog('INFO', '✅ Роутер подключен к движку');
                
                // Тестируем мастер-микс
                if (audioEngine.masterMix) {
                    this.addLog('INFO', '✅ Мастер-микс создан');
                } else {
                    this.addLog('WARN', '⚠️ Мастер-микс не найден');
                }
            } else {
                this.addLog('WARN', '⚠️ Роутер не подключен к движку');
            }

        } catch (error) {
            this.addLog('ERROR', `❌ Ошибка тестирования роутинга: ${error.message}`);
        }
    }

    /**
     * Обновление статуса
     */
    updateStatus() {
        if (!this.panel) return;

        const statusElement = this.panel.querySelector('#audio-status');
        const audioEngine = window.audioEngine;
        
        let status = 'AudioEngine: ';
        if (audioEngine) {
            status += `✅ Активен | `;
            status += `AudioRouter: ${audioEngine.audioRouter ? '✅' : '❌'} | `;
            status += `Играет: ${audioEngine.isPlaying ? '▶️' : '⏸️'}`;
        } else {
            status += '❌ Не найден';
        }

        statusElement.textContent = status;
    }

    /**
     * Показать панель
     */
    show() {
        this.panel.style.display = 'flex';
        this.updateLogDisplay();
        this.updateStatus();
        
        // Обновляем статус каждые 2 секунды
        this.statusInterval = setInterval(() => this.updateStatus(), 2000);
    }

    /**
     * Скрыть панель
     */
    hide() {
        this.panel.style.display = 'none';
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
    }

    /**
     * Переключить панель
     */
    toggle() {
        if (this.panel.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    }

    /**
     * Очистить логи
     */
    clearLogs() {
        this.logHistory = [];
        this.updateLogDisplay();
        this.addLog('INFO', '🧹 Логи очищены');
    }
}

// Автоматическая инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.krakenDiagnostics = new KrakenDiagnostics();
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KrakenDiagnostics;
} 