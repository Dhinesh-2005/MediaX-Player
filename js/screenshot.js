/**
 * MediaX Player - High-Resolution Video Screenshot Engine
 * Captures clean, unscaled video frames via Canvas API,
 * with multi-format support (PNG, JPG, WEBP), clipboard copy, and download.
 */

class ScreenshotManager {
  constructor() {
    this.videoEl = null;
    this.flashEl = null;
    this.modalEl = null;
    this.previewImgEl = null;
    this.lastBlob = null;
    this.lastFilename = '';
    this.format = 'image/png'; // 'image/png', 'image/jpeg', 'image/webp'
  }

  init(videoEl, flashEl, modalEl, previewImgEl) {
    this.videoEl = videoEl;
    this.flashEl = flashEl;
    this.modalEl = modalEl;
    this.previewImgEl = previewImgEl;

    if (window.MediaXStorage) {
      this.format = window.MediaXStorage.getSetting('screenshotFormat') || 'image/png';
    }
  }

  /**
   * Captures the current video frame
   * @param {boolean} showModal - whether to open preview modal or instant download
   */
  async capture(showModal = true) {
    if (!this.videoEl || !this.videoEl.videoWidth || !this.videoEl.videoHeight) {
      if (window.MediaXApp) {
        window.MediaXApp.showToast('No active video to capture', 'warning');
      }
      return;
    }

    // Trigger visual camera shutter flash
    this.triggerFlash();

    try {
      const width = this.videoEl.videoWidth;
      const height = this.videoEl.videoHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Check if user requested filters to be included
      const includeFilters = window.MediaXStorage ? window.MediaXStorage.getSetting('screenshotIncludeFilters') : false;
      if (includeFilters && this.videoEl.style.filter && this.videoEl.style.filter !== 'none') {
        ctx.filter = this.videoEl.style.filter;
      }

      ctx.drawImage(this.videoEl, 0, 0, width, height);

      // Format filename: screenshot-YYYY-MM-DD-HH-mm-ss.ext
      const ext = this.format === 'image/jpeg' ? 'jpg' : (this.format === 'image/webp' ? 'webp' : 'png');
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      this.lastFilename = `screenshot-${timestamp}.${ext}`;

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, this.format, 0.95);
      });

      this.lastBlob = blob;
      const dataUrl = canvas.toDataURL(this.format, 0.95);

      if (showModal && this.modalEl && this.previewImgEl) {
        this.previewImgEl.src = dataUrl;
        this.modalEl.classList.add('open');
        if (window.MediaXApp) {
          window.MediaXApp.openBackdrop(() => this.closeModal());
        }
      } else {
        this.download();
      }

      if (window.MediaXApp) {
        window.MediaXApp.showToast(`Screenshot captured (${width}×${height})`, 'success');
      }
    } catch (err) {
      console.error('ScreenshotManager: Frame capture failed', err);
      if (window.MediaXApp) {
        window.MediaXApp.showToast('Unable to capture screenshot from current frame', 'error');
      }
    }
  }

  triggerFlash() {
    if (!this.flashEl) return;
    this.flashEl.classList.add('active');
    setTimeout(() => {
      this.flashEl.classList.remove('active');
    }, 180);
  }

  download() {
    if (!this.lastBlob) return;
    const url = URL.createObjectURL(this.lastBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.lastFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    this.closeModal();
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Saved: ${this.lastFilename}`, 'success');
    }
  }

  async copyToClipboard() {
    if (!this.lastBlob) return;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        // ClipboardItem requires image/png
        let clipBlob = this.lastBlob;
        if (this.lastBlob.type !== 'image/png') {
          // Convert to PNG for clipboard compatibility
          const img = new Image();
          img.src = URL.createObjectURL(this.lastBlob);
          await new Promise(r => img.onload = r);
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          c.getContext('2d').drawImage(img, 0, 0);
          clipBlob = await new Promise(r => c.toBlob(r, 'image/png'));
        }

        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': clipBlob })
        ]);

        if (window.MediaXApp) {
          window.MediaXApp.showToast('Screenshot copied to clipboard!', 'success');
        }
        this.closeModal();
      } else {
        throw new Error('Clipboard API not supported');
      }
    } catch (e) {
      console.warn('ScreenshotManager: Clipboard copy error', e);
      if (window.MediaXApp) {
        window.MediaXApp.showToast('Clipboard copy not permitted. Downloading instead.', 'warning');
      }
      this.download();
    }
  }

  setFormat(format) {
    this.format = format;
    if (window.MediaXStorage) {
      window.MediaXStorage.setSetting('screenshotFormat', format);
    }
  }

  closeModal() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
    if (window.MediaXApp) {
      window.MediaXApp.closeBackdrop();
    }
  }
}

window.MediaXScreenshot = new ScreenshotManager();
