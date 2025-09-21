// oscilloscope.js
export function drawOscilloscope(ctx, canvas, analyser, dataArray) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Read audio data
    analyser.getByteTimeDomainData(dataArray);

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
