// oscilloscope.js
// Ghost waveform for pre-interaction state (stronger, more organic)
let ghostPhase = 0;
let ghostAmpLFO = 0;
function generateGhostWaveform(dataArray) {
    const len = dataArray.length;
    // slow LFO to modulate amplitude over time
    ghostAmpLFO = 0.5 + Math.sin(ghostPhase * 0.12) * 0.35; // ~0.15..0.85

    for (let i = 0; i < len; i++) {
        const t = i / len;

        // multiple harmonics with different speeds and strengths
        const a = Math.sin(ghostPhase * 1.6 + t * Math.PI * 2 * 1.8) * 1.0;
        const b = Math.sin(ghostPhase * 0.9 + t * Math.PI * 2 * 3.2) * 0.6;
        const c = Math.sin(ghostPhase * 2.4 + t * Math.PI * 2 * 5.1) * 0.28;

        // slight chaotic jitter / noise
        const noise = (Math.sin(ghostPhase * 7.3 + t * 31.0) * 0.06) + (Math.random() * 0.02 - 0.01);

        const combined = (a + b + c) * 0.5 * ghostAmpLFO + noise;

        // normalize roughly into 0..255 centered at 128
        const v = Math.max(0, Math.min(255, Math.round((combined + 1) * 128)));
        dataArray[i] = v;
    }

    // advance phase slightly each frame, with tiny randomness so it feels alive
    ghostPhase += 0.032 + (Math.random() * 0.008);
}

export function drawOscilloscope(ctx, canvas, analyser, dataArray, useGhost = false) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (useGhost) {
        generateGhostWaveform(dataArray);
    } else {
        analyser.getByteTimeDomainData(dataArray);
    }

    // Horizontal centered waveform
    ctx.save();
    ctx.lineWidth = 2;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#EAAC59');
    gradient.addColorStop(0.5, '#fff');
    gradient.addColorStop(1, '#EAAC59');
    ctx.strokeStyle = gradient;

    const midY = canvas.height / 2;
    const sliceW = canvas.width / dataArray.length;
    let x = 0;

    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0; // 0..2
        const y = midY + (v - 1) * (canvas.height / 3); // scaled vertical amplitude
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceW;
    }
    ctx.stroke();
    ctx.restore();
}
