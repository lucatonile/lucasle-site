// oscilloscope.js
// Ghost waveform for pre-interaction state (stronger, more organic)
let ghostPhase = 0;
let ghostAmpLFO = 0;
function generateGhostWaveform(dataArray) {
    const len = dataArray.length;

    ghostAmpLFO = 0.6 + Math.sin(ghostPhase * 0.08) * 0.4;
    const verticalBias = Math.sin(ghostPhase * 0.22) * 0; // ignore extra vertical shift

    for (let i = 0; i < len; i++) {
        const t = i / len;
        const a = Math.sin(ghostPhase * 1.6 + t * Math.PI * 2 * 1.8) * 1.0;
        const b = Math.sin(ghostPhase * 0.9 + t * Math.PI * 2 * 3.2) * 0.6;
        const c = Math.sin(ghostPhase * 2.4 + t * Math.PI * 2 * 5.1) * 0.28;
        const combined = (a + b + c) * 0.3 * ghostAmpLFO;

        // map -1..1 to 0..255 centered around 128
        const v = Math.round((combined) * 127 + 128);
        dataArray[i] = Math.max(0, Math.min(255, v));
    }

    ghostPhase += 0.035 + (Math.random() * 0.01);
}


export function drawOscilloscope(ctx, canvas, analyser, dataArray, useGhost = false) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (useGhost) generateGhostWaveform(dataArray);
    else analyser.getByteTimeDomainData(dataArray);

    ctx.save();
    ctx.lineWidth = 2;

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#EAAC59');
    gradient.addColorStop(0.5, '#fff');
    gradient.addColorStop(1, '#EAAC59');
    ctx.strokeStyle = gradient;

    const midY = canvas.height / 2;
    const verticalScale = useGhost ? (canvas.height * 0.15) : (canvas.height / 3);
    const sliceW = canvas.width / dataArray.length;
    let x = 0;

    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128; // normalize to -1..1
        const y = midY + v * verticalScale;   // now perfectly centered
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceW;
    }

    ctx.stroke();
    ctx.restore();
}

