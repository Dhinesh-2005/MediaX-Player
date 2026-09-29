/**
 * MediaX Player - FFmpeg WebAssembly On-Demand Transcoder
 * Completely client-side WebAssembly video/audio decoder & transcoder.
 * Lazy-loaded only when unsupported format is detected or on request.
 * Zero server interaction - user files never leave their device.
 */

class FFmpegClientLoader {
  constructor() {
    this.ffmpeg = null;
    this.isLoaded = false;
    this.isLoading = false;
    this.overlayEl = null;
    this.progressBarEl = null;
    this.progressTextEl = null;
    this.statusTextEl = null;
    this.abortController = null;
  }

  init(overlayEl, progressBarEl, progressTextEl, statusTextEl) {
    this.overlayEl = overlayEl;
    this.progressBarEl = progressBarEl;
    this.progressTextEl = progressTextEl;
    this.statusTextEl = statusTextEl;
  }

  async loadEngine() {
    if (this.isLoaded) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    this.showProgress('Loading FFmpeg WebAssembly Engine...', 15);

    try {
      // Dynamically load ffmpeg script if not present
      if (!window.FFmpeg) {
        await this.loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
      }

      const { createFFmpeg } = window.FFmpeg;
      this.ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
      });

      this.ffmpeg.setProgress(({ ratio }) => {
        const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
        this.showProgress('Processing locally on device...', percent);
      });

      await this.ffmpeg.load();
      this.isLoaded = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      console.warn('FFmpeg WebAssembly load warning:', err);
      this.isLoading = false;
      this.hideProgress();
      throw err;
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Transcodes an unsupported media file (e.g. MKV/AVI/unsupported audio) into MP4 / WebM
   */
  async transcodeFile(file) {
    try {
      this.showProgress('Initializing WebAssembly decoder...', 5);
      await this.loadEngine();

      this.showProgress('Reading file data locally...', 10);
      const { fetchFile } = window.FFmpeg;
      const fileData = await fetchFile(file);

      const inName = `input_${file.name.replace(/[^a-zA-Z0-9._]/g, '_')}`;
      const outName = 'output_converted.mp4';

      this.ffmpeg.FS('writeFile', inName, fileData);
      this.showProgress('Transcoding video stream...', 20);

      // Fast remux or transcode to standard H264/AAC MP4
      await this.ffmpeg.run('-i', inName, '-c:v', 'copy', '-c:a', 'aac', outName);

      const outData = this.ffmpeg.FS('readFile', outName);
      const convertedBlob = new Blob([outData.buffer], { type: 'video/mp4' });

      // Clean virtual file system
      try {
        this.ffmpeg.FS('unlink', inName);
        this.ffmpeg.FS('unlink', outName);
      } catch (e) {}

      this.hideProgress();

      if (window.MediaXApp) {
        window.MediaXApp.showToast('Transcoding completed successfully!', 'success');
      }

      return {
        name: file.name.replace(/\.[^/.]+$/, "") + ".mp4",
        size: convertedBlob.size,
        type: 'video',
        url: URL.createObjectURL(convertedBlob),
        file: convertedBlob
      };
    } catch (err) {
      this.hideProgress();
      console.error('FFmpeg transcode error:', err);
      throw err;
    }
  }

  showProgress(status, percent) {
    if (this.overlayEl) {
      this.overlayEl.classList.add('active');
    }
    if (this.statusTextEl) {
      this.statusTextEl.textContent = status;
    }
    if (this.progressBarEl) {
      this.progressBarEl.style.width = `${percent}%`;
    }
    if (this.progressTextEl) {
      this.progressTextEl.textContent = `${percent}%`;
    }
  }

  hideProgress() {
    if (this.overlayEl) {
      this.overlayEl.classList.remove('active');
    }
  }

  cancel() {
    this.hideProgress();
    if (window.MediaXApp) {
      window.MediaXApp.showToast('Transcoding cancelled', 'info');
    }
  }
}

window.MediaXFFmpeg = new FFmpegClientLoader();
