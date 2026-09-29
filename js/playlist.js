/**
 * MediaX Player - Local Playlist Manager
 * Handles multi-file queuing, reordering, shuffle, repeat (off/all/one),
 * and automatic track sequencing.
 */

class PlaylistManager {
  constructor() {
    this.items = [];
    this.currentIndex = -1;
    this.isShuffled = false;
    this.repeatMode = 'off'; // 'off', 'all', 'one'
    this.shuffledOrder = [];
    this.containerEl = null;
  }

  init(containerEl) {
    this.containerEl = containerEl;
    this.render();
  }

  addFiles(files, autoPlay = true) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    const startIndex = this.items.length;
    fileArray.forEach((file) => {
      let folder = file.folderPath || '';
      if (!folder && file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split('/');
        if (parts.length > 1) {
          folder = parts.slice(0, -1).join('/');
        }
      }
      if (!folder) {
        folder = 'Device Videos';
      }

      const item = {
        id: 'pl_' + Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: file.size,
        type: file.type.startsWith('audio') ? 'audio' : 'video',
        folder: folder,
        file: file,
        url: URL.createObjectURL(file),
        duration: 0
      };
      this.items.push(item);
    });

    this.rebuildShuffleOrder();
    this.render();

    // If autoPlay requested and nothing currently playing, play first added file
    if (autoPlay && this.currentIndex === -1 && this.items.length > 0) {
      this.playIndex(startIndex);
    }
  }

  addExternalItem(name, url, type = 'video') {
    const item = {
      id: 'pl_' + Math.random().toString(36).substring(2, 9),
      name: name,
      size: 0,
      type: type,
      file: null,
      url: url,
      duration: 0
    };
    this.items.push(item);
    this.rebuildShuffleOrder();
    this.render();
    if (this.currentIndex === -1) {
      this.playIndex(this.items.length - 1);
    }
  }

  playIndex(index) {
    if (index < 0 || index >= this.items.length) return;
    this.currentIndex = index;
    const item = this.items[index];

    if (window.MediaXPlayer) {
      window.MediaXPlayer.loadMedia(item);
    }
    this.render();
  }

  playNext() {
    if (this.items.length === 0) return;

    if (this.repeatMode === 'one' && this.currentIndex !== -1) {
      this.playIndex(this.currentIndex);
      return;
    }

    if (this.isShuffled) {
      const currentPosInShuffle = this.shuffledOrder.indexOf(this.currentIndex);
      if (currentPosInShuffle !== -1 && currentPosInShuffle < this.shuffledOrder.length - 1) {
        this.playIndex(this.shuffledOrder[currentPosInShuffle + 1]);
      } else if (this.repeatMode === 'all') {
        this.rebuildShuffleOrder();
        this.playIndex(this.shuffledOrder[0]);
      }
      return;
    }

    if (this.currentIndex < this.items.length - 1) {
      this.playIndex(this.currentIndex + 1);
    } else if (this.repeatMode === 'all') {
      this.playIndex(0);
    }
  }

  playPrevious() {
    if (this.items.length === 0) return;

    // If more than 3 seconds in, restart current track
    if (window.MediaXPlayer && window.MediaXPlayer.getCurrentTime() > 3) {
      window.MediaXPlayer.seekTo(0);
      return;
    }

    if (this.isShuffled) {
      const currentPosInShuffle = this.shuffledOrder.indexOf(this.currentIndex);
      if (currentPosInShuffle > 0) {
        this.playIndex(this.shuffledOrder[currentPosInShuffle - 1]);
      }
      return;
    }

    if (this.currentIndex > 0) {
      this.playIndex(this.currentIndex - 1);
    } else if (this.repeatMode === 'all') {
      this.playIndex(this.items.length - 1);
    }
  }

  removeItem(index) {
    if (index < 0 || index >= this.items.length) return;
    const removedItem = this.items[index];
    if (removedItem.file && removedItem.url) {
      URL.revokeObjectURL(removedItem.url);
    }

    this.items.splice(index, 1);

    if (this.currentIndex === index) {
      if (this.items.length > 0) {
        this.playIndex(Math.min(index, this.items.length - 1));
      } else {
        this.currentIndex = -1;
        if (window.MediaXPlayer) window.MediaXPlayer.unload();
      }
    } else if (this.currentIndex > index) {
      this.currentIndex--;
    }

    this.rebuildShuffleOrder();
    this.render();
  }

  moveItem(fromIdx, toIdx) {
    if (toIdx < 0 || toIdx >= this.items.length) return;
    const item = this.items.splice(fromIdx, 1)[0];
    this.items.splice(toIdx, 0, item);

    if (this.currentIndex === fromIdx) {
      this.currentIndex = toIdx;
    } else if (this.currentIndex > fromIdx && this.currentIndex <= toIdx) {
      this.currentIndex--;
    } else if (this.currentIndex < fromIdx && this.currentIndex >= toIdx) {
      this.currentIndex++;
    }

    this.rebuildShuffleOrder();
    this.render();
  }

  clear() {
    this.items.forEach((item) => {
      if (item.file && item.url) {
        URL.revokeObjectURL(item.url);
      }
    });
    this.items = [];
    this.currentIndex = -1;
    this.shuffledOrder = [];
    this.render();
    if (window.MediaXPlayer) {
      window.MediaXPlayer.unload();
    }
  }

  removeItem(index) {
    if (index < 0 || index >= this.items.length) return;
    const item = this.items[index];
    if (item.file && item.url) URL.revokeObjectURL(item.url);
    this.items.splice(index, 1);
    if (this.currentIndex >= this.items.length) {
      this.currentIndex = this.items.length - 1;
    }
    this.rebuildShuffleOrder();
    this.render();
    if (window.MediaXLibrary) window.MediaXLibrary.sync(this.items);
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    if (this.isShuffled) {
      this.rebuildShuffleOrder();
    }
    return this.isShuffled;
  }

  toggleRepeat() {
    const modes = ['off', 'all', 'one'];
    const nextIdx = (modes.indexOf(this.repeatMode) + 1) % modes.length;
    this.repeatMode = modes[nextIdx];
    return this.repeatMode;
  }

  rebuildShuffleOrder() {
    this.shuffledOrder = this.items.map((_, i) => i);
    for (let i = this.shuffledOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledOrder[i], this.shuffledOrder[j]] = [this.shuffledOrder[j], this.shuffledOrder[i]];
    }
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  render() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    if (this.items.length === 0) {
      this.containerEl.innerHTML = `
        <div class="playlist-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <div style="font-size:15px; font-weight:600; color:var(--text-primary);">Playlist is empty</div>
          <div style="font-size:13px; color:var(--text-muted);">Add media files or drag & drop them here</div>
        </div>
      `;
      return;
    }

    this.items.forEach((item, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = `playlist-item ${idx === this.currentIndex ? 'active' : ''}`;
      itemEl.setAttribute('draggable', 'true');

      const indexLabel = String(idx + 1).padStart(2, '0');
      const sizeStr = item.size ? this.formatBytes(item.size) : '';

      itemEl.innerHTML = `
        <div class="playlist-item-index">${indexLabel}</div>
        <div class="playlist-item-meta">
          <div class="playlist-item-title">${this.escapeHtml(item.name)}</div>
          <div class="playlist-item-info">
            <span class="media-badge-tag">${item.type.toUpperCase()}</span>
            ${sizeStr ? `<span>${sizeStr}</span>` : ''}
          </div>
        </div>
        <div class="playlist-item-actions">
          <button class="btn-icon" style="width:28px;height:28px;" title="Move Up" data-action="up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
          <button class="btn-icon" style="width:28px;height:28px;" title="Move Down" data-action="down">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <button class="btn-icon" style="width:28px;height:28px;color:var(--danger);" title="Remove" data-action="remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;

      itemEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) {
          const action = btn.getAttribute('data-action');
          if (action === 'up') {
            e.stopPropagation();
            this.moveItem(idx, idx - 1);
          } else if (action === 'down') {
            e.stopPropagation();
            this.moveItem(idx, idx + 1);
          } else if (action === 'remove') {
            e.stopPropagation();
            this.removeItem(idx);
          }
          return;
        }
        this.playIndex(idx);
      });

      this.containerEl.appendChild(itemEl);
    });
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

window.MediaXPlaylist = new PlaylistManager();
