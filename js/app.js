/**
 * MediaX Player - Main Application Bootstrap & Orchestrator
 * Connects all modules, drag-and-drop, touch gestures, file loaders,
 * toast notifications, and sample streams.
 */

class MediaXApplication {
  constructor() {
    this.landingViewEl = null;
    this.playerViewEl = null;
    this.backdropEl = null;
    this.toastContainerEl = null;
    this.resumeBannerEl = null;
    this.playlistDrawerEl = null;
    this.backdropCloseCallback = null;
    this.resumeTimer = null;
  }

  init() {
    // Cache DOM Elements
    this.landingViewEl = document.getElementById('view-landing');
    this.playerViewEl = document.getElementById('view-player');
    this.backdropEl = document.getElementById('modal-backdrop');
    this.toastContainerEl = document.getElementById('toast-container');
    this.resumeBannerEl = document.getElementById('resume-banner');
    this.playlistDrawerEl = document.getElementById('playlist-drawer');

    const videoEl = document.getElementById('video-element');
    const stageEl = document.getElementById('media-stage');
    const vizCanvas = document.getElementById('visualizer-canvas');
    const subContainer = document.getElementById('subtitles-container');
    const flashEl = document.getElementById('screenshot-flash');
    const screenshotModal = document.getElementById('screenshot-modal');
    const screenshotPreviewImg = document.getElementById('screenshot-preview-img');
    const settingsDrawer = document.getElementById('settings-drawer');
    const playlistList = document.getElementById('playlist-list');
    const contextMenu = document.getElementById('player-context-menu');
    const viewport = document.getElementById('media-viewport');

    // Initialize modules
    if (window.MediaXPlayer) window.MediaXPlayer.init(videoEl);
    if (window.MediaXVisualizer) window.MediaXVisualizer.init(vizCanvas);
    if (window.MediaXVideoEffects) window.MediaXVideoEffects.init(videoEl, stageEl);
    if (window.MediaXSubtitles) window.MediaXSubtitles.init(subContainer);
    if (window.MediaXScreenshot) window.MediaXScreenshot.init(videoEl, flashEl, screenshotModal, screenshotPreviewImg);
    if (window.MediaXMetadata) window.MediaXMetadata.init(videoEl);
    if (window.MediaXPlaylist) window.MediaXPlaylist.init(playlistList);
    if (window.MediaXShortcuts) window.MediaXShortcuts.init();
    if (window.MediaXContextMenu) window.MediaXContextMenu.init(contextMenu, viewport);

    if (window.MediaXControls) {
      window.MediaXControls.init({
        playerContainerEl: this.playerViewEl,
        controlsContainerEl: document.querySelector('.player-controls-container'),
        seekbarWrapperEl: document.getElementById('seekbar-wrapper'),
        seekbarPlayedEl: document.getElementById('seekbar-played'),
        seekbarBufferedEl: document.getElementById('seekbar-buffered'),
        seekbarThumbEl: document.getElementById('seekbar-thumb'),
        seekbarTooltipEl: document.getElementById('seekbar-tooltip'),
        timeCurrentEl: document.getElementById('time-current'),
        timeTotalEl: document.getElementById('time-total'),
        btnPlayEl: document.getElementById('btn-play-main'),
        btnMuteEl: document.getElementById('btn-volume-mute'),
        volumeSliderEl: document.getElementById('volume-slider'),
        volumeLabelEl: document.getElementById('volume-percent-label'),
        btnSpeedEl: document.getElementById('btn-speed'),
        markerAEl: document.getElementById('loop-marker-a'),
        markerBEl: document.getElementById('loop-marker-b'),
        loopRangeEl: document.getElementById('loop-range')
      });
    }

    if (window.MediaXSettings) window.MediaXSettings.init(settingsDrawer);

    if (window.MediaXFFmpeg) {
      window.MediaXFFmpeg.init(
        document.getElementById('ffmpeg-overlay'),
        document.getElementById('ffmpeg-progress-bar'),
        document.getElementById('ffmpeg-progress-text'),
        document.getElementById('ffmpeg-status-text')
      );
    }

    this.bindFileInputs();
    this.bindDragAndDrop();
    this.bindHeaderNav();
    this.bindTouchGestures();
    this.bindBackdrop();
    this.bindSamples();
    this.bindScreenshotModal();
    this.bindLibrary();

    console.log('MediaX Player initialized successfully.');
  }

