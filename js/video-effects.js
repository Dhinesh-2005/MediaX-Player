/**
 * MediaX Player - Video Transformations & Image Adjustments
 * Manages display modes, aspect ratios, rotation, flipping, zoom, pan,
 * and real-time CSS image adjustments (brightness, contrast, saturation, hue, sharpness).
 */

class VideoEffectsManager {
  constructor() {
    this.videoEl = null;
    this.stageEl = null;

    // Display & Transformations
    this.displayMode = 'fit'; // 'fit', 'fill', 'original', '16:9', '4:3', 'stretch', 'crop'
    this.rotation = 0; // 0, 90, 180, 270
    this.flipH = false;
    this.flipV = false;
    this.zoom = 1.0; // 1.0 to 2.5
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    // Image Adjustments
    this.brightness = 100; // 50% to 150%
    this.contrast = 100;   // 50% to 150%
    this.saturation = 100; // 0% to 200%
    this.hue = 0;          // 0deg to 360deg
    this.sharpness = 0;    // -5 to +5 (blur / clarity)
  }

  init(videoEl, stageEl) {
    this.videoEl = videoEl;
    this.stageEl = stageEl;
    this.bindPanEvents();
    this.applyAll();
  }

  setDisplayMode(mode) {
    this.displayMode = mode;
    if (!this.videoEl) return;

    // Reset aspect-ratio overrides
    this.videoEl.style.aspectRatio = '';
    this.videoEl.style.width = '100%';
    this.videoEl.style.height = '100%';

    switch (mode) {
      case 'fit':
        this.videoEl.style.objectFit = 'contain';
        break;
      case 'fill':
        this.videoEl.style.objectFit = 'cover';
        break;
      case 'original':
        this.videoEl.style.objectFit = 'none';
        if (this.videoEl.videoWidth) {
          this.videoEl.style.width = `${this.videoEl.videoWidth}px`;
          this.videoEl.style.height = `${this.videoEl.videoHeight}px`;
        }
        break;
      case '16:9':
        this.videoEl.style.objectFit = 'contain';
        this.videoEl.style.aspectRatio = '16 / 9';
        break;
      case '4:3':
        this.videoEl.style.objectFit = 'contain';
        this.videoEl.style.aspectRatio = '4 / 3';
        break;
      case 'stretch':
        this.videoEl.style.objectFit = 'fill';
        break;
      case 'crop':
        this.videoEl.style.objectFit = 'cover';
        break;
      default:
        this.videoEl.style.objectFit = 'contain';
    }

    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Display mode: ${mode.toUpperCase()}`, 'info');
    }
  }

  // --- Transformations ---
  rotateClockwise() {
    this.rotation = (this.rotation + 90) % 360;
    this.applyTransform();
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Rotation: ${this.rotation}°`, 'info');
    }
  }

  setRotation(deg) {
    this.rotation = deg % 360;
    this.applyTransform();
  }

  resetRotation() {
    this.rotation = 0;
    this.applyTransform();
  }

  toggleFlipH() {
    this.flipH = !this.flipH;
    this.applyTransform();
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Flip Horizontal: ${this.flipH ? 'ON' : 'OFF'}`, 'info');
    }
  }

  toggleFlipV() {
    this.flipV = !this.flipV;
    this.applyTransform();
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Flip Vertical: ${this.flipV ? 'ON' : 'OFF'}`, 'info');
    }
  }

  resetFlip() {
    this.flipH = false;
    this.flipV = false;
    this.applyTransform();
  }

  setZoom(zoomFactor) {
    this.zoom = Math.max(1.0, Math.min(2.5, Math.round(zoomFactor * 100) / 100));
    if (this.zoom === 1.0) {
      this.panX = 0;
      this.panY = 0;
    }
    this.applyTransform();
  }

  zoomIn(step = 0.15) {
    this.setZoom(this.zoom + step);
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Zoom: ${Math.round(this.zoom * 100)}%`, 'info');
    }
  }

  zoomOut(step = 0.15) {
    this.setZoom(this.zoom - step);
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Zoom: ${Math.round(this.zoom * 100)}%`, 'info');
    }
  }

  resetZoom() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  applyTransform() {
    if (!this.videoEl) return;
    const transforms = [];

    // Pan (only when zoomed)
    if (this.zoom > 1.0) {
      transforms.push(`translate(${this.panX}px, ${this.panY}px)`);
    }

    // Zoom
    if (this.zoom !== 1.0) {
      transforms.push(`scale(${this.zoom})`);
    }

    // Rotation
    if (this.rotation !== 0) {
      transforms.push(`rotate(${this.rotation}deg)`);
    }

    // Flipping
    const scaleX = this.flipH ? -1 : 1;
    const scaleY = this.flipV ? -1 : 1;
    if (scaleX !== 1 || scaleY !== 1) {
      transforms.push(`scale(${scaleX}, ${scaleY})`);
    }

    this.videoEl.style.transform = transforms.join(' ');
  }

  bindPanEvents() {
    if (!this.stageEl) return;

    this.stageEl.addEventListener('mousedown', (e) => {
      if (this.zoom <= 1.0 || e.button !== 0) return;
      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
      this.stageEl.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning) return;
      this.panX = e.clientX - this.panStartX;
      this.panY = e.clientY - this.panStartY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        if (this.stageEl) this.stageEl.style.cursor = '';
      }
    });

    // Mouse wheel zoom
    this.stageEl.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          this.zoomIn(0.1);
        } else {
          this.zoomOut(0.1);
        }
      }
    }, { passive: false });
  }

  // --- Image Adjustments ---
  setBrightness(val) {
    this.brightness = Math.max(50, Math.min(150, val));
    this.applyFilters();
  }

  setContrast(val) {
    this.contrast = Math.max(50, Math.min(150, val));
    this.applyFilters();
  }

  setSaturation(val) {
    this.saturation = Math.max(0, Math.min(200, val));
    this.applyFilters();
  }

  setHue(val) {
    this.hue = (val % 360 + 360) % 360;
    this.applyFilters();
  }

  setSharpness(val) {
    this.sharpness = Math.max(-5, Math.min(5, val));
    this.applyFilters();
  }

  resetAdjustment(type) {
    switch (type) {
      case 'brightness': this.brightness = 100; break;
      case 'contrast': this.contrast = 100; break;
      case 'saturation': this.saturation = 100; break;
      case 'hue': this.hue = 0; break;
      case 'sharpness': this.sharpness = 0; break;
      case 'all':
        this.brightness = 100;
        this.contrast = 100;
        this.saturation = 100;
        this.hue = 0;
        this.sharpness = 0;
        break;
    }
    this.applyFilters();
  }

  applyFilters() {
    if (!this.videoEl) return;
    const filters = [];

    if (this.brightness !== 100) filters.push(`brightness(${this.brightness}%)`);
    if (this.contrast !== 100) filters.push(`contrast(${this.contrast}%)`);
    if (this.saturation !== 100) filters.push(`saturate(${this.saturation}%)`);
    if (this.hue !== 0) filters.push(`hue-rotate(${this.hue}deg)`);
    if (this.sharpness < 0) filters.push(`blur(${Math.abs(this.sharpness)}px)`);

    this.videoEl.style.filter = filters.length > 0 ? filters.join(' ') : 'none';
  }

  applyAll() {
    this.setDisplayMode(this.displayMode);
    this.applyTransform();
    this.applyFilters();
  }
}

window.MediaXVideoEffects = new VideoEffectsManager();
