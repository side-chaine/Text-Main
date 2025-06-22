/*
This is a port of the popular C++ library SoundTouch.
See http://www.surina.net/soundtouch/
*/

var exports = {};

var FifoSampleBuffer = exports.FifoSampleBuffer = function(channels) {
    this.channels = channels || 2;
    this.buffer = this._getBuffer(0);
    this.position = 0;
};

FifoSampleBuffer.prototype._getBuffer = function(len) {
    var buffer;
    if (this.channels === 1) {
        buffer = new Float32Array(len);
    } else {
        buffer = [];
        for (var i = 0; i < this.channels; i++) {
            buffer[i] = new Float32Array(len);
        }
    }
    return buffer;
}


FifoSampleBuffer.prototype.put = function(data) {
    if (this.channels === 1) {
        var newLength = this.position + data.length;
        var newBuffer = new Float32Array(newLength);
        newBuffer.set(this.buffer, 0);
        newBuffer.set(data, this.position);
        this.buffer = newBuffer;
        this.position = newLength;
    } else {
        var newLength = this.position + data[0].length;
        var newBuffer = this._getBuffer(newLength);
        for (var i = 0; i < this.channels; i++) {
            newBuffer[i].set(this.buffer[i], 0);
            newBuffer[i].set(data[i], this.position);
        }
        this.buffer = newBuffer;
        this.position = newLength;
    }
}

FifoSampleBuffer.prototype.get = function(len) {
    if (this.position < len) {
        len = this.position;
    }
    if (this.channels === 1) {
        var result = this.buffer.subarray(0, len);
        this.buffer = this.buffer.subarray(len, this.position);
    } else {
        var result = this._getBuffer(len);
        var newBuffer = this._getBuffer(this.position - len);
        for (var i = 0; i < this.channels; i++) {
            result[i].set(this.buffer[i].subarray(0, len));
            newBuffer[i].set(this.buffer[i].subarray(len, this.position));
        }
        this.buffer = newBuffer;
    }
    this.position -= len;
    return result;
}

var RateTransposer = exports.RateTransposer = function() {
    this.slopeCount = 0;
    this.prevSampleL = 0;
    this.prevSampleR = 0;
};

RateTransposer.prototype.transpose = function(numChannels, buffer, reverse) {
    var i = 0;
    var a = this.prevSampleL;
    var b = this.prevSampleR;
    var step = this.rate - 1;

    if (numChannels == 2) {
        while (i < buffer.length - 1) {
            a += step * (buffer[i] - a);
            b += step * (buffer[i + 1] - b);
            buffer[i] = a;
            buffer[i + 1] = b;
            i += 2;
        }
    } else {
        while (i < buffer.length) {
            a += step * (buffer[i] - a);
            buffer[i] = a;
            i++;
        }
    }
    if (reverse) {
        this.prevSampleL = buffer[i - 2];
        this.prevSampleR = buffer[i - 1];
    } else {
        this.prevSampleL = a;
        this.prevSampleR = b;
    }
};

var Stretch = exports.Stretch = function(numChannels, tempo, sampleRate) {
    this.numChannels = numChannels;
    this.tempo = tempo;
    this.sampleRate = sampleRate;

    this.inputBuffer = new FifoSampleBuffer(this.numChannels);
    this.outputBuffer = new FifoSampleBuffer(this.numChannels);

    this.pRateTransposer = new RateTransposer();

    this.nominalSkip = this.tempo * (this.SEEK_WINDOW_SIZE - this.SLOPE_SIZE) + this.SLOPE_SIZE;
    this.slopeSize = Math.round(this.SLOPE_SIZE * this.tempo);
    this.seekSize = Math.round(this.SEEK_WINDOW_SIZE * this.tempo);

    this.pRef = this._getBuffer(this.seekSize);
    this.pSeek = this._getBuffer(this.seekSize);

    this.isBeginning = true;
};

