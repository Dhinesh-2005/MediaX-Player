/**
 * MediaX Player - Subtitle Parser, Track Switcher & Renderer
 * Fully client-side SRT and WebVTT parser, renderer, delay sync (-5000ms to +5000ms),
 * and custom style engine with Default Caption & multi-language track switching.
 */

class SubtitleManager {
  constructor() {
    this.cues = [];
    this.isEnabled = true;
    this.delayMs = 0; // -5000 to +5000 ms
    this.currentText = '';
    this.containerEl = null;
    this.cueEl = null;
    this.videoEl = null;
    this.activeCueIndex = -1;
    this.externalFileName = '';
    this.activeTrackId = 'default';
    this.availableTracks = [];

    // Styling properties
    this.fontSize = 24;
    this.color = '#ffffff';
    this.bgOpacity = 0.75;
    this.fontWeight = '600';
    this.position = 'bottom'; // 'bottom', 'top', 'middle'
  }

  init(containerEl, videoEl = null) {
    this.containerEl = containerEl;
    this.videoEl = videoEl || document.getElementById('video-element');

    if (this.containerEl) {
      this.cueEl = this.containerEl.querySelector('.subtitle-cue');
      if (!this.cueEl) {
        this.cueEl = document.createElement('div');
        this.cueEl.className = 'subtitle-cue hidden';
        this.containerEl.appendChild(this.cueEl);
      }
    }

    // Load saved settings
    if (window.MediaXStorage) {
      this.fontSize = window.MediaXStorage.getSetting('subtitleSize') || 24;
      this.color = window.MediaXStorage.getSetting('subtitleColor') || '#ffffff';
      this.bgOpacity = window.MediaXStorage.getSetting('subtitleBgOpacity') || 0.75;
      this.fontWeight = window.MediaXStorage.getSetting('subtitleFontWeight') || '600';
      this.position = window.MediaXStorage.getSetting('subtitlePosition') || 'bottom';
      this.delayMs = window.MediaXStorage.getSetting('subtitleDelay') || 0;
    }

    this.applyStyles();
    this.updateAvailableTracks();
  }

  setVideoElement(videoEl) {
    this.videoEl = videoEl;
    this.updateAvailableTracks();
  }

  /**
   * Updates available subtitle tracks from video.textTracks, external files, and default caption
   */
  updateAvailableTracks() {
    this.availableTracks = [
      { id: 'default', label: 'Default Caption (Automatic)', language: 'default', isDefault: true },
      { id: 'off', label: 'Off (Disable Subtitles)', language: 'none' }
    ];

    // Inspect video.textTracks (embedded or <track> tags in video)
    if (this.videoEl && this.videoEl.textTracks && this.videoEl.textTracks.length > 0) {
      for (let i = 0; i < this.videoEl.textTracks.length; i++) {
        const tr = this.videoEl.textTracks[i];
        const langName = this.getLanguageDisplayName(tr.language);
        const label = tr.label || (langName ? `${langName} (${tr.kind || 'Subtitles'})` : `Track ${i + 1}`);
        this.availableTracks.push({
          id: `track-${i}`,
          index: i,
          label: label,
          language: tr.language || 'und',
          kind: tr.kind || 'subtitles',
          trackObj: tr
        });
      }
    }

    // If external subtitle file is loaded
    if (this.cues.length > 0) {
      this.availableTracks.push({
        id: 'external',
        label: this.externalFileName ? `External: ${this.externalFileName}` : 'External Subtitle File (.srt/.vtt)',
        language: 'custom',
        isExternal: true
      });
    }

    this.syncSubtitleUI();
    return this.availableTracks;
  }

  /**
   * Select active subtitle track
   * @param {string} trackId - 'default', 'off', 'external', or 'track-X'
   */
  selectSubtitleTrack(trackId) {
    this.activeTrackId = trackId;
    let selected = this.availableTracks.find(t => t.id === trackId);
    if (!selected) {
      selected = this.availableTracks[0];
      this.activeTrackId = selected.id;
    }

    if (trackId === 'off') {
      this.isEnabled = false;
      if (this.cueEl) this.cueEl.classList.add('hidden');
      // Disable any native video text tracks
      if (this.videoEl && this.videoEl.textTracks) {
        for (let i = 0; i < this.videoEl.textTracks.length; i++) {
          this.videoEl.textTracks[i].mode = 'disabled';
        }
      }
    } else if (trackId === 'default') {
      this.isEnabled = true;
      // If native text tracks exist, enable the first or default one
      if (this.videoEl && this.videoEl.textTracks && this.videoEl.textTracks.length > 0) {
        let defaultFound = false;
        for (let i = 0; i < this.videoEl.textTracks.length; i++) {
          const t = this.videoEl.textTracks[i];
          if (t.default || !defaultFound) {
            t.mode = 'hidden'; // hidden so we can read cues or display them in our custom styled overlay
            defaultFound = true;
          } else {
            t.mode = 'disabled';
          }
        }
      }
    } else if (selected && selected.trackObj) {
      this.isEnabled = true;
      // Embedded text track selected
      if (this.videoEl && this.videoEl.textTracks) {
        for (let i = 0; i < this.videoEl.textTracks.length; i++) {
          const t = this.videoEl.textTracks[i];
          t.mode = (i === selected.index) ? 'hidden' : 'disabled';
        }
      }
    } else if (trackId === 'external') {
      this.isEnabled = true;
      if (this.videoEl && this.videoEl.textTracks) {
        for (let i = 0; i < this.videoEl.textTracks.length; i++) {
          this.videoEl.textTracks[i].mode = 'disabled';
        }
      }
    }

    this.syncSubtitleUI();

    // Sync quick subtitles button state in player controls
    const quickBtn = document.getElementById('btn-subtitles-quick');
    if (quickBtn) {
      quickBtn.classList.toggle('active', this.isEnabled && trackId !== 'off');
    }

    return selected;
  }

