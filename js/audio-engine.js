/**
 * Audio Engine for Text application
 * Handles audio playback using single streaming HTML5 Audio (Sprint Engine).
 * Phase 1: Reliable instrumental-only playback to eliminate sync issues.
 */

class AudioEngine {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        this.instrumentalGain = this.audioContext.createGain();
        this.vocalsGain = this.audioContext.createGain();
        this.microphoneGain = this.audioContext.createGain();
        
        this.instrumentalGain.connect(this.audioContext.destination);
        this.vocalsGain.connect(this.audioContext.destination);
        this.microphoneGain.connect(this.audioContext.destination);
        
        this._isPlaying = false;
        this.duration = 0;
        this.pauseTime = 0;

        // Dual streaming audio elements (Hybrid Engine)
        this.instrumentalAudio = null;
        this.vocalsAudio = null;

        // Web Audio API sources from <audio> elements
        this.instrumentalSourceNode = null;
        this.vocalsSourceNode = null;
        
        this.activeBlobUrls = [];
        
        this._onTrackLoadedCallbacks = [];
        this._onPositionUpdateCallbacks = [];
        this._positionUpdateInterval = null;
        
        this.loopActive = false;
        this.loopStart = null;
        this.loopEnd = null;
        
        this.microphoneEnabled = false;
        this.microphoneVolume = 0.7;
        this.microphoneSource = null;
        this.microphoneGain.gain.value = this.microphoneVolume;
        
