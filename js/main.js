import { audioCtx, fmState, setupFMSynth, updateFMSynth, analyser, gainNode, loadReverb } from './fmSynth.js';
import { drawOscilloscope } from './oscilloscope.js';

// Cursor
const cursor = document.getElementById('cursor');
const trail = document.getElementById('trail');
let mouseX = 0, mouseY = 0, trailX = 0, trailY = 0;
let lastX = 0, lastY = 0, lastTime = Date.now();
let mouseSpeed = 0;
let mouseDir = 0; // added: direction/velocity sign for particles

// Canvas: prefer existing canvas in HTML
const existingCanvas = document.getElementById('oscilloscope');
const canvas = existingCanvas || document.createElement('canvas');
if (!existingCanvas) {
    canvas.id = 'oscilloscope';
    document.body.appendChild(canvas);
}
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Analyser buffer
analyser.fftSize = 2048;
const dataArray = new Uint8Array(analyser.fftSize);

// Particles
const particles = [];
// function createParticles(num, width, height) {
//     // preload particle images
//     const imgSources = [
//         'images/portrait1.jpg',
//         'images/portrait2.jpg'
//     ];
//     const imgs = imgSources.map(src => {
//         const im = new Image();
//         im.src = src;
//         return im;
//     });

//     for (let i = 0; i < num; i++) {
//         const baseAmp = 6 + Math.random() * 18;          // autonomous drift amplitude (px)
//         const baseSpeed = 0.2 + Math.random() * 1.2;    // autonomous drift speed (hz-ish)
//         const phase = Math.random() * Math.PI * 2;
//         particles.push({
//             x: Math.random() * width,
//             y: Math.random() * height,
//             vx: (Math.random() - 0.5) * 0.4,        // small random velocity
//             vy: (Math.random() - 0.5) * 0.4,
//             size: 36 + Math.random() * 48,         // image draw size
//             alpha: 0.7 + Math.random() * 0.3,
//             baseAmp,
//             baseSpeed,
//             phase,
//             img: imgs[i % imgs.length]             // assign one of the preloaded images
//         });
//     }
// }
// createParticles(25, canvas.width, canvas.height);

// Mouse movement
document.addEventListener('mousemove', e => {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const dt = (Date.now() - lastTime) || 1;
    mouseSpeed = Math.sqrt(dx * dx + dy * dy) / dt * 50;
    mouseDir = dx / dt; // added: preserve direction info for particles

    // Map velocity to freq & modulation
    fmState.targetFreq = 110 + mouseSpeed * 15;   // bigger jumps for faster movement
    fmState.targetModDepth = Math.min(mouseSpeed * 30, 120);

    lastX = e.clientX;
    lastY = e.clientY;
    lastTime = Date.now();
});

// Unlock audio + load reverb
async function unlockAudio() {
    await audioCtx.resume();
    await loadReverb('audio/ir_hall.wav'); // replace with your IR
    setupFMSynth();

    // remove listeners so this only runs once (prevents multiple connections/starts)
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
}
document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);

// --- New: robust idle/visibility/focus handling ---
const IDLE_THRESHOLD = 800; // ms without movement considered idle
const IDLE_FREQ = 110;
const IDLE_MOD = 50;
const QUIET_GAIN = 0.005; // very quiet when idle
const ACTIVE_GAIN = 0.18; // target when active

function forceIdleState() {
    mouseSpeed = 0;
    fmState.targetFreq = IDLE_FREQ;
    fmState.targetModDepth = IDLE_MOD;
    // set baseGain low immediately; animate loop will smooth it
    fmState.baseGain = QUIET_GAIN;
    // reset lastTime so we avoid a spike on resume
    lastTime = Date.now();
}

// When visibility changes, make sure we quiet and reset timing
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // still suspend audio context to save resources
        audioCtx.suspend();
        forceIdleState();
    } else {
        audioCtx.resume();
        // make sure we don't accidentally pick up stale mouse velocity
        forceIdleState();
    }
});

// When window loses focus or pointer leaves, go quiet
window.addEventListener('blur', () => {
    forceIdleState();
});
document.addEventListener('mouseleave', (e) => {
    // if the pointer left the document entirely, treat as idle
    if (!e.relatedTarget) forceIdleState();
});
document.addEventListener('mouseout', (e) => {
    // some browsers use mouseout — check if leaving document
    if (!e.relatedTarget) forceIdleState();
});

// Animate
let idlePhase = 0;
function animate() {
    requestAnimationFrame(animate);

    // Cursor
    trailX += (mouseX - trailX) * 0.1;
    trailY += (mouseY - trailY) * 0.1;
    cursor.style.left = mouseX + 'px';
    cursor.style.top = mouseY + 'px';
    trail.style.left = trailX + 'px';
    trail.style.top = trailY + 'px';

    // Smooth freq/mod
    const smoothing = mouseSpeed > 0 ? 0.08 : 0.02; // faster when moving
    fmState.currentFreq += (fmState.targetFreq - fmState.currentFreq) * smoothing;
    fmState.currentModDepth += (fmState.targetModDepth - fmState.currentModDepth) * smoothing;

    // Idle decay based on time since last movement (more robust than mouseSpeed alone)
    const timeSinceLast = Date.now() - lastTime;
    if (timeSinceLast > IDLE_THRESHOLD) {
        // progressively pull targets back to idle values
        fmState.targetFreq += (IDLE_FREQ - fmState.targetFreq) * 0.03;
        fmState.targetModDepth += (IDLE_MOD - fmState.targetModDepth) * 0.03;
        // smoothly lower master gain toward a quiet level
        fmState.baseGain += (QUIET_GAIN - fmState.baseGain) * 0.04;
    } else {
        // active — raise gain toward active level
        fmState.baseGain += (ACTIVE_GAIN - fmState.baseGain) * 0.05;
    }

    idlePhase += 0.01;
    updateFMSynth(idlePhase);

    analyser.getByteTimeDomainData(dataArray);
    // pass mouseDir and mouseSpeed in correct order
    drawOscilloscope(ctx, canvas, analyser, dataArray, particles, fmState.currentModDepth, mouseDir, mouseSpeed);
}
animate();

// Pause/resume on tab
document.addEventListener('visibilitychange', () => {
    if (document.hidden) audioCtx.suspend();
    else audioCtx.resume();
});

// Resize canvas
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
