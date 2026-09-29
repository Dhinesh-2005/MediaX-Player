/**
 * MediaX Player - Core Player Controller
 * Orchestrates HTML5 media playback, A-B looping, frame-by-frame precision stepping,
 * audio/video mode switching, and playback position persistence.
 */

class MediaXPlayerController {
  constructor() {
    this.videoEl = null;
    this.currentMedia = null;
    this.isPlaying = false;
    this.isMuted = false;
    this.volume = 1.0;
    this.speed = 1.0;

    // A-B Loop state
    this.loopPointA = null;
    this.loopPointB = null;
    this.isLoopActive = false;

    // Audio mode vs Video mode
    this.isAudioOnly = false;

    // Listeners callbacks
    this.onTimeUpdateCallbacks = [];
    this.onPlayStateCallbacks = [];
    this.onMediaLoadedCallbacks = [];
  }

  init(videoEl) {
    this.videoEl = videoEl;
    if (!this.videoEl) return;

    this.bindEvents();
    const savedVol = window.MediaXStorage ? window.MediaXStorage.getSetting('defaultVolume') : 1.0;
    this.setVolume(savedVol);
  }

  bindEvents() {
    this.videoEl.addEventListener('play', () => {
      this.isPlaying = true;
      if (window.MediaXAudio) window.MediaXAudio.ensureContext();
      if (this.isAudioOnly && window.MediaXVisualizer) {
        window.MediaXVisualizer.start();
        const disc = document.getElementById('audio-art-disc');
        if (disc) {
          disc.classList.remove('paused');
          disc.classList.add('spinning');
        }
      }
      this.notifyPlayState(true);
    });

    this.videoEl.addEventListener('pause', () => {
      this.isPlaying = false;
      if (this.isAudioOnly && window.MediaXVisualizer) {
        const disc = document.getElementById('audio-art-disc');
        if (disc) disc.classList.add('paused');
      }
      this.notifyPlayState(false);
      this.saveCurrentPlaybackPoint();
    });

    this.videoEl.addEventListener('timeupdate', () => {
      const curTime = this.videoEl.currentTime;

      // Check A-B Loop
      if (this.isLoopActive && this.loopPointA !== null && this.loopPointB !== null) {
        if (curTime >= this.loopPointB) {
          this.videoEl.currentTime = this.loopPointA;
          return;
        }
      }

      // Update subtitles
      if (window.MediaXSubtitles) {
        window.MediaXSubtitles.update(curTime);
      }

      this.notifyTimeUpdate(curTime, this.videoEl.duration);
    });

    this.videoEl.addEventListener('ended', () => {
      this.isPlaying = false;
      this.notifyPlayState(false);
      if (window.MediaXPlaylist) {
        window.MediaXPlaylist.playNext();
      }
    });

    this.videoEl.addEventListener('loadedmetadata', () => {
      if (window.MediaXAudio) {
        window.MediaXAudio.init(this.videoEl);
        window.MediaXAudio.updateAvailableTracks(this.currentMedia);
      }
      if (window.MediaXMetadata) {
        window.MediaXMetadata.setCurrentFile(this.currentMedia);
      }
      if (window.MediaXSubtitles) {
        window.MediaXSubtitles.setVideoElement(this.videoEl);
        window.MediaXSubtitles.updateAvailableTracks();
      }

      // Check for playback resume point
      this.checkResumePoint();

      this.notifyMediaLoaded();
    });

    this.videoEl.addEventListener('error', (e) => {
      console.warn('Media element error event:', e);
      this.handlePlaybackError();
    });
  }

  async loadMedia(mediaItem) {
    if (!mediaItem || !mediaItem.url) return;
    this.currentMedia = mediaItem;

    // Detect if audio-only format
    const name = (mediaItem.name || '').toLowerCase();
    const isAudio = mediaItem.type === 'audio' ||
      /\.(mp3|wav|ogg|flac|m4a|aac|wma)$/i.test(name);
    this.setAudioOnlyMode(isAudio);

    // Reset A-B Loop
    this.clearABLoop();

    // Reset subtitles text
    if (window.MediaXSubtitles) {
      window.MediaXSubtitles.clear();
      window.MediaXSubtitles.setVideoElement(this.videoEl);
    }

    this.videoEl.src = mediaItem.url;
    this.videoEl.load();

    try {
      await this.videoEl.play();
    } catch (err) {
      // Autoplay with audio might require user click
      console.log('Autoplay deferred for user gesture:', err);
    }

    // Save to recents
    if (window.MediaXStorage && mediaItem.file) {
      window.MediaXStorage.addRecent({
        name: mediaItem.name,
        size: mediaItem.size,
        type: isAudio ? 'audio' : 'video'
      });
    }

    // Update app header titles
    if (window.MediaXApp) {
      window.MediaXApp.updateActiveMediaTitle(mediaItem.name, isAudio ? 'AUDIO' : 'VIDEO');
    }
  }