Stretch.prototype.SEEK_WINDOW_SIZE = 400; // ms
Stretch.prototype.SLOPE_SIZE = 82; // ms

Stretch.prototype.SEEK_WINDOW_SIZE = 16384;
Stretch.prototype.SLOPE_SIZE = 2048;

Stretch.prototype._getBuffer = function(len) {
    var buffer;
    if (this.numChannels === 1) {
        buffer = new Float32Array(len);
    } else {
        buffer = [];
        for (var i = 0; i < this.numChannels; i++) {
            buffer[i] = new Float32Array(len);
        }
    }
    return buffer;
}


Stretch.prototype.clear = function() {
    this.inputBuffer.position = 0;
    this.outputBuffer.position = 0;
};

Stretch.prototype.get = function(len) {
    var result = this.outputBuffer.get(len);
    return result;
};


Stretch.prototype.seekBest = function(ref, seek) {
    var bestOffset;
    var bestCorr;

    if (this.numChannels === 1) {
        bestCorr = -1e30;
        for (var offset = 0; offset < this.seekSize; offset += 1) {
            var corr = 0;
            for (var i = 0; i < this.seekSize; i += 1) {
                var ro = ref[i];
                var so = seek[i + offset];
                corr += ro * so;
            }
            if (corr > bestCorr) {
                bestCorr = corr;
                bestOffset = offset;
            }
        }
    } else {
        bestCorr = -1e30;
        for (var offset = 0; offset < this.seekSize; offset += 1) {
            var corr = 0;
            for (var j = 0; j < this.numChannels; j++) {
                for (var i = 0; i < this.seekSize; i += 1) {
                    var ro = ref[j][i];
                    var so = seek[j][i + offset];
                    corr += ro * so;
                }
            }
            if (corr > bestCorr) {
                bestCorr = corr;
                bestOffset = offset;
            }
        }
    }
    return bestOffset;
};

Stretch.prototype.put = function(data) {
    this.inputBuffer.put(data);
    this.process();
};

Stretch.prototype.overlapAdd = function(output, input) {
    var len = this.slopeSize;
    if (this.numChannels == 1) {
        for (var i = 0; i < len; i++) {
            output[i] = input[i] * i / len + output[i] * (len - i) / len;
        }
    } else {
        for (var i = 0; i < len; i++) {
            for (var j = 0; j < this.numChannels; j++) {
                output[j][i] = input[j][i] * i / len + output[j][i] * (len - i) / len;
            }
        }
    }
};

Stretch.prototype.process = function() {
    while (this.inputBuffer.position >= this.seekSize * 2) {
        var pRef = this.inputBuffer.get(this.seekSize);
        var pSeek = this.inputBuffer.get(this.seekSize);

        var offset = this.seekBest(pRef, pSeek);

        var pMid = this._getBuffer(this.slopeSize);
        if (this.numChannels === 1) {
            for (var i = 0; i < this.slopeSize; i++) {
                pMid[i] = pRef[offset + i];
            }
        } else {
            for (var i = 0; i < this.slopeSize; i++) {
                for (var j = 0; j < this.numChannels; j++) {
                    pMid[j][i] = pRef[j][offset + i];
                }
            }
        }
        this.overlapAdd(pMid, pSeek);

        this.inputBuffer.position = this.seekSize - (offset + this.slopeSize) + this.inputBuffer.position;
        if (this.numChannels === 1) {
            var newBuffer = new Float32Array(this.inputBuffer.position);
            newBuffer.set(pSeek.subarray(offset + this.slopeSize, this.seekSize));
            newBuffer.set(this.inputBuffer.buffer, this.seekSize - (offset + this.slopeSize));
            this.inputBuffer.buffer = newBuffer;
        } else {
            var newBuffer = this._getBuffer(this.inputBuffer.position);
            for (var j = 0; j < this.numChannels; j++) {
                newBuffer[j].set(pSeek[j].subarray(offset + this.slopeSize, this.seekSize));
                newBuffer[j].set(this.inputBuffer.buffer[j], this.seekSize - (offset + this.slopeSize));
            }
            this.inputBuffer.buffer = newBuffer;
        }


        if (this.isBeginning) {
            this.outputBuffer.put(pRef);
            this.isBeginning = false;
        } else {
            this.outputBuffer.put(pRef.subarray(0, offset));
        }
        this.outputBuffer.put(pMid);
    }
};

