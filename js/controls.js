/**
 * MediaX Player - Playback Controls & Timeline Bar
 * Manages seekbar dragging, buffered progress, time display, volume,
 * PiP, fullscreen, and smooth auto-hide behavior.
 */

class MediaXControlsManager {
  constructor() {
    this.playerContainerEl = null;
    this.controlsContainerEl = null;
    this.seekbarWrapperEl = null;
    this.seekbarPlayedEl = null;
    this.seekbarBufferedEl = null;
    this.seekbarThumbEl = null;
    this.seekbarTooltipEl = null;
    this.timeCurrentEl = null;
    this.timeTotalEl = null;
    this.btnPlayEl = null;
    this.btnMuteEl = null;
    this.volumeSliderEl = null;
    this.volumeLabelEl = null;
    this.btnSpeedEl = null;
    this.markerAEl = null;
    this.markerBEl = null;
    this.loopRangeEl = null;

    this.isSeeking = false;
    this.showRemainingTime = false;
    this.autoHideTimer = null;
    this.autoHideDelay = 2500;
  }

  init(elements) {
    Object.assign(this, elements);

    if (window.MediaXStorage) {
      this.autoHideDelay = window.MediaXStorage.getSetting('autoHideDelay') || 2500;
    }

    this.bindControlButtons();
    this.bindSeekbarEvents();
    this.bindAutoHide();

    // Listen to player updates
    if (window.MediaXPlayer) {
      window.MediaXPlayer.onTimeUpdate((cur, dur) => this.onTimeUpdate(cur, dur));
      window.MediaXPlayer.onPlayState((isPlaying) => this.onPlayState(isPlaying));
      window.MediaXPlayer.onMediaLoaded(() => this.onMediaLoaded());
    }
  }

