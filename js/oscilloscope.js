// oscilloscope.js
export function drawOscilloscope(ctx, canvas, analyser, dataArray, particles, currentModDepth, mouseDir, mouseSpeed) {
    // Clear canvas for crisp waveform
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const t = Date.now() / 1000; // seconds for smooth autonomous motion

    // // Draw particles
    // particles.forEach(p => {
    //     // autonomous sinusoidal drift
    //     const driftX = Math.cos(p.phase + t * p.baseSpeed) * p.baseAmp;
    //     const driftY = Math.sin(p.phase + t * (p.baseSpeed * 0.9)) * (p.baseAmp * 0.7);

    //     // subtle mouse influence and random jitter
    //     const mouseInfluence = Math.min(mouseSpeed, 200) * 0.0012; // very small
    //     const mouseXPush = (mouseDir || 0) * 0.0008; // tiny directional push

    //     p.x += p.vx * 0.6 + driftX * 0.03 + mouseXPush + (Math.random() - 0.5) * 0.6;
    //     p.y += p.vy * 0.6 + driftY * 0.03 + (mouseInfluence * (Math.random() - 0.5));

    //     // Wrap edges with padding so particles don't pop abruptly
    //     const half = p.baseSize * 2;
    //     if (p.x < -half) p.x = canvas.width + half;
    //     if (p.x > canvas.width + half) p.x = -half;
    //     if (p.y < -half) p.y = canvas.height + half;
    //     if (p.y > canvas.height + half) p.y = -half;

    //     // size wobble / pulse for liveliness
    //     const wobble = 1 + Math.sin(t * p.wobbleSpeed + p.phase) * p.sizeVariance;
    //     const size = Math.max(1, p.baseSize * wobble + currentModDepth / 60);

    //     // draw circle with particle color
    //     const [r, g, b] = p.color || [234, 172, 89];
    //     ctx.globalAlpha = p.alpha;
    //     ctx.fillStyle = `rgb(${r},${g},${b})`;
    //     ctx.beginPath();
    //     ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    //     ctx.fill();
    //     ctx.globalAlpha = 1;
    // });

    // Draw waveform
    analyser.getByteTimeDomainData(dataArray);
    ctx.lineWidth = 2;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#EAAC59');
    gradient.addColorStop(0.5, '#fff');
    gradient.addColorStop(1, '#EAAC59');
    ctx.strokeStyle = gradient;

    ctx.beginPath();
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;  // normalize 0–2
        const y = v * canvas.height / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
    }
    ctx.stroke();
}