  setAudioOnlyMode(isAudio) {
    this.isAudioOnly = isAudio;
    const vizContainer = document.getElementById('audio-visualizer-container');
    const audioTitle = document.getElementById('audio-title-large');

    if (isAudio) {
      if (vizContainer) vizContainer.classList.add('active');
      if (audioTitle && this.currentMedia) {
        audioTitle.textContent = this.currentMedia.name;
      }
      if (window.MediaXVisualizer) window.MediaXVisualizer.start();
    } else {
      if (vizContainer) vizContainer.classList.remove('active');
      if (window.MediaXVisualizer) window.MediaXVisualizer.stop();
    }
  }

  togglePlay() {
    if (!this.videoEl || !this.videoEl.src) return;
    if (this.videoEl.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  play() {
    if (this.videoEl && this.videoEl.src) {
      if (window.MediaXAudio) window.MediaXAudio.ensureContext();
      this.videoEl.play().catch(e => console.warn('Play interrupted', e));
    }
  }

  pause() {
    if (this.videoEl) {
      this.videoEl.pause();
    }
  }

  seekTo(seconds) {
    if (!this.videoEl || isNaN(this.videoEl.duration)) return;
    const target = Math.max(0, Math.min(this.videoEl.duration, seconds));
    this.videoEl.currentTime = target;
  }

  skip(seconds) {
    if (!this.videoEl || isNaN(this.videoEl.duration)) return;
    this.seekTo(this.videoEl.currentTime + seconds);
    if (window.MediaXApp) {
      window.MediaXApp.showGestureFeedback(seconds > 0 ? `+${seconds}s` : `${seconds}s`, seconds > 0 ? 'right' : 'left');
    }
  }

  /**
   * Precise frame-by-frame navigation
   * @param {number} direction -1 for prev frame, +1 for next frame
   */
  stepFrame(direction) {
    if (!this.videoEl) return;
    this.pause();
    const fps = (window.MediaXMetadata && window.MediaXMetadata.fpsEstimate) ? window.MediaXMetadata.fpsEstimate : 30;
    const frameDuration = 1 / fps;
    this.seekTo(this.videoEl.currentTime + (direction * frameDuration));
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Frame ${direction > 0 ? '+1' : '-1'} (~${Math.round(fps)} fps)`, 'info');
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(3.0, vol));
    if (this.volume > 1.0) {
      // Use Web Audio gain for amplification
      if (this.videoEl) this.videoEl.volume = 1.0;
      if (window.MediaXAudio) window.MediaXAudio.setVolume(this.volume);
    } else {
      if (this.videoEl) this.videoEl.volume = this.volume;
      if (window.MediaXAudio) window.MediaXAudio.setVolume(1.0);
    }

    if (this.volume === 0) {
      this.isMuted = true;
    } else {
      this.isMuted = false;
    }

    if (window.MediaXStorage) {
      window.MediaXStorage.setSetting('defaultVolume', this.volume);
    }

    if (window.MediaXControls) {
      window.MediaXControls.updateVolumeUI(this.volume, this.isMuted);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.videoEl) {
      this.videoEl.muted = this.isMuted;
    }
    if (window.MediaXControls) {
      window.MediaXControls.updateVolumeUI(this.volume, this.isMuted);
    }
    if (window.MediaXApp) {
      window.MediaXApp.showToast(this.isMuted ? 'Muted' : 'Unmuted', 'info');
    }
  }

  setSpeed(speedVal) {
    this.speed = Math.max(0.1, Math.min(4.0, speedVal));
    if (this.videoEl) {
      this.videoEl.playbackRate = this.speed;
    }
    if (window.MediaXControls) {
      window.MediaXControls.updateSpeedUI(this.speed);
    }
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Playback Speed: ${this.speed}x`, 'info');
    }
  }

