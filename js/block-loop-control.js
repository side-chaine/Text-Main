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
        this.lastJumpTime = 0;     // Защита от частых прыжков
        this.debugLogCounter = 0;  // Счетчик для логирования
        
        // UI элементы
        this.loopButton = null;
        this.currentBlockElement = null;
        
        // Привязываем контекст для обработчиков
        this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
        this.handleBlockChange = this.handleBlockChange.bind(this);
        
        console.log('BlockLoopControl: Инициализирован');
    }
    
    /**
     * Активирует компонент (только в режиме репетиции)
     */
    activate() {
        if (this.isActive) return;
        
        this.isActive = true;
        console.log('BlockLoopControl: Активирован');
        
        // Подписываемся на события
        this._setupEventListeners();
        
        // Создаем кнопку для текущего блока если он есть
        this._createLoopButtonForCurrentBlock();
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
        // Подписываемся на обновления позиции воспроизведения через AudioEngine
        if (this.audioEngine) {
            this.audioEngine.onPositionUpdate(this.handleTimeUpdate);
        }
        
        // Слушаем изменения активного блока
        document.addEventListener('active-line-changed', this.handleBlockChange);
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
        
        // Добавляем кнопку рядом с блоком
        this._positionLoopButton(blockElement);
        
        this.currentBlockElement = blockElement;
        this.currentLoopBlock = block;
        
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
    
    /**
     * Убирает кнопку Loop
     * @private
     */
    _removeLoopButton() {
        if (this.loopButton) {
            this.loopButton.remove();
            this.loopButton = null;
        }
        
        this.currentBlockElement = null;
        this.currentLoopBlock = null;
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

        // Получаем временные границы блока
        const timeRange = this._getBlockTimeRange(block);
        if (!timeRange || timeRange.startTime === null || timeRange.endTime === null) {
            console.error('BlockLoopControl: Не удалось определить временные границы блока');
            return;
        }

        // Сохраняем параметры зацикливания
        this.loopStartTime = timeRange.startTime;
        this.loopEndTime = timeRange.endTime;
        this.currentLoopBlock = block;
        this.isLooping = true;

        console.log(`BlockLoopControl: Временные границы блока: ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`);

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
        
        // Уведомляем об изменении состояния лупа
        document.dispatchEvent(new CustomEvent('loop-state-changed', { 
            detail: { isLooping: true, source: 'BlockLoopControl' } 
        }));
    }
    
    /**
     * Останавливает зацикливание
     */
    stopLooping() {
        if (!this.isLooping) return;
        
        console.log('BlockLoopControl: Остановка зацикливания');
        
        this.isLooping = false;
        this.currentLoopBlock = null;
        this.loopStartTime = null;
        this.loopEndTime = null;
        this.lastJumpTime = 0; // Сбрасываем защиту от прыжков
        
        // Обновляем вид кнопки
        this._updateButtonState(false);
        
        // Убираем эффект свечения блока
        if (this.currentBlockElement) {
            this.currentBlockElement.classList.remove('loop-active');
        }
        
        // Уведомляем об изменении состояния лупа
        document.dispatchEvent(new CustomEvent('loop-state-changed', { 
            detail: { isLooping: false, source: 'BlockLoopControl' } 
        }));
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
        } else {
            this.loopButton.classList.remove('active');
            this.loopButton.innerHTML = 'Loop'; // Неактивная иконка
            this.loopButton.title = `Зациклить блок "${this.currentLoopBlock?.name || ''}"`;
        }
    }
    
    /**
     * Обработчик обновления времени - проверяет зацикливание
     * @param {number} currentTime - текущее время воспроизведения
     */
    handleTimeUpdate(currentTime) {
        if (!this.isActive || !this.isLooping) return;
        
        // Проверяем состояние воспроизведения
        if (this.audioEngine.isPaused || !this.audioEngine.isPlaying) {
            return; // Не выполняем проверки во время паузы
        }

        // Проверяем, что у нас есть валидные границы зацикливания
        if (this.loopStartTime === null || this.loopEndTime === null || 
            this.loopStartTime === 0 && this.loopEndTime === 0) {
            return; // Не зацикливаем если границы не установлены корректно
        }

        // Логируем только каждые 10 проверок для уменьшения спама в консоли
        if (this.debugLogCounter === undefined) this.debugLogCounter = 0;
        this.debugLogCounter++;
        if (this.debugLogCounter % 10 === 0) {
            console.log(`BlockLoopControl: LOOP CHECK - Current: ${currentTime.toFixed(2)}s, Start: ${this.loopStartTime.toFixed(2)}s, End: ${this.loopEndTime.toFixed(2)}s`);
        }
        
        // Добавляем небольшой буфер (0.1 секунды) для более надежного срабатывания
        const buffer = 0.1;
        const now = Date.now();
        const minJumpInterval = 1000; // Увеличиваем до 1 секунды между прыжками
        
        // Если вышли за конец блока (с учетом буфера) - перематываем на начало
        if (currentTime >= (this.loopEndTime - buffer)) {
            // Проверяем, не было ли недавнего прыжка
            if (!this.lastJumpTime || (now - this.lastJumpTime > minJumpInterval)) {
                console.log(`🔄 BlockLoopControl: LOOP TRIGGER! End reached at ${currentTime.toFixed(2)}s, jumping to start ${this.loopStartTime.toFixed(2)}s`);
                this.lastJumpTime = now;
                this.audioEngine.setCurrentTime(this.loopStartTime);
            } else {
                console.log(`⏸️ BlockLoopControl: Jump suppressed (too soon after last jump)`);
            }
            return;
        }
        
        // Примечание: НЕ перематываем если находимся перед началом блока
        // Пусть воспроизведение дойдет до начала блока естественным образом
        // и тогда зацикливание будет работать нормально
    }
    
    /**
     * Обработчик изменения активного блока
     * @param {Event} event - событие изменения блока
     */
    handleBlockChange(event) {
        if (!this.isActive) return;
        
        console.log('BlockLoopControl: Активный блок изменился');
        
        // Получаем новый индекс строки из события
        const newLineIndex = event.detail?.lineIndex;
        if (newLineIndex === undefined || newLineIndex === null) {
            console.log('BlockLoopControl: Нет информации о новой строке в событии');
            return;
        }
        
        // Если зацикливание активно, проверяем принадлежность новой строки к текущему блоку
        if (this.isLooping && this.currentLoopBlock) {
            // Проверяем, находится ли новая строка в пределах текущего зацикленного блока
            const isLineInCurrentBlock = this.currentLoopBlock.lineIndices && 
                                       this.currentLoopBlock.lineIndices.includes(newLineIndex);
            
            if (isLineInCurrentBlock) {
                console.log(`BlockLoopControl: Строка ${newLineIndex} принадлежит текущему зацикленному блоку ${this.currentLoopBlock.name}, зацикливание продолжается`);
                return; // Не останавливаем зацикливание, просто продолжаем
            } else {
                console.log(`BlockLoopControl: Строка ${newLineIndex} НЕ принадлежит текущему зацикленному блоку ${this.currentLoopBlock.name}, останавливаем зацикливание`);
                // Останавливаем зацикливание только если действительно вышли за пределы блока
                this.stopLooping();
            }
        }
        
        // Создаем кнопку для нового блока
        this._createLoopButtonForCurrentBlock();
    }
    
    /**
     * Обновляет кнопку для текущего активного блока
     * Вызывается при изменении блока
     */
    updateForCurrentBlock() {
        if (!this.isActive) return;
        
        console.log('BlockLoopControl: Обновление для текущего блока');
        
        // Проверяем, изменился ли блок на самом деле
        const newActiveBlock = this.lyricsDisplay?.currentActiveBlock;
        
        if (newActiveBlock && this.currentLoopBlock && 
            newActiveBlock.id === this.currentLoopBlock.id) {
            console.log('BlockLoopControl: Тот же блок, зацикливание продолжается');
            return; // Остаемся в том же блоке - не трогаем зацикливание
        }
        
        console.log('BlockLoopControl: Блок изменился, останавливаем зацикливание');
        
        // Останавливаем текущее зацикливание только если блок действительно изменился
        if (this.isLooping) {
            this.stopLooping();
        }
        
        // Создаем кнопку для нового блока
        this._createLoopButtonForCurrentBlock();
    }
}

// Экспортируем для использования в других модулях
window.BlockLoopControl = BlockLoopControl;

console.log('BlockLoopControl: Класс загружен'); 