  // --- View Transitions ---
  showPlayerView() {
    if (this.landingViewEl) this.landingViewEl.classList.add('hidden');
    if (this.playerViewEl) this.playerViewEl.classList.add('active');
    document.body.classList.add('player-active');
  }

  showLandingView() {
    if (window.MediaXPlayer) window.MediaXPlayer.unload();
    if (this.playerViewEl) this.playerViewEl.classList.remove('active');
    if (this.landingViewEl) this.landingViewEl.classList.remove('hidden');
    document.body.classList.remove('player-active');
  }

  updateActiveMediaTitle(title, tag = 'MEDIA') {
    const titleEl = document.getElementById('media-active-title');
    const badgeEl = document.getElementById('media-active-badge');
    if (titleEl) titleEl.textContent = title;
    if (badgeEl) badgeEl.textContent = tag;
  }

  // --- File Inputs & Open Media ---
  bindFileInputs() {
    const fileInputs = [
      document.getElementById('landing-file-input'),
      document.getElementById('header-file-input'),
      document.getElementById('playlist-file-input')
    ];

    const openButtons = [
      document.getElementById('btn-open-landing'),
      document.getElementById('btn-open-dropzone'),
      document.getElementById('btn-open-header'),
      document.getElementById('btn-add-playlist')
    ];

    openButtons.forEach((btn, idx) => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetInput = fileInputs[Math.min(idx, fileInputs.length - 1)];
          if (targetInput) targetInput.click();
        });
      }
    });

    fileInputs.forEach((input) => {
      if (input) {
        input.addEventListener('change', (e) => {
          if (e.target.files && e.target.files.length > 0) {
            this.handleSelectedFiles(e.target.files);
            input.value = ''; // reset so same file can be reopened
          }
        });
      }
    });
  }

  handleSelectedFiles(fileList) {
    const files = Array.from(fileList);
    const mediaFiles = [];
    const subtitleFiles = [];

    files.forEach((file) => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (['srt', 'vtt'].includes(ext)) {
        subtitleFiles.push(file);
      } else {
        mediaFiles.push(file);
      }
    });

    // If subtitles dropped/selected
    if (subtitleFiles.length > 0 && window.MediaXSubtitles) {
      window.MediaXSubtitles.loadFromFile(subtitleFiles[0]);
    }

    if (mediaFiles.length > 0) {
      if (window.MediaXPlaylist) {
        window.MediaXPlaylist.addFiles(mediaFiles);
        // Sync library with new files (before navigating to player)
        if (window.MediaXLibrary) {
          window.MediaXLibrary.sync(window.MediaXPlaylist.items);
        }
      }
      this.showPlayerView();
    }
  }

  // --- Drag & Drop ---
  bindDragAndDrop() {
    const dropzone = document.getElementById('landing-dropzone');
    const body = document.body;

    ['dragenter', 'dragover'].forEach((eventName) => {
      body.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropzone) dropzone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      body.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropzone) dropzone.classList.remove('drag-over');
      }, false);
    });

    body.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleSelectedFiles(e.dataTransfer.files);
      }
    });
  }

  // --- Header Navigation & Quick Buttons ---
  bindHeaderNav() {
    const btnBackHome = document.getElementById('btn-back-home');
    if (btnBackHome) {
      btnBackHome.addEventListener('click', () => {
        this.showLandingView();
        if (window.MediaXLibrary) window.MediaXLibrary.refresh();
      });
    }

    const btnSettings = document.getElementById('btn-toggle-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        if (window.MediaXSettings) window.MediaXSettings.toggleDrawer();
      });
    }

    const btnPlaylist = document.getElementById('btn-toggle-playlist');
    if (btnPlaylist) {
      btnPlaylist.addEventListener('click', () => this.togglePlaylistDrawer());
    }

    const btnClosePlaylist = document.getElementById('btn-close-playlist');
    if (btnClosePlaylist) {
      btnClosePlaylist.addEventListener('click', () => this.closePlaylistDrawer());
    }

    const btnMiniPlayer = document.getElementById('btn-mini-player');
    if (btnMiniPlayer) {
      btnMiniPlayer.addEventListener('click', () => {
        if (this.playerViewEl) {
          this.playerViewEl.classList.toggle('mini-player-mode');
        }
      });
    }

    const btnMediaInfo = document.getElementById('btn-media-info');
    if (btnMediaInfo) {
      btnMediaInfo.addEventListener('click', () => {
        if (window.MediaXSettings) window.MediaXSettings.openTab('info');
      });
    }
  }

  // --- Playlist Drawer Controls ---
  togglePlaylistDrawer() {
    if (this.playlistDrawerEl) {
      const isOpen = this.playlistDrawerEl.classList.toggle('open');
      if (isOpen) {
        this.openBackdrop(() => this.closePlaylistDrawer());
      } else {
        this.closeBackdrop();
      }
    }
  }

  closePlaylistDrawer() {
    if (this.playlistDrawerEl) {
      this.playlistDrawerEl.classList.remove('open');
      this.closeBackdrop();
    }
  }

  // --- Mobile Touch Gestures & Tap Zones ---
  bindTouchGestures() {
    const zoneLeft = document.getElementById('gesture-zone-left');
    const zoneCenter = document.getElementById('gesture-zone-center');
    const zoneRight = document.getElementById('gesture-zone-right');

    let lastTapLeft = 0;
    let lastTapRight = 0;
    let lastTapCenter = 0;

    if (zoneLeft) {
      zoneLeft.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTapLeft < 320) {
          // Double tap left: rewind
          if (window.MediaXPlayer) window.MediaXPlayer.skip(-10);
          lastTapLeft = 0;
        } else {
          lastTapLeft = now;
        }
      });
    }

    if (zoneRight) {
      zoneRight.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTapRight < 320) {
          // Double tap right: forward
          if (window.MediaXPlayer) window.MediaXPlayer.skip(10);
          lastTapRight = 0;
        } else {
          lastTapRight = now;
        }
      });
    }

    if (zoneCenter) {
      zoneCenter.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTapCenter < 320) {
          // Double tap center: toggle play/pause
          if (window.MediaXPlayer) window.MediaXPlayer.togglePlay();
          lastTapCenter = 0;
        } else {
          lastTapCenter = now;
        }
      });
    }
  }

  showGestureFeedback(text, position = 'center') {
    const indicatorId = position === 'left' ? 'indicator-left' : (position === 'right' ? 'indicator-right' : 'indicator-center');
    const indicator = document.getElementById(indicatorId);
    if (!indicator) return;

    const span = indicator.querySelector('span');
    if (span) span.textContent = text;
    indicator.classList.add('show');

    setTimeout(() => {
      indicator.classList.remove('show');
    }, 450);
  }

  // --- Backdrop Modal Controller ---
  openBackdrop(onClose) {
    this.backdropCloseCallback = onClose;
    if (this.backdropEl) {
      this.backdropEl.classList.add('active');
    }
  }

  closeBackdrop() {
    if (this.backdropEl) {
      this.backdropEl.classList.remove('active');
    }
    this.backdropCloseCallback = null;
  }

  bindBackdrop() {
    if (this.backdropEl) {
      this.backdropEl.addEventListener('click', () => {
        if (this.backdropCloseCallback) {
          this.backdropCloseCallback();
        }
      });
    }
  }

  // --- Resume Playback Banner ---
  showResumeBanner(seconds, onResume) {
    if (!this.resumeBannerEl) return;
    const timeText = this.resumeBannerEl.querySelector('#resume-time-text');
    const btnResume = this.resumeBannerEl.querySelector('#btn-resume-accept');
    const btnDismiss = this.resumeBannerEl.querySelector('#btn-resume-dismiss');

    if (timeText) {
      timeText.textContent = (window.MediaXPlayer) ? window.MediaXPlayer.formatTime(seconds) : `${seconds}s`;
    }

    const dismiss = () => {
      this.resumeBannerEl.classList.remove('show');
      clearTimeout(this.resumeTimer);
    };

    if (btnResume) {
      btnResume.onclick = () => {
        onResume();
        dismiss();
      };
    }

    if (btnDismiss) {
      btnDismiss.onclick = () => {
        dismiss();
      };
    }

    this.resumeBannerEl.classList.add('show');
    clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => dismiss(), 8000);
  }

  // --- Screenshot Modal ---
  bindScreenshotModal() {
    const btnDownload = document.getElementById('btn-screenshot-download');
    const btnCopy = document.getElementById('btn-screenshot-copy');
    const btnClose = document.getElementById('btn-screenshot-close');

    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        if (window.MediaXScreenshot) window.MediaXScreenshot.download();
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (window.MediaXScreenshot) window.MediaXScreenshot.copyToClipboard();
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (window.MediaXScreenshot) window.MediaXScreenshot.closeModal();
      });
    }
  }

  // --- Library Home Screen ---
  bindLibrary() {
    // Initialize library module
    if (window.MediaXLibrary) window.MediaXLibrary.init();

    // Open file from header folder icon
    const btnOpenHeader2 = document.getElementById('btn-open-header');
    if (btnOpenHeader2) {
      btnOpenHeader2.addEventListener('click', () => {
        const inp = document.getElementById('header-file-input');
        if (inp) inp.click();
      });
    }

    // Header settings icon (on landing) opens settings drawer
    const btnLibSettings = document.getElementById('btn-library-settings');
    if (btnLibSettings) {
      btnLibSettings.addEventListener('click', () => {
        if (window.MediaXSettings) window.MediaXSettings.toggleDrawer();
      });
    }

    // Search (placeholder - opens file picker)
    const btnSearch = document.getElementById('btn-library-search');
    if (btnSearch) {
      btnSearch.addEventListener('click', () => {
        const inp = document.getElementById('landing-file-input');
        if (inp) inp.click();
      });
    }

    // FAB (mobile floating button)
    const fab = document.getElementById('lib-fab');
    if (fab) {
      fab.addEventListener('click', () => {
        const inp = document.getElementById('landing-file-input');
        if (inp) inp.click();
      });
    }

    // Clear history button on home screen
    const btnClearHistory = document.getElementById('btn-clear-history-home');
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', () => {
        if (window.MediaXStorage) window.MediaXStorage.clearRecents();
        if (window.MediaXLibrary) window.MediaXLibrary.refresh();
      });
    }

    // "Me" bottom nav button -> opens settings
    const btnNavMe = document.getElementById('lib-nav-me');
    if (btnNavMe) {
      btnNavMe.addEventListener('click', () => {
        if (window.MediaXSettings) window.MediaXSettings.toggleDrawer();
      });
    }
  }

  // --- Built-in Sample Media Triggers ---
  bindSamples() {

    // Sample Video 1 (Big Buck Bunny)
    const btnSample1 = document.getElementById('sample-video-1');
    if (btnSample1) {
      btnSample1.addEventListener('click', () => {
        this.showPlayerView();
        if (window.MediaXPlaylist) {
          window.MediaXPlaylist.addExternalItem(
            'Big Buck Bunny (Animation HD)',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            'video'
          );
        }
      });
    }

    // Sample Video 2 (Tears of Steel)
    const btnSample2 = document.getElementById('sample-video-2');
    if (btnSample2) {
      btnSample2.addEventListener('click', () => {
        this.showPlayerView();
        if (window.MediaXPlaylist) {
          window.MediaXPlaylist.addExternalItem(
            'Tears of Steel (Sci-Fi HD)',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
            'video'
          );
        }
      });
    }

    // Sample 3: 100% Offline Audio Synthesizer (Instant offline test)
    const btnSampleSynth = document.getElementById('sample-audio-synth');
    if (btnSampleSynth) {
      btnSampleSynth.addEventListener('click', async () => {
        try {
          if (window.MediaXSamples) {
            const wavBlob = await window.MediaXSamples.generateOfflineAudio();
            if (wavBlob) {
              this.showPlayerView();
              const url = URL.createObjectURL(wavBlob);
              if (window.MediaXPlaylist) {
                window.MediaXPlaylist.addExternalItem(
                  'Synthwave Chillout (Offline Generator)',
                  url,
                  'audio'
                );
              }
            }
          }
        } catch (e) {
          console.error('Audio synthesizer error:', e);
          this.showToast('Failed to synthesize test audio', 'error');
        }
      });
    }
  }

  // --- Toast Notifications ---
  showToast(message, type = 'info', duration = 3200) {
    if (!this.toastContainerEl) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    switch (type) {
      case 'success':
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        break;
      case 'warning':
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        break;
      case 'error':
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        break;
      default:
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        break;
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-body">
        <div class="toast-message">${this.escapeHtml(message)}</div>
      </div>
      <button class="toast-close" title="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });

    this.toastContainerEl.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 260);
    }, duration);
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

window.MediaXApp = new MediaXApplication();

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.MediaXApp.init();
});
