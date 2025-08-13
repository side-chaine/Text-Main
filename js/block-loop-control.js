/**
 * BlockLoopControl - Компонент для зацикливания блоков в режиме репетиции
 * Создает кнопку Loop рядом с активным блоком и управляет зацикливанием
 */

class BlockLoopControl {
    constructor(audioEngine, lyricsDisplay, markerManager) {
        this.audioEngine = audioEngine;
        this.lyricsDisplay = lyricsDisplay;
        this.markerManager = markerManager;
        
        // Состояние компонента
        this.isActive = false;
        this.isLooping = false;
        this.currentLoopBlock = null;
        this.loopStartTime = null; // null вместо 0 - чтобы отличать неустановленное значение
        this.loopEndTime = null;   // null вместо 0 - чтобы отличать неустановленное значение
        this.lastJumpTime = 0;      // Защита от частых прыжков
        this.diagnosticCounter = 0;  // Счетчик для логирования
        
        // 🎯 НОВЫЙ ФЛАГ: Отслеживание пользовательских границ
        this.hasUserDefinedBoundaries = false;
        this.userBoundaries = null; // Сохраняем пользовательские границы
        
        // Состояние перемотки для предотвращения race condition
        this.isSeekingInProgress = false;
        this.seekStartTime = null;
        
        // Буферное время после перемотки для игнорирования изменений блоков
        this.lastSeekTime = 0;
        this.seekStabilizationBuffer = 500; // 500мс буфер после перемотки
        
        // Флаг для точной коррекции
        this.isCorrectionInProgress = false;
        this.correctionStartTime = null;
        
        // ⚡ НОВЫЕ ФЛАГИ ДЛЯ УСИЛЕННОЙ НАДЕЖНОСТИ ЛУПА
        this.isPreJumpReady = false; // Флаг готовности к упреждающему прыжку
        this.seekTimeouts = null; // Массив timeouts для очистки при успешном seek
        
        // UI элементы
        this.loopButton = null;
        this.currentBlockElement = null;
        
        // Инициализируем DragBoundaryController
        this.dragBoundaryController = new DragBoundaryController(this, this.lyricsDisplay);
        
        // Привязываем контекст для обработчиков
        this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
        this.handleBlockChange = this.handleBlockChange.bind(this);
        this.handleLoopSeek = this.handleLoopSeek.bind(this);
        
        console.log('🎛️ BlockLoopControl initialized with seeking flag and seek buffer');
    }
    
    /**
     * Активирует компонент (только в режиме репетиции)
     */
    activate() {
        if (this.isActive) return;
        
        this.isActive = true;
        console.log('BlockLoopControl: Активирован');
        
        // Настраиваем обработчики событий
        this._setupEventListeners();
        
        // Создаем кнопку для текущего активного блока
        this._createLoopButtonForCurrentBlock();
        
        // Запускаем систему автоматического восстановления
        this._startAutoRecoverySystem();
    }
    
    /**
     * Деактивирует компонент
     */
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        console.log('BlockLoopControl: Деактивирован');
        
        // Останавливаем зацикливание если активно
        if (this.isLooping) {
            this.stopLooping();
        }
        
        // Останавливаем систему автоматического восстановления
        this._stopAutoRecoverySystem();
        
        // Деактивируем DragBoundaryController
        if (this.dragBoundaryController) {
            this.dragBoundaryController.deactivate();
        }
        
        // Убираем кнопку
        this._removeLoopButton();
        
