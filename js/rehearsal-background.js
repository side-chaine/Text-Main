class RehearsalBackgroundManager {
	constructor(imagePaths, interval = 0) {
		this.imagePaths = imagePaths;
		this.interval = interval; // 0 = без автосмены
		this.timerId = null;
		this.body = document.body;
		this.lastImageIndex = -1;
	}

	start() {
		if (!this.imagePaths || this.imagePaths.length === 0) return;
		this.body.classList.add('rehearsal-active');
		this._setBackground();
		if (this.interval && this.interval > 0 && this.imagePaths.length > 1) {
			this.timerId = setInterval(this._setBackground.bind(this), this.interval);
		}
	}

	stop() {
		if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
		this.body.classList.remove('rehearsal-active');
		// Не очищаем backgroundImage здесь, так как режимы сами управляют сбросом
	}

	_setBackground() {
		let nextIndex;
		do {
			nextIndex = Math.floor(Math.random() * this.imagePaths.length);
		} while (this.imagePaths.length > 1 && nextIndex === this.lastImageIndex);
		this.lastImageIndex = nextIndex;
		const imagePath = this.imagePaths[nextIndex];
		const img = new Image();
		img.onload = () => {
			this.body.style.setProperty('background-image', `url('${imagePath}')`, 'important');
			console.log(`✅ Rehearsal Background: set ${imagePath}`);
		};
		img.onerror = () => console.error(`❌ Rehearsal Background: failed to load ${imagePath}`);
		img.src = imagePath;
	}
} 