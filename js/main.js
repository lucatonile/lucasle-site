import { audioCtx, fmState, setupFMSynth, updateFMSynth, analyser, gainNode, loadReverb } from './fmSynth.js';
import { drawOscilloscope } from './oscilloscope.js';

// State
let audioUnlocked = false;

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

// add scroll percent state
let scrollPct = 0;
let lastScrollY = window.scrollY;

document.addEventListener('scroll', e => {
    const max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
    scrollPct = Math.max(0, Math.min(1, window.scrollY / max));

    // treat scroll like mouse velocity so idle system stays active
    const dy = window.scrollY - lastScrollY;
    const dt = (Date.now() - lastTime) || 1;
    const scrollSpeed = Math.abs(dy) / dt * 50;

    fmState.targetFreq = 110 + scrollSpeed * 15;
    fmState.targetModDepth = Math.min(scrollSpeed * 30, 120);

    lastScrollY = window.scrollY;
    lastTime = Date.now(); // <-- key: prevents idle fade during scrolling
}, { passive: true });
// updateScroll(); // init

// Unlock audio + load reverb
async function unlockAudio() {
    await audioCtx.resume();
    await loadReverb('audio/ir_hall.wav');
    setupFMSynth();

    audioUnlocked = true; // <-- mark unlocked

    document.body.classList.add('osc-active');
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
}

document.addEventListener('click', unlockAudio);
document.addEventListener('click', () => {
    useGhost = !useGhost;
});
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

    // Smooth freq/mod from mouse targets (existing)
    const smoothing = mouseSpeed > 0 ? 0.08 : 0.02; // faster when moving
    fmState.currentFreq += (fmState.targetFreq - fmState.currentFreq) * smoothing;
    fmState.currentModDepth += (fmState.targetModDepth - fmState.currentModDepth) * smoothing;

    // --- Scroll-driven modulation: nudge the target values toward scroll mapping ---
    // map scrollPct to additional freq/mod range
    const scrollFreq = 110 + scrollPct * 400;       // ~110..510 Hz
    const scrollMod = 50 + scrollPct * 150;        // ~50..200 mod depth
    const scrollInfluence = 0.06; // how strongly scroll pulls the targets
    fmState.targetFreq += (scrollFreq - fmState.targetFreq) * scrollInfluence;
    fmState.targetModDepth += (scrollMod - fmState.targetModDepth) * (scrollInfluence * 0.9);

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

    // Let drawOscilloscope decide whether to use ghost or real analyser data
    const useGhost = !audioUnlocked;
    drawOscilloscope(ctx, canvas, analyser, dataArray, useGhost);
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

// Make header video fade and gallery fade in, with moving overlay
(function headerScrollFade() {
    const header = document.querySelector('.site-header');
    const headerMedia = document.querySelector('.header-media');
    const headerClip = document.getElementById('headerClip');
    const headerOverlay = document.querySelector('.header-overlay');
    const headerTitle = document.querySelector('.header-title');
    const spacer = document.querySelector('.hero-spacer');
    const gallery = document.querySelector('.gallery');
    if (!header || !headerMedia || !spacer || !gallery) return;

    const fadeStart = 0.01;
    const fadeEnd = 0.5;

    let latestY = window.scrollY;
    let ticking = false;

    function onScrollEvent() {
        latestY = window.scrollY;
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    function update() {
        ticking = false;

        const headerH = header.offsetHeight || window.innerHeight;
        const spacerH = spacer.offsetHeight || 0;
        const total = (headerH + spacerH) || 1;

        // normalized scroll progress
        const sc = clamp01(latestY / total);
        const norm = clamp01((sc - fadeStart) / (fadeEnd - fadeStart));

        // fade header/video out
        headerMedia.style.opacity = String(1 - norm);
        if (headerClip) headerClip.style.opacity = String(1 - norm);

        // fade gallery in
        gallery.style.opacity = String(norm);
        gallery.style.transform = `translateY(${(1 - norm) * 12}px)`;

        // Move and scale header text
        if (headerOverlay && headerTitle) {
            const topPos = 50 - (norm * 42);
            const fontSize = 96 - (norm * 64);

            headerOverlay.style.top = `${topPos}%`;
            headerTitle.style.fontSize = `clamp(24px, ${fontSize}px, 96px)`;

            // fade out whole overlay
            headerOverlay.style.opacity = 1 - norm;

            // optional: hide it completely after fade
            if (norm >= 0.99) {
                headerOverlay.style.display = 'none';
            } else {
                headerOverlay.style.display = 'flex';
            }

            const subtitle = headerOverlay.querySelector('.header-sub');
            if (subtitle) {
                subtitle.style.opacity = 1 - norm;
            }
        }

    }

    document.addEventListener('scroll', onScrollEvent, { passive: true });
    window.addEventListener('resize', () => {
        latestY = window.scrollY;
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });

    requestAnimationFrame(update);
})();