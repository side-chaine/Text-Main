class KaraokeBackgroundManager {
    constructor(imagePaths, interval = 60000) {
        this.imagePaths = imagePaths;
        this.interval = interval;
        this.timerId = null;
        this.body = document.body;
        this.lastImageIndex = -1; // Чтобы первая картинка не повторялась
    }

    start() {
        console.log('Karaoke Background Manager: Starting slideshow...');
        if (!this.imagePaths || this.imagePaths.length === 0) return;
        
        this.body.classList.add('karaoke-active');
        
        // Change background immediately
        this._changeBackground();
        if (this.imagePaths.length > 1) {
            this.timerId = setInterval(this._changeBackground.bind(this), this.interval);
        }
    }

    stop() {
        console.log('Karaoke Background Manager: Stopping slideshow...');
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.body.classList.remove('karaoke-active');
        // Optionally reset to a default background
        this.body.style.backgroundImage = '';
    }

    _changeBackground() {
        if (this.imagePaths.length === 0) {
            console.warn('Karaoke Background Manager: No images to display.');
            return;
        }

        let nextImageIndex;
        // Выбираем случайный индекс, который не совпадает с предыдущим
        do {
            nextImageIndex = Math.floor(Math.random() * this.imagePaths.length);
        } while (this.imagePaths.length > 1 && nextImageIndex === this.lastImageIndex);
        
        this.lastImageIndex = nextImageIndex;
        const imagePath = this.imagePaths[nextImageIndex];
        
        // Preload the image to ensure smooth transition
        const img = new Image();
        img.onload = () => {
            this.body.style.setProperty('background-image', `url('${imagePath}')`, 'important');
            console.log(`✅ Karaoke Background Manager: SUCCESSFULLY set background to ${imagePath}`);
        };
        img.onerror = () => {
            console.error(`❌ Karaoke Background Manager: FAILED to load image at path: ${imagePath}. Check if the path is correct and the file exists.`);
        };
        img.src = imagePath;
    }
} 