  // --- A-B Loop Controls ---
  setLoopA() {
    if (!this.videoEl) return;
    this.loopPointA = this.videoEl.currentTime;
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Loop point A set: ${this.formatTime(this.loopPointA)}`, 'info');
    }
    if (window.MediaXControls) {
      window.MediaXControls.updateLoopMarkers(this.loopPointA, this.loopPointB, this.videoEl.duration);
    }
  }

  setLoopB() {
    if (!this.videoEl || this.loopPointA === null) {
      if (window.MediaXApp) window.MediaXApp.showToast('Please set point A first', 'warning');
      return;
    }
    if (this.videoEl.currentTime <= this.loopPointA) {
      if (window.MediaXApp) window.MediaXApp.showToast('Point B must be after point A', 'warning');
      return;
    }
    this.loopPointB = this.videoEl.currentTime;
    this.isLoopActive = true;
    if (window.MediaXApp) {
      window.MediaXApp.showToast(`Loop active: ${this.formatTime(this.loopPointA)} → ${this.formatTime(this.loopPointB)}`, 'success');
    }
    if (window.MediaXControls) {
      window.MediaXControls.updateLoopMarkers(this.loopPointA, this.loopPointB, this.videoEl.duration);
    }
  }

  clearABLoop() {
    this.loopPointA = null;
    this.loopPointB = null;
    this.isLoopActive = false;
    if (window.MediaXControls) {
      window.MediaXControls.clearLoopMarkers();
    }
  }

  // --- Resume Playback Points ---
  checkResumePoint() {
    if (!this.currentMedia || !window.MediaXStorage) return;
    const resume = window.MediaXStorage.getResumePoint(this.currentMedia.name, this.currentMedia.size);
    if (resume && resume.time > 5 && this.videoEl.duration && resume.time < this.videoEl.duration - 10) {
      if (window.MediaXApp) {
        window.MediaXApp.showResumeBanner(resume.time, () => {
          this.seekTo(resume.time);
        });
      }
    }
  }

  saveCurrentPlaybackPoint() {
    if (!this.currentMedia || !this.videoEl || !window.MediaXStorage) return;
    window.MediaXStorage.saveResumePoint(
      this.currentMedia.name,
      this.currentMedia.size,
      this.videoEl.currentTime,
      this.videoEl.duration
    );
  }

  handlePlaybackError() {
    if (!this.currentMedia) return;
    const name = this.currentMedia.name || 'file';
    const isWasmCandidate = /\.(mkv|avi|flv|wmv|ts)$/i.test(name);

    if (isWasmCandidate && window.MediaXFFmpeg && this.currentMedia.file) {
      if (window.MediaXApp) {
        window.MediaXApp.showToast('Media codec not natively supported. Starting local WebAssembly decoder...', 'warning');
      }
      window.MediaXFFmpeg.transcodeFile(this.currentMedia.file).then((converted) => {
        this.loadMedia(converted);
      }).catch((e) => {
        if (window.MediaXApp) {
          window.MediaXApp.showToast('This media format or codec is not supported by your current browser. Try another format.', 'error');
        }
      });
    } else {
      if (window.MediaXApp) {
        window.MediaXApp.showToast('This media format or codec is not supported by your current browser. Try another browser or use a compatible media format.', 'error');
      }
    }
  }

  getCurrentTime() {
    return this.videoEl ? this.videoEl.currentTime : 0;
  }

  getDuration() {
    return this.videoEl ? this.videoEl.duration : 0;
  }

  unload() {
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.removeAttribute('src');
      this.videoEl.load();
    }
    this.currentMedia = null;
    this.isPlaying = false;
    this.clearABLoop();
    if (window.MediaXVisualizer) window.MediaXVisualizer.stop();
  }

  // Event dispatchers
  onTimeUpdate(cb) { this.onTimeUpdateCallbacks.push(cb); }
  onPlayState(cb) { this.onPlayStateCallbacks.push(cb); }
  onMediaLoaded(cb) { this.onMediaLoadedCallbacks.push(cb); }

  notifyTimeUpdate(time, dur) {
    this.onTimeUpdateCallbacks.forEach(cb => cb(time, dur));
  }
  notifyPlayState(state) {
    this.onPlayStateCallbacks.forEach(cb => cb(state));
  }
  notifyMediaLoaded() {
    this.onMediaLoadedCallbacks.forEach(cb => cb());
  }

  formatTime(seconds) {
    const s = Math.floor(seconds || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${m}:${String(sec).padStart(2, '0')}`;
  }
}

window.MediaXPlayer = new MediaXPlayerController();
