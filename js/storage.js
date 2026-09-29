/**
 * MediaX Player - Local Storage Manager
 * Handles local persistence of settings, playback resume points, and recent media.
 * Everything remains 100% on the user's device.
 */

const STORAGE_KEYS = {
  SETTINGS: 'mediax_settings',
  RECENTS: 'mediax_recent_media',
  RESUME_POINTS: 'mediax_resume_points',
  CUSTOM_EQ: 'mediax_custom_eq_preset'
};

const DEFAULT_SETTINGS = {
  theme: 'dark', // 'dark', 'black', 'ocean', 'light'
  skipDuration: 10,
  skipDurationLarge: 30,
  autoResume: true,
  autoHideDelay: 2500,
  defaultVolume: 1.0,
  maxVolumeBoost: 3.0,
  audioDelay: 0,
  audioNormalization: false,
  audioStereoBalance: 0,
  audioMono: false,
  bassBoost: 0,
  trebleBoost: 0,
  eqPreset: 'Flat',
  displayMode: 'fit',
  subtitleSize: 24,
  subtitleColor: '#ffffff',
  subtitleBgOpacity: 0.75,
  subtitleFontWeight: '600',
  subtitlePosition: 'bottom',
  subtitleDelay: 0,
  screenshotFormat: 'image/png',
  screenshotIncludeFilters: false,
  loopMode: 'off' // 'off', 'one', 'all'
};

class StorageManager {
  constructor() {
    this.settings = this.loadSettings();
    this.recents = this.loadRecents();
    this.resumePoints = this.loadResumePoints();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.warn('StorageManager: Failed to load settings from localStorage', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('StorageManager: Failed to save settings to localStorage', e);
    }
  }

  getSetting(key) {
    return this.settings[key] !== undefined ? this.settings[key] : DEFAULT_SETTINGS[key];
  }

  setSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings(this.settings);
  }

  // --- Resume Playback Points ---
  loadResumePoints() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RESUME_POINTS);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  saveResumePoint(fileName, fileSize, time, duration) {
    if (!fileName || !time || time < 5 || (duration && time > duration - 5)) return;
    try {
      const key = `${fileName}_${fileSize || 0}`;
      this.resumePoints[key] = {
        name: fileName,
        size: fileSize,
        time: Math.floor(time),
        duration: Math.floor(duration || 0),
        updatedAt: Date.now()
      };
      // Keep only latest 50 entries
      const entries = Object.entries(this.resumePoints);
      if (entries.length > 50) {
        entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
        this.resumePoints = Object.fromEntries(entries.slice(0, 50));
      }
      localStorage.setItem(STORAGE_KEYS.RESUME_POINTS, JSON.stringify(this.resumePoints));
    } catch (e) {
      console.warn('StorageManager: Error saving resume point', e);
    }
  }

  getResumePoint(fileName, fileSize) {
    const key = `${fileName}_${fileSize || 0}`;
    return this.resumePoints[key] || null;
  }

  clearResumePoint(fileName, fileSize) {
    const key = `${fileName}_${fileSize || 0}`;
    delete this.resumePoints[key];
    try {
      localStorage.setItem(STORAGE_KEYS.RESUME_POINTS, JSON.stringify(this.resumePoints));
    } catch (e) {}
  }

  // --- Recent Media List ---
  loadRecents() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECENTS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  addRecent(fileMeta) {
    try {
      this.recents = this.recents.filter(item => item.name !== fileMeta.name || item.size !== fileMeta.size);
      this.recents.unshift({
        name: fileMeta.name,
        size: fileMeta.size,
        type: fileMeta.type || 'media',
        lastPosition: fileMeta.lastPosition || 0,
        duration: fileMeta.duration || 0,
        timestamp: Date.now()
      });
      if (this.recents.length > 20) {
        this.recents = this.recents.slice(0, 20);
      }
      localStorage.setItem(STORAGE_KEYS.RECENTS, JSON.stringify(this.recents));
    } catch (e) {
      console.warn('StorageManager: Error adding recent media', e);
    }
  }

  clearRecents() {
    this.recents = [];
    try {
      localStorage.removeItem(STORAGE_KEYS.RECENTS);
    } catch (e) {}
  }

  // --- Custom Equalizer Preset ---
  saveCustomEQ(bands) {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_EQ, JSON.stringify(bands));
    } catch (e) {}
  }

  loadCustomEQ() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_EQ);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  // Clear all local data (Privacy reset)
  clearAllData() {
    try {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.RECENTS);
      localStorage.removeItem(STORAGE_KEYS.RESUME_POINTS);
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_EQ);
      this.settings = { ...DEFAULT_SETTINGS };
      this.recents = [];
      this.resumePoints = {};
    } catch (e) {}
  }
}

window.MediaXStorage = new StorageManager();
