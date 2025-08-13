class RehearsalBackgroundManager {
	constructor(imagePaths, interval = 0) {
		this.imagePaths = imagePaths;
		this.interval = interval; // 0 = без автосмены
		this.timerId = null;
		this.body = document.body;
		this.lastImageIndex = -1;
		this.isActive = false;
		this._currentBlockIndex = null;
		this._boundHandler = null;
		this._currentBlockId = null;
	}

	start() {
		if (!this.imagePaths || this.imagePaths.length === 0) return;
		this.body.classList.add('rehearsal-active');
		this.isActive = true;
		this._setBackground();
		if (this.interval && this.interval > 0 && this.imagePaths.length > 1) {
			this.timerId = setInterval(this._setBackground.bind(this), this.interval);
		}
	}

	stop() {
		if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
		this.body.classList.remove('rehearsal-active');
		this.isActive = false;
		// Не очищаем backgroundImage здесь, так как режимы сами управляют сбросом
	}

	_setBackground(forcedIndex = null) {
		if (!this.isActive || !this.body.classList.contains('mode-rehearsal')) return;
		let nextIndex = forcedIndex;
		if (typeof nextIndex !== 'number' || nextIndex < 0) {
			// случайный только если не передан индекс
			do {
				nextIndex = Math.floor(Math.random() * this.imagePaths.length);
			} while (this.imagePaths.length > 1 && nextIndex === this.lastImageIndex);
		}
		this.lastImageIndex = nextIndex;
		const imagePath = this.imagePaths[nextIndex];
		const img = new Image();
		img.onload = () => {
			if (!this.isActive || !this.body.classList.contains('mode-rehearsal')) return;
			this.body.style.setProperty('background-image', `url('${imagePath}')`, 'important');
			console.log(`✅ Rehearsal Background: set ${imagePath}`);
		};
		img.onerror = () => console.error(`❌ Rehearsal Background: failed to load ${imagePath}`);
		img.src = imagePath;
	}

	/**
	 * Привязка к смене блоков: меняем фон только при естественном проигрывании и смене блока.
	 */
	bindToBlockChanges(lyricsDisplay, blockLoopControl, audioEngine) {
		if (this._boundHandler) return; // уже привязано
		this._boundHandler = (e) => {
			try {
				if (!this.isActive || !this.body.classList.contains('mode-rehearsal')) return;
				if (!lyricsDisplay || !Array.isArray(lyricsDisplay.textBlocks) || lyricsDisplay.textBlocks.length === 0) return;
				// Не менять при лупе или seek
				if (blockLoopControl && (blockLoopControl.isLooping || blockLoopControl.isSeekingInProgress)) return;
				// Только во время воспроизведения
				if (!audioEngine || audioEngine.isPlaying !== true) return;
				const lineIndex = e.detail?.lineIndex;
				if (typeof lineIndex !== 'number') return;
				// Работаем по разделённым блокам (учитываем разбиение >8 строк)
				const processedBlocks = (typeof lyricsDisplay._splitLargeBlocks === 'function')
					? lyricsDisplay._splitLargeBlocks(lyricsDisplay.textBlocks || [])
					: (lyricsDisplay.textBlocks || []);
				const newBlockIndex = this._getBlockIndexByLine(processedBlocks, lineIndex);
				if (newBlockIndex === null) return;
				const newBlockId = processedBlocks[newBlockIndex]?.id || `idx-${newBlockIndex}`;
				if (this._currentBlockIndex === null) {
					this._currentBlockIndex = newBlockIndex;
					this._currentBlockId = newBlockId;
					return;
				}
				if (newBlockIndex !== this._currentBlockIndex || newBlockId !== this._currentBlockId) {
					this._currentBlockIndex = newBlockIndex;
					this._currentBlockId = newBlockId;
					// Дет. выбор картинки: индекс блока по модулю количества картинок
					const imgIndex = newBlockIndex % this.imagePaths.length;
					this._setBackground(imgIndex);
				}
			} catch(_) {}
		};
		document.addEventListener('active-line-changed', this._boundHandler);

		// Инициализируем текущий блок на момент привязки
		try {
			if (lyricsDisplay && Array.isArray(lyricsDisplay.textBlocks) && lyricsDisplay.textBlocks.length > 0) {
				const currentLine = typeof lyricsDisplay.currentLine === 'number' ? lyricsDisplay.currentLine : 0;
				const processedBlocks = (typeof lyricsDisplay._splitLargeBlocks === 'function')
					? lyricsDisplay._splitLargeBlocks(lyricsDisplay.textBlocks || [])
					: (lyricsDisplay.textBlocks || []);
				this._currentBlockIndex = this._getBlockIndexByLine(processedBlocks, currentLine);
				this._currentBlockId = processedBlocks?.[this._currentBlockIndex]?.id || null;
			}
		} catch(_) {}
	}

	_getBlockIndexByLine(blocks, lineIndex) {
		for (let i = 0; i < blocks.length; i++) {
			const blk = blocks[i];
			if (!blk || !Array.isArray(blk.lineIndices)) continue;
			const min = Math.min(...blk.lineIndices);
			const max = Math.max(...blk.lineIndices);
			if (lineIndex >= min && lineIndex <= max) return i;
		}
		return null;
	}
} 