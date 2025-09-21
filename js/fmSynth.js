// fmSynth.js
export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
export const carrier = audioCtx.createOscillator();
export const modulator = audioCtx.createOscillator();
export const modGain = audioCtx.createGain();
export const gainNode = audioCtx.createGain();
export const analyser = audioCtx.createAnalyser();
export const convolver = audioCtx.createConvolver();

// FM synth state
export const fmState = {
    currentFreq: 110,
    currentModDepth: 50,
    targetFreq: 110,
    targetModDepth: 50,
    baseGain: 0.01
};

// --- Scale (C major extended)
const scaleFreqs = [
    65.41, 69.30, 73.42, 77.78, 82.41, 87.31, 92.50, 98.00,
    103.83, 110.00, 116.54, 123.47, 130.81, 138.59, 146.83,
    155.56, 164.81, 174.61, 185.00, 196.00, 207.65, 220.00,
    233.08, 246.94, 261.63, 277.18, 293.66, 311.13, 329.63,
    349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88,
    523.25, 554.37, 587.33, 622.25, 659.25, 698.46, 739.99,
    783.99, 830.61, 880.00, 932.33, 987.77, 1046.50, 1108.73,
    1174.66, 1244.51, 1318.51, 1396.91, 1479.98, 1567.98,
    1661.22, 1760.00, 1864.66, 1975.53, 2093.00, 2217.46,
    2349.32, 2489.02, 2637.02, 2793.83, 2959.96, 3135.96,
    3322.44, 3520.00]
export function snapToScale(freq) {
    let closest = scaleFreqs[0];
    let minDiff = Math.abs(freq - closest);
    for (let f of scaleFreqs) {
        const diff = Math.abs(freq - f);
        if (diff < minDiff) {
            minDiff = diff;
            closest = f;
        }
    }
    return closest;
}

// Load impulse response
export async function loadReverb(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    convolver.buffer = await audioCtx.decodeAudioData(arrayBuffer);
}

// add a flag so we only setup once
let _fmInitialized = false;

// Setup FM synth
export function setupFMSynth() {
    if (_fmInitialized) return;
    _fmInitialized = true;

    carrier.type = 'sine';
    modulator.type = 'sine';
    carrier.frequency.value = fmState.currentFreq;
    modulator.frequency.value = 5;

    modGain.gain.value = fmState.currentModDepth;
    gainNode.gain.value = fmState.baseGain;

    // FM
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Wet/dry
    const wetGain = audioCtx.createGain();
    const dryGain = audioCtx.createGain();
    dryGain.gain.value = 0.5;
    wetGain.gain.value = 0.5;

    // route carrier through wet/dry -> mix -> master gain -> analyser -> destination
    carrier.connect(dryGain);
    carrier.connect(convolver);
    convolver.connect(wetGain);

    const mix = audioCtx.createGain();
    dryGain.connect(mix);
    wetGain.connect(mix);

    // ensure master gainNode is in chain so volume smoothing works
    mix.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    // start oscillators only if not already started
    try { carrier.start(); } catch (e) { /* already started */ }
    // try { modulator.start(); } catch (e) { /* already started */ }
}

// Update FM synth
export function updateFMSynth(idleModPhase = 0) {
    const freqWithIdle = snapToScale(fmState.currentFreq) + Math.sin(idleModPhase) * 10;
    carrier.frequency.setTargetAtTime(freqWithIdle, audioCtx.currentTime, 0.01);
    modGain.gain.setTargetAtTime(fmState.currentModDepth, audioCtx.currentTime, 0.01);

    gainNode.gain.setTargetAtTime(fmState.baseGain, audioCtx.currentTime, 0.05);
}
