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

	_setBackground() {
		if (!this.isActive || !this.body.classList.contains('mode-rehearsal')) return;
		let nextIndex;
		do {
			nextIndex = Math.floor(Math.random() * this.imagePaths.length);
		} while (this.imagePaths.length > 1 && nextIndex === this.lastImageIndex);
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
				const newBlockIndex = this._getBlockIndexByLine(lyricsDisplay.textBlocks, lineIndex);
				if (newBlockIndex === null) return;
				if (this._currentBlockIndex === null) {
					this._currentBlockIndex = newBlockIndex;
					return;
				}
				if (newBlockIndex !== this._currentBlockIndex) {
					this._currentBlockIndex = newBlockIndex;
					this._setBackground();
				}
			} catch(_) {}
		};
		document.addEventListener('active-line-changed', this._boundHandler);
	}

	_getBlockIndexByLine(textBlocks, lineIndex) {
		for (let i = 0; i < textBlocks.length; i++) {
			const blk = textBlocks[i];
			if (!blk || !Array.isArray(blk.lineIndices)) continue;
			const min = Math.min(...blk.lineIndices);
			const max = Math.max(...blk.lineIndices);
			if (lineIndex >= min && lineIndex <= max) return i;
		}
		return null;
	}
} 