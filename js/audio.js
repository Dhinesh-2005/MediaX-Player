/**
 * MediaX Player - Web Audio API Core Engine
 * Manages AudioContext, 10-band Equalizer, Audio Delay Sync,
 * Bass/Treble boost, Stereo Panning, Audio Normalization, Volume Amplification, and Analyser.
 */

class MediaXAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.sourceNode = null;
    this.delayNode = null;
    this.eqNodes = [];
    this.bassNode = null;
    this.trebleNode = null;
    this.compressorNode = null;
    this.pannerNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.isInitialized = false;
    this.isNormalizationEnabled = false;
    this.isMonoEnabled = false;
    this.currentDelayMs = 0;
    this.currentVolume = 1.0;
    
    // 10 Standard ISO Frequencies for Equalizer
    this.eqFrequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  }

  /**
   * Initializes the Web Audio pipeline attached to the HTML5 video/audio element.
   * Must be called during or after a user gesture (click/play).
   */
  init(mediaElement) {
    if (this.isInitialized && this.mediaElement === mediaElement) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('MediaXAudioEngine: Web Audio API not supported in this browser.');
        return;
      }

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      this.mediaElement = mediaElement;

      // Create MediaElementSource if not already created for this element
      if (!this.sourceNode) {
        try {
          this.sourceNode = this.audioCtx.createMediaElementSource(mediaElement);
        } catch (err) {
          // If source node is already connected on this element
          console.warn('MediaXAudioEngine: Note on MediaElementSource', err);
        }
      }

      if (!this.sourceNode) return;

      // 1. Audio Delay Node (supports up to 5.0 seconds delay)
      this.delayNode = this.audioCtx.createDelay(5.0);
      this.delayNode.delayTime.value = 0;

      // 2. 10-Band Biquad Filter Nodes
      this.eqNodes = this.eqFrequencies.map((freq, index) => {
        const filter = this.audioCtx.createBiquadFilter();
        if (index === 0) {
          filter.type = 'lowshelf';
        } else if (index === this.eqFrequencies.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4; // standard Q factor for 10-band 1-octave
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });

      // 3. Extra Bass Boost Filter (LowShelf @ 90Hz)
      this.bassNode = this.audioCtx.createBiquadFilter();
      this.bassNode.type = 'lowshelf';
      this.bassNode.frequency.value = 90;
      this.bassNode.gain.value = 0;

      // 4. Extra Treble Boost Filter (HighShelf @ 7500Hz)
      this.trebleNode = this.audioCtx.createBiquadFilter();
      this.trebleNode.type = 'highshelf';
      this.trebleNode.frequency.value = 7500;
      this.trebleNode.gain.value = 0;

      // 5. Dynamics Compressor (Audio Normalizer)
      this.compressorNode = this.audioCtx.createDynamicsCompressor();
      this.compressorNode.threshold.value = -24;
      this.compressorNode.knee.value = 30;
      this.compressorNode.ratio.value = 12;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;

      // 6. Stereo Panner Node (Left / Right Balance)
      if (this.audioCtx.createStereoPanner) {
        this.pannerNode = this.audioCtx.createStereoPanner();
        this.pannerNode.pan.value = 0;
      }

      // 7. Master Gain Node (Volume & Amplification up to 300%)
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.currentVolume;

      // 8. Analyser Node (For real-time audio visualizer)
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 1024;
      this.analyserNode.smoothingTimeConstant = 0.82;

      // Connect the audio processing chain:
      // source -> delay -> eq[0..9] -> bass -> treble -> (compressor if enabled) -> panner -> gain -> analyser -> destination
      let lastNode = this.sourceNode;

      lastNode.connect(this.delayNode);
      lastNode = this.delayNode;

      // Connect each EQ filter in series
      for (const eqFilter of this.eqNodes) {
        lastNode.connect(eqFilter);
        lastNode = eqFilter;
      }

      lastNode.connect(this.bassNode);
      lastNode = this.bassNode;

      lastNode.connect(this.trebleNode);
      lastNode = this.trebleNode;

      if (this.pannerNode) {
        lastNode.connect(this.pannerNode);
        lastNode = this.pannerNode;
      }

      lastNode.connect(this.gainNode);
      lastNode = this.gainNode;

      lastNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);

      this.isInitialized = true;
      console.log('MediaXAudioEngine: Web Audio Pipeline successfully initialized.');
    } catch (err) {
      console.error('MediaXAudioEngine initialization error:', err);
    }
  }

  ensureContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Set Audio Delay in Milliseconds (-5000ms to +5000ms)
   * Positive value: Audio is delayed relative to video.
   * Negative value: Audio is advanced relative to video (co-ordinated with video time offset).
   */
  setAudioDelay(delayMs) {
    this.currentDelayMs = delayMs;
    const clampedMs = Math.max(-5000, Math.min(5000, delayMs));

    if (this.delayNode && this.audioCtx) {
      // DelayNode accepts values >= 0
      const positiveDelaySec = Math.max(0, clampedMs / 1000);
      this.delayNode.delayTime.setTargetAtTime(positiveDelaySec, this.audioCtx.currentTime, 0.05);
    }

    return clampedMs;
  }

  getAudioDelay() {
    return this.currentDelayMs;
  }

  /**
   * Set Equalizer band gain by index (0 to 9)
   * @param {number} bandIndex 
   * @param {number} gainDb (-12dB to +12dB)
   */
  setBandGain(bandIndex, gainDb) {
    if (bandIndex >= 0 && bandIndex < this.eqNodes.length) {
      const clampedGain = Math.max(-12, Math.min(12, gainDb));
      if (this.audioCtx) {
        this.eqNodes[bandIndex].gain.setTargetAtTime(clampedGain, this.audioCtx.currentTime, 0.03);
      } else {
        this.eqNodes[bandIndex].gain.value = clampedGain;
      }
    }
  }

  /**
   * Set all 10 EQ bands from an array of 10 values
   */
  setAllBands(gainArray) {
    if (!Array.isArray(gainArray)) return;
    gainArray.forEach((gain, idx) => {
      this.setBandGain(idx, gain);
    });
  }

  /**
   * Reset Equalizer to Flat (all 0 dB)
   */
  resetEQ() {
    this.eqNodes.forEach((node) => {
      if (this.audioCtx) {
        node.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.03);
      } else {
        node.gain.value = 0;
      }
    });
  }

  /**
   * Set Extra Bass Boost gain (0 to +12 dB)
   */
  setBassBoost(gainDb) {
    if (this.bassNode) {
      const clamped = Math.max(0, Math.min(12, gainDb));
      if (this.audioCtx) {
        this.bassNode.gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.05);
      } else {
        this.bassNode.gain.value = clamped;
      }
    }
  }

  /**
   * Set Extra Treble Boost gain (0 to +12 dB)
   */
  setTrebleBoost(gainDb) {
    if (this.trebleNode) {
      const clamped = Math.max(0, Math.min(12, gainDb));
      if (this.audioCtx) {
        this.trebleNode.gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.05);
      } else {
        this.trebleNode.gain.value = clamped;
      }
    }
  }

  /**
   * Set Stereo Balance (-1.0 Left to +1.0 Right)
   */
  setStereoBalance(pan) {
    if (this.pannerNode && this.pannerNode.pan) {
      const clampedPan = Math.max(-1, Math.min(1, pan));
      if (this.audioCtx) {
        this.pannerNode.pan.setTargetAtTime(clampedPan, this.audioCtx.currentTime, 0.03);
      } else {
        this.pannerNode.pan.value = clampedPan;
      }
    }
  }

  /**
   * Set Master Volume & Amplification
   * @param {number} volume (0.0 to 3.0, where > 1.0 is amplification/boost)
   */
  setVolume(volume) {
    this.currentVolume = Math.max(0, Math.min(3.0, volume));
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setTargetAtTime(this.currentVolume, this.audioCtx.currentTime, 0.02);
    }
    return this.currentVolume;
  }

  /**
   * Toggle Audio Normalization (Dynamics Compressor)
   */
  setNormalization(enable) {
    this.isNormalizationEnabled = !!enable;
    if (!this.isInitialized) return;

    try {
      // Re-route compressor into chain or bypass
      if (this.compressorNode && this.gainNode && this.trebleNode) {
        this.trebleNode.disconnect();
        if (this.isNormalizationEnabled) {
          this.trebleNode.connect(this.compressorNode);
          if (this.pannerNode) {
            this.compressorNode.connect(this.pannerNode);
          } else {
            this.compressorNode.connect(this.gainNode);
          }
        } else {
          if (this.pannerNode) {
            this.trebleNode.connect(this.pannerNode);
          } else {
            this.trebleNode.connect(this.gainNode);
          }
        }
      }
    } catch (e) {
      console.warn('MediaXAudioEngine: normalization toggle note', e);
    }
  }

  /**
   * Toggle Mono Downmix
   */
  setMono(enable) {
    this.isMonoEnabled = !!enable;
    if (this.audioCtx && this.sourceNode) {
      try {
        this.audioCtx.destination.channelCount = this.isMonoEnabled ? 1 : 2;
        this.audioCtx.destination.channelCountMode = 'explicit';
        this.audioCtx.destination.channelInterpretation = 'speakers';
      } catch (e) {
        console.warn('MediaXAudioEngine: Mono downmix note', e);
      }
    }
  }

  /**
   * Updates and returns available audio tracks for the current media.
   * Default is always available. Additional language tracks only appear if actually present in the media.
   */
  updateAvailableTracks(mediaItem = null) {
    this.availableTracks = [
      { id: 'default', index: 0, label: 'Default (Original Audio)', language: 'default', enabled: true }
    ];

    // 1. Check browser native AudioTrackList on mediaElement
    if (this.mediaElement && this.mediaElement.audioTracks && this.mediaElement.audioTracks.length > 0) {
      this.availableTracks = [];
      for (let i = 0; i < this.mediaElement.audioTracks.length; i++) {
        const track = this.mediaElement.audioTracks[i];
        const langName = this.getLanguageDisplayName(track.language);
        const label = track.label || (langName ? `${langName}` : (i === 0 ? 'Default (Original Audio)' : `Audio Track ${i + 1}`));
        this.availableTracks.push({
          id: track.id || `track-${i}`,
          index: i,
          label: label,
          language: track.language || 'und',
          enabled: track.enabled || (i === 0)
        });
      }
      if (!this.availableTracks.some(t => t.id === 'default' || t.index === 0)) {
        this.availableTracks.unshift({ id: 'default', index: 0, label: 'Default (Original Audio)', language: 'default', enabled: true });
      }
    } else if (mediaItem && mediaItem.audioTracks && Array.isArray(mediaItem.audioTracks) && mediaItem.audioTracks.length > 0) {
      // 2. Extra audio tracks explicitly present in the media container / metadata
      mediaItem.audioTracks.forEach((tr, idx) => {
        const langName = this.getLanguageDisplayName(tr.language);
        const label = tr.label || tr.name || (langName ? `${langName}` : `Audio Track ${idx + 1}`);
        this.availableTracks.push({
          id: tr.id || `audio-${idx}`,
          index: idx + 1,
          label: label,
          language: tr.language || 'und',
          enabled: false
        });
      });
    }

    this.selectedTrackId = this.availableTracks[0]?.id || 'default';
    this.syncAudioTrackUI();
    return this.availableTracks;
  }

  getAudioTracks() {
    if (!this.availableTracks || this.availableTracks.length === 0) {
      return this.updateAvailableTracks();
    }
    return this.availableTracks;
  }

  selectAudioTrack(trackId) {
    this.selectedTrackId = trackId;
    let selectedTrack = this.availableTracks.find(t => t.id === trackId || String(t.index) === String(trackId));
    if (!selectedTrack) {
      selectedTrack = this.availableTracks[0];
    }

    // If native audioTracks supported
    if (this.mediaElement && this.mediaElement.audioTracks) {
      for (let i = 0; i < this.mediaElement.audioTracks.length; i++) {
        const t = this.mediaElement.audioTracks[i];
        t.enabled = (t.id === trackId || i === selectedTrack?.index);
      }
    }

    // Update tracks enabled status in state
    this.availableTracks.forEach(t => {
      t.enabled = (t.id === selectedTrack.id);
    });

    this.syncAudioTrackUI();

    return selectedTrack;
  }

  syncAudioTrackUI() {
    const selectEl = document.getElementById('setting-audio-track-select');
    const badgeEl = document.getElementById('audio-track-status-badge');

    if (selectEl) {
      selectEl.innerHTML = '';
      this.availableTracks.forEach(track => {
        const opt = document.createElement('option');
        opt.value = track.id;
        opt.textContent = track.label;
        if (track.id === this.selectedTrackId || track.enabled) {
          opt.selected = true;
        }
        selectEl.appendChild(opt);
      });
    }

    if (badgeEl) {
      const active = this.availableTracks.find(t => t.id === this.selectedTrackId || t.enabled) || this.availableTracks[0];
      const count = this.availableTracks.length;
      if (count > 1) {
        badgeEl.textContent = `Audio Track: ${active?.label || 'Default'} (${count} tracks available in video)`;
      } else {
        badgeEl.textContent = `Audio Track: Default (Single Audio Stream)`;
      }
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
   * Visualizer byte frequency data
   */
  getFrequencyData(array) {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(array);
    }
  }

  /**
   * Visualizer time domain waveform data
   */
  getTimeDomainData(array) {
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(array);
    }
  }
}

window.MediaXAudio = new MediaXAudioEngine();
