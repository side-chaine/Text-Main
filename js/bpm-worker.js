// js/bpm-worker.js

// --- Pure calculation functions, moved from the original library ---

const getPeaks = (data) => {
    const partSize = 22050;
    const parts = data[0].length / partSize;
    let peaks = [];
    for (let i = 0; i < parts; i++) {
        const part = data[0].subarray(i * partSize, (i + 1) * partSize);
        const newPeaks = findPeaks(part, partSize);
        peaks.push(...newPeaks.map((peak) => peak + i * partSize));
    }
    return peaks;
};

const findPeaks = (data, partSize) => {
    const peaks = [];
    // A threshold helps ignore noise below a certain amplitude.
    const threshold = 0.08; // Increased threshold for more selectivity
    for (let i = 1; i < partSize - 1; i++) {
        if (data[i - 1] < data[i] && data[i] > data[i + 1] && data[i] > threshold) {
            peaks.push(i);
        }
    }
    return peaks;
};

const getIntervals = (peaks, sampleRate) => {
    const groups = [];

    // Define tempo range in terms of samples based on the actual sampleRate
    const lowerBound = (60 / 200) * sampleRate; // 200 BPM
    const upperBound = (60 / 70) * sampleRate;  // 70 BPM

    peaks.forEach((peak, index) => {
        for (let i = 1; index + i < peaks.length && i < 10; i++) {
            const group = {
                interval: peaks[index + i] - peak,
                count: 1
            };

            // Normalize interval to a typical tempo range.
            while (group.interval < lowerBound) {
                group.interval *= 2;
            }
            while (group.interval > upperBound) {
                group.interval /= 2;
            }

            group.interval = Math.round(group.interval);

            // Find a group with a similar interval
            const tolerance = Math.round(group.interval * 0.04); // Reverting to a more stable tolerance
            const found = groups.find((g) => Math.abs(g.interval - group.interval) < tolerance);

            if (found) {
                found.count++;
            } else {
                groups.push(group);
            }
        }
    });
    return groups;
};


// --- Worker Logic ---

self.onmessage = (event) => {
    try {
        const { channelData, sampleRate } = event.data;
        const peaks = getPeaks([channelData]);
        const groups = getIntervals(peaks, sampleRate);
        
        if (groups.length === 0) {
            throw new Error("Could not find any beats.");
        }

        const top = groups
            .sort((a, b) => b.count - a.count)
            .filter((a, i) => i < 5)
            .reduce((prev, current) => (prev.count > current.count ? prev : current));
        
        const bpm = Math.round(60 / (top.interval / sampleRate));

        self.postMessage({ status: 'success', bpm });

    } catch (error) {
        self.postMessage({ status: 'error', message: `Calculation failed: ${error.message}` });
    }
}; 