  syncSubtitleUI() {
    const selectEl = document.getElementById('setting-subtitle-track-select');
    const badgeEl = document.getElementById('subtitle-track-status-badge');

    if (selectEl) {
      selectEl.innerHTML = '';
      this.availableTracks.forEach(track => {
        const opt = document.createElement('option');
        opt.value = track.id;
        opt.textContent = track.label;
        if (track.id === this.activeTrackId) {
          opt.selected = true;
        }
        selectEl.appendChild(opt);
      });
    }

    if (badgeEl) {
      const active = this.availableTracks.find(t => t.id === this.activeTrackId) || this.availableTracks[0];
      badgeEl.textContent = `Active Subtitle: ${active?.label || 'Default Caption'}`;
    }
  }

  getLanguageDisplayName(code) {
    if (!code || code === 'und') return null;
    const map = {
      en: 'English', eng: 'English',
      ta: 'Tamil', tam: 'Tamil',
      hi: 'Hindi', hin: 'Hindi',
      ja: 'Japanese', jpn: 'Japanese',
      es: 'Spanish', spa: 'Spanish',
      fr: 'French', fra: 'French',
      de: 'German', deu: 'German',
      ko: 'Korean', kor: 'Korean',
      zh: 'Chinese', zho: 'Chinese'
    };
    return map[code.toLowerCase()] || code.toUpperCase();
  }

