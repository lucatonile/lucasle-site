/* --- Cursor --- */
const cursor = document.getElementById('cursor');
const trail = document.getElementById('trail');
let mouseX = 0, mouseY = 0;
let trailX = 0, trailY = 0;

document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function animateCursor() {
    cursor.style.left = mouseX + 'px';
    cursor.style.top = mouseY + 'px';

    trailX += (mouseX - trailX) * 0.1;
    trailY += (mouseY - trailY) * 0.1;

    trail.style.left = trailX + 'px';
    trail.style.top = trailY + 'px';

    requestAnimationFrame(animateCursor);
}
animateCursor();

document.querySelectorAll('a').forEach(link => {
    link.addEventListener('mouseenter', () => {
        cursor.style.transform = "translate(-50%, -50%) scale(2)";
        trail.style.background = "rgba(255,255,255,0.5)";
    });
    link.addEventListener('mouseleave', () => {
        cursor.style.transform = "translate(-50%, -50%) scale(1)";
        trail.style.background = "rgba(255,255,255,0.35)";
    });
});

/* --- Wave Links --- */
// Wrap each letter of the links in a span for animation
document.querySelectorAll('.wave-link').forEach(link => {
    const text = link.textContent;
    link.textContent = ''; // clear text
    for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.textContent = text[i];
        // random delay between 0 and 1.5s for natural phase
        span.style.animationDelay = `${Math.random() * 1.5}s`;
        link.appendChild(span);
    }
});



/* --- Floating Particles --- */
// --- Web Audio Setup ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let carrier = audioCtx.createOscillator();
let modulator = audioCtx.createOscillator();
let modGain = audioCtx.createGain();
let gainNode = audioCtx.createGain();

// Connect nodes
carrier.connect(gainNode).connect(audioCtx.destination);
modulator.connect(modGain);
modGain.connect(carrier.frequency);

// Oscillator setup
carrier.type = 'sine';
modulator.type = 'sine';
carrier.frequency.value = 220;
modulator.frequency.value = 1;
modGain.gain.value = 0;
gainNode.gain.value = 0.2;

carrier.start();
modulator.start();

// --- Canvas setup ---
const canvas = document.createElement('canvas');
canvas.id = 'oscilloscope';
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- Oscilloscope setup ---
const analyser = audioCtx.createAnalyser();
gainNode.connect(analyser);
analyser.fftSize = 2048;
const bufferLength = analyser.fftSize;
const dataArray = new Uint8Array(bufferLength);

// --- Particles setup ---
const particles = [];
const numParticles = 25;
for (let i = 0; i < numParticles; i++) {
    particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        size: 5 + Math.random() * 10,
        alpha: 0.5 + Math.random() * 0.5,
    });
}

// --- Mouse velocity & direction ---
let lastMouseX = 0;
let lastMouseY = 0;
let lastMoveTime = Date.now();
let mouseSpeed = 0;
let mouseDir = 0;

let targetFreq = 220;
let targetModDepth = 0;
let currentFreq = 220;
let currentModDepth = 0;

// --- Idle modulation LFO ---
let idleModPhase = 0;

// --- Mouse movement tracking ---
document.addEventListener('mousemove', e => {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    const dt = (Date.now() - lastMoveTime) || 1;

    mouseSpeed = Math.sqrt(dx * dx + dy * dy) / dt * 50;
    mouseDir = dx / dt;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    lastMoveTime = Date.now();

    targetFreq = 220 + mouseSpeed * 5;
    targetModDepth = Math.min(Math.abs(mouseDir) * 2, 300);
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    const smoothing = 0.05;
    const idleVolume = 0.05; // quiet volume when mouse idle
    const maxVolume = 0.2;

    // Smoothly approach targets
    currentFreq += (targetFreq - currentFreq) * smoothing;
    currentModDepth += (targetModDepth - currentModDepth) * smoothing;

    carrier.frequency.setTargetAtTime(currentFreq, audioCtx.currentTime, 0.01);
    modGain.gain.setTargetAtTime(currentModDepth, audioCtx.currentTime, 0.01);

    // Gradually decay to idle
    const idleDecay = Date.now() - lastMoveTime > 100;
    if (idleDecay) {
        targetFreq += (220 - targetFreq) * 0.02;
        targetModDepth += (0 - targetModDepth) * 0.02;
        gainNode.gain.setTargetAtTime(idleVolume, audioCtx.currentTime, 0.02);
    } else {
        gainNode.gain.setTargetAtTime(maxVolume, audioCtx.currentTime, 0.05);
    }

    // --- Add subtle idle modulation ---
    idleModPhase += 0.01;
    const lfo = Math.sin(idleModPhase) * 5; // small ±5 Hz modulation
    carrier.frequency.setValueAtTime(currentFreq + lfo, audioCtx.currentTime);

    // --- Draw background ---
    // ctx.fillStyle = 'rgba(0,0,0,0.03)'; // smaller alpha = less blur
    // ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);


    // --- Draw particles ---
    particles.forEach(p => {
        p.x += p.vx + (mouseDir / 20);
        p.y += p.vy + (mouseSpeed / 200);

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const size = p.size + currentModDepth / 50;
        ctx.fillStyle = `rgba(234,172,89,${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
    });

    // --- Draw oscilloscope ---
    analyser.getByteTimeDomainData(dataArray);
    ctx.lineWidth = 2;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#EAAC59');
    gradient.addColorStop(0.5, '#fff');
    gradient.addColorStop(1, '#EAAC59');
    ctx.strokeStyle = gradient;
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
    }
    ctx.stroke();
}
animate();

// --- Unlock audio on first gesture ---
function unlockAudio() {
    audioCtx.resume();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
}
document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);

// --- Pause/resume on tab visibility ---
document.addEventListener('visibilitychange', () => {
    if (document.hidden) audioCtx.suspend();
    else audioCtx.resume();
});

// --- Handle window resize ---
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// ensure header video and overlay are visible when ready
(function revealHeaderVideo() {
    const mediaWrap = document.querySelector('.header-media');
    const vid = document.getElementById('headerClip');
    if (!mediaWrap || !vid) return;

    function show() {
        mediaWrap.setAttribute('aria-revealed', 'true');
        // ensure any inline/fallback styles are visible
        vid.style.opacity = '1';
        vid.style.filter = 'none';
    }

    if (vid.readyState >= 3) { // HAVE_FUTURE_DATA
        show();
    } else {
        vid.addEventListener('canplay', show, { once: true });
        window.addEventListener('DOMContentLoaded', () => setTimeout(show, 400), { once: true });
    }
})();
