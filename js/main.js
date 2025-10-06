import { drawOscilloscope } from './oscilloscope.js';

// Cursor
const cursor = document.getElementById('cursor');
const trail = document.getElementById('trail');
let mouseX = 0, mouseY = 0, trailX = 0, trailY = 0;
let lastTime = Date.now();

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

// Scroll tracking
let scrollPct = 0;
let lastScrollY = window.scrollY;
document.addEventListener('scroll', () => {
    const max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
    scrollPct = Math.max(0, Math.min(1, window.scrollY / max));
    lastScrollY = window.scrollY;
    lastTime = Date.now();
}, { passive: true });

// Animate visuals
function animate() {
    requestAnimationFrame(animate);

    // Cursor
    trailX += (mouseX - trailX) * 0.1;
    trailY += (mouseY - trailY) * 0.1;
    cursor.style.left = mouseX + 'px';
    cursor.style.top = mouseY + 'px';
    trail.style.left = trailX + 'px';
    trail.style.top = trailY + 'px';

    // Draw placeholder oscilloscope (if any visual effect remains)
    drawOscilloscope(ctx, canvas);
}
animate();

// Resize canvas
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Header fade & gallery reveal
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
    const fadeEnd = 0.9;

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

// Select all Vimeo iframes in your portfolio
const vimeoIframes = document.querySelectorAll('.portfolio-video iframe');
let currentPlayer = null; // store the currently playing video

vimeoIframes.forEach(iframe => {
    const player = new Vimeo.Player(iframe);

    player.on('play', () => {
        // If there's another video playing, pause it
        if (currentPlayer && currentPlayer !== player) {
            currentPlayer.pause();
        }
        // Set this as the new currently playing video
        currentPlayer = player;
    });

    // Optional: reset currentPlayer when this video is paused
    player.on('pause', () => {
        if (currentPlayer === player) {
            currentPlayer = null;
        }
    });
});