  /**
   * Load subtitles from File object
   */
  async loadFromFile(file) {
    if (!file) return;
    try {
      this.externalFileName = file.name;
      const text = await file.text();
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'vtt' || text.startsWith('WEBVTT')) {
        this.parseVTT(text);
      } else {
        this.parseSRT(text);
      }
      this.isEnabled = true;
      this.updateAvailableTracks();
      this.selectSubtitleTrack('external');
    } catch (e) {
      console.error('SubtitleManager: Failed to parse subtitle file', e);
    }
  }

  /**
   * Parse SRT text format
   */
  parseSRT(data) {
    this.cues = [];
    const text = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const blocks = text.split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 2) continue;

      let timeIndex = 0;
      if (!lines[0].includes('-->') && lines.length >= 3) {
        timeIndex = 1;
      }

      const timeLine = lines[timeIndex];
      if (!timeLine || !timeLine.includes('-->')) continue;

      const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
      const startTime = this.timeToSeconds(startStr);
      const endTime = this.timeToSeconds(endStr);

      const cueLines = lines.slice(timeIndex + 1);
      const content = this.cleanSubtitleText(cueLines.join('<br>'));

      if (!isNaN(startTime) && !isNaN(endTime) && content) {
        this.cues.push({ start: startTime, end: endTime, text: content });
      }
    }

    this.cues.sort((a, b) => a.start - b.start);
  }

  /**
   * Parse WebVTT format
   */
  parseVTT(data) {
    this.cues = [];
    const text = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const blocks = text.split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split('\n');
      let timeLineIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-->')) {
          timeLineIdx = i;
          break;
        }
      }

      if (timeLineIdx === -1) continue;

      const timeLine = lines[timeLineIdx];
      const match = timeLine.match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
      if (!match) continue;

      const startTime = this.timeToSeconds(match[1]);
      const endTime = this.timeToSeconds(match[2]);

      const cueLines = lines.slice(timeLineIdx + 1);
      const content = this.cleanSubtitleText(cueLines.join('<br>'));

      if (!isNaN(startTime) && !isNaN(endTime) && content) {
        this.cues.push({ start: startTime, end: endTime, text: content });
      }
    }

    this.cues.sort((a, b) => a.start - b.start);
  }

  timeToSeconds(timeStr) {
    if (!timeStr) return NaN;
    const cleanStr = timeStr.replace(',', '.').trim();
    const parts = cleanStr.split(':');
    if (parts.length === 3) {
      const hours = parseFloat(parts[0]);
      const minutes = parseFloat(parts[1]);
      const seconds = parseFloat(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      const minutes = parseFloat(parts[0]);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    }
    return parseFloat(cleanStr);
  }

  cleanSubtitleText(rawHtml) {
    return rawHtml
      .replace(/<(?!\/?(b|i|u|br)\b)[^>]+>/gi, '')
      .replace(/^\s+|\s+$/g, '');
  }

  /**
   * Update active cue based on current video playback position
   */
  update(currentTime) {
    if (!this.isEnabled || this.activeTrackId === 'off' || !this.cueEl) {
      if (this.cueEl && !this.cueEl.classList.contains('hidden')) {
        this.cueEl.classList.add('hidden');
      }
      return;
    }

    const adjustedTime = currentTime + (this.delayMs / 1000);
    let matchedText = '';

    // Check if an embedded text track is active (track-X or default when embedded tracks exist)
    const activeEmbeddedTrack = this.availableTracks.find(t => t.id === this.activeTrackId && t.trackObj);
    const fallbackEmbeddedTrack = (this.activeTrackId === 'default' && this.cues.length === 0 && this.availableTracks.find(t => t.trackObj));
    const targetTextTrack = activeEmbeddedTrack ? activeEmbeddedTrack.trackObj : (fallbackEmbeddedTrack ? fallbackEmbeddedTrack.trackObj : null);

    if (targetTextTrack && targetTextTrack.activeCues && targetTextTrack.activeCues.length > 0) {
      const cueList = Array.from(targetTextTrack.activeCues);
      matchedText = cueList.map(c => this.cleanSubtitleText(c.text || '')).join('<br>');
    } else if (this.cues.length > 0) {
      // External or loaded cues
      for (let i = 0; i < this.cues.length; i++) {
        const cue = this.cues[i];
        if (adjustedTime >= cue.start && adjustedTime <= cue.end) {
          matchedText = cue.text;
          break;
        }
      }
    }

    if (matchedText) {
      if (this.currentText !== matchedText) {
        this.currentText = matchedText;
        this.cueEl.innerHTML = matchedText;
        this.cueEl.classList.remove('hidden');
      }
    } else {
      if (this.currentText !== '') {
        this.currentText = '';
        this.cueEl.innerHTML = '';
        this.cueEl.classList.add('hidden');
      }
    }
  }

  toggleEnabled() {
    if (this.activeTrackId === 'off') {
      this.selectSubtitleTrack('default');
      return true;
    } else {
      this.selectSubtitleTrack('off');
      return false;
    }
  }

  setDelay(ms) {
    this.delayMs = Math.max(-5000, Math.min(5000, ms));
    if (window.MediaXStorage) {
      window.MediaXStorage.setSetting('subtitleDelay', this.delayMs);
    }
    return this.delayMs;
  }

  setFontSize(px) {
    this.fontSize = px;
    this.applyStyles();
    if (window.MediaXStorage) window.MediaXStorage.setSetting('subtitleSize', px);
  }

  setColor(color) {
    this.color = color;
    this.applyStyles();
    if (window.MediaXStorage) window.MediaXStorage.setSetting('subtitleColor', color);
  }

  setBgOpacity(opacity) {
    this.bgOpacity = opacity;
    this.applyStyles();
    if (window.MediaXStorage) window.MediaXStorage.setSetting('subtitleBgOpacity', opacity);
  }

  setFontWeight(weight) {
    this.fontWeight = weight;
    this.applyStyles();
    if (window.MediaXStorage) window.MediaXStorage.setSetting('subtitleFontWeight', weight);
  }

  setPosition(pos) {
    this.position = pos;
    this.applyStyles();
    if (window.MediaXStorage) window.MediaXStorage.setSetting('subtitlePosition', pos);
  }

  applyStyles() {
    if (!this.cueEl || !this.containerEl) return;
    this.cueEl.style.fontSize = `${this.fontSize}px`;
    this.cueEl.style.color = this.color;
    this.cueEl.style.backgroundColor = `rgba(0, 0, 0, ${this.bgOpacity})`;
    this.cueEl.style.fontWeight = this.fontWeight;

    if (this.position === 'top') {
      this.containerEl.style.bottom = 'auto';
      this.containerEl.style.top = '80px';
      this.containerEl.style.transform = '';
    } else if (this.position === 'middle') {
      this.containerEl.style.bottom = 'auto';
      this.containerEl.style.top = '50%';
      this.containerEl.style.transform = 'translateY(-50%)';
    } else {
      this.containerEl.style.top = 'auto';
      this.containerEl.style.bottom = '';
      this.containerEl.style.transform = '';
    }
  }

  clear() {
    this.cues = [];
    this.currentText = '';
    this.externalFileName = '';
    if (this.cueEl) {
      this.cueEl.innerHTML = '';
      this.cueEl.classList.add('hidden');
    }
    this.updateAvailableTracks();
  }
}

window.MediaXSubtitles = new SubtitleManager();
