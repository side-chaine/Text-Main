// stretch-lab.js

// import { analyze } from './libs/web-audio-beat-detector.js'; // We no longer do this here

document.addEventListener('DOMContentLoaded', () => {
    console.log("Stretch Lab Initialized.");

    // --- Worker ---
    const bpmWorker = new Worker('./js/bpm-worker.js', { type: 'module' });

    // --- DOM Elements ---
    const fileInput = document.getElementById('audio-file-input');
    const originalAudio = document.getElementById('original-audio');
    const stretchedAudio = document.getElementById('stretched-audio');
    const sourceBpmInput = document.getElementById('source-bpm');
    const targetBpmInput = document.getElementById('target-bpm');
    const processButton = document.getElementById('process-button');
    const logOutput = document.getElementById('log-output');

    // --- State ---
    let originalBuffer = null;
    let audioContext = null;

    // --- Logging ---
    const log = (message) => {
        console.log(message);
        logOutput.textContent = `${new Date().toLocaleTimeString()}: ${message}\n${logOutput.textContent}`;
    };

    log("Awaiting audio file...");

    // --- Worker Communication ---
    bpmWorker.onmessage = (event) => {
        const { status, bpm, message } = event.data;
        if (status === 'success') {
            log(`Background analysis complete. BPM Detected: ${bpm}`);
            sourceBpmInput.value = bpm;
            targetBpmInput.value = bpm;
            processButton.disabled = false;
            log("Ready to stretch. Adjust target BPM and press 'Stretch!'");
        } else {
            log(`Error in background analysis: ${message}`);
        }
    };

    bpmWorker.onerror = (error) => {
        log(`A critical error occurred in the BPM worker: ${error.message}`);
        console.error(error);
    };

    // --- Event Listeners ---
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        log(`Loading file: ${file.name}...`);

        // Initialize AudioContext on user interaction
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            // We need to clone the buffer because we are transferring it to the worker
            const bufferForWorker = arrayBuffer.slice(0);

            originalBuffer = await audioContext.decodeAudioData(arrayBuffer);
            log("File decoded successfully for playback.");

            // Display original audio
            originalAudio.src = URL.createObjectURL(file);
            originalAudio.load();

            // Analyze BPM in the background
            log("Starting background BPM analysis... UI will remain responsive.");
            processButton.disabled = true; // Disable until analysis is complete
            
            // --- Step 1: Filter audio on the main thread ---
            const offlineContext = new OfflineAudioContext(1, originalBuffer.length, originalBuffer.sampleRate);
            const source = offlineContext.createBufferSource();
            source.buffer = originalBuffer;
            const filter = offlineContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 120;
            filter.Q.value = 1;
            source.connect(filter);
            filter.connect(offlineContext.destination);
            source.start(0);

            log("Filtering audio to isolate beats...");
            const filteredBuffer = await offlineContext.startRendering();
            log("Filtering complete. Sending to worker for analysis.");

            // --- Step 2: Send filtered data to worker ---
            const channelData = filteredBuffer.getChannelData(0);
            bpmWorker.postMessage({ channelData, sampleRate: originalBuffer.sampleRate }, [channelData.buffer]);

        } catch (error) {
            log(`Error processing audio: ${error.message}`);
            console.error(error);
            processButton.disabled = true;
        }
    });

    processButton.addEventListener('click', () => {
        if (!originalBuffer) {
            log("No audio buffer loaded.");
            return;
        }

        const sourceBPM = parseFloat(sourceBpmInput.value);
        const targetBPM = parseFloat(targetBpmInput.value);

        if (isNaN(sourceBPM) || isNaN(targetBPM) || targetBPM <= 0) {
            log("Invalid BPM values.");
            return;
        }

        log(`Stretching from ${sourceBPM} BPM to ${targetBPM} BPM...`);
        processButton.disabled = true;

        const processWithPolling = () => {
            // Poll until the SoundTouch library is ready
            if (typeof window.SoundTouch === 'undefined' || typeof window.SimpleStretcher === 'undefined') {
                log("Waiting for SoundTouch library to be ready...");
                setTimeout(processWithPolling, 100);
                return;
            }

            log("SoundTouch library is ready. Processing...");

            // --- SoundTouch.js Integration ---
            const tempoRatio = targetBPM / sourceBPM;
            const soundTouch = new window.SoundTouch(audioContext.sampleRate);
            soundTouch.tempo = tempoRatio;
            
            const source = {
                extract: (target, numFrames, position) => {
                    const l = originalBuffer.getChannelData(0);
                    const r = originalBuffer.numberOfChannels > 1 ? originalBuffer.getChannelData(1) : l;
                    for (let i = 0; i < numFrames; i++) {
                        target[i * 2] = l[i + position];
                        target[i * 2 + 1] = r[i + position];
                    }
                    return Math.min(numFrames, l.length - position);
                },
                length: originalBuffer.length,
            };

            const stretcher = new window.SimpleStretcher(source, soundTouch);
            const stretchedBuffer = audioContext.createBuffer(
                originalBuffer.numberOfChannels,
                stretcher.length,
                audioContext.sampleRate
            );

            const lCh = stretchedBuffer.getChannelData(0);
            const rCh = stretchedBuffer.numberOfChannels > 1 ? stretchedBuffer.getChannelData(1) : lCh;

            stretcher.extract(
                (left, right) => {
                    lCh.set(left);
                    rCh.set(right);
                },
                (progress) => {
                    // This log can be spammy, maybe update a progress bar instead
                    // log(`Processing... ${Math.round(progress * 100)}%`);
                }
            );

            log("Stretching complete. Creating audio player...");

            // Convert buffer to blob to play in audio element
            const wavData = bufferToWave(stretchedBuffer, stretchedBuffer.length);
            const blob = new Blob([new Uint8Array(wavData)], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            stretchedAudio.src = url;
            stretchedAudio.load();
            log("Result is ready to play.");
            processButton.disabled = false;
        };

        processWithPolling();
    });

    // Helper function to convert AudioBuffer to a WAV file format (Blob)
    // Author: Matt Diamond
    function bufferToWave(abuffer, len) {
        let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

        // write WAVE header
        setUint32(0x46464952);                         // "RIFF"
        setUint32(length - 8);                         // file length - 8
        setUint32(0x45564157);                         // "WAVE"

        setUint32(0x20746d66);                         // "fmt " chunk
        setUint32(16);                                 // length = 16
        setUint16(1);                                  // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2);                      // block-align
        setUint16(16);                                 // 16-bit
        
        setUint32(0x61746164);                         // "data" - chunk
        setUint32(length - pos - 4);                   // chunk length

        // write interleaved data
        for(i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        while(pos < length) {
            for(i = 0; i < numOfChan; i++) {             // interleave channels
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
                view.setInt16(pos, sample, true);          // write 16-bit sample
                pos += 2;
            }
            offset++                                     // next source sample
        }

        return buffer;

        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    }
}); 