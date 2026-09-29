/**
 * MediaX Player - Custom Right-Click Context Menu
 * Provides native desktop media player context menu within the video stage.
 * Does not interfere with standard browser context menu outside player bounds.
 */

class ContextMenuManager {
  constructor() {
    this.menuEl = null;
    this.viewportEl = null;
    this.isVisible = false;
  }

  init(menuEl, viewportEl) {
    this.menuEl = menuEl;
    this.viewportEl = viewportEl;

    if (!this.menuEl || !this.viewportEl) return;

    this.viewportEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.show(e.clientX, e.clientY);
    });

    window.addEventListener('click', (e) => {
      if (this.isVisible && !this.menuEl.contains(e.target)) {
        this.hide();
      }
    });

    window.addEventListener('scroll', () => {
      if (this.isVisible) this.hide();
    });

    this.bindMenuItems();
  }

  show(x, y) {
    if (!this.menuEl) return;
    this.menuEl.classList.add('active');
    this.isVisible = true;

    // Adjust position to stay within window bounds
    const rect = this.menuEl.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX = x;
    let posY = y;

    if (posX + rect.width > winWidth) {
      posX = winWidth - rect.width - 12;
    }
    if (posY + rect.height > winHeight) {
      posY = winHeight - rect.height - 12;
    }

    this.menuEl.style.left = `${posX}px`;
    this.menuEl.style.top = `${posY}px`;
  }

  hide() {
    if (this.menuEl) {
      this.menuEl.classList.remove('active');
    }
    this.isVisible = false;
  }

  bindMenuItems() {
    if (!this.menuEl) return;

    this.menuEl.addEventListener('click', (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item) return;

      const action = item.getAttribute('data-action');
      this.hide();

      switch (action) {
        case 'play-pause':
          if (window.MediaXPlayer) window.MediaXPlayer.togglePlay();
          break;
        case 'rewind':
          if (window.MediaXPlayer) window.MediaXPlayer.skip(-10);
          break;
        case 'forward':
          if (window.MediaXPlayer) window.MediaXPlayer.skip(10);
          break;
        case 'screenshot':
          if (window.MediaXScreenshot) window.MediaXScreenshot.capture(true);
          break;
        case 'audio-track':
          if (window.MediaXSettings) window.MediaXSettings.openTab('audio');
          break;
        case 'subtitles':
          if (window.MediaXSettings) window.MediaXSettings.openTab('subtitles');
          break;
        case 'speed':
          if (window.MediaXControls && window.MediaXControls.btnSpeedEl) {
            window.MediaXControls.btnSpeedEl.click();
          }
          break;
        case 'display-mode':
          if (window.MediaXSettings) window.MediaXSettings.openTab('display');
          break;
        case 'fullscreen':
          if (window.MediaXControls) window.MediaXControls.toggleFullscreen();
          break;
        case 'info':
          if (window.MediaXSettings) window.MediaXSettings.openTab('info');
          break;
        case 'settings':
          if (window.MediaXSettings) window.MediaXSettings.openTab('playback');
          break;
      }
    });
  }
}

window.MediaXContextMenu = new ContextMenuManager();
