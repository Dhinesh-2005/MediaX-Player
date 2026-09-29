/**
 * MediaX Player - Real-Time Audio Visualizer
 * Renders glowing frequency bars, fluid waveform, or radial pulse
 * on an HTML5 Canvas using Web Audio API's AnalyserNode.
 */

class AudioVisualizer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animFrameId = null;
    this.mode = 'bars'; // 'bars', 'wave', 'radial'
    this.freqData = null;
    this.timeData = null;
    this.isRunning = false;
    this.peakBars = [];
  }

  init(canvasEl) {
    this.canvas = canvasEl;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    const bufferLength = 512;
    this.freqData = new Uint8Array(bufferLength);
    this.timeData = new Uint8Array(bufferLength);
    this.peakBars = new Array(64).fill(0);
  }

  handleResize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || window.innerWidth;
    this.height = rect.height || window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.render();
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.ctx && this.width && this.height) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  render() {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(() => this.render());

    if (!window.MediaXAudio || !this.ctx || !this.width || !this.height) return;

    window.MediaXAudio.getFrequencyData(this.freqData);
    window.MediaXAudio.getTimeDomainData(this.timeData);

    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.mode === 'wave') {
      this.renderWaveform();
    } else if (this.mode === 'radial') {
      this.renderRadial();
    } else {
      this.renderBars();
    }
  }

  renderBars() {
    const numBars = 64;
    const barWidth = (this.width / numBars) * 0.75;
    const gap = (this.width - barWidth * numBars) / (numBars + 1);
    const centerY = this.height * 0.85;

    // Linear gradient for bars
    const gradient = this.ctx.createLinearGradient(0, centerY, 0, centerY - 240);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.8)');
    gradient.addColorStop(1, 'rgba(236, 72, 153, 1)');

    for (let i = 0; i < numBars; i++) {
      // Map index non-linearly to emphasize bass and mids
      const sampleIdx = Math.floor(Math.pow(i / numBars, 1.6) * (this.freqData.length * 0.7));
      const val = this.freqData[sampleIdx] || 0;
      const barHeight = Math.max(4, (val / 255) * (this.height * 0.45));

      const x = gap + i * (barWidth + gap);
      const y = centerY - barHeight;

      // Peak drop physics
      if (barHeight > (this.peakBars[i] || 0)) {
        this.peakBars[i] = barHeight;
      } else {
        this.peakBars[i] = Math.max(0, (this.peakBars[i] || 0) - 1.5);
      }

      // Draw Main Bar with rounded top
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      this.ctx.fill();

      // Draw Peak Cap
      const peakY = centerY - this.peakBars[i] - 4;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      this.ctx.shadowBlur = 6;
      this.ctx.fillRect(x, peakY, barWidth, 2);
      this.ctx.shadowBlur = 0;

      // Reflection underneath
      this.ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      this.ctx.beginPath();
      this.ctx.roundRect(x, centerY + 4, barWidth, barHeight * 0.25, [0, 0, 4, 4]);
      this.ctx.fill();
    }
  }

  renderWaveform() {
    this.ctx.lineWidth = 3;
    const gradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(0.5, '#a855f7');
    gradient.addColorStop(1, '#ec4899');
    this.ctx.strokeStyle = gradient;
    this.ctx.shadowColor = 'rgba(168, 85, 247, 0.75)';
    this.ctx.shadowBlur = 12;

    this.ctx.beginPath();
    const sliceWidth = this.width / this.timeData.length;
    let x = 0;

    for (let i = 0; i < this.timeData.length; i++) {
      const v = this.timeData[i] / 128.0;
      const y = (v * this.height) / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  renderRadial() {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const baseRadius = Math.min(centerX, centerY) * 0.35;
    const numPoints = 80;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);

    const gradient = this.ctx.createLinearGradient(-baseRadius, -baseRadius, baseRadius, baseRadius);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(1, '#ec4899');
    this.ctx.strokeStyle = gradient;
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = 'rgba(99, 102, 241, 0.6)';
    this.ctx.shadowBlur = 15;

    this.ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const sampleIdx = Math.floor((i / numPoints) * (this.freqData.length * 0.5));
      const val = this.freqData[sampleIdx] || 0;
      const r = baseRadius + (val / 255) * 80;

      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;

      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    this.ctx.restore();
  }
}

window.MediaXVisualizer = new AudioVisualizer();