  bindControlButtons() {
    // Play/Pause
    if (this.btnPlayEl) {
      this.btnPlayEl.addEventListener('click', () => {
        if (window.MediaXPlayer) window.MediaXPlayer.togglePlay();
      });
    }

    // Skip -10s / +10s
    const btnSkipBack = document.getElementById('btn-skip-backward');
    if (btnSkipBack) {
      btnSkipBack.addEventListener('click', () => {
        const sec = window.MediaXStorage ? window.MediaXStorage.getSetting('skipDuration') : 10;
        if (window.MediaXPlayer) window.MediaXPlayer.skip(-sec);
      });
    }

    const btnSkipFwd = document.getElementById('btn-skip-forward');
    if (btnSkipFwd) {
      btnSkipFwd.addEventListener('click', () => {
        const sec = window.MediaXStorage ? window.MediaXStorage.getSetting('skipDuration') : 10;
        if (window.MediaXPlayer) window.MediaXPlayer.skip(sec);
      });
    }

    // Frame by Frame
    const btnStepBack = document.getElementById('btn-step-backward');
    if (btnStepBack) {
      btnStepBack.addEventListener('click', () => {
        if (window.MediaXPlayer) window.MediaXPlayer.stepFrame(-1);
      });
    }

    const btnStepFwd = document.getElementById('btn-step-forward');
    if (btnStepFwd) {
      btnStepFwd.addEventListener('click', () => {
        if (window.MediaXPlayer) window.MediaXPlayer.stepFrame(1);
      });
    }

    // Prev / Next Media
    const btnPrev = document.getElementById('btn-prev-media');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (window.MediaXPlaylist) window.MediaXPlaylist.playPrevious();
      });
    }

    const btnNext = document.getElementById('btn-next-media');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (window.MediaXPlaylist) window.MediaXPlaylist.playNext();
      });
    }

    // Volume & Mute
    if (this.btnMuteEl) {
      this.btnMuteEl.addEventListener('click', () => {
        if (window.MediaXPlayer) window.MediaXPlayer.toggleMute();
      });
    }

    if (this.volumeSliderEl) {
      this.volumeSliderEl.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (window.MediaXPlayer) window.MediaXPlayer.setVolume(val);
      });
    }

    // Time display toggle (remaining vs total)
    const timeDisplay = document.querySelector('.time-display');
    if (timeDisplay) {
      timeDisplay.addEventListener('click', () => {
        this.showRemainingTime = !this.showRemainingTime;
        if (window.MediaXPlayer) {
          this.onTimeUpdate(window.MediaXPlayer.getCurrentTime(), window.MediaXPlayer.getDuration());
        }
      });
    }

    // Fullscreen
    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => this.toggleFullscreen());
    }

    // Picture-in-Picture
    const btnPip = document.getElementById('btn-pip');
    if (btnPip) {
      btnPip.addEventListener('click', () => this.togglePictureInPicture());
    }

    // Screenshot
    const btnScreenshot = document.getElementById('btn-screenshot');
    if (btnScreenshot) {
      btnScreenshot.addEventListener('click', () => {
        if (window.MediaXScreenshot) window.MediaXScreenshot.capture(true);
      });
    }

    // Speed Popover / Selector
    if (this.btnSpeedEl) {
      this.btnSpeedEl.addEventListener('click', () => {
        const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
        const cur = window.MediaXPlayer ? window.MediaXPlayer.speed : 1.0;
        const nextIdx = (speeds.indexOf(cur) + 1) % speeds.length;
        if (window.MediaXPlayer) window.MediaXPlayer.setSpeed(speeds[nextIdx]);
      });
    }

    // Equalizer Button
    const btnEq = document.getElementById('btn-equalizer-quick');
    if (btnEq) {
      btnEq.addEventListener('click', () => {
        if (window.MediaXSettings) window.MediaXSettings.openTab('equalizer');
      });
    }

    // Audio Sync Delay Quick Button
    const btnAudioSync = document.getElementById('btn-audio-sync-quick');
    if (btnAudioSync) {
      btnAudioSync.addEventListener('click', () => {
        if (window.MediaXSettings) window.MediaXSettings.openTab('audio');
      });
    }

    // Subtitles Button
    const btnSubtitles = document.getElementById('btn-subtitles-quick');
    if (btnSubtitles) {
      btnSubtitles.addEventListener('click', () => {
        if (window.MediaXSubtitles) {
          const enabled = window.MediaXSubtitles.toggleEnabled();
          btnSubtitles.classList.toggle('active', enabled);
        }
      });
    }

    // A-B Loop Button
    const btnLoop = document.getElementById('btn-loop-quick');
    if (btnLoop) {
      btnLoop.addEventListener('click', () => {
        if (!window.MediaXPlayer) return;
        if (window.MediaXPlayer.loopPointA === null) {
          window.MediaXPlayer.setLoopA();
        } else if (window.MediaXPlayer.loopPointB === null) {
          window.MediaXPlayer.setLoopB();
          btnLoop.classList.add('active');
        } else {
          window.MediaXPlayer.clearABLoop();
          btnLoop.classList.remove('active');
        }
      });
    }
  }

  bindSeekbarEvents() {
    if (!this.seekbarWrapperEl) return;

    const onSeek = (e) => {
      const rect = this.seekbarWrapperEl.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (window.MediaXPlayer) {
        const dur = window.MediaXPlayer.getDuration();
        if (dur) {
          window.MediaXPlayer.seekTo(pos * dur);
        }
      }
    };

    this.seekbarWrapperEl.addEventListener('mousedown', (e) => {
      this.isSeeking = true;
      this.seekbarWrapperEl.classList.add('seeking');
      onSeek(e);

      const onMouseMove = (ev) => {
        if (this.isSeeking) onSeek(ev);
      };

      const onMouseUp = () => {
        this.isSeeking = false;
        this.seekbarWrapperEl.classList.remove('seeking');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Touch support for seekbar
    this.seekbarWrapperEl.addEventListener('touchstart', (e) => {
      this.isSeeking = true;
      this.seekbarWrapperEl.classList.add('seeking');
      onSeek(e);
    }, { passive: true });

    this.seekbarWrapperEl.addEventListener('touchmove', (e) => {
      if (this.isSeeking) onSeek(e);
    }, { passive: true });

    this.seekbarWrapperEl.addEventListener('touchend', () => {
      this.isSeeking = false;
      this.seekbarWrapperEl.classList.remove('seeking');
    });

    // Hover tooltip with preview
    this.seekbarWrapperEl.addEventListener('mousemove', (e) => {
      if (!this.seekbarTooltipEl) return;
      const rect = this.seekbarWrapperEl.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur = window.MediaXPlayer ? window.MediaXPlayer.getDuration() : 0;
      const time = ratio * dur;

      this.seekbarTooltipEl.style.left = `${ratio * 100}%`;
      const timeSpan = this.seekbarTooltipEl.querySelector('.seek-tooltip-time') || this.seekbarTooltipEl;
      timeSpan.textContent = this.formatTime(time);
      this.seekbarTooltipEl.classList.add('visible');
    });

    this.seekbarWrapperEl.addEventListener('mouseleave', () => {
      if (this.seekbarTooltipEl) {
        this.seekbarTooltipEl.classList.remove('visible');
      }
    });
  }

  bindAutoHide() {
    const showControls = () => {
      if (this.playerContainerEl) {
        this.playerContainerEl.classList.remove('controls-hidden');
      }
      const viewport = document.querySelector('.media-viewport');
      if (viewport) viewport.classList.remove('hide-cursor');

      clearTimeout(this.autoHideTimer);

      // Only schedule auto-hide if media is currently playing
      if (window.MediaXPlayer && window.MediaXPlayer.isPlaying) {
        this.autoHideTimer = setTimeout(() => {
          // Do not hide if any drawer/menu is open
          const hasOpenDrawer = document.querySelector('.settings-drawer.open, .playlist-drawer.open, .modal-backdrop.active, #player-context-menu.active');
          if (!hasOpenDrawer && this.playerContainerEl) {
            this.playerContainerEl.classList.add('controls-hidden');
            if (viewport) viewport.classList.add('hide-cursor');
          }
        }, this.autoHideDelay);
      }
    };

    if (this.playerContainerEl) {
      this.playerContainerEl.addEventListener('mousemove', showControls);
      this.playerContainerEl.addEventListener('click', showControls);
      this.playerContainerEl.addEventListener('touchstart', showControls, { passive: true });
    }
  }

  onTimeUpdate(currentTime, duration) {
    if (!duration || isNaN(duration)) return;

    const percent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

    if (!this.isSeeking) {
      if (this.seekbarPlayedEl) this.seekbarPlayedEl.style.width = `${percent}%`;
      if (this.seekbarThumbEl) this.seekbarThumbEl.style.left = `${percent}%`;
    }

    if (this.timeCurrentEl) {
      this.timeCurrentEl.textContent = this.formatTime(currentTime);
    }

    if (this.timeTotalEl) {
      if (this.showRemainingTime) {
        const remaining = Math.max(0, duration - currentTime);
        this.timeTotalEl.textContent = `-${this.formatTime(remaining)}`;
      } else {
        this.timeTotalEl.textContent = this.formatTime(duration);
      }
    }

    // Update buffered indicator
    this.updateBuffered();
  }

  updateBuffered() {
    if (!this.seekbarBufferedEl || !window.MediaXPlayer || !window.MediaXPlayer.videoEl) return;
    const video = window.MediaXPlayer.videoEl;
    const dur = video.duration;
    if (!dur) return;

    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
        const bufEnd = video.buffered.end(i);
        const bufPercent = Math.min(100, (bufEnd / dur) * 100);
        this.seekbarBufferedEl.style.width = `${bufPercent}%`;
        break;
      }
    }
  }

  onPlayState(isPlaying) {
    if (this.btnPlayEl) {
      const playIcon = this.btnPlayEl.querySelector('.icon-play');
      const pauseIcon = this.btnPlayEl.querySelector('.icon-pause');
      if (playIcon && pauseIcon) {
        playIcon.classList.toggle('hidden', isPlaying);
        pauseIcon.classList.toggle('hidden', !isPlaying);
      }
    }

    // Keep controls visible when paused
    if (!isPlaying && this.playerContainerEl) {
      this.playerContainerEl.classList.remove('controls-hidden');
      const viewport = document.querySelector('.media-viewport');
      if (viewport) viewport.classList.remove('hide-cursor');
    }
  }

  onMediaLoaded() {
    if (this.seekbarPlayedEl) this.seekbarPlayedEl.style.width = '0%';
    if (this.seekbarThumbEl) this.seekbarThumbEl.style.left = '0%';
    if (this.seekbarBufferedEl) this.seekbarBufferedEl.style.width = '0%';
    this.clearLoopMarkers();
  }

  updateVolumeUI(vol, isMuted) {
    if (this.volumeSliderEl) {
      this.volumeSliderEl.value = isMuted ? 0 : vol;
    }
    if (this.volumeLabelEl) {
      const pct = Math.round((isMuted ? 0 : vol) * 100);
      this.volumeLabelEl.textContent = `${pct}%`;
      this.volumeLabelEl.classList.toggle('boosted', pct > 100);
    }
    if (this.btnMuteEl) {
      const iconMuted = this.btnMuteEl.querySelector('.icon-volume-muted');
      const iconHigh = this.btnMuteEl.querySelector('.icon-volume-high');
      const iconLow = this.btnMuteEl.querySelector('.icon-volume-low');
      if (iconMuted && iconHigh) {
        if (isMuted || vol === 0) {
          iconMuted.classList.remove('hidden');
          iconHigh.classList.add('hidden');
          if (iconLow) iconLow.classList.add('hidden');
        } else {
          iconMuted.classList.add('hidden');
          iconHigh.classList.remove('hidden');
          if (iconLow) iconLow.classList.add('hidden');
        }
      }
    }
  }

  updateSpeedUI(speed) {
    if (this.btnSpeedEl) {
      this.btnSpeedEl.textContent = `${speed}x`;
    }
  }

  updateLoopMarkers(pointA, pointB, duration) {
    if (!duration) return;
    if (pointA !== null && this.markerAEl) {
      const pA = (pointA / duration) * 100;
      this.markerAEl.style.left = `${pA}%`;
      this.markerAEl.classList.add('active');
    }
    if (pointB !== null && this.markerBEl) {
      const pB = (pointB / duration) * 100;
      this.markerBEl.style.left = `${pB}%`;
      this.markerBEl.classList.add('active');
    }
    if (pointA !== null && pointB !== null && this.loopRangeEl) {
      const left = (pointA / duration) * 100;
      const width = ((pointB - pointA) / duration) * 100;
      this.loopRangeEl.style.left = `${left}%`;
      this.loopRangeEl.style.width = `${width}%`;
      this.loopRangeEl.classList.add('active');
    }
  }

  clearLoopMarkers() {
    if (this.markerAEl) this.markerAEl.classList.remove('active');
    if (this.markerBEl) this.markerBEl.classList.remove('active');
    if (this.loopRangeEl) this.loopRangeEl.classList.remove('active');
  }

  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        const el = this.playerContainerEl || document.documentElement;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  }

  async togglePictureInPicture() {
    if (!window.MediaXPlayer || !window.MediaXPlayer.videoEl) return;
    const video = window.MediaXPlayer.videoEl;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      } else {
        if (window.MediaXApp) {
          window.MediaXApp.showToast('Picture-in-picture is not supported by this browser.', 'warning');
        }
      }
    } catch (e) {
      console.warn('PiP error', e);
      if (window.MediaXApp) {
        window.MediaXApp.showToast('Unable to enter Picture-in-Picture mode', 'error');
      }
    }
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

window.MediaXControls = new MediaXControlsManager();