        console.log("🚀 AudioEngine (Hybrid Engine) - Гибридная архитектура восстановлена");
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        // This method sets up the space bar handler
        this.boundSpaceHandler = this._handleSpaceBar.bind(this);
        document.addEventListener('keydown', this.boundSpaceHandler);
        console.log("Space bar handler attached");
    }
    
    _handleSpaceBar(event) {
        // Only handle spacebar when we're not in an input field
        console.log("Key pressed:", event.code);
        
        if (event.code === 'Space' && 
            !event.shiftKey &&
            event.target.tagName !== 'INPUT' && 
            event.target.tagName !== 'TEXTAREA') {
            
            event.preventDefault();
            console.log("Space bar pressed, toggling playback");
            
            // Toggle play/pause
            if (this._isPlaying) {
                this.pause();
            } else if (this.instrumentalAudio) { // Check if a track is loaded
                this.play();
            }
        }
    }
    
    /**
     * Add event listener for track loaded event
     * @param {Function} callback - Function to call when track is loaded
     */
    onTrackLoaded(callback) {
        if (typeof callback === 'function') {
            this._onTrackLoadedCallbacks.push(callback);
        }
    }
    
    /**
     * Add event listener for position update events
     * @param {Function} callback - Function to call with the current position
     */
    onPositionUpdate(callback) {
        if (typeof callback === 'function') {
            this._onPositionUpdateCallbacks.push(callback);
            
            // Start position update interval if not already running
            this._startPositionUpdateInterval();
        }
    }
    
    /**
     * Remove event listener
     * @param {string} eventType - Event type ('trackLoaded' or 'positionUpdate')
     * @param {Function} callback - The callback to remove
     */
    removeEventListener(eventType, callback) {
        if (eventType === 'trackLoaded') {
            this._onTrackLoadedCallbacks = this._onTrackLoadedCallbacks.filter(cb => cb !== callback);
        } else if (eventType === 'positionUpdate') {
            this._onPositionUpdateCallbacks = this._onPositionUpdateCallbacks.filter(cb => cb !== callback);
            
            // Stop interval if no listeners remain
            if (this._onPositionUpdateCallbacks.length === 0) {
                this._stopPositionUpdateInterval();
            }
        }
    }
    
    /**
     * Start interval to update position
     * @private
     */
    _startPositionUpdateInterval() {
        if (this._positionUpdateInterval) return;
        
        this._positionUpdateInterval = setInterval(() => {
            const currentTime = this.getCurrentTime();
            
            this._onPositionUpdateCallbacks.forEach(callback => {
                try {
                    callback(currentTime);
                } catch (e) {
                    console.error('Error in position update callback:', e);
                }
            });
        }, 50); // Update every 50ms
    }
    
    /**
     * Stop position update interval
     * @private
     */
    _stopPositionUpdateInterval() {
        if (this._positionUpdateInterval) {
            clearInterval(this._positionUpdateInterval);
            this._positionUpdateInterval = null;
        }
    }
    
    /**
     * Notify track loaded callbacks
     * @private
     */
    _notifyTrackLoaded() {
        const detail = {
            duration: this.duration,
            hasVocals: false
        };
        
        const event = new CustomEvent('track-loaded', { detail });
        document.dispatchEvent(event);
        
        this._onTrackLoadedCallbacks.forEach(callback => {
            try {
                callback(detail);
            } catch (e) {
                console.error('Error in track loaded callback:', e);
            }
        });
    }
    
    /**
     * Load a track into the audio engine using hybrid streaming.
     * Instrumental loads first for quick start, vocals load in parallel.
     * @param {string} instrumentalUrl - URL to instrumental audio file
     * @param {string} vocalsUrl - URL to vocals audio file
     * @returns {Promise} - Resolves with track info when instrumental is loaded
     */
    async loadTrack(instrumentalUrl, vocalsUrl = null) {
        console.log('🚀 ГИБРИД: Загрузка двойного потока');
        console.time('⏱️ HYBRID_ENGINE_LOAD_TIME');

        this.stop(); // Stop any previous track

        // Create instrumental audio element (priority)
        this.instrumentalAudio = new Audio();
        this.instrumentalAudio.crossOrigin = "anonymous";

        // Track blob URLs for cleanup
        if (instrumentalUrl.startsWith('blob:')) this.activeBlobUrls.push(instrumentalUrl);

        // Create a promise that resolves when the instrumental is ready to play
        const instrumentalReadyPromise = new Promise((resolve, reject) => {
            this.instrumentalAudio.addEventListener('loadedmetadata', () => {
                this.duration = this.instrumentalAudio.duration;
                console.log(`✅ ИНСТРУМЕНТАЛ ГОТОВ! Длительность: ${this.duration.toFixed(2)}с`);
                resolve();
            });
            this.instrumentalAudio.addEventListener('error', (e) => {
                console.error("❌ Ошибка загрузки инструментала:", e);
                reject('Instrumental loading failed');
            });
        });

        // Set source to start loading instrumental
        this.instrumentalAudio.src = instrumentalUrl;

        // Инициализируем hybridEngine с базовыми URL
        this.hybridEngine = {
            instrumentalUrl: instrumentalUrl,
            vocalsUrl: vocalsUrl,
            masterUrl: instrumentalUrl // Временно используем инструментал
        };

        // Load vocals in parallel if provided
        let vocalsReadyPromise = Promise.resolve();
        
            if (vocalsUrl) {
            this.vocalsAudio = new Audio();
            this.vocalsAudio.crossOrigin = "anonymous";
            
            if (vocalsUrl.startsWith('blob:')) this.activeBlobUrls.push(vocalsUrl);

            vocalsReadyPromise = new Promise((resolve, reject) => {
                this.vocalsAudio.addEventListener('loadedmetadata', () => {
                    console.log(`✅ ВОКАЛ ГОТОВ! Длительность: ${this.vocalsAudio.duration.toFixed(2)}с`);
                    resolve();
                });
                this.vocalsAudio.addEventListener('error', (e) => {
                    console.warn("⚠️ Ошибка загрузки вокала:", e);
                    resolve(); // Continue without vocals
                });
            });

            this.vocalsAudio.src = vocalsUrl;
            
            // Создаем мастер-дорожку асинхронно и обновляем URL после создания
            this._createMasterTrack(instrumentalUrl, vocalsUrl).then(masterUrl => {
                console.log('🎚️ МАСТЕР: Обновляем URL после создания микшированной дорожки');
                this.hybridEngine.masterUrl = masterUrl;
                console.log(`🎚️ МАСТЕР URL обновлен: ${masterUrl.substring(0, 50)}...`);
            }).catch(error => {
                console.error('❌ МАСТЕР: Ошибка создания, используем инструментал:', error);
            });
        }

        // Wait for instrumental to be ready (vocals can load in background)
        await instrumentalReadyPromise;

        // Connect to Web Audio API
        if (!this.instrumentalSourceNode) {
            this.instrumentalSourceNode = this.audioContext.createMediaElementSource(this.instrumentalAudio);
            this.instrumentalSourceNode.connect(this.instrumentalGain);
        }

        // Connect vocals when ready (non-blocking)
        if (vocalsUrl && this.vocalsAudio) {
            vocalsReadyPromise.then(() => {
                if (!this.vocalsSourceNode && this.vocalsAudio) {
                    this.vocalsSourceNode = this.audioContext.createMediaElementSource(this.vocalsAudio);
                    this.vocalsSourceNode.connect(this.vocalsGain);
                    console.log('🎤 ВОКАЛ ПОДКЛЮЧЕН к аудио-контексту');
                }
            });
        }

        console.timeEnd('⏱️ HYBRID_ENGINE_LOAD_TIME');
        console.log('🎯 ГИБРИД: Рассинхронизация устранена!');

            this._notifyTrackLoaded();
            
            return {
            duration: this.duration,
            hasVocals: !!vocalsUrl
        };
    }
    
    /**
     * Создает мастер-дорожку путем микширования инструментала и вокала
     * @param {string} instrumentalUrl - URL инструментальной дорожки
     * @param {string} vocalsUrl - URL вокальной дорожки
     * @returns {Promise<string>} - URL созданной мастер-дорожки
     * @private
     */
    async _createMasterTrack(instrumentalUrl, vocalsUrl) {
        try {
            console.log('🎚️ МАСТЕР: Создание микшированной дорожки...');
            console.log(`🎚️ МАСТЕР: Инструментал URL: ${instrumentalUrl.substring(0, 50)}...`);
            console.log(`🎚️ МАСТЕР: Вокал URL: ${vocalsUrl.substring(0, 50)}...`);
            
            // Загружаем оба аудиофайла как ArrayBuffer
            console.log('🎚️ МАСТЕР: Загружаем аудиофайлы...');
            const [instrumentalResponse, vocalsResponse] = await Promise.all([
                fetch(instrumentalUrl),
                fetch(vocalsUrl)
            ]);
            
            console.log('🎚️ МАСТЕР: Конвертируем в ArrayBuffer...');
            const [instrumentalArrayBuffer, vocalsArrayBuffer] = await Promise.all([
                instrumentalResponse.arrayBuffer(),
                vocalsResponse.arrayBuffer()
            ]);
            
            console.log(`🎚️ МАСТЕР: Инструментал размер: ${instrumentalArrayBuffer.byteLength} байт`);
            console.log(`🎚️ МАСТЕР: Вокал размер: ${vocalsArrayBuffer.byteLength} байт`);
            
            // Декодируем аудиоданные
            console.log('🎚️ МАСТЕР: Декодируем аудиоданные...');
            const [instrumentalBuffer, vocalsBuffer] = await Promise.all([
                this.audioContext.decodeAudioData(instrumentalArrayBuffer.slice()),
                this.audioContext.decodeAudioData(vocalsArrayBuffer.slice())
            ]);
            
            console.log(`🎚️ МАСТЕР: Инструментал - каналов: ${instrumentalBuffer.numberOfChannels}, длина: ${instrumentalBuffer.length}, частота: ${instrumentalBuffer.sampleRate}Hz`);
            console.log(`🎚️ МАСТЕР: Вокал - каналов: ${vocalsBuffer.numberOfChannels}, длина: ${vocalsBuffer.length}, частота: ${vocalsBuffer.sampleRate}Hz`);
            
            // Создаем новый буфер для мастер-дорожки
            const masterBuffer = this.audioContext.createBuffer(
                Math.max(instrumentalBuffer.numberOfChannels, vocalsBuffer.numberOfChannels),
                Math.max(instrumentalBuffer.length, vocalsBuffer.length),
                instrumentalBuffer.sampleRate
            );
            
            console.log(`🎚️ МАСТЕР: Создан буфер - каналов: ${masterBuffer.numberOfChannels}, длина: ${masterBuffer.length}`);
            
            // Микшируем каналы
            console.log('🎚️ МАСТЕР: Начинаем микширование каналов...');
            for (let channel = 0; channel < masterBuffer.numberOfChannels; channel++) {
                const masterData = masterBuffer.getChannelData(channel);
                const instrumentalData = instrumentalBuffer.getChannelData(Math.min(channel, instrumentalBuffer.numberOfChannels - 1));
                const vocalsData = vocalsBuffer.getChannelData(Math.min(channel, vocalsBuffer.numberOfChannels - 1));
                
                for (let i = 0; i < masterData.length; i++) {
                    const instrumentalSample = i < instrumentalData.length ? instrumentalData[i] : 0;
                    const vocalsSample = i < vocalsData.length ? vocalsData[i] : 0;
                    
                    // Микшируем с небольшим сжатием для предотвращения клиппинга
                    masterData[i] = (instrumentalSample + vocalsSample) * 0.7;
                }
            }
            
            console.log('🎚️ МАСТЕР: Микширование завершено, конвертируем в blob...');
            
            // Конвертируем обратно в blob
            const masterBlob = await this._audioBufferToBlob(masterBuffer);
            const masterUrl = URL.createObjectURL(masterBlob);
            
            // Добавляем в список для очистки
            if (masterUrl.startsWith('blob:')) this.activeBlobUrls.push(masterUrl);
            
            console.log(`🎚️ МАСТЕР: Микшированная дорожка создана! URL: ${masterUrl.substring(0, 50)}...`);
            console.log(`🎚️ МАСТЕР: Размер blob: ${masterBlob.size} байт`);
            
            return masterUrl;
            
        } catch (error) {
            console.error('❌ МАСТЕР: Ошибка создания микшированной дорожки:', error);
            console.error('❌ МАСТЕР: Stack trace:', error.stack);
            return instrumentalUrl; // Возвращаем инструментал как fallback
        }
    }
    
    /**
     * Конвертирует AudioBuffer в Blob
     * @param {AudioBuffer} audioBuffer - буфер для конвертации
     * @returns {Promise<Blob>} - результирующий blob
     * @private
     */
    async _audioBufferToBlob(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;
        
        // Создаем WAV заголовок
        const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
        const view = new DataView(arrayBuffer);
        
        // WAV заголовок
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * numberOfChannels * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numberOfChannels * 2, true);
        
        // Записываем аудиоданные
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
                view.setInt16(offset, sample * 0x7FFF, true);
                offset += 2;
            }
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
    
    /**
     * Get audio data (not applicable for streaming version, returns null)
     */
    getAudioData(useVocals = true) {
        console.warn('getAudioData is not supported in streaming mode.');
        return null;
    }
    
    /**
     * Get audio buffer (not applicable for streaming version, returns null)
     */
    getAudioBuffer(useVocals = true) {
        console.warn('getAudioBuffer is not supported in streaming mode.');
        return null;
    }
    
    hasVocals() {
        // Phase 1: Always false since we only load instrumental
        return false;
    }
    
    /**
     * Set loop points for playback
     * @param {number} startTime - start time in seconds
     * @param {number} endTime - end time in seconds
     */
    setLoop(startTime, endTime) {
        try {
            // Проверяем валидность входных данных
            if (isNaN(startTime) || isNaN(endTime) || startTime < 0 || endTime <= startTime) {
                console.warn(`AudioEngine: Invalid loop points: ${startTime}s - ${endTime}s`);
            return false;
        }
        
            // Ограничиваем точки зацикливания длительностью трека
            const safeStartTime = Math.max(0, Math.min(startTime, this.duration));
            const safeEndTime = Math.min(endTime, this.duration);
            
            console.log(`AudioEngine: Loop points set to ${safeStartTime.toFixed(2)}s - ${safeEndTime.toFixed(2)}s`);
            
            // Устанавливаем точки зацикливания
            this.loopStart = safeStartTime;
            this.loopEnd = safeEndTime;
            
            // Сбрасываем счетчик ошибок
            this.loopErrors = 0;
            
            // Устанавливаем обработчик для проверки зацикливания
        this._setupLoopCheck();
        
            // Отправляем событие об установке зацикливания
            const event = new CustomEvent('loop-set', {
                detail: {
                    startTime: safeStartTime,
                    endTime: safeEndTime
                }
            });
            document.dispatchEvent(event);
        
        return true;
        } catch (error) {
            console.error('AudioEngine: Error setting loop:', error);
            return false;
        }
    }
    
    /**
     * Очищает точки зацикливания
     */
    clearLoop() {
        console.log('AudioEngine: Clearing loop');
        
        try {
            // Сбрасываем точки зацикливания
            this.loopStart = null;
            this.loopEnd = null;
            
            // Если есть активные источники, обновляем их состояние
            if (this.instrumentalSourceNode) {
                this.instrumentalSourceNode.disconnect();
            }
            
            // Сбрасываем счетчики ошибок
            this.loopErrors = 0;
            
            // Отправляем событие о сбросе зацикливания
            const event = new CustomEvent('loop-cleared', {
                detail: {
                    time: this.getCurrentTime()
                }
            });
            document.dispatchEvent(event);
            
            return true;
        } catch (error) {
            console.error('AudioEngine: Error clearing loop:', error);
            return false;
        }
    }
    
    /**
     * Sets up the loop check interval
     * @private
     */
    _setupLoopCheck() {
        if (this._loopCheckInterval) {
            clearInterval(this._loopCheckInterval);
            this._loopCheckInterval = null;
        }
        
        // Проверяем состояние цикла каждые 50 мс
        this._loopCheckInterval = setInterval(() => {
            if (!this._isPlaying) {
                return;
            }
            
            try {
                const currentTime = this.getCurrentTime();
                
                // Пропускаем проверку, если недавно был выполнен переход
                if (this._lastSeekTime && (Date.now() - this._lastSeekTime) < 300) {
                    return;
                }
                
                // Если вышли за пределы цикла, возвращаемся в начало
                if (currentTime >= this.loopEnd - 0.01) {
                    // Проверка на null перед вызовом toFixed
                    const currentTimeStr = currentTime ? currentTime.toFixed(2) : '0.00';
                    const loopStartStr = this.loopStart ? this.loopStart.toFixed(2) : '0.00';
                    
                    console.log(`Loop triggered at ${currentTimeStr}s, returning to ${loopStartStr}s`);
                    this._lastSeekTime = Date.now();
                    this.setCurrentTime(this.loopStart);
                    
                    // Отправляем событие о срабатывании цикла
                    this._dispatchLoopEvent(currentTime, this.loopStart);
                }
            } catch (error) {
                console.error('AudioEngine: Error in loop check:', error);
            }
        }, 50);
    }
    
    /**
     * Отправляет событие о срабатывании цикла
     * @param {number} fromTime - Время до зацикливания
     * @param {number} toTime - Время после зацикливания
     * @private
     */
    _dispatchLoopEvent(fromTime, toTime) {
        const event = new CustomEvent('loopcompleted', {
            detail: {
                previousTime: fromTime,
                newTime: toTime,
                loopStart: this.loopStart,
                loopEnd: this.loopEnd
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Play the current track (instrumental + vocals in sync)
     * @returns {Promise} - Resolves when playback starts
     */
    async play() {
        if (!this.instrumentalAudio) {
            console.warn('⚠️ Нет загруженного трека');
            return;
        }
        
        try {
            // Ensure audio context is resumed
        if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Play instrumental first (master timing)
            await this.instrumentalAudio.play();
            console.log('▶️ ИНСТРУМЕНТАЛ: Воспроизведение начато');

            // Play vocals in sync if available
            if (this.vocalsAudio && this.vocalsAudio.readyState >= 3) {
                try {
                    // Sync vocals to instrumental timing
                    this.vocalsAudio.currentTime = this.instrumentalAudio.currentTime;
                    await this.vocalsAudio.play();
                    console.log('🎤 ВОКАЛ: Синхронизирован и воспроизводится');
                } catch (vocalsError) {
                    console.warn('⚠️ Вокал не может быть воспроизведен:', vocalsError);
                }
            }

            this.isPlaying = true;
            this._notifyPlaybackStateChanged();
            
        } catch (error) {
            console.error('❌ Ошибка воспроизведения:', error);
            throw error;
        }
    }
    
    /**
     * Pause the current track (both streams)
     */
    pause() {
        if (this.instrumentalAudio) {
            this.instrumentalAudio.pause();
            console.log('⏸️ ИНСТРУМЕНТАЛ: Пауза');
        }
        
        if (this.vocalsAudio) {
            this.vocalsAudio.pause();
            console.log('⏸️ ВОКАЛ: Пауза');
        }

        this.isPlaying = false;
        this._notifyPlaybackStateChanged();
    }
    
    /**
     * Stop playback and reset position
     */
    stop() {
        if (this.instrumentalAudio) {
            this.instrumentalAudio.pause();
            this.instrumentalAudio.currentTime = 0;
        }
        
        if (this.vocalsAudio) {
            this.vocalsAudio.pause();
            this.vocalsAudio.currentTime = 0;
        }

        this.isPlaying = false;
        this._notifyPlaybackStateChanged();
        console.log('⏹️ ГИБРИД: Остановлен и сброшен');
    }
    
    /**
     * Get current playback position in seconds
     * @returns {number} Current time in seconds
     */
    getCurrentTime() {
        return this.instrumentalAudio ? this.instrumentalAudio.currentTime : 0;
    }
    
    /**
     * Set playback position
     * @param {number} time - Time in seconds
     */
    setCurrentTime(time) {
        if (this.instrumentalAudio) {
            this.instrumentalAudio.currentTime = time;
            
            // Sync vocals if available
            if (this.vocalsAudio) {
                this.vocalsAudio.currentTime = time;
            }
            
            console.log(`⏰ СИНХРО: Позиция установлена ${time.toFixed(2)}с`);
        }
    }
    
    _dispatchPositionChangedEvent(previousTime, newTime) {
            const event = new CustomEvent('audio-position-changed', {
                detail: {
                    previousTime: previousTime,
                newTime: newTime
                }
            });
            document.dispatchEvent(event);
        
        // Добавляем стандартное событие timeupdate для лучшей совместимости
        const timeupdateEvent = new CustomEvent('timeupdate', {
            detail: {
                currentTime: newTime
        }
        });
        document.dispatchEvent(timeupdateEvent);
    }
    
    // Make isPlaying available as a property for compatibility
    get isPlaying() {
        return this._isPlaying === true;
    }
    
    set isPlaying(value) {
        this._isPlaying = value === true;
        console.log(`isPlaying property set to: ${this._isPlaying}`);
    }
    
    /**
     * Set vocals volume (0.0 to 1.0)
     * @param {number} volume - Volume level (0.0 = muted, 1.0 = full)
     */
    setVocalsVolume(volume) {
        if (this.vocalsGain) {
            this.vocalsGain.gain.value = Math.max(0, Math.min(1, volume));
            console.log(`🎤 ВОКАЛ: Громкость установлена ${(volume * 100).toFixed(0)}%`);
        }
    }
    
    /**
     * Set instrumental volume (0.0 to 1.0)
     * @param {number} volume - Volume level (0.0 = muted, 1.0 = full)
     */
    setInstrumentalVolume(volume) {
        if (this.instrumentalGain) {
            this.instrumentalGain.gain.value = Math.max(0, Math.min(1, volume));
            console.log(`🎵 ИНСТРУМЕНТАЛ: Громкость установлена ${(volume * 100).toFixed(0)}%`);
        }
    }
    
    /**
     * Update the play/pause button text based on current state
     */
    _updatePlayPauseButton() {
        const playPauseButton = document.getElementById('play-pause');
        if (playPauseButton) {
            playPauseButton.textContent = this._isPlaying ? 'Pause' : 'Play';
            if(this.instrumentalAudio){
                 playPauseButton.disabled = false;
                } else {
                 playPauseButton.disabled = true;
            }
        }
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        this.stop();
        this.removeEventListener('keydown', this.boundSpaceHandler);
        
        // Revoke old blob URLs
        this.activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
        this.activeBlobUrls = [];
        
        // Disconnect media element source
        if (this.instrumentalSourceNode) {
            this.instrumentalSourceNode.disconnect();
        }
        this.instrumentalAudio = null;
        this.instrumentalSourceNode = null;
        
        console.log('🧹 СПРИНТЕР: Ресурсы очищены');
    }

    /**
     * Seek to a specific time in the track
     * @param {number} time - The time to seek to in seconds
     */
    seekTo(time) {
        this.setCurrentTime(time);
    }

    /**
     * Resets the audio engine to its initial state
     */
    reset() {
        console.log('AudioEngine: Starting reset...');
        this.cleanup(); // Use cleanup to stop and disconnect
        
        this._isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.duration = 0;
        
        this.loopActive = false;
        this.loopStart = null;
        this.loopEnd = null;

        console.log('AudioEngine: Reset completed successfully');
    }

    /**
     * Caching logic is not used in streaming mode. These are stubs.
     */
    getCacheStats() {
        console.warn('Caching is not used in streaming mode.');
        return { hits: 0, misses: 0, size: 0 };
    }

    clearCache() {
        console.warn('Caching is not used in streaming mode.');
    }

    _notifyPlaybackStateChanged() {
        // Notify listeners about playback state changes
        const event = new CustomEvent('playback-state-changed', {
            detail: {
                isPlaying: this.isPlaying,
                currentTime: this.getCurrentTime(),
                duration: this.duration
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Set playback rate (speed) without changing pitch
     * @param {number} rate - Playback rate (1.0 = normal, 0.5 = half speed, 2.0 = double speed)
     */
    setPlaybackRate(rate) {
        if (rate <= 0) {
            console.warn('AudioEngine: Playback rate must be positive');
            return;
        }
        
        console.log(`🎵 AudioEngine: Установка скорости воспроизведения: ${(rate * 100).toFixed(0)}%`);
        
        // Apply to both instrumental and vocal tracks
        if (this.instrumentalAudio) {
            this.instrumentalAudio.playbackRate = rate;
        }
        
        if (this.vocalsAudio) {
            this.vocalsAudio.playbackRate = rate;
        }
    }
    
    /**
     * Get current playback rate
     * @returns {number} Current playback rate
     */
    getPlaybackRate() {
        if (this.instrumentalAudio) {
            return this.instrumentalAudio.playbackRate;
        }
        return 1.0;
    }
}

// Create global audio engine instance
const audioEngine = new AudioEngine(); 
window.audioEngine = audioEngine; 