var SoundTouch = exports.SoundTouch = function(sampleRate) {
    this.sampleRate = sampleRate;
    this.numChannels = 2;

    this._tempo = 1.0;
    this._pitch = 1.0;
    this._rate = 1.0;

    this.virtualPitch = 1.0;
    this.virtualTempo = 1.0;
    this.virtualRate = 1.0;

    this.pRateTransposer = new RateTransposer();
    this.pTDStretch = new Stretch(this.numChannels, this._tempo, this.sampleRate);
    this.pRateTransposer.rate = this._rate;
};

Object.defineProperty(SoundTouch.prototype, "tempo", {
    get: function() {
        return this._tempo;
    },
    set: function(tempo) {
        this._tempo = tempo;
        this.pTDStretch.tempo = this._tempo;
    }
});

Object.defineProperty(SoundTouch.prototype, "pitch", {
    get: function() {
        return this._pitch;
    },
    set: function(pitch) {
        this._pitch = pitch;
        this.pRateTransposer.rate = this._pitch;
    }
});

Object.defineProperty(SoundTouch.prototype, "rate", {
    get: function() {
        return this._rate;
    },
    set: function(rate) {
        this._rate = rate;
        this.pRateTransposer.rate = this.pitch * this.rate;
    }
});


SoundTouch.prototype.clear = function() {
    this.pTDStretch.clear();
};

SoundTouch.prototype.get = function(len) {
    return this.pTDStretch.get(len);
};

SoundTouch.prototype.put = function(data) {
    this.pRateTransposer.transpose(this.numChannels, data);
    this.pTDStretch.put(data);
};
var WebAudioBufferSource = exports.WebAudioBufferSource = function(buffer) {
    this.buffer = buffer;
}

WebAudioBufferSource.prototype.extract = function(target, numFrames, position) {
    var l = this.buffer.getChannelData(0);
    if (this.buffer.numberOfChannels > 1) {
        var r = this.buffer.getChannelData(1);
    }
    for (var i = 0; i < numFrames; i++) {
        target[i * 2] = l[i + position];
        if (this.buffer.numberOfChannels > 1) {
            target[i * 2 + 1] = r[i + position];
        }
    }
    return Math.min(numFrames, l.length - position);
}

var SimpleStretcher = exports.SimpleStretcher = function(source, process) {
    this.source = source;
    this.process = process;
    this.buffer = new Float32Array(16384 * 2);

    this.process.put(this.buffer);

    this.position = 0;
    this.length = Math.floor(this.source.length / this.process.tempo);
};

SimpleStretcher.prototype.extract = function(onread, onprogress) {
    var BUFF_SIZE = 16384 * 2;
    var completed = 0;
    var soundTouch = this.process;
    var source = this.source;
    var f = new Float32Array(BUFF_SIZE / 2);
    var f2 = new Float32Array(BUFF_SIZE / 2);

    while (completed < this.length) {
        var originalPos = Math.round(this.position * soundTouch.tempo);
        var framesExtracted = source.extract(this.buffer, 16384, originalPos);
        soundTouch.put(this.buffer);
        var framesProcessed = soundTouch.get(f);

        for (var i = 0; i < framesProcessed; i++) {
            f2[i * 2] = f[i];
            f2[i * 2 + 1] = f[i];
        }
        onread(f, f2);

        this.position += framesProcessed;
        completed += framesProcessed;
        onprogress(completed / this.length);
    }
}
for (var key in exports) {
    this[key] = exports[key];
}