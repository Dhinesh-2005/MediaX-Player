/**
 * MediaX Player - Media Information Inspector
 * Extracts real audio/video metadata, resolution, aspect ratio,
 * estimated framerate, audio channels, and container details.
 */

class MediaMetadataInspector {
  constructor() {
    this.videoEl = null;
    this.currentFile = null;
    this.fpsEstimate = null;
    this.fpsCallbackId = null;
  }

  init(videoEl) {
    this.videoEl = videoEl;
  }

  setCurrentFile(fileOrItem) {
    this.currentFile = fileOrItem;
    this.fpsEstimate = null;
    this.measureFps();
  }

  measureFps() {
    if (!this.videoEl || !('requestVideoFrameCallback' in HTMLVideoElement.prototype)) return;

    let frameCount = 0;
    let startTime = null;

    const onFrame = (now, metadata) => {
      if (!startTime) startTime = now;
      frameCount++;
      const elapsed = (now - startTime) / 1000;
      if (elapsed >= 1.0) {
        this.fpsEstimate = Math.round((frameCount / elapsed) * 10) / 10;
        this.updateUI();
        return;
      }
      if (this.videoEl && !this.videoEl.paused) {
        this.videoEl.requestVideoFrameCallback(onFrame);
      }
    };

    this.videoEl.requestVideoFrameCallback(onFrame);
  }

  getInfo() {
    const info = {
      fileName: 'Not available',
      fileSize: 'Not available',
      duration: 'Not available',
      container: 'Not available',
      // Video
      videoCodec: 'Not available',
      resolution: 'Not available',
      aspectRatio: 'Not available',
      frameRate: this.fpsEstimate ? `${this.fpsEstimate} fps` : 'Not available',
      // Audio
      audioCodec: 'Not available',
      audioChannels: 'Not available',
      sampleRate: 'Not available'
    };

    if (this.currentFile) {
      info.fileName = this.currentFile.name || 'Stream / Sample Media';
      if (this.currentFile.size) {
        info.fileSize = this.formatBytes(this.currentFile.size);
      }
      const ext = info.fileName.split('.').pop().toUpperCase();
      info.container = ext || 'Standard Media';
    }

    if (this.videoEl) {
      if (!isNaN(this.videoEl.duration) && this.videoEl.duration > 0) {
        info.duration = this.formatTime(this.videoEl.duration);
      }

      if (this.videoEl.videoWidth && this.videoEl.videoHeight) {
        const w = this.videoEl.videoWidth;
        const h = this.videoEl.videoHeight;
        info.resolution = `${w} × ${h}`;
        info.aspectRatio = this.calculateAspectRatio(w, h);
      }

      // Check browser reported canPlayType / MIME if available
      if (this.currentFile && this.currentFile.file && this.currentFile.file.type) {
        info.videoCodec = this.currentFile.file.type;
      }
    }

    if (window.MediaXAudio && window.MediaXAudio.audioCtx) {
      info.sampleRate = `${window.MediaXAudio.audioCtx.sampleRate} Hz`;
      info.audioChannels = window.MediaXAudio.isMonoEnabled ? '1 (Mono)' : '2 (Stereo)';
    }

    return info;
  }

  calculateAspectRatio(width, height) {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const rW = width / divisor;
    const rH = height / divisor;
    if ((rW === 16 && rH === 9) || (rW === 4 && rH === 3) || (rW === 21 && rH === 9)) {
      return `${rW}:${rH}`;
    }
    const ratio = (width / height).toFixed(2);
    return `${rW}:${rH} (~${ratio}:1)`;
  }

  formatBytes(bytes) {
    if (!bytes) return 'Not available';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatTime(seconds) {
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  updateUI() {
    const pane = document.getElementById('tab-info');
    if (!pane) return;
    const info = this.getInfo();

    pane.innerHTML = `
      <div class="settings-section-title">Media File</div>
      <div class="settings-item">
        <div class="settings-item-row">
          <span class="settings-label">File Name</span>
          <span class="settings-badge" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(info.fileName)}</span>
        </div>
        <div class="settings-item-row">
          <span class="settings-label">File Size</span>
          <span class="settings-badge">${info.fileSize}</span>
        </div>
        <div class="settings-item-row">
          <span class="settings-label">Duration</span>
          <span class="settings-badge">${info.duration}</span>
        </div>
        <div class="settings-item-row">
          <span class="settings-label">Container Format</span>
          <span class="settings-badge">${info.container}</span>
        </div>
      </div>

      <div class="settings-section-title">Video Stream</div>
      <div class="settings-item">
        <div class="settings-item-row">
          <span class="settings-label">Resolution</span>
          <span class="settings-badge">${info.resolution}</span>
        </div>
        <div class="settings-item-row">
          <span class="settings-label">Aspect Ratio</span>
          <span class="settings-badge">${info.aspectRatio}</span>
        </div>
        <div class="settings-item-row">
          <span class="settings-label">Frame Rate</span>
          <span class="settings-badge">${info.frameRate}</span>
        </div>
        <div class="settings-item-row">
          <span class="settings-label">MIME / Codec</span>
          <span class="settings-badge">${info.videoCodec}</span>
        </div>
      </div>

      <div class="settings-section-title">Audio Stream</div>
      <div class="settings-item">
        <div class="settings-item-row">
          <span class="settings-label">Channels</span>
          <span class="settings-badge">${info.audioChannels}</span>
        </div>
        <div class="settings-item-row">
          <span class="settings-label">Sample Rate</span>
          <span class="settings-badge">${info.sampleRate}</span>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }
}

window.MediaXMetadata = new MediaMetadataInspector();