        // Отписываемся от событий
        this._removeEventListeners();
    }
    
    /**
     * Настраивает обработчики событий
     * @private
     */
    _setupEventListeners() {
        // Подписываемся на обновления позиции от AudioEngine
            this.audioEngine.onPositionUpdate(this.handleTimeUpdate);
        
        // Подписываемся на событие завершения перемотки
        if (this.audioEngine.audioElement) {
            this.audioEngine.audioElement.addEventListener('seeked', this.handleLoopSeek);
            console.log('🔔 SEEKED event listener subscribed');
        }
        
        // Слушаем изменения активного блока
        document.addEventListener('active-line-changed', this.handleBlockChange);

        // Ранний хук после рендера текста (если событие используется в системе)
        try {
            document.addEventListener('lyrics-rendered', () => {
                if (!this.isActive) return;
                try {
                    this._createLoopButtonForCurrentBlock();
                } catch (e) {
                    console.warn('BlockLoopControl: Не удалось создать Loop-кнопку по событию lyrics-rendered', e);
                }
            });
        } catch (e) {
            // безопасно игнорируем, если события нет в системе
        }
    }
    
    /**
     * Убирает обработчики событий
     * @private
     */
    _removeEventListeners() {
        // Убираем колбэк обновления позиции из AudioEngine
        if (this.audioEngine && this.audioEngine._onPositionUpdateCallbacks) {
            const callbackIndex = this.audioEngine._onPositionUpdateCallbacks.indexOf(this.handleTimeUpdate);
            if (callbackIndex > -1) {
                this.audioEngine._onPositionUpdateCallbacks.splice(callbackIndex, 1);
            }
        }
        
        // Убираем слушатель события seeked
        if (this.audioEngine && this.audioEngine.audioElement) {
            this.audioEngine.audioElement.removeEventListener('seeked', this.handleLoopSeek);
            console.log('🔔 SEEKED event listener removed');
        }
        
        document.removeEventListener('active-line-changed', this.handleBlockChange);
    }
    
    /**
     * Создает кнопку Loop для текущего активного блока
     * @private
     */
    _createLoopButtonForCurrentBlock() {
        console.log('BlockLoopControl: _createLoopButtonForCurrentBlock called');
        
        if (!this.lyricsDisplay) {
            console.log('BlockLoopControl: lyricsDisplay not available');
            return;
        }
        
        console.log('BlockLoopControl: lyricsDisplay.currentActiveBlock:', this.lyricsDisplay.currentActiveBlock);
        console.log('BlockLoopControl: lyricsDisplay.textBlocks:', this.lyricsDisplay.textBlocks);
        
        // В режиме репетиции получаем активный блок напрямую
        if (this.lyricsDisplay.currentActiveBlock) {
            const currentBlock = this.lyricsDisplay.currentActiveBlock;
            console.log('BlockLoopControl: Создаем кнопку для активного блока репетиции:', currentBlock.name);
            this._createLoopButton(currentBlock);
            return;
        }
        
        // В других режимах используем textBlocks
        if (!this.lyricsDisplay.textBlocks) {
            console.log('BlockLoopControl: textBlocks not available');
            return;
        }
        
        // Находим текущий активный блок
        const activeLineIndex = this.lyricsDisplay.activeLineIndex;
        console.log('BlockLoopControl: activeLineIndex:', activeLineIndex);
        
        if (activeLineIndex === null || activeLineIndex === undefined) {
            console.log('BlockLoopControl: activeLineIndex is null/undefined');
            return;
        }
        
        const currentBlock = this._findBlockByLineIndex(activeLineIndex);
        if (!currentBlock) {
            console.log('BlockLoopControl: currentBlock not found for line', activeLineIndex);
            return;
        }
        
        console.log('BlockLoopControl: Создаем кнопку для блока:', currentBlock.name);
        this._createLoopButton(currentBlock);
    }
    
    /**
     * Находит блок по индексу строки
     * @param {number} lineIndex - индекс строки
     * @returns {Object|null} - найденный блок или null
     * @private
     */
    _findBlockByLineIndex(lineIndex) {
        if (!this.lyricsDisplay || !this.lyricsDisplay.textBlocks) return null;
        
        let currentLineCount = 0;
        
        for (const block of this.lyricsDisplay.textBlocks) {
            const blockEndLine = currentLineCount + block.lines.length - 1;
            
            if (lineIndex >= currentLineCount && lineIndex <= blockEndLine) {
                return {
                    ...block,
                    startLineIndex: currentLineCount,
                    endLineIndex: blockEndLine
                };
            }
            
            currentLineCount += block.lines.length;
        }
        
        return null;
    }
    
    /**
     * Создает кнопку Loop для блока
     * @param {Object} block - блок для зацикливания
     * @private
     */
    _createLoopButton(block) {
        console.log('BlockLoopControl: _createLoopButton called for block:', block.name);
        
        // Убираем старую кнопку если есть
        this._removeLoopButton();
        
        // Находим DOM элемент блока
        const blockElement = this._findBlockDOMElement(block);
        console.log('BlockLoopControl: blockElement found:', !!blockElement);
        
        if (!blockElement) {
            console.log('BlockLoopControl: DOM element for block not found');
            return;
        }
        
        // Создаем кнопку
        this.loopButton = document.createElement('button');
        this.loopButton.className = 'block-loop-btn';
        this.loopButton.innerHTML = 'Loop'; // Текстовая иконка вместо эмодзи
        this.loopButton.title = `Зациклить блок "${block.name}"`;
 
         // Обработчик клика
         this.loopButton.addEventListener('click', () => {
             this.toggleLooping(block);
         });
 
        // Кнопка «плюс» для добавления следующего блока в луп (создаём скрытой)
        this.plusButton = document.createElement('button');
        this.plusButton.className = 'block-loop-plus-btn hidden';
        this.plusButton.innerHTML = '+';
        this.plusButton.title = 'Добавить следующий блок в луп';
        this.plusButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this._tryAttachNextBlockToLoop();
        });

        // Добавляем кнопку рядом с блоком
        this._positionLoopButton(blockElement);
        // Позиционируем плюс по центру под Loop и прячем до активации лупа
        this._positionPlusButton(blockElement);
 
         this.currentBlockElement = blockElement;
         this.currentLoopBlock = block;
        
        // 🔧 ИСПРАВЛЕНИЕ: Активируем drag boundaries БЕЗ сохраненных границ
        // Каждый новый блок получает границы по умолчанию (весь блок)
        if (this.dragBoundaryController && this.isActive) {
            this.dragBoundaryController.activate(block, blockElement, null);
            console.log('BlockLoopControl: Создана кнопка для блока:', block.name);
        }
        
        console.log('BlockLoopControl: Кнопка создана для блока:', block.name);
    }
    
    /**
     * Находит DOM элемент блока
     * @param {Object} block - блок
     * @returns {Element|null} - DOM элемент или null
     * @private
     */
    _findBlockDOMElement(block) {
        // В режиме репетиции ищем активный блок
        const rehearsalBlock = document.querySelector('.rehearsal-active-block');
        if (rehearsalBlock) {
            return rehearsalBlock;
        }
        
        // В других режимах ищем .block-container
        const blockContainers = document.querySelectorAll('.block-container');
        
        for (const container of blockContainers) {
            // Ищем по названию блока или ID
            if (container.dataset.blockId === block.id || 
                container.querySelector('.block-name')?.textContent === block.name) {
                return container;
            }
        }
        
        return null;
    }
    
    /**
     * Позиционирует кнопку Loop рядом с блоком
     * @param {Element} blockElement - DOM элемент блока
     * @private
     */
    _positionLoopButton(blockElement) {
        // Добавляем кнопку в правый верхний угол блока
        blockElement.style.position = 'relative';
        this.loopButton.style.position = 'absolute';
        this.loopButton.style.top = '10px';
        this.loopButton.style.right = '10px';
        this.loopButton.style.zIndex = '1000';
        
        blockElement.appendChild(this.loopButton);
    }

    _positionPlusButton(blockElement) {
        blockElement.style.position = 'relative';
        this.plusButton.style.position = 'absolute';
        this.plusButton.style.top = '52px';
        this.plusButton.style.right = '18px';
        this.plusButton.style.zIndex = '1000';
        this.plusButton.style.opacity = '0';
        this.plusButton.style.transition = 'opacity 160ms ease, transform 160ms ease';
        blockElement.appendChild(this.plusButton);
    }
    
    /**
     * Убирает кнопку Loop
     * @private
     */
    _removeLoopButton() {
        if (this.loopButton) {
            this.loopButton.remove();
            this.loopButton = null;
        }
        if (this.plusButton) {
            this.plusButton.remove();
            this.plusButton = null;
        }
        
        // НЕ деактивируем drag boundaries при удалении кнопки
        // Границы должны деактивироваться только при полном отключении контроллера
        // if (this.dragBoundaryController) {
        //     this.dragBoundaryController.deactivate();
        // }
        
        this.currentBlockElement = null;
        // НЕ сбрасываем currentLoopBlock - он может понадобиться для drag boundaries
        // this.currentLoopBlock = null;
        
        console.log('BlockLoopControl: Кнопка удалена, drag boundaries остаются активными');
    }
    
    /**
     * Переключает зацикливание блока
     * @param {Object} block - блок для зацикливания
     */
    toggleLooping(block) {
        if (this.isLooping && this.currentLoopBlock?.id === block.id) {
            this.stopLooping();
        } else {
            this.startLooping(block);
        }
    }
    
    /**
     * Запускает зацикливание блока
     * @param {Object} block - блок для зацикливания
     */
    startLooping(block) {
        if (!this.audioEngine || !block) {
            console.warn('BlockLoopControl: Cannot start looping - missing audioEngine or block');
            return;
        }

        console.log(`BlockLoopControl: Запуск зацикливания блока: ${block.name}`);

        // 🎯 КРИТИЧЕСКОЕ УЛУЧШЕНИЕ: Проверяем пользовательские границы из DragBoundaryController
        let timeRange = null;
        
        if (this.dragBoundaryController && this.dragBoundaryController.isActive) {
            const boundaries = this.dragBoundaryController.getBoundaries();
            
            if (boundaries && boundaries.startBoundary !== null && boundaries.endBoundary !== null) {
                // Получаем временные метки для пользовательских границ
                const startTime = this._findTimeByLine(boundaries.startBoundary);
                const endTime = this._findTimeByLine(boundaries.endBoundary + 1); // следующая строка для конца
                
                if (startTime !== null && endTime !== null) {
                    timeRange = { startTime, endTime };
                    console.log(`🎯 USING USER BOUNDARIES: Lines ${boundaries.startBoundary}-${boundaries.endBoundary} = ${startTime.toFixed(2)}s-${endTime.toFixed(2)}s`);
                } else {
                    console.warn('🎯 USER BOUNDARIES INVALID: Could not convert line indices to time, falling back to block boundaries');
                }
            }
        }
        
        // Если пользовательские границы не доступны, используем границы блока
        if (!timeRange) {
            timeRange = this._getBlockTimeRange(block);
            console.log(`📦 USING BLOCK BOUNDARIES: ${timeRange?.startTime?.toFixed(2)}s-${timeRange?.endTime?.toFixed(2)}s`);
        }

        if (!timeRange || timeRange.startTime === null || timeRange.endTime === null) {
            console.error('BlockLoopControl: Не удалось определить временные границы');
            return;
        }

        // Сохраняем параметры зацикливания
        this.loopStartTime = timeRange.startTime;
        this.loopEndTime = timeRange.endTime;
        this.currentLoopBlock = block;
        this.isLooping = true;

        console.log(`BlockLoopControl: Временные границы лупа: ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`);

        // НЕ перематываем на начало блока - пусть воспроизведение продолжается
        // Зацикливание сработает когда дойдет до конца блока естественным образом
        console.log(`BlockLoopControl: Зацикливание установлено, воспроизведение продолжается без прерывания`);

        // Обновляем состояние кнопки
        this._updateButtonState(true);

        // Добавляем оранжевую окантовку блока
        if (this.currentBlockElement) {
            this.currentBlockElement.classList.add('loop-active');
            console.log('BlockLoopControl: Добавлена оранжевая окантовка блока');
        }

        console.log(`BlockLoopControl: Зацикливание активно ${this.loopStartTime}s - ${this.loopEndTime}s (без прерывания воспроизведения)`);
    }
    
    /**
     * Останавливает зацикливание
     */
    stopLooping() {
        if (!this.isLooping) return;
        
        console.log('BlockLoopControl: Остановка зацикливания');
        
        this.isLooping = false;
        // НЕ сбрасываем currentLoopBlock - он нужен для drag boundaries
        // this.currentLoopBlock = null; 
        this.loopStartTime = null;
        this.loopEndTime = null;
        this.lastJumpTime = 0; // Сбрасываем защиту от прыжков
        
        // 🔧 ИСПРАВЛЕНИЕ: Сбрасываем пользовательские границы при остановке лупа
        this.hasUserDefinedBoundaries = false;
        this.userBoundaries = null;
        
        // Обновляем вид кнопки
        this._updateButtonState(false);
        
        // Убираем эффект свечения блока
        if (this.currentBlockElement) {
            this.currentBlockElement.classList.remove('loop-active');
        }
        
        // НЕ деактивируем drag boundaries при остановке лупа
        // Границы должны оставаться активными для возможности перетаскивания
        console.log('BlockLoopControl: Зацикливание остановлено, drag boundaries остаются активными');
    }
    
    /**
     * Получает временные границы блока
     * @param {Object} block - блок
     * @returns {Object|null} - объект с start и end временами или null
     * @private
     */
    _getBlockTimeRange(block) {
        if (!block || !block.lineIndices || block.lineIndices.length === 0) {
            console.warn('BlockLoopControl: Invalid block for time range calculation:', block);
            return { startTime: null, endTime: null };
        }

        if (!this.markerManager) {
            console.warn('BlockLoopControl: MarkerManager not available');
            return { startTime: null, endTime: null };
        }

        const markers = this.markerManager.getMarkers();
        if (!markers || markers.length === 0) {
            console.warn('BlockLoopControl: No markers available');
            return { startTime: null, endTime: null };
        }

        console.log(`BlockLoopControl: Calculating time range for block "${block.name}" with lines [${block.lineIndices.join(',')}]`);
        console.log(`BlockLoopControl: Available markers count: ${markers.length}`);

        // Получаем индекс первой строки текущего блока
        const firstLineIndex = Math.min(...block.lineIndices);
        
        // Получаем индекс последней строки текущего блока
        const lastLineIndex = Math.max(...block.lineIndices);
        
        console.log(`BlockLoopControl: Block line range: ${firstLineIndex} to ${lastLineIndex}`);

        // Находим первый маркер текущего блока (начало лупа)
        let startMarker = null;
        for (const marker of markers) {
            if (marker.lineIndex === firstLineIndex) {
                startMarker = marker;
                console.log(`BlockLoopControl: Found start marker for line ${firstLineIndex}: ${marker.time.toFixed(2)}s`);
                break;
            }
        }

        // Если не нашли точный маркер для первой строки, ищем ближайший
        if (!startMarker) {
            console.log(`BlockLoopControl: No exact start marker found for line ${firstLineIndex}, searching for nearest next marker`);
            for (const marker of markers) {
                if (marker.lineIndex >= firstLineIndex) {
                    startMarker = marker;
                    console.log(`BlockLoopControl: Using nearest marker for line ${marker.lineIndex}: ${marker.time.toFixed(2)}s as start`);
                    break;
                }
            }
        }

        // Находим первый маркер СЛЕДУЮЩЕГО блока (конец лупа)
        // Это будет первый маркер после последней строки текущего блока
        let endMarker = null;
        console.log(`BlockLoopControl: Searching for end marker after line ${lastLineIndex}`);
        
        for (const marker of markers) {
            if (marker.lineIndex > lastLineIndex) {
                endMarker = marker;
                console.log(`BlockLoopControl: Found end marker (first of next block) for line ${marker.lineIndex}: ${marker.time.toFixed(2)}s`);
                break;
            }
        }

        // Если не нашли следующий блок, используем продолжительность трека
        if (!endMarker && this.audioEngine) {
            const duration = this.audioEngine.getDuration();
            if (duration > 0) {
                endMarker = { time: duration };
                console.log(`BlockLoopControl: Using track duration ${duration.toFixed(2)}s as end marker (no next block found)`);
            }
        }

        if (!startMarker) {
            console.warn('BlockLoopControl: Could not determine start time for block');
            return { startTime: null, endTime: null };
        }

        if (!endMarker) {
            console.warn('BlockLoopControl: Could not determine end time for block');
            return { startTime: null, endTime: null };
        }

        const startTime = startMarker.time;
        const endTime = endMarker.time;

        console.log(`BlockLoopControl: Block "${block.name}" LOOP BOUNDS: START=${startTime.toFixed(2)}s END=${endTime.toFixed(2)}s (duration: ${(endTime - startTime).toFixed(2)}s)`);

        return { startTime, endTime };
    }
    
    /**
     * Обновляет состояние кнопки
     * @param {boolean} isActive - активно ли зацикливание
     * @private
     */
    _updateButtonState(isActive) {
        if (!this.loopButton) return;
        
        if (isActive) {
            this.loopButton.classList.add('active');
            this.loopButton.innerHTML = 'Stop'; // Активная иконка
            this.loopButton.title = 'Остановить зацикливание';
            if (this.plusButton) {
                this.plusButton.classList.remove('hidden');
                requestAnimationFrame(() => {
                    this.plusButton.style.opacity = '1';
                    this.plusButton.style.transform = 'translateY(0)';
                });
            }
        } else {
            this.loopButton.classList.remove('active');
            this.loopButton.innerHTML = 'Loop'; // Неактивная иконка
            this.loopButton.title = `Зациклить блок "${this.currentLoopBlock?.name || ''}"`;
            if (this.plusButton) {
                this.plusButton.style.opacity = '0';
                this.plusButton.style.transform = 'translateY(-6px)';
                this.plusButton.classList.add('hidden');
            }
        }
    }
    
    /**
     * Обработчик обновления времени - проверяет зацикливание
     * @param {number} currentTime - текущее время воспроизведения
     */
    handleTimeUpdate(currentTime) {
        if (!this.isActive || !this.isLooping) return;
        
        this.diagnosticCounter++;
        
        // 🔒 КРИТИЧЕСКАЯ ЗАЩИТА: Блокируем все проверки лупа во время перемотки
        if (this.isSeekingInProgress) {
            const seekDuration = Date.now() - this.seekStartTime;
            console.log(`🔒 LOOP CHECKS BLOCKED: Seek in progress for ${seekDuration}ms`);
            return;
        }
        
        // 🔒 ЗАЩИТА ОТ КОРРЕКЦИИ: Блокируем проверки во время точной коррекции
        if (this.isCorrectionInProgress) {
            const correctionDuration = Date.now() - this.correctionStartTime;
            console.log(`🔧 LOOP CHECKS BLOCKED: Correction in progress for ${correctionDuration}ms`);
            return;
        }
        
        // Детальная диагностика реже, каждые 30 проверок
        if (this.diagnosticCounter % 30 === 0) {
            const audioState = this.audioEngine.isPlaying ? 'playing' : 'paused';
            console.debug(`🔍 LOOP DIAGNOSTIC #${this.diagnosticCounter}:`);
            console.debug(`     Current: ${currentTime.toFixed(3)}s`);
            console.debug(`     Loop Range: ${this.loopStartTime?.toFixed(3)}s - ${this.loopEndTime?.toFixed(3)}s`);
            console.debug(`     End Threshold: ${(this.loopEndTime - 0.05).toFixed(3)}s`);
            console.debug(`     Time Since Last Jump: ${(Date.now() - this.lastJumpTime) / 1000}s`);
            console.debug(`     Audio State: ${audioState}`);
        }
        
        // ⚡ КРИТИЧЕСКОЕ УСИЛЕНИЕ: Расширенные "ворота" для надежного срабатывания
        // Увеличиваем буфер до 150мс и добавляем упреждающий прыжок
        const preJumpThreshold = this.loopEndTime - 0.15; // Упреждающий порог 150мс
        const criticalThreshold = this.loopEndTime - 0.05; // Критический порог 50мс
        
        // 🎯 УПРЕЖДАЮЩИЙ ПРЫЖОК: Готовимся к прыжку заранее
        if (currentTime >= preJumpThreshold && currentTime < criticalThreshold) {
            // Проверяем готовность к прыжку
        const now = Date.now();
            const timeSinceLastJump = this.lastJumpTime ? now - this.lastJumpTime : Infinity;
            const minJumpInterval = 1200; // Уменьшаем интервал до 1.2 секунды для более отзывчивого лупа
            
            if (timeSinceLastJump >= minJumpInterval && !this.isSeekingInProgress) {
                console.log(`🚀 PRE-JUMP PREPARATION at ${currentTime.toFixed(3)}s (${(this.loopEndTime - currentTime).toFixed(3)}s until end)`);
                this.isPreJumpReady = true;
            }
        }
        
        // 🔄 ОСНОВНАЯ ЛОГИКА ПРЫЖКА: Срабатывает в критическом пороге или при готовности к упреждающему прыжку
        if (currentTime >= criticalThreshold || (this.isPreJumpReady && currentTime >= preJumpThreshold)) {
            const triggerType = this.isPreJumpReady ? 'PRE-JUMP' : 'CRITICAL';
            console.log(`🚨 LOOP ${triggerType} TRIGGERED at ${currentTime.toFixed(3)}s`);
            
            // Проверяем минимальный интервал между перемотками
            const now = Date.now();
            const timeSinceLastJump = this.lastJumpTime ? now - this.lastJumpTime : Infinity;
            const minJumpInterval = 1200; // Уменьшенный интервал для более отзывчивого лупа
            
            console.log(`    Time since last jump: ${(timeSinceLastJump / 1000).toFixed(1)}s`);
            console.log(`    Jump allowed: ${timeSinceLastJump >= minJumpInterval} (min interval: ${minJumpInterval/1000}s)`);
            console.log(`    Currently seeking: ${this.isSeekingInProgress}`);
            
            if (timeSinceLastJump >= minJumpInterval && !this.isSeekingInProgress) {
                // 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем что цель перемотки находится в том же блоке
                const currentBlock = this.currentLoopBlock;
                if (currentBlock && currentBlock.lineIndices) {
                    // Находим строку, соответствующую loopStartTime
                    const targetLine = this._findLineByTime(this.loopStartTime);
                    const blockContainsTarget = currentBlock.lineIndices.includes(targetLine);
                    
                    console.log(`🎯 JUMP TARGET VALIDATION:`);
                    console.log(`    Target time: ${this.loopStartTime.toFixed(3)}s`);
                    console.log(`    Target line: ${targetLine}`);
                    console.log(`    Current block lines: [${currentBlock.lineIndices.join(',')}]`);
                    console.log(`    Block contains target: ${blockContainsTarget}`);
                    
                    if (!blockContainsTarget) {
                        console.warn(`⚠️ JUMP TARGET OUTSIDE BLOCK: Adjusting to block start`);
                        // Корректируем цель перемотки на начало текущего блока
                        const blockStartLine = Math.min(...currentBlock.lineIndices);
                        const adjustedStartTime = this._findTimeByLine(blockStartLine);
                        if (adjustedStartTime !== null) {
                            console.log(`🔧 ADJUSTED TARGET: ${adjustedStartTime.toFixed(3)}s (line ${blockStartLine})`);
                            this.loopStartTime = adjustedStartTime;
                        }
                    }
                }
                
                // ⚡ ДВОЙНОЕ ПОДТВЕРЖДЕНИЕ: Усиленный механизм seek с подтверждением
                const seekTarget = this.loopStartTime + 0.01; // Минимальное смещение для точности
                console.log(`🔄 EXECUTING ${triggerType} LOOP JUMP: ${currentTime.toFixed(3)}s → ${this.loopStartTime.toFixed(3)}s (target: ${seekTarget.toFixed(3)}s)`);
                console.log(`🔒 SEEK STARTED: isSeekingInProgress = true`);
                
                // Устанавливаем флаги
                this.isSeekingInProgress = true;
                this.isPreJumpReady = false; // Сбрасываем флаг готовности
                this.seekStartTime = Date.now();
                
                // ⚡ АВАРИЙНЫЙ FALLBACK: Двойной timeout для надежности
                const primaryTimeout = setTimeout(() => {
                    if (this.isSeekingInProgress) {
                        console.warn('⚠️ PRIMARY SEEK TIMEOUT: Forcing isSeekingInProgress = false after 300ms');
                        this.isSeekingInProgress = false;
                        this.lastSeekTime = Date.now();
                    }
                }, 300);
                
                const emergencyTimeout = setTimeout(() => {
                    if (this.isSeekingInProgress) {
                        console.error('💥 EMERGENCY SEEK TIMEOUT: Force-clearing seek state after 800ms');
                        this.isSeekingInProgress = false;
                        this.lastSeekTime = Date.now();
                        clearTimeout(primaryTimeout);
                    }
                }, 800);
                
                try {
                    console.log(`   Executing setCurrentTime(${seekTarget.toFixed(3)})`);
                    console.log(`   Time before seek: ${currentTime.toFixed(3)}s`);
                    this.audioEngine.setCurrentTime(seekTarget);
                    this.lastJumpTime = Date.now();
                    
                    // Сохраняем timeouts для очистки при успешном seek
                    this.seekTimeouts = [primaryTimeout, emergencyTimeout];
                } catch (error) {
                    console.error('❌ SEEK ERROR:', error);
                    this.isSeekingInProgress = false;
                    this.isPreJumpReady = false;
                    clearTimeout(primaryTimeout);
                    clearTimeout(emergencyTimeout);
                }
            } else if (this.isSeekingInProgress) {
                console.log(`⏳ JUMP BLOCKED: Seek already in progress`);
            } else {
                console.log(`⏳ JUMP SUPPRESSED: Too soon since last jump (${(timeSinceLastJump / 1000).toFixed(1)}s < ${minJumpInterval/1000}s)`);
                
                // 🚨 ДИАГНОСТИКА КАСКАДНЫХ СБОЕВ: Более агрессивная защита
                if (timeSinceLastJump < minJumpInterval && currentTime > this.loopEndTime + 0.5) {
                    console.error(`💥 CASCADE FAILURE DETECTED: Playback ${(currentTime - this.loopEndTime).toFixed(1)}s beyond loop end`);
                    console.error(`   Emergency action: Force-allowing immediate jump to prevent complete loop failure`);
                    // В критической ситуации разрешаем экстренный прыжок
                    this.lastJumpTime = 0; // Сбрасываем ограничение
                    this.isPreJumpReady = true; // Активируем готовность к прыжку
                }
            }
        } else {
            // Логируем когда мы в "безопасной зоне"
            const timeUntilEnd = this.loopEndTime - currentTime;
            if (this.diagnosticCounter % 10 === 0 && timeUntilEnd > 1.0) {
                console.log(`✅ LOOP SAFE: ${timeUntilEnd.toFixed(1)}s until loop end`);
            }
        }
    }
    
    /**
     * Обработчик изменения активного блока
     * @param {Event} event - событие изменения блока
     */
    handleBlockChange(event) {
        if (!this.isActive) return;
        
        const currentLoopBlock = this.currentLoopBlock;
        const newActiveBlock = this.lyricsDisplay.currentActiveBlock;
        
        console.log('📡 BLOCK CHANGE EVENT received');
        console.log(`   Current loop block: ${currentLoopBlock ? currentLoopBlock.name + ' (ID: ' + currentLoopBlock.id + ')' : 'None'}`);
        console.log(`   New active block: ${newActiveBlock ? newActiveBlock.name + ' (ID: ' + newActiveBlock.id + ')' : 'None'}`);
        console.log(`   Loop is active: ${this.isLooping}`);
        console.log(`   Seeking in progress: ${this.isSeekingInProgress}`);
        
        // 🛡️ КРИТИЧЕСКАЯ ЗАЩИТА: Игнорируем изменения блоков во время перемотки
        if (this.isSeekingInProgress) {
            console.log('🔒 IGNORING BLOCK CHANGE: Seek in progress, this is likely caused by the loop jump');
            return;
        }
        
        // 🛡️ НОВАЯ ЗАЩИТА: Игнорируем изменения блоков в течение буферного времени после перемотки
        if (this.lastSeekTime) {
            const timeSinceSeek = Date.now() - this.lastSeekTime;
            if (timeSinceSeek < this.seekStabilizationBuffer) {
                console.log(`🛡️ SEEK BUFFER ACTIVE: Ignoring block change (${timeSinceSeek}ms since seek, buffer: ${this.seekStabilizationBuffer}ms)`);
                return;
            } else {
                console.log(`✅ SEEK BUFFER EXPIRED: ${timeSinceSeek}ms since seek, processing block change`);
                this.lastSeekTime = 0; // Сбрасываем буфер
            }
        }
        
        // 🎯 КРИТИЧЕСКАЯ ПРОВЕРКА: Если луп активен, проверяем пользовательские границы DragBoundaryController
        if (this.isLooping) {
            console.log(`🎯 LOOP IS ACTIVE: Checking user boundaries`);
            console.log(`   DragBoundaryController exists: ${!!this.dragBoundaryController}`);
            console.log(`   DragBoundaryController is active: ${this.dragBoundaryController?.isActive}`);
            console.log(`   Has user defined boundaries: ${this.hasUserDefinedBoundaries}`);
            
            // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем, что границы относятся к текущему блоку
            if (this.dragBoundaryController && this.dragBoundaryController.isActive) {
                const currentLineIndex = this.lyricsDisplay.activeLineIndex;
                const boundaries = this.dragBoundaryController.getBoundaries();
                
                console.log(`🎯 USER BOUNDARY DETAILED CHECK:`);
                console.log(`   Current line index: ${currentLineIndex}`);
                console.log(`   Boundaries object:`, boundaries);
                
                // 🔧 НОВАЯ ПРОВЕРКА: Убеждаемся что границы относятся к текущему блоку
                if (boundaries && newActiveBlock && currentLineIndex !== null && currentLineIndex !== undefined) {
                    const { startBoundary, endBoundary } = boundaries;
                    const blockLines = newActiveBlock.lineIndices || [];
                    
                    // Проверяем, что границы находятся в пределах текущего блока
                    const boundariesInCurrentBlock = blockLines.includes(startBoundary) && blockLines.includes(endBoundary);
                    
                    console.log(`🎯 BOUNDARY VALIDATION:`);
                    console.log(`   Current block lines: [${blockLines.join(',')}]`);
                    console.log(`   User boundaries: ${startBoundary} - ${endBoundary}`);
                    console.log(`   Boundaries in current block: ${boundariesInCurrentBlock}`);
                    
                    if (!boundariesInCurrentBlock) {
                        console.log(`🚨 INVALID BOUNDARIES: User boundaries don't belong to current block, stopping loop`);
                        // Сбрасываем пользовательские границы
                        this.hasUserDefinedBoundaries = false;
                        this.userBoundaries = null;
                    } else {
                        const isWithinUserBoundaries = currentLineIndex >= startBoundary && currentLineIndex <= endBoundary;
                        
                        console.log(`🎯 USER BOUNDARY CHECK:`);
                        console.log(`   Current line: ${currentLineIndex}`);
                        console.log(`   User boundaries: ${startBoundary} - ${endBoundary}`);
                        console.log(`   Within boundaries: ${isWithinUserBoundaries}`);
                        
                        if (isWithinUserBoundaries) {
                            console.log(`✅ STAYING WITHIN USER BOUNDARIES: Not stopping loop - line ${currentLineIndex} is within user-defined range ${startBoundary}-${endBoundary}`);
                            
                            // Обновляем кнопку для нового блока, но НЕ останавливаем луп
                            this._createLoopButtonForCurrentBlock();
                            return;
                        }
                        
                        console.log(`🚨 LINE OUTSIDE USER BOUNDARIES: Line ${currentLineIndex} is outside user range ${startBoundary}-${endBoundary}, checking other conditions`);
                    }
                } else {
                    console.log(`⚠️ BOUNDARY CHECK FAILED: boundaries=${!!boundaries}, currentLineIndex=${currentLineIndex}`);
                }
            } else {
                console.log(`⚠️ NO USER BOUNDARIES: DragBoundaryController not active, proceeding with normal block change logic`);
            }
        }
        
        // Диагностика мерцающих состояний
        if (!newActiveBlock && currentLoopBlock) {
            console.warn('⚠️ FLICKER DETECTED: New active block is null while loop block exists');
            console.log(`   Current time: ${Date.now()}`);
            
            // Grace period для восстановления состояния
            setTimeout(() => {
                const recoveredBlock = this.lyricsDisplay.currentActiveBlock;
                if (recoveredBlock) {
                    console.log(`✅ FLICKER RECOVERED: Block restored to ${recoveredBlock.name}`);
                } else {
                    console.warn('❌ FLICKER PERSISTS: Block still null after grace period');
                }
            }, 100);
            return;
        }
        
        // ТРИГГЕР СМЕНЫ ФОНА ДЛЯ РЕПЕТИЦИИ (без лупа и без перемотки)
        try {
            const isRehearsal = document.body.classList.contains('mode-rehearsal');
            if (isRehearsal && !this.isLooping && !this.isSeekingInProgress && window.app?.rehearsalBackgroundManager) {
                window.app.rehearsalBackgroundManager.setRandomBackgroundSmooth();
            }
        } catch(_) {}

        // Если новый блок и текущий блок лупа существуют
        if (newActiveBlock && this.currentLoopBlock) {
            // Сравниваем по ID блока И по имени блока для большей точности
            const sameBlockId = newActiveBlock.id === this.currentLoopBlock.id;
            const sameBlockName = newActiveBlock.name === this.currentLoopBlock.name;
            
            console.log(`   Same block ID: ${sameBlockId}`);
            console.log(`   Same block name: ${sameBlockName}`);
            
            // Дополнительная проверка: сравниваем индексы строк блоков
            const currentBlockLines = this.currentLoopBlock.lineIndices || [];
            const newBlockLines = newActiveBlock.lineIndices || [];
            const sameLines = JSON.stringify(currentBlockLines.sort()) === JSON.stringify(newBlockLines.sort());
            
            console.log(`   Current block lines: [${currentBlockLines.join(',')}]`);
            console.log(`   New block lines: [${newBlockLines.join(',')}]`);
            console.log(`   Same lines: ${sameLines}`);
            
            // Дополнительная проверка: сравниваем временные границы блоков
            let sameTimeRange = false;
            if (this.markerManager) {
                const currentTimeRange = this._getBlockTimeRange(this.currentLoopBlock);
                const newTimeRange = this._getBlockTimeRange(newActiveBlock);
                
                if (currentTimeRange && newTimeRange && 
                    currentTimeRange.startTime !== null && newTimeRange.startTime !== null &&
                    currentTimeRange.endTime !== null && newTimeRange.endTime !== null) {
                    
                    const timeDiff = Math.abs(currentTimeRange.startTime - newTimeRange.startTime) + 
                                   Math.abs(currentTimeRange.endTime - newTimeRange.endTime);
                    sameTimeRange = timeDiff < 0.1; // Разница менее 0.1 секунды считается одинаковой
                    
                    console.log(`   Current time range: ${currentTimeRange.startTime.toFixed(3)}s - ${currentTimeRange.endTime.toFixed(3)}s`);
                    console.log(`   New time range: ${newTimeRange.startTime.toFixed(3)}s - ${newTimeRange.endTime.toFixed(3)}s`);
                    console.log(`   Time difference: ${timeDiff.toFixed(3)}s`);
                    console.log(`   Same time range: ${sameTimeRange}`);
                }
            }
            
            if ((sameBlockId || sameBlockName) && sameLines && sameTimeRange) {
                console.log(`✅ SAME BLOCK CONFIRMED: Not stopping loop - this is the same block`);
                return; // Остаемся в том же блоке - НЕ трогаем зацикливание и handles
            }
        }
        
        console.log(`🔄 DIFFERENT BLOCK DETECTED: Proceeding with block change logic`);
        console.log(`   Was looping: ${this.isLooping}`);
        
        // Останавливаем текущее зацикливание только если блок действительно изменился
        if (this.isLooping) {
            console.log(`BlockLoopControl: Блок изменился, останавливаем зацикливание`);
            console.log(`BlockLoopControl: Текущий блок лупа: ${this.currentLoopBlock?.name}`);
            console.log(`BlockLoopControl: Новый активный блок: ${newActiveBlock?.name}`);
            this.stopLooping();
        } else {
            console.log(`ℹ️ NO LOOP TO STOP: Loop was not active`);
        }
        
        // Создаем кнопку для нового блока
        console.log(`🔧 CREATING LOOP BUTTON: For new active block`);
        this._createLoopButtonForCurrentBlock();
    }
    
    /**
     * Обновляет кнопку для текущего активного блока
     * Вызывается при изменении блока
     */
    updateForCurrentBlock() {
        if (!this.isActive) return;
        
        console.log('BlockLoopControl: Обновление для текущего блока');
        
        // 🎯 КРИТИЧЕСКАЯ ПРОВЕРКА: Если луп активен, проверяем пользовательские границы DragBoundaryController
        if (this.isLooping && this.dragBoundaryController && this.dragBoundaryController.isActive) {
            const currentLineIndex = this.lyricsDisplay.activeLineIndex;
            const boundaries = this.dragBoundaryController.getBoundaries();
            
            if (boundaries && currentLineIndex !== null && currentLineIndex !== undefined) {
                const { startBoundary, endBoundary } = boundaries;
                const isWithinUserBoundaries = currentLineIndex >= startBoundary && currentLineIndex <= endBoundary;
                
                console.log(`🎯 UPDATE BOUNDARY CHECK:`);
                console.log(`   Current line: ${currentLineIndex}`);
                console.log(`   User boundaries: ${startBoundary} - ${endBoundary}`);
                console.log(`   Within boundaries: ${isWithinUserBoundaries}`);
                
                if (isWithinUserBoundaries) {
                    console.log(`✅ STAYING WITHIN USER BOUNDARIES (UPDATE): Not stopping loop - line ${currentLineIndex} is within user-defined range ${startBoundary}-${endBoundary}`);
                    
                    // Обновляем кнопку для нового блока, но НЕ останавливаем луп
                    this._createLoopButtonForCurrentBlock();
                    return;
                }
                
                console.log(`🚨 LINE OUTSIDE USER BOUNDARIES (UPDATE): Line ${currentLineIndex} is outside user range ${startBoundary}-${endBoundary}, checking other conditions`);
            }
        }
        
        // Проверяем, изменился ли блок на самом деле
        const newActiveBlock = this.lyricsDisplay?.currentActiveBlock;
        
        // Если новый блок и текущий блок лупа существуют
        if (newActiveBlock && this.currentLoopBlock) {
            // Сравниваем по ID блока И по имени блока для большей точности
            const sameBlockId = newActiveBlock.id === this.currentLoopBlock.id;
            const sameBlockName = newActiveBlock.name === this.currentLoopBlock.name;
            
            // Дополнительная проверка: сравниваем индексы строк блоков
            const currentBlockLines = this.currentLoopBlock.lineIndices || [];
            const newBlockLines = newActiveBlock.lineIndices || [];
            const sameLines = JSON.stringify(currentBlockLines.sort()) === JSON.stringify(newBlockLines.sort());
            
            // Дополнительная проверка: сравниваем временные границы блоков
            let sameTimeRange = false;
            if (this.markerManager) {
                const currentTimeRange = this._getBlockTimeRange(this.currentLoopBlock);
                const newTimeRange = this._getBlockTimeRange(newActiveBlock);
                
                if (currentTimeRange && newTimeRange && 
                    currentTimeRange.startTime !== null && newTimeRange.startTime !== null &&
                    currentTimeRange.endTime !== null && newTimeRange.endTime !== null) {
                    
                    const timeDiff = Math.abs(currentTimeRange.startTime - newTimeRange.startTime) + 
                                   Math.abs(currentTimeRange.endTime - newTimeRange.endTime);
                    sameTimeRange = timeDiff < 0.1; // Разница менее 0.1 секунды считается одинаковой
                }
            }
            
            if ((sameBlockId || sameBlockName) && sameLines && sameTimeRange) {
                console.log('BlockLoopControl: Тот же блок с теми же временными границами, зацикливание продолжается');
            return; // Остаемся в том же блоке - не трогаем зацикливание
            }
        }
        
        console.log('BlockLoopControl: Блок изменился, останавливаем зацикливание');
        console.log('BlockLoopControl: Текущий блок лупа:', this.currentLoopBlock?.name);
        console.log('BlockLoopControl: Новый активный блок:', newActiveBlock?.name);
        
        // Останавливаем текущее зацикливание только если блок действительно изменился
        if (this.isLooping) {
            this.stopLooping();
        }
        
        // Создаем кнопку для нового блока
        this._createLoopButtonForCurrentBlock();
    }
    
    /**
     * Обработчик изменения границ от DragBoundaryController
     * @param {Object} boundaries - новые границы {startTime, endTime}
     */
    onBoundaryChange(boundaries) {
        if (!this.isLooping || !boundaries) return;
        
        console.log('BlockLoopControl: Границы изменены через drag:', boundaries);
        
        // 🎯 УСТАНАВЛИВАЕМ ФЛАГ ПОЛЬЗОВАТЕЛЬСКИХ ГРАНИЦ
        this.hasUserDefinedBoundaries = true;
        this.userBoundaries = { ...boundaries };
        console.log('🎯 USER BOUNDARIES SET: hasUserDefinedBoundaries = true');
        
        // 🎯 КРИТИЧЕСКОЕ УЛУЧШЕНИЕ: Правильно обрабатываем изменение границ
        if (boundaries.startTime !== undefined && boundaries.endTime !== undefined) {
            // Обновляем временные границы напрямую
            this.loopStartTime = boundaries.startTime;
            this.loopEndTime = boundaries.endTime;
            
            console.log(`🎯 LOOP BOUNDARIES UPDATED: ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`);
        } else if (boundaries.startBoundary !== undefined && boundaries.endBoundary !== undefined) {
            // Конвертируем индексы строк во временные метки
            const startTime = this._findTimeByLine(boundaries.startBoundary);
            const endTime = this._findTimeByLine(boundaries.endBoundary + 1); // следующая строка для конца
            
            if (startTime !== null && endTime !== null) {
                this.loopStartTime = startTime;
                this.loopEndTime = endTime;
                
                console.log(`🎯 LOOP BOUNDARIES UPDATED FROM LINES: Lines ${boundaries.startBoundary}-${boundaries.endBoundary} = ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`);
            } else {
                console.warn('🎯 BOUNDARY UPDATE FAILED: Could not convert line indices to time');
            }
        }
    }
    
    /**
     * Обновляет границы лупа на основе индексов строк
     * @param {number} startLineIndex - индекс начальной строки
     * @param {number} endLineIndex - индекс конечной строки
     */
    updateLoopBoundaries(startLineIndex, endLineIndex) {
        if (!this.isLooping || !this.markerManager) return;
        
        console.log(`BlockLoopControl: Обновление границ лупа: строки ${startLineIndex}-${endLineIndex}`);
        
        // Получаем временные метки для новых границ
        const markers = this.markerManager.getMarkers();
        const startMarker = markers.find(m => m.lineIndex === startLineIndex);
        const endMarker = markers.find(m => m.lineIndex === endLineIndex + 1); // следующая строка для конца
        
        if (startMarker) {
            this.loopStartTime = startMarker.time;
            console.log(`BlockLoopControl: Новое время начала: ${this.loopStartTime.toFixed(2)}s`);
        }
        
        if (endMarker) {
            this.loopEndTime = endMarker.time;
            console.log(`BlockLoopControl: Новое время окончания: ${this.loopEndTime.toFixed(2)}s`);
        } else {
            // Если нет следующего маркера, используем конец блока
            const blockEndMarker = markers.find(m => m.lineIndex > endLineIndex);
            if (blockEndMarker) {
                this.loopEndTime = blockEndMarker.time;
                console.log(`BlockLoopControl: Используем конец блока: ${this.loopEndTime.toFixed(2)}s`);
            }
        }
        
        console.log(`BlockLoopControl: Обновленные границы лупа: ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`);
    }
    
    /**
     * Обработчик события seeked - вызывается когда перемотка завершена
     * @private
     */
    handleLoopSeek() {
        const currentTime = this.audioEngine.getCurrentTime();
        const seekDuration = Date.now() - this.seekStartTime;
        
        console.log(`🎯 LOOP SEEK COMPLETED: Position ${currentTime.toFixed(3)}s (duration: ${seekDuration}ms)`);
        
        // ⚡ ДВОЙНОЕ ПОДТВЕРЖДЕНИЕ: Очищаем timeouts при успешном seek
        if (this.seekTimeouts) {
            this.seekTimeouts.forEach(timeout => clearTimeout(timeout));
            this.seekTimeouts = null;
            console.log(`✅ SEEK TIMEOUTS CLEARED: Emergency timeouts cancelled`);
        }
        
        if (this.isSeekingInProgress) {
            this.isSeekingInProgress = false;
            this.lastSeekTime = Date.now();
            console.log(`🔓 SEEK FLAG RESET: isSeekingInProgress = false, stabilization buffer activated`);
        }

        // 🎯 КРИТИЧЕСКАЯ КОРРЕКЦИЯ: Проверяем точность попадания
        if (this.loopStartTime !== null) {
            const targetTime = this.loopStartTime;
            const actualTime = currentTime;
            const timeDifference = Math.abs(actualTime - targetTime);
            
            console.log(`📊 SEEK ACCURACY CHECK:`);
            console.log(`   Expected: ${targetTime.toFixed(3)}s`);
            console.log(`   Actual: ${actualTime.toFixed(3)}s`);
            console.log(`   Difference: ${timeDifference.toFixed(3)}s`);
            
            // ⚡ УСИЛЕННАЯ КОРРЕКЦИЯ: Более строгие требования к точности
            if (timeDifference > 0.1) { // Уменьшаем допустимую погрешность до 100мс
                console.log(`⚠️ SEEK INACCURACY DETECTED: ${timeDifference.toFixed(3)}s difference`);
                console.log(`🔧 PERFORMING PRECISION CORRECTION: ${actualTime.toFixed(3)}s → ${targetTime.toFixed(3)}s`);
                
                this.isCorrectionInProgress = true;
                this.correctionStartTime = Date.now();
                
                // Точная коррекция с микро-смещением
                const preciseTarget = targetTime + 0.005; // 5мс смещение для стабильности
                this.audioEngine.setCurrentTime(preciseTarget);
                
                // Более короткий timeout для коррекции
                setTimeout(() => {
                    if (this.isCorrectionInProgress) {
                        console.log(`⚠️ CORRECTION TIMEOUT: Forcing isCorrectionInProgress = false after 150ms`);
                        this.isCorrectionInProgress = false;
                    }
                }, 150);
            } else {
                console.log(`✅ SEEK ACCURACY OK: Within acceptable range (${timeDifference.toFixed(3)}s)`);
            }
        }
        
        // ⚡ ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ: Проверяем что мы в правильном блоке
        if (this.currentLoopBlock && this.lyricsDisplay) {
            const currentLineIndex = this.lyricsDisplay.currentLine;
            const blockContainsCurrentLine = this.currentLoopBlock.lineIndices && 
                                           this.currentLoopBlock.lineIndices.includes(currentLineIndex);
            
            console.log(`🎯 POST-SEEK BLOCK VALIDATION:`);
            console.log(`   Current line: ${currentLineIndex}`);
            console.log(`   Loop block lines: [${this.currentLoopBlock.lineIndices?.join(',')}]`);
            console.log(`   Line in loop block: ${blockContainsCurrentLine}`);
            
            if (!blockContainsCurrentLine) {
                console.warn(`⚠️ POST-SEEK WARNING: Current line ${currentLineIndex} not in loop block`);
                console.warn(`   This may indicate seek accuracy issues or block synchronization problems`);
            } else {
                console.log(`✅ POST-SEEK VALIDATION: Successfully landed in correct block`);
            }
        }
    }
    
    /**
     * Запускает систему автоматического восстановления лупа
     * @private
     */
    _startAutoRecoverySystem() {
        // Проверяем состояние лупа каждые 2 секунды
        this.autoRecoveryInterval = setInterval(() => {
            this._checkLoopHealth();
        }, 2000);
        
        console.log('🛡️ AUTO RECOVERY: System started (checking every 2s)');
    }
    
    /**
     * Останавливает систему автоматического восстановления
     * @private
     */
    _stopAutoRecoverySystem() {
        if (this.autoRecoveryInterval) {
            clearInterval(this.autoRecoveryInterval);
            this.autoRecoveryInterval = null;
            console.log('🛡️ AUTO RECOVERY: System stopped');
        }
    }
    
    /**
     * Проверяет состояние лупа и восстанавливает при необходимости
     * @private
     */
    _checkLoopHealth() {
        if (!this.isActive || this.isSeekingInProgress) return;
        
        const currentTime = this.audioEngine?.getCurrentTime();
        const currentBlock = this.lyricsDisplay?.currentActiveBlock;
        
        // Если нет текущего времени или блока, пропускаем проверку
        if (currentTime === undefined || !currentBlock) return;
        
        // Проверяем: должен ли быть активен луп, но он неактивен?
        const shouldBeLooping = this.currentLoopBlock && 
                               currentBlock.id === this.currentLoopBlock.id &&
                               currentTime >= this.loopStartTime &&
                               currentTime <= this.loopEndTime;
        
        if (shouldBeLooping && !this.isLooping) {
            console.log(`🚨 AUTO RECOVERY: Loop should be active but isn't!`);
            console.log(`   Current block: ${currentBlock.name} (ID: ${currentBlock.id})`);
            console.log(`   Loop block: ${this.currentLoopBlock.name} (ID: ${this.currentLoopBlock.id})`);
            console.log(`   Current time: ${currentTime.toFixed(3)}s`);
            console.log(`   Loop range: ${this.loopStartTime?.toFixed(3)}s - ${this.loopEndTime?.toFixed(3)}s`);
            
            // Попытка автоматического восстановления
            console.log(`🔧 AUTO RECOVERY: Attempting to restore loop`);
            this.startLooping(this.currentLoopBlock);
            return;
        }
        
        // Проверяем: активен луп, но мы далеко за его пределами?
        if (this.isLooping && this.loopEndTime && 
            currentTime > this.loopEndTime + 2.0) { // Если ушли на 2+ секунды за границу
            
            console.log(`🚨 AUTO RECOVERY: Loop is active but we're far beyond its boundaries!`);
            console.log(`   Current time: ${currentTime.toFixed(3)}s`);
            console.log(`   Loop end: ${this.loopEndTime.toFixed(3)}s`);
            console.log(`   Distance beyond: ${(currentTime - this.loopEndTime).toFixed(1)}s`);
            
            // Это признак cascade failure - останавливаем сломанный луп
            console.log(`🛑 AUTO RECOVERY: Stopping broken loop`);
            this.stopLooping();
            return;
        }
        
        // Все в порядке - логируем только каждые 10 проверок
        if (!this.diagnosticCounter) this.diagnosticCounter = 0;
        this.diagnosticCounter++;
        
        if (this.diagnosticCounter % 30 === 0) {
            console.debug(`✅ AUTO RECOVERY: Loop health OK (check #${this.diagnosticCounter})`);
            console.debug(`   Loop active: ${this.isLooping}`);
            console.debug(`   Current time: ${currentTime.toFixed(1)}s`);
            if (this.isLooping) {
                console.debug(`   Loop range: ${this.loopStartTime?.toFixed(1)}s - ${this.loopEndTime?.toFixed(1)}s`);
            }
        }
    }
    
    /**
     * Находит строку по времени
     */
    _findLineByTime(targetTime) {
        if (!this.markerManager || !this.markerManager.markers) {
            return null;
        }
        
        let closestLine = null;
        let closestDistance = Infinity;
        
        for (const marker of this.markerManager.markers) {
            const distance = Math.abs(marker.time - targetTime);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestLine = marker.lineIndex;
            }
        }
        
        return closestLine;
    }
    
    /**
     * Находит время по строке
     */
    _findTimeByLine(lineIndex) {
        if (!this.markerManager || !this.markerManager.markers) {
            return null;
        }
        
        const marker = this.markerManager.markers.find(m => m.lineIndex === lineIndex);
        return marker ? marker.time : null;
    }

    _onCorrectionCompleted() {
        if (this.isCorrectionInProgress) {
            const correctionDuration = Date.now() - this.correctionStartTime;
            const currentTime = this.audioEngine.getCurrentTime();
            
            console.log(`✅ CORRECTION COMPLETED: Position ${currentTime.toFixed(3)}s (took ${correctionDuration}ms)`);
            
            this.isCorrectionInProgress = false;
            this.correctionStartTime = null;
            this.lastSeekTime = Date.now(); // Обновляем время последней перемотки
            
            console.log(`🔓 CORRECTION FLAG CLEARED: System ready for normal operation`);
        }
    }

    _tryAttachNextBlockToLoop() {
        try {
            if (!this.isLooping || !this.currentLoopBlock) return;
            const blocks = this.lyricsDisplay?.textBlocks;
            if (!Array.isArray(blocks) || blocks.length === 0) return;
            // Найти индекс текущего блока в processed списке (учитываем split)
            const processed = this.lyricsDisplay._splitLargeBlocks(blocks);
            const curIdx = processed.findIndex(b => b.id === this.currentLoopBlock.id);
            if (curIdx === -1 || curIdx >= processed.length - 1) return;
            const nextBlock = processed[curIdx + 1];

            // Подсветка второго блока
            const nextEl = this._findBlockDOMElement(nextBlock) || document.querySelector('.rehearsal-next-preview')?.parentElement;
            if (nextEl) nextEl.classList.add('loop-active');

            // Вычислить объединённые границы времени: start = текущее start, end = граница next блока (или пользовательская)
            const nextRange = this._getBlockTimeRange(nextBlock);
            if (nextRange && nextRange.endTime) {
                this.loopEndTime = nextRange.endTime;
                console.log(`BlockLoopControl: Расширен луп до следующего блока. Новый конец: ${this.loopEndTime.toFixed(2)}s`);
            }
        } catch (e) { console.warn('BlockLoopControl: attach next block failed', e); }
    }
}

// Экспортируем для использования в других модулях
window.BlockLoopControl = BlockLoopControl;

console.log('BlockLoopControl: Класс загружен'); 