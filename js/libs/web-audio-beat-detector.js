const version = '0.2.1';

const guess = (buffer) => {
    // This is a new implementation of an old patch from an even older patch.
    // @see https://github.com/cwilso/WebAudio/blob/master/samples/js/beatdetektor.js
    const offlineContext = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    // It's possible to use a bandpass filter, but the results are not always better.
    const filter = offlineContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    filter.Q.value = 1;
    source.connect(filter);
    const destination = offlineContext.destination;
    filter.connect(destination);
    source.start(0);
    return offlineContext.startRendering().then((renderedBuffer) => {
        const peaks = getPeaks([renderedBuffer.getChannelData(0)]);
        const groups = getIntervals(peaks);
        const top = groups
            .sort((a, b) => b.count - a.count)
            .filter((a, i) => i < 5)
            .reduce((prev, current) => (prev.count > current.count ? prev : current));
        return {
            bpm: Math.round(60 / (top.interval / buffer.sampleRate)),
            peaks
        };
    });
};
const analyze = (buffer) => {
    return new Promise((resolve, reject) => {
        try {
            resolve(guess(buffer));
        }
        catch (err) {
            reject(err);
        }
    });
};
const getPeaks = (data) => {
    // What we're going to do here, is to buffer up buffer slices
    // because it's too big to process at once.
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
    let lastMin = -1;
    let lastMax = -1;
    for (let i = 0; i < partSize; i++) {
        const min = getMin(data, i);
        const max = getMax(data, i);
        if (max > lastMax) {
            lastMax = max;
        }
        if (min < lastMin) {
            lastMin = min;
        }
        if (i > 0) {
            if (data[i - 1] < data[i] && data[i] > data[i + 1] && data[i] > 0.1) {
                peaks.push(i);
            }
        }
    }
    return peaks;
};
const getMin = (data, i) => {
    let min = 0;
    for (let x = 0; x < data.length; x++) {
        if (x < i) {
            if (data[x] < min) {
                min = data[x];
            }
        }
    }
    return min;
};
const getMax = (data, i) => {
    let max = 0;
    for (let x = 0; x < data.length; x++) {
        if (x < i) {
            if (data[x] > max) {
                max = data[x];
            }
        }
    }
    return max;
};
const getIntervals = (peaks) => {
    const groups = [];
    peaks.forEach((peak, index) => {
        for (let i = 1; index + i < peaks.length && i < 10; i++) {
            const group = {
                interval: peaks[index + i] - peak,
                count: 1
            };
            while (group.interval < 100) {
                group.interval *= 2;
            }
            while (group.interval > 200) {
                group.interval /= 2;
            }
            group.interval = Math.round(group.interval);
            if (!groups.some((interval) => interval.interval === group.interval)) {
                groups.push(group);
            }
        }
    });
    return groups.map((group) => {
        peaks.forEach((peak, index) => {
            for (let i = 1; index + i < peaks.length && i < 10; i++) {
                if (group.interval === Math.round(peaks[index + i] - peak)) {
                    group.count++;
                }
            }
        });
        return group;
    });
};

export { analyze, version };