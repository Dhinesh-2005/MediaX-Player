/**
 * MediaX Player - Settings Drawer & Preferences Controller
 * Handles sliding settings drawer, tab routing, theme switching,
 * audio sync delay stepper/presets, audio enhancements, video filters, and subtitles styling.
 */

class SettingsController {
  constructor() {
    this.drawerEl = null;
    this.currentTab = 'playback';
  }

  init(drawerEl) {
    this.drawerEl = drawerEl;
    this.bindTabNavigation();
    this.bindThemeSwitcher();
    this.bindPlaybackSettings();
    this.bindAudioSettings();
    this.bindVideoSettings();
    this.bindSubtitleSettings();
    this.bindPrivacySettings();

    // Apply saved theme
    const savedTheme = window.MediaXStorage ? window.MediaXStorage.getSetting('theme') : 'dark';
    this.setTheme(savedTheme, false);
  }

  bindTabNavigation() {
    const tabs = document.querySelectorAll('.tab-nav-btn');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        this.openTab(tabId);
      });
    });

    const btnClose = document.getElementById('btn-close-settings');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.closeDrawer());
    }
  }

  openTab(tabId) {
    this.currentTab = tabId;

    // Update active tab buttons
    document.querySelectorAll('.tab-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    // Update active tab panes
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    // Specific pane refreshes
    if (tabId === 'equalizer' && window.MediaXEqualizer) {
      // Re-render sliders if container exists
      const eqContainer = document.getElementById('eq-bands-wrapper');
      const eqSelect = document.getElementById('eq-preset-select');
      if (eqContainer && !eqContainer.hasChildNodes()) {
        window.MediaXEqualizer.init(eqContainer, eqSelect);
      }
    } else if (tabId === 'audio' && window.MediaXAudio) {
      window.MediaXAudio.syncAudioTrackUI();
    } else if (tabId === 'subtitles' && window.MediaXSubtitles) {
      window.MediaXSubtitles.updateAvailableTracks();
    } else if (tabId === 'info' && window.MediaXMetadata) {
      window.MediaXMetadata.updateUI();
    } else if (tabId === 'keyboard' && window.MediaXShortcuts) {
      const kbContainer = document.getElementById('shortcuts-list-container');
      window.MediaXShortcuts.renderShortcutsList(kbContainer);
    }

    this.openDrawer();
  }

  openDrawer() {
    if (this.drawerEl) {
      this.drawerEl.classList.add('open');
      if (window.MediaXApp) {
        window.MediaXApp.openBackdrop(() => this.closeDrawer());
      }
    }
  }

  closeDrawer() {
    if (this.drawerEl) {
      this.drawerEl.classList.remove('open');
      if (window.MediaXApp) {
        window.MediaXApp.closeBackdrop();
      }
    }
  }

  toggleDrawer(tabId = null) {
    if (this.drawerEl && this.drawerEl.classList.contains('open')) {
      if (tabId && this.currentTab !== tabId) {
        this.openTab(tabId);
      } else {
        this.closeDrawer();
      }
    } else {
      this.openTab(tabId || this.currentTab);
    }
  }

  // --- Themes ---
  bindThemeSwitcher() {
    const themeSelect = document.getElementById('setting-theme-select');
    if (themeSelect) {
      const saved = window.MediaXStorage ? window.MediaXStorage.getSetting('theme') : 'dark';
      themeSelect.value = saved;
      themeSelect.addEventListener('change', (e) => {
        this.setTheme(e.target.value, true);
      });
    }
  }

  setTheme(themeName, notify = true) {
    const root = document.documentElement;
    if (themeName === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', themeName);
    }

    if (window.MediaXStorage) {
      window.MediaXStorage.setSetting('theme', themeName);
    }
  }

  // --- Playback Settings ---
  bindPlaybackSettings() {
    const skipSelect = document.getElementById('setting-skip-duration');
    if (skipSelect && window.MediaXStorage) {
      skipSelect.value = window.MediaXStorage.getSetting('skipDuration');
      skipSelect.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        window.MediaXStorage.setSetting('skipDuration', val);
      });
    }

    const autoResumeSwitch = document.getElementById('setting-auto-resume');
    if (autoResumeSwitch && window.MediaXStorage) {
      autoResumeSwitch.checked = window.MediaXStorage.getSetting('autoResume');
      autoResumeSwitch.addEventListener('change', (e) => {
        window.MediaXStorage.setSetting('autoResume', e.target.checked);
      });
    }
  }

  // --- Audio & Audio Sync Settings ---
  bindAudioSettings() {
    // Audio Track Select (Default or Available Languages)
    const audioTrackSelect = document.getElementById('setting-audio-track-select');
    if (audioTrackSelect) {
      audioTrackSelect.addEventListener('change', (e) => {
        if (window.MediaXAudio) {
          window.MediaXAudio.selectAudioTrack(e.target.value);
        }
      });
    }

    // Audio Delay Sync Stepper
    const delaySlider = document.getElementById('setting-audio-delay-slider');
    const delayValDisplay = document.getElementById('setting-audio-delay-val');
    const btnDelayMinus = document.getElementById('btn-delay-minus');
    const btnDelayPlus = document.getElementById('btn-delay-plus');
    const btnDelayReset = document.getElementById('btn-delay-reset');

    const updateDelayUI = (ms) => {
      const formatted = (ms > 0 ? `+${ms}` : `${ms}`) + ' ms';
      if (delaySlider) delaySlider.value = ms;
      if (delayValDisplay) delayValDisplay.textContent = formatted;
      const badge = document.getElementById('audio-delay-badge');
      if (badge) {
        badge.textContent = formatted;
        badge.classList.toggle('hidden', ms === 0);
      }
      // Update preset chips active state
      document.querySelectorAll('.sync-preset-chip').forEach(chip => {
        const chipMs = parseInt(chip.getAttribute('data-ms'), 10);
        chip.classList.toggle('active', chipMs === ms);
      });
    };

    if (delaySlider) {
      delaySlider.addEventListener('input', (e) => {
        const ms = parseInt(e.target.value, 10);
        if (window.MediaXAudio) window.MediaXAudio.setAudioDelay(ms);
        updateDelayUI(ms);
      });
    }

    if (btnDelayMinus) {
      btnDelayMinus.addEventListener('click', () => {
        const current = window.MediaXAudio ? window.MediaXAudio.getAudioDelay() : 0;
        const target = Math.max(-5000, current - 50);
        if (window.MediaXAudio) window.MediaXAudio.setAudioDelay(target);
        updateDelayUI(target);
      });
    }

    if (btnDelayPlus) {
      btnDelayPlus.addEventListener('click', () => {
        const current = window.MediaXAudio ? window.MediaXAudio.getAudioDelay() : 0;
        const target = Math.min(5000, current + 50);
        if (window.MediaXAudio) window.MediaXAudio.setAudioDelay(target);
        updateDelayUI(target);
      });
    }

    if (btnDelayReset) {
      btnDelayReset.addEventListener('click', () => {
        if (window.MediaXAudio) window.MediaXAudio.setAudioDelay(0);
        updateDelayUI(0);
      });
    }

    // Audio Delay Presets (-500, -250, -100, 0, +100, +250, +500)
    document.querySelectorAll('.sync-preset-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const ms = parseInt(chip.getAttribute('data-ms'), 10);
        if (window.MediaXAudio) window.MediaXAudio.setAudioDelay(ms);
        updateDelayUI(ms);
      });
    });

    // Audio Normalization (Dynamics Compressor)
    const normSwitch = document.getElementById('setting-audio-norm');
    if (normSwitch) {
      normSwitch.addEventListener('change', (e) => {
        if (window.MediaXAudio) window.MediaXAudio.setNormalization(e.target.checked);
      });
    }

    // Mono Downmix
    const monoSwitch = document.getElementById('setting-audio-mono');
    if (monoSwitch) {
      monoSwitch.addEventListener('change', (e) => {
        if (window.MediaXAudio) window.MediaXAudio.setMono(e.target.checked);
      });
    }

    // Stereo Panner Balance (-1.0 to +1.0)
    const panSlider = document.getElementById('setting-stereo-pan');
    const panVal = document.getElementById('setting-stereo-pan-val');
    if (panSlider) {
      panSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (window.MediaXAudio) window.MediaXAudio.setStereoBalance(val);
        if (panVal) {
          panVal.textContent = val === 0 ? 'Center' : (val < 0 ? `L ${Math.abs(Math.round(val * 100))}%` : `R ${Math.round(val * 100)}%`);
        }
      });
    }

    // Bass Boost Slider
    const bassSlider = document.getElementById('setting-bass-boost');
    const bassVal = document.getElementById('setting-bass-boost-val');
    if (bassSlider) {
      bassSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (window.MediaXAudio) window.MediaXAudio.setBassBoost(val);
        if (bassVal) bassVal.textContent = `+${val} dB`;
      });
    }

    // Treble Boost Slider
    const trebleSlider = document.getElementById('setting-treble-boost');
    const trebleVal = document.getElementById('setting-treble-boost-val');
    if (trebleSlider) {
      trebleSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (window.MediaXAudio) window.MediaXAudio.setTrebleBoost(val);
        if (trebleVal) trebleVal.textContent = `+${val} dB`;
      });
    }
  }

  // --- Video & Display Settings ---
  bindVideoSettings() {
    // Display Mode
    const displaySelect = document.getElementById('setting-display-mode');
    if (displaySelect) {
      displaySelect.addEventListener('change', (e) => {
        if (window.MediaXVideoEffects) window.MediaXVideoEffects.setDisplayMode(e.target.value);
      });
    }

    // Rotate Buttons
    const btnRotate90 = document.getElementById('btn-rotate-90');
    const btnRotateReset = document.getElementById('btn-rotate-reset');
    if (btnRotate90) {
      btnRotate90.addEventListener('click', () => {
        if (window.MediaXVideoEffects) window.MediaXVideoEffects.rotateClockwise();
      });
    }
    if (btnRotateReset) {
      btnRotateReset.addEventListener('click', () => {
        if (window.MediaXVideoEffects) window.MediaXVideoEffects.resetRotation();
      });
    }

    // Flip Buttons
    const btnFlipH = document.getElementById('btn-flip-h');
    const btnFlipV = document.getElementById('btn-flip-v');
    const btnFlipReset = document.getElementById('btn-flip-reset');
    if (btnFlipH) {
      btnFlipH.addEventListener('click', () => {
        if (window.MediaXVideoEffects) window.MediaXVideoEffects.toggleFlipH();
      });
    }
    if (btnFlipV) {
      btnFlipV.addEventListener('click', () => {
        if (window.MediaXVideoEffects) window.MediaXVideoEffects.toggleFlipV();
      });
    }
    if (btnFlipReset) {
      btnFlipReset.addEventListener('click', () => {
        if (window.MediaXVideoEffects) window.MediaXVideoEffects.resetFlip();
      });
    }

    // Zoom Buttons
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        if (window.MediaXVideoEffects) window.MediaXVideoEffects.zoomIn();
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        if (window.MediaXVideoEffects) window.MediaXVideoEffects.zoomOut();
      });
    }
    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => {
        if (window.MediaXVideoEffects) window.MediaXVideoEffects.resetZoom();
      });
    }

    // Image Adjustments Sliders & Reset buttons
    this.bindAdjustmentSlider('brightness', (val) => window.MediaXVideoEffects.setBrightness(val), '%');
    this.bindAdjustmentSlider('contrast', (val) => window.MediaXVideoEffects.setContrast(val), '%');
    this.bindAdjustmentSlider('saturation', (val) => window.MediaXVideoEffects.setSaturation(val), '%');
    this.bindAdjustmentSlider('hue', (val) => window.MediaXVideoEffects.setHue(val), '°');
    this.bindAdjustmentSlider('sharpness', (val) => window.MediaXVideoEffects.setSharpness(val), 'px');

    const btnResetAllAdjustments = document.getElementById('btn-reset-all-adjustments');
    if (btnResetAllAdjustments) {
      btnResetAllAdjustments.addEventListener('click', () => {
        if (window.MediaXVideoEffects) {
          window.MediaXVideoEffects.resetAdjustment('all');
          this.resetAdjustmentSliderUI();
        }
      });
    }
  }

  bindAdjustmentSlider(name, onInput, unit) {
    const slider = document.getElementById(`setting-adj-${name}`);
    const display = document.getElementById(`setting-adj-${name}-val`);
    const btnReset = document.getElementById(`btn-reset-adj-${name}`);

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (display) display.textContent = `${val}${unit}`;
        if (window.MediaXVideoEffects) onInput(val);
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (window.MediaXVideoEffects) {
          window.MediaXVideoEffects.resetAdjustment(name);
          const defaultVal = (name === 'hue' || name === 'sharpness') ? 0 : 100;
          if (slider) slider.value = defaultVal;
          if (display) display.textContent = `${defaultVal}${unit}`;
        }
      });
    }
  }

  resetAdjustmentSliderUI() {
    ['brightness', 'contrast', 'saturation'].forEach(name => {
      const s = document.getElementById(`setting-adj-${name}`);
      const d = document.getElementById(`setting-adj-${name}-val`);
      if (s) s.value = 100;
      if (d) d.textContent = '100%';
    });
    const hueS = document.getElementById('setting-adj-hue');
    const hueD = document.getElementById('setting-adj-hue-val');
    if (hueS) hueS.value = 0;
    if (hueD) hueD.textContent = '0°';

    const sharpS = document.getElementById('setting-adj-sharpness');
    const sharpD = document.getElementById('setting-adj-sharpness-val');
    if (sharpS) sharpS.value = 0;
    if (sharpD) sharpD.textContent = '0px';
  }

  // --- Subtitles Settings ---
  bindSubtitleSettings() {
    // Subtitle Track Selection (Default Caption, Off, Languages)
    const subTrackSelect = document.getElementById('setting-subtitle-track-select');
    if (subTrackSelect) {
      subTrackSelect.addEventListener('change', (e) => {
        if (window.MediaXSubtitles) {
          window.MediaXSubtitles.selectSubtitleTrack(e.target.value);
        }
      });
    }

    const sizeSlider = document.getElementById('setting-sub-size');
    const sizeVal = document.getElementById('setting-sub-size-val');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (window.MediaXSubtitles) window.MediaXSubtitles.setFontSize(val);
        if (sizeVal) sizeVal.textContent = `${val}px`;
      });
    }

    const colorSelect = document.getElementById('setting-sub-color');
    if (colorSelect) {
      colorSelect.addEventListener('change', (e) => {
        if (window.MediaXSubtitles) window.MediaXSubtitles.setColor(e.target.value);
      });
    }

    const opacitySlider = document.getElementById('setting-sub-opacity');
    const opacityVal = document.getElementById('setting-sub-opacity-val');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (window.MediaXSubtitles) window.MediaXSubtitles.setBgOpacity(val);
        if (opacityVal) opacityVal.textContent = `${Math.round(val * 100)}%`;
      });
    }

    const posSelect = document.getElementById('setting-sub-position');
    if (posSelect) {
      posSelect.addEventListener('change', (e) => {
        if (window.MediaXSubtitles) window.MediaXSubtitles.setPosition(e.target.value);
      });
    }

    // Subtitle Delay Stepper
    const subDelaySlider = document.getElementById('setting-sub-delay');
    const subDelayVal = document.getElementById('setting-sub-delay-val');
    if (subDelaySlider) {
      subDelaySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (window.MediaXSubtitles) window.MediaXSubtitles.setDelay(val);
        if (subDelayVal) subDelayVal.textContent = `${val > 0 ? `+${val}` : val} ms`;
      });
    }

    // Load Subtitle File Input
    const subFileInput = document.getElementById('setting-sub-file-input');
    const btnLoadSub = document.getElementById('btn-load-sub-file');
    if (btnLoadSub && subFileInput) {
      btnLoadSub.addEventListener('click', () => subFileInput.click());
      subFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          if (window.MediaXSubtitles) window.MediaXSubtitles.loadFromFile(e.target.files[0]);
        }
      });
    }
  }

  // --- Privacy & Storage Settings ---
  bindPrivacySettings() {
    const btnClearRecents = document.getElementById('btn-clear-recent-history');
    if (btnClearRecents) {
      btnClearRecents.addEventListener('click', () => {
        if (window.MediaXStorage) {
          window.MediaXStorage.clearRecents();
          if (window.MediaXApp) window.MediaXApp.showToast('Recent playback history cleared', 'success');
        }
      });
    }

    const btnResetAll = document.getElementById('btn-reset-all-preferences');
    if (btnResetAll) {
      btnResetAll.addEventListener('click', () => {
        if (confirm('Reset all player preferences to factory defaults?')) {
          if (window.MediaXStorage) {
            window.MediaXStorage.clearAllData();
            location.reload();
          }
        }
      });
    }
  }
}

window.MediaXSettings = new SettingsController();
