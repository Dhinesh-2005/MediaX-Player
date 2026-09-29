/**
 * MediaX Library Manager
 * Manages the home screen library: permission prompt on open, video directory scanning,
 * available videos list, folder grouping, history (recents), tabs, and context menus.
 */

class LibraryManager {
  constructor() {
    this.sessionItems = [];       // Files added this session (from playlist)
    this.activeLibTab = 'video';  // 'video' | 'folder' | 'playlist'
    this.viewMode = 'list';       // 'list' | 'grid'
    this.menuOpenFor = null;
    this._menuEl = null;
    this._permModalEl = null;
    this._hasPromptedPermission = false;
  }

  init() {
    this._menuEl = document.getElementById('lib-item-menu');
    this._permModalEl = document.getElementById('lib-permission-modal');
    this._bindTabs();
    this._bindMenuDismiss();
    this._bindBottomNav();
    this._bindPermissionModal();
    this.refresh();

    // On initial app open: automatically ask permission to access video files/folder
    setTimeout(() => {
      if (this.sessionItems.length === 0 && !this._hasPromptedPermission) {
        this.showPermissionModal();
      }
    }, 400);
  }

  // --- Permission Modal Handling ---
  showPermissionModal() {
    this._hasPromptedPermission = true;
    if (this._permModalEl) {
      this._permModalEl.classList.add('open');
    }
  }

  hidePermissionModal() {
    if (this._permModalEl) {
      this._permModalEl.classList.remove('open');
    }
  }

  _bindPermissionModal() {
    const btnGrantFolder = document.getElementById('btn-perm-grant-folder');
    if (btnGrantFolder) {
      btnGrantFolder.addEventListener('click', () => {
        this.requestDirectoryAccess();
      });
    }

    const btnSelectFiles = document.getElementById('btn-perm-select-files');
    if (btnSelectFiles) {
      btnSelectFiles.addEventListener('click', () => {
        this.requestFilesAccess();
      });
    }

    const btnDismiss = document.getElementById('btn-perm-dismiss');
    if (btnDismiss) {
      btnDismiss.addEventListener('click', () => {
        this.hidePermissionModal();
      });
    }

    if (this._permModalEl) {
      this._permModalEl.addEventListener('click', (e) => {
        if (e.target === this._permModalEl) {
          this.hidePermissionModal();
        }
      });
    }
  }

  async requestDirectoryAccess() {
    this.hidePermissionModal();
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        await this._scanDirectoryHandle(dirHandle);
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // User cancelled prompt
      console.warn('showDirectoryPicker failed, falling back to input', err);
    }

