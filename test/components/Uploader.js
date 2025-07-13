// test/components/Uploader.js

const filesState = {
    instrumental: null,
    vocals: null,
    lyrics: null,
    markers: null,
};

function updateDropZoneUI(dropZone, file) {
    const messageElement = dropZone.querySelector('.drop-zone-message');
    if (file) {
        messageElement.innerHTML = `✅ <span class="file-name">${file.name}</span>`;
        dropZone.classList.add('has-file');
    } else {
        // Since we removed default text, we just clear the message
        if (messageElement) messageElement.innerHTML = '';
        dropZone.classList.remove('has-file');
    }
}

function handleFileDrop(event, type, dropZone) {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (file) {
        filesState[type] = file;
        updateDropZoneUI(dropZone, file);
    }
}

function handleFileInput(event, type, dropZone) {
    const file = event.target.files[0];
    if (file) {
        filesState[type] = file;
        if (dropZone) {
            updateDropZoneUI(dropZone, file);
        } else {
            // Handle JSON file button UI
            const jsonButton = document.getElementById('json-upload-button');
            jsonButton.innerHTML = `✅ ${file.name}`;
            jsonButton.classList.add('has-file');
        }
    }
}

export function initializeUploader() {
    // Modal elements
    const uploaderModal = document.getElementById('uploader-modal');
    const showUploadModalBtn = document.getElementById('show-upload-modal-btn');
    const closeModalBtn = document.getElementById('modal-close-btn');

    // Uploader elements inside modal
    const instrumentalZone = document.getElementById('instrumental-drop-zone');
    const vocalsZone = document.getElementById('vocals-drop-zone');
    const lyricsZone = document.getElementById('lyrics-drop-zone');
    const jsonInput = document.getElementById('json-file-input');
    const jsonButton = document.getElementById('json-upload-button');
    const uploadButton = document.getElementById('upload-track-button');

    // --- Modal Logic ---
    showUploadModalBtn.addEventListener('click', () => uploaderModal.classList.add('visible'));
    closeModalBtn.addEventListener('click', () => uploaderModal.classList.remove('visible'));
    uploaderModal.addEventListener('click', (event) => {
        if (event.target === uploaderModal) {
            uploaderModal.classList.remove('visible');
        }
    });

    // --- Drag and Drop Logic ---
    const dropZones = [instrumentalZone, vocalsZone, lyricsZone];
    dropZones.forEach(zone => {
        ['dragover', 'dragenter'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => { e.preventDefault(); zone.classList.remove('drag-over'); });
        });
    });

    instrumentalZone.addEventListener('drop', (e) => handleFileDrop(e, 'instrumental', instrumentalZone));
    vocalsZone.addEventListener('drop', (e) => handleFileDrop(e, 'vocals', vocalsZone));
    lyricsZone.addEventListener('drop', (e) => handleFileDrop(e, 'lyrics', lyricsZone));

    // --- Button Click Logic ---
    jsonButton.addEventListener('click', () => jsonInput.click());
    jsonInput.addEventListener('change', (e) => handleFileInput(e, 'markers', null));

    uploadButton.addEventListener('click', () => {
        if (Object.values(filesState).every(file => file === null)) {
            alert('Пожалуйста, добавьте хотя бы один файл для загрузки.');
            return;
        }
        console.log('--- Симуляция отправки на сервер ---');
        console.log('Файлы для загрузки:', filesState);
        alert('Открывай консоль (Ctrl+Shift+J или Cmd+Opt+J), чтобы увидеть симуляцию загрузки!');
        uploaderModal.classList.remove('visible'); // Close modal after "uploading"
    });
} 