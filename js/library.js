/**
 * MediaX Library Manager
 * Manages the home screen library: history (recents), session video/audio library,
 * folder grouping, tab navigation, and context menus.
 */

class LibraryManager {
  constructor() {
    this.sessionItems = [];       // Files added this session (from playlist)
    this.activeLibTab = 'video';  // 'video' | 'folder' | 'playlist'
    this.viewMode = 'list';       // 'list' | 'grid'
    this.menuOpenFor = null;
    this._menuEl = null;
  }

  init() {
    this._menuEl = document.getElementById('lib-item-menu');
    this._bindTabs();
    this._bindMenuDismiss();
    this._bindBottomNav();
    this.refresh();
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

  // --- Library (session files) ---
  _renderLibrary() {
    const pane = document.getElementById('lib-pane-video');
    if (!pane) return;

    const items = this.sessionItems.filter(i =>
      this.activeLibTab === 'video'
        ? (i.type === 'video' || i.type === 'media')
        : i.type === 'audio'
    );

    // For folders tab - group by source
    if (this.activeLibTab === 'folder') {
      this._renderFolderPane();
      return;
    }

    const playlist = document.getElementById('lib-pane-playlist');
    if (playlist) this._renderPlaylistPane();

    if (items.length === 0) {
      pane.innerHTML = `
        <div class="lib-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
          <div class="lib-empty-title">No ${this.activeLibTab === 'video' ? 'videos' : 'audio'} yet</div>
          <div class="lib-empty-sub">Open local files or drop them anywhere to start playing</div>
          <button id="lib-empty-open" class="btn-primary" style="margin-top:6px; font-size:13px; padding:10px 22px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Open Media
          </button>
        </div>
        <div class="lib-privacy-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
          </svg>
          Your media stays on your device. Files are processed locally. Nothing is uploaded.
        </div>`;

      const btnOpen = document.getElementById('lib-empty-open');
      if (btnOpen) {
        btnOpen.addEventListener('click', () => {
          const inp = document.getElementById('landing-file-input');
          if (inp) inp.click();
        });
      }
      return;
    }

    const currentId = window.MediaXPlaylist
      ? (window.MediaXPlaylist.items[window.MediaXPlaylist.currentIndex] || {}).id
      : null;

    pane.innerHTML = `
      <div class="video-list" id="lib-video-list">
        ${items.map((item, idx) => this._videoItemHTML(item, idx, currentId)).join('')}
      </div>
      <div class="lib-privacy-note" style="margin-top:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
        </svg>
        Your media stays on your device. Files are processed locally. Nothing is uploaded.
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

  _videoItemHTML(item, idx, currentId) {
    const isPlaying = item.id === currentId;
    const dur = item.duration ? this._fmtDuration(item.duration) : '';
    const sizeStr = item.size ? this._fmtSize(item.size) : '';
    const isAudio = item.type === 'audio';

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
            ${isAudio ? `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Audio</span>` : `<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>Video</span>`}
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

    // Group session items by approximate folder name (from filename prefix)
    const groups = {};
    this.sessionItems.forEach(item => {
      const parts = item.name.split(/[\\/]/);
      const folder = parts.length > 1 ? parts[0] : 'Current Session';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(item);
    });

    if (Object.keys(groups).length === 0) {
      pane.innerHTML = `
        <div class="lib-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <div class="lib-empty-title">No folders yet</div>
          <div class="lib-empty-sub">Open media files to see them grouped here</div>
        </div>`;
      return;
    }

    pane.innerHTML = `
      <div class="folder-grid">
        ${Object.entries(groups).map(([name, items]) => `
          <div class="folder-card" data-folder="${this._esc(name)}">
            <div class="folder-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div class="folder-name">${this._esc(name)}</div>
            <div class="folder-count">${items.length} file${items.length !== 1 ? 's' : ''}</div>
          </div>`).join('')}
      </div>`;

    pane.querySelectorAll('.folder-card').forEach(el => {
      el.addEventListener('click', () => {
        // Switch to video tab and filter (future enhancement)
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
        if (this.menuOpenFor) this._playItem(this.menuOpenFor);
        this._closeMenu();
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
        }
        this._closeMenu();
      });
    }

    document.addEventListener('click', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target)) {
        this._closeMenu();
      }
    });
  }

  _closeMenu() {
    if (this._menuEl) this._menuEl.classList.remove('open');
    this.menuOpenFor = null;
  }

  // --- Utilities ---
  _fmtDuration(secs) {
    if (!secs || secs <= 0) return '';
    secs = Math.round(secs);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  _fmtSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  _timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  _esc(str) {
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }
}

window.MediaXLibrary = new LibraryManager();