    // Fallback: trigger native webkitdirectory input
    const folderInput = document.getElementById('folder-permission-input');
    if (folderInput) {
      folderInput.click();
    }
  }

  requestFilesAccess() {
    this.hidePermissionModal();
    const filesInput = document.getElementById('files-permission-input') || document.getElementById('landing-file-input');
    if (filesInput) {
      filesInput.click();
    }
  }

  async _scanDirectoryHandle(dirHandle) {
    const videoExts = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'm4v', 'flv', 'ts', 'wmv', '3gp', 'ogg', 'ogv'];
    const collectedFiles = [];

    async function walk(handle, path) {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const ext = entry.name.split('.').pop().toLowerCase();
          if (videoExts.includes(ext)) {
            try {
              const file = await entry.getFile();
              file.folderPath = path || handle.name || 'Videos';
              collectedFiles.push(file);
            } catch (e) {
              console.warn('Could not read file:', entry.name, e);
            }
          }
        } else if (entry.kind === 'directory') {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const subPath = path ? `${path}/${entry.name}` : entry.name;
            await walk(entry, subPath);
          }
        }
      }
    }

    try {
      await walk(dirHandle, dirHandle.name);
      if (collectedFiles.length > 0 && window.MediaXApp) {
        // Add files without auto-starting playback so available videos are visible on home screen
        window.MediaXApp.handleSelectedFiles(collectedFiles, false);
      }
    } catch (e) {
      console.error('Directory scanning error:', e);
    }
  }

  // Called whenever playlist changes (addFiles / removeItem / clear)
  sync(playlistItems) {
    this.sessionItems = (playlistItems || []).map(item => ({ ...item }));
    this.refresh();
  }

  refresh() {
    this._renderHistory();
    this._renderLibrary();
  }

  // --- History (Recently Played) ---
  _renderHistory() {
    const container = document.getElementById('lib-history-scroll');
    if (!container) return;
    const recents = window.MediaXStorage ? window.MediaXStorage.recents : [];

    if (!recents || recents.length === 0) {
      container.innerHTML = `
        <div class="history-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>No recently played files</span>
        </div>`;
      return;
    }

    container.innerHTML = recents.slice(0, 12).map((item, i) => {
      const dur = item.duration ? this._fmtDuration(item.duration) : '';
      const pos = item.lastPosition && item.duration
        ? Math.round((item.lastPosition / item.duration) * 100)
        : 0;
      const isAudio = item.type === 'audio';
      return `
        <div class="history-thumb" data-recent-index="${i}" title="${this._esc(item.name)}">
          <div class="history-thumb-art">
            ${isAudio ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>`}
            ${dur ? `<span class="history-thumb-duration">${dur}</span>` : ''}
          </div>
          <div class="history-thumb-info">
            <div class="history-thumb-name">${this._esc(item.name)}</div>
            <div class="history-thumb-meta">${pos > 0 ? `${pos}% watched` : this._timeAgo(item.timestamp)}</div>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.history-thumb').forEach(el => {
      el.addEventListener('click', () => {
        // Local files can't be re-opened from history (no File handle stored)
      });
    });
  }

  // --- Library (Available Videos & Audio) ---
  _renderLibrary() {
    const pane = document.getElementById('lib-pane-video');
    if (!pane) return;

    if (this.activeLibTab === 'folder') {
      this._renderFolderPane();
      return;
    }

    const playlist = document.getElementById('lib-pane-playlist');
    if (playlist) this._renderPlaylistPane();

    const items = this.sessionItems.filter(i =>
      this.activeLibTab === 'video'
        ? (i.type === 'video' || i.type === 'media')
        : i.type === 'audio'
    );

    if (items.length === 0) {
      pane.innerHTML = `
        <div class="lib-perm-home-banner">
          <div class="lib-perm-home-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              <polygon points="12 11 12 17 17 14" fill="currentColor"/>
            </svg>
          </div>
          <h3 class="lib-perm-home-title">Storage Permission Required</h3>
          <p class="lib-perm-home-desc">
            Allow MediaX Player to access your video files to view and organize all available videos on your device.
          </p>
          <div class="lib-perm-home-actions">
            <button id="btn-home-grant-perm" class="btn-primary" style="font-size:13px; padding:10px 20px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Allow Access &amp; Scan Video Folder
            </button>
            <button id="btn-home-select-files" class="lib-perm-btn-secondary" style="font-size:13px; padding:10px 18px; width:auto;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
              Select Video Files
            </button>
          </div>
        </div>
        <div class="lib-privacy-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
          </svg>
          Your media stays on your device. Files are processed locally. Nothing is uploaded.
        </div>`;

      const btnGrant = document.getElementById('btn-home-grant-perm');
      if (btnGrant) {
        btnGrant.addEventListener('click', () => this.requestDirectoryAccess());
      }
      const btnFiles = document.getElementById('btn-home-select-files');
      if (btnFiles) {
        btnFiles.addEventListener('click', () => this.requestFilesAccess());
      }
      return;
    }

    const currentId = window.MediaXPlaylist
      ? (window.MediaXPlaylist.items[window.MediaXPlaylist.currentIndex] || {}).id
      : null;

    pane.innerHTML = `
      <div class="available-videos-header">
        <div class="available-videos-title">
          <span>Available Videos</span>
          <span class="available-videos-count">${items.length}</span>
        </div>
        <div class="available-videos-actions">
          <button id="btn-rescan-folder" class="lib-action-pill" title="Add More Videos or Scan Another Folder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Videos / Folder
          </button>
        </div>
      </div>
      <div class="video-list" id="lib-video-list">
        ${items.map((item, idx) => this._videoItemHTML(item, idx, currentId)).join('')}
      </div>
      <div class="lib-privacy-note" style="margin-top:12px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
        </svg>
        Your media stays on your device. Files are processed locally. Nothing is uploaded.
      </div>`;

    const btnRescan = document.getElementById('btn-rescan-folder');
    if (btnRescan) {
      btnRescan.addEventListener('click', () => this.requestDirectoryAccess());
    }

    pane.querySelectorAll('.video-list-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.vitem-more')) return;
        const id = el.dataset.itemId;
        this._playItem(id);
      });
    });

    pane.querySelectorAll('.vitem-more').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.itemId;
        this._openMenu(e, id);
      });
    });
  }

  _videoItemHTML(item, idx, currentId) {
    const isPlaying = item.id === currentId;
    const dur = item.duration ? this._fmtDuration(item.duration) : '';
    const sizeStr = item.size ? this._fmtSize(item.size) : '';
    const isAudio = item.type === 'audio';
    const ext = (item.name.split('.').pop() || 'MEDIA').toUpperCase();
    const folder = item.folder || '';

    return `
      <div class="video-list-item${isPlaying ? ' playing' : ''}" data-item-id="${item.id}">
        <div class="vitem-thumb">
          ${isAudio ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>`}
          ${dur ? `<span class="vitem-duration">${dur}</span>` : ''}
        </div>
        <div class="vitem-info">
          <div class="vitem-name">${this._esc(item.name)}</div>
          <div class="vitem-meta">
            ${sizeStr ? `<span>${sizeStr}</span>` : ''}
            <span style="font-size:10px; font-weight:700; padding:1px 5px; border-radius:4px; background:rgba(99,102,241,0.18); color:var(--accent-light);">${ext}</span>
            ${folder ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${this._esc(folder)}</span>` : ''}
          </div>
          ${isPlaying ? `<div class="vitem-now-playing"><span></span><span></span><span></span><span></span></div>` : ''}
        </div>
        <button class="vitem-more" data-item-id="${item.id}" title="More options" aria-label="More options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>
          </svg>
        </button>
      </div>`;
  }

  _renderFolderPane() {
    const pane = document.getElementById('lib-pane-folder');
    if (!pane) return;

    // Group session items by folder
    const groups = {};
    this.sessionItems.forEach(item => {
      const folder = item.folder || (item.name.includes('/') ? item.name.split('/')[0] : 'Device Videos');
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(item);
    });

    if (Object.keys(groups).length === 0) {
      pane.innerHTML = `
        <div class="lib-perm-home-banner">
          <div class="lib-perm-home-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3 class="lib-perm-home-title">No Video Folders Found</h3>
          <p class="lib-perm-home-desc">Allow access to your video folder to organize your videos into folders here.</p>
          <div class="lib-perm-home-actions">
            <button id="btn-folder-grant-perm" class="btn-primary" style="font-size:13px; padding:10px 20px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Scan Video Folder
            </button>
          </div>
        </div>`;
      const btnGrant = document.getElementById('btn-folder-grant-perm');
      if (btnGrant) btnGrant.addEventListener('click', () => this.requestDirectoryAccess());
      return;
    }

    pane.innerHTML = `
      <div class="folder-grid">
        ${Object.entries(groups).map(([name, items]) => `
          <div class="folder-card" data-folder="${this._esc(name)}">
            <div class="folder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div class="folder-name">${this._esc(name)}</div>
            <div class="folder-count">${items.length} video${items.length !== 1 ? 's' : ''}</div>
          </div>`).join('')}
      </div>`;

    pane.querySelectorAll('.folder-card').forEach(el => {
      el.addEventListener('click', () => {
        this._switchTab('video');
      });
    });
  }

  _renderPlaylistPane() {
    const pane = document.getElementById('lib-pane-playlist');
    if (!pane) return;
    const items = this.sessionItems;

    if (items.length === 0) {
      pane.innerHTML = `
        <div class="lib-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <div class="lib-empty-title">Playlist is empty</div>
          <div class="lib-empty-sub">Add media files to build a playlist</div>
        </div>`;
      return;
    }

    const currentId = window.MediaXPlaylist
      ? (window.MediaXPlaylist.items[window.MediaXPlaylist.currentIndex] || {}).id
      : null;

    pane.innerHTML = `
      <div class="lib-group-label">${items.length} track${items.length !== 1 ? 's' : ''}</div>
      <div class="video-list">
        ${items.map((item, idx) => this._videoItemHTML(item, idx, currentId)).join('')}
      </div>`;

    pane.querySelectorAll('.video-list-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.vitem-more')) return;
        const id = el.dataset.itemId;
        this._playItem(id);
      });
    });

    pane.querySelectorAll('.vitem-more').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.itemId;
        this._openMenu(e, id);
      });
    });
  }

  // --- Tab switching ---
  _bindTabs() {
    document.querySelectorAll('.lib-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) this._switchTab(tab);
      });
    });
  }

  _switchTab(tab) {
    this.activeLibTab = tab;
    document.querySelectorAll('.lib-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.lib-pane').forEach(p => {
      p.classList.toggle('active', p.id === `lib-pane-${tab}`);
    });
    this._renderLibrary();
  }

  // --- Bottom Nav ---
  _bindBottomNav() {
    document.querySelectorAll('.lib-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.navTab;
        if (!tab) return;
        document.querySelectorAll('.lib-nav-btn').forEach(b => b.classList.toggle('active', b === btn));
        if (tab === 'video') this._switchTab('video');
        else if (tab === 'music') this._switchTab('audio');
        else if (tab === 'playlist') this._switchTab('playlist');
      });
    });
  }

  // --- Play item ---
  _playItem(id) {
    if (!window.MediaXPlaylist) return;
    const idx = window.MediaXPlaylist.items.findIndex(i => i.id === id);
    if (idx !== -1) {
      window.MediaXPlaylist.playIndex(idx);
      if (window.MediaXApp) window.MediaXApp.showPlayerView();
    }
  }

  // --- Item Context Menu ---
  _openMenu(e, itemId) {
    const menu = this._menuEl;
    if (!menu) return;
    this.menuOpenFor = itemId;

    // Position near button
    const rect = e.currentTarget.getBoundingClientRect();
    const menuW = 184;
    let left = rect.right - menuW;
    let top = rect.bottom + 4;
    if (left < 8) left = 8;
    if (top + 150 > window.innerHeight) top = rect.top - 150;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.classList.add('open');
  }

  _bindMenuDismiss() {
    const menu = this._menuEl;
    if (!menu) return;

    // Play action
    const btnPlay = menu.querySelector('[data-action="play"]');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        if (this.menuOpenFor) {
          this._playItem(this.menuOpenFor);
          this._closeMenu();
        }
      });
    }

    // Remove action
    const btnRemove = menu.querySelector('[data-action="remove"]');
    if (btnRemove) {
      btnRemove.addEventListener('click', () => {
        if (this.menuOpenFor && window.MediaXPlaylist) {
          const idx = window.MediaXPlaylist.items.findIndex(i => i.id === this.menuOpenFor);
          if (idx !== -1) {
            window.MediaXPlaylist.removeItem(idx);
          }
          this._closeMenu();
        }
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !e.target.closest('.vitem-more')) {
        this._closeMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeMenu();
    });
  }

  _closeMenu() {
    if (this._menuEl) this._menuEl.classList.remove('open');
    this.menuOpenFor = null;
  }

  // --- Formatters ---
  _fmtDuration(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h > 0) {
      return `${h}:${String(remM).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${m}:${String(rem).padStart(2, '0')}`;
  }

  _fmtSize(bytes) {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${Math.round(mb)} MB`;
  }

  _timeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${Math.max(1, m)}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  _esc(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}

window.MediaXLibrary = new LibraryManager();
