/**
 * MediaX Player - Keyboard Shortcuts Engine
 * Complete shortcuts map per MPC/VLC standards with input field guards
 * and search-filtered shortcut dialog.
 */

class ShortcutsManager {
  constructor() {
    this.shortcuts = [
      { key: 'Space', desc: 'Play / Pause', category: 'Playback' },
      { key: '←', desc: 'Rewind 10 seconds', category: 'Playback' },
      { key: '→', desc: 'Forward 10 seconds', category: 'Playback' },
      { key: 'Shift + ←', desc: 'Rewind 30 seconds', category: 'Playback' },
      { key: 'Shift + →', desc: 'Forward 30 seconds', category: 'Playback' },
      { key: ',', desc: 'Previous frame (when paused)', category: 'Playback' },
      { key: '.', desc: 'Next frame (when paused)', category: 'Playback' },
      { key: 'L', desc: 'Toggle A-B Loop', category: 'Playback' },
      { key: '↑', desc: 'Volume + 5%', category: 'Audio' },
      { key: '↓', desc: 'Volume - 5%', category: 'Audio' },
      { key: 'M', desc: 'Toggle Mute', category: 'Audio' },
      { key: 'E', desc: 'Audio Equalizer Drawer', category: 'Audio' },
      { key: 'A', desc: 'Audio Track / Sync Delay', category: 'Audio' },
      { key: 'F', desc: 'Toggle Fullscreen', category: 'Display' },
      { key: 'P', desc: 'Picture-in-Picture', category: 'Display' },
      { key: 'S', desc: 'Capture Screenshot', category: 'Video' },
      { key: 'R', desc: 'Reset Video Adjustments', category: 'Video' },
      { key: 'C', desc: 'Toggle Subtitles', category: 'Subtitles' },
      { key: 'I', desc: 'Media Information', category: 'General' },
      { key: 'Esc', desc: 'Close dialogs / Exit fullscreen', category: 'General' }
    ];
  }

  init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  handleKeyDown(e) {
    // Guard: ignore keystrokes if typing inside text fields or contenteditable
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) {
      if (e.key === 'Escape') {
        active.blur();
      }
      return;
    }

    const key = e.key;
    const isShift = e.shiftKey;

    switch (key) {
      case ' ': // Space: Play/Pause
        e.preventDefault();
        if (window.MediaXPlayer) window.MediaXPlayer.togglePlay();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (window.MediaXPlayer) {
          const skipSec = isShift ? 30 : (window.MediaXStorage ? window.MediaXStorage.getSetting('skipDuration') : 10);
          window.MediaXPlayer.skip(-skipSec);
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (window.MediaXPlayer) {
          const skipSec = isShift ? 30 : (window.MediaXStorage ? window.MediaXStorage.getSetting('skipDuration') : 10);
          window.MediaXPlayer.skip(skipSec);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (window.MediaXPlayer) {
          const newVol = Math.min(2.0, window.MediaXPlayer.volume + 0.05);
          window.MediaXPlayer.setVolume(newVol);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (window.MediaXPlayer) {
          const newVol = Math.max(0, window.MediaXPlayer.volume - 0.05);
          window.MediaXPlayer.setVolume(newVol);
        }
        break;

      case 'm':
      case 'M':
        e.preventDefault();
        if (window.MediaXPlayer) window.MediaXPlayer.toggleMute();
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        if (window.MediaXControls) window.MediaXControls.toggleFullscreen();
        break;

      case 'p':
      case 'P':
        e.preventDefault();
        if (window.MediaXControls) window.MediaXControls.togglePictureInPicture();
        break;

      case 's':
      case 'S':
        e.preventDefault();
        if (window.MediaXScreenshot) window.MediaXScreenshot.capture(true);
        break;

      case 'e':
      case 'E':
        e.preventDefault();
        if (window.MediaXSettings) window.MediaXSettings.toggleDrawer('equalizer');
        break;

      case 'i':
      case 'I':
        e.preventDefault();
        if (window.MediaXSettings) window.MediaXSettings.toggleDrawer('info');
        break;

      case 'a':
      case 'A':
        e.preventDefault();
        if (window.MediaXSettings) window.MediaXSettings.toggleDrawer('audio');
        break;

      case 'c':
      case 'C':
        e.preventDefault();
        if (window.MediaXSubtitles) window.MediaXSubtitles.toggleEnabled();
        break;

      case 'l':
      case 'L':
        e.preventDefault();
        if (window.MediaXPlayer) {
          if (window.MediaXPlayer.loopPointA === null) {
            window.MediaXPlayer.setLoopA();
          } else if (window.MediaXPlayer.loopPointB === null) {
            window.MediaXPlayer.setLoopB();
          } else {
            window.MediaXPlayer.clearABLoop();
            if (window.MediaXApp) window.MediaXApp.showToast('A-B Loop cleared', 'info');
          }
        }
        break;

      case 'r':
      case 'R':
        e.preventDefault();
        if (window.MediaXVideoEffects) {
          window.MediaXVideoEffects.resetAdjustment('all');
          window.MediaXVideoEffects.resetRotation();
          window.MediaXVideoEffects.resetFlip();
          window.MediaXVideoEffects.resetZoom();
          if (window.MediaXApp) window.MediaXApp.showToast('Video adjustments reset', 'info');
        }
        break;

      case ',': // Previous Frame
        e.preventDefault();
        if (window.MediaXPlayer) window.MediaXPlayer.stepFrame(-1);
        break;

      case '.': // Next Frame
        e.preventDefault();
        if (window.MediaXPlayer) window.MediaXPlayer.stepFrame(1);
        break;

      case 'Escape':
        // Close modals, context menu, or exit settings
        if (window.MediaXSettings) window.MediaXSettings.closeDrawer();
        if (window.MediaXContextMenu) window.MediaXContextMenu.hide();
        if (window.MediaXScreenshot) window.MediaXScreenshot.closeModal();
        if (window.MediaXApp) window.MediaXApp.closePlaylistDrawer();
        break;
    }
  }

  renderShortcutsList(containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div class="settings-section-title">Keyboard Shortcuts Reference</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${this.shortcuts.map(sc => `
          <div class="settings-item-row" style="padding:8px 12px; background:var(--bg-card); border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
            <span style="font-size:13px; color:var(--text-secondary);">${sc.desc}</span>
            <kbd style="padding:3px 8px; border-radius:4px; background:rgba(0,0,0,0.4); border:1px solid var(--border); font-family:monospace; font-size:12px; color:var(--accent-light); font-weight:700;">${sc.key}</kbd>
          </div>
        `).join('')}
      </div>
    `;
  }
}

window.MediaXShortcuts = new ShortcutsManager();
