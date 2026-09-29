/**
 * MediaX Player - Equalizer Controller
 * Manages 10-band Equalizer UI sliders, presets, and user customizations.
 */

const EQ_PRESETS = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
  'Vocal': [-2, -1, 1, 3, 4, 4, 3, 1, 0, -1],
  'Movie': [4, 3, 1, -1, 0, 1, 2, 4, 5, 3],
  'Music': [3, 2, 0, 1, 2, 1, 1, 2, 3, 2],
  'Rock': [5, 4, 2, 0, -1, 1, 3, 4, 4, 5],
  'Classical': [4, 3, 2, 1, -1, -1, 0, 2, 3, 3],
  'Pop': [-1, 1, 3, 4, 4, 2, 0, 1, 2, 2]
};

const FREQ_LABELS = ['31Hz', '62Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];

class EqualizerController {
  constructor() {
    this.currentBands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.currentPreset = 'Flat';
    this.containerEl = null;
    this.presetSelectEl = null;
  }

  init(containerEl, presetSelectEl) {
    this.containerEl = containerEl;
    this.presetSelectEl = presetSelectEl;

    // Load saved custom preset if any
    const savedCustom = window.MediaXStorage.loadCustomEQ();
    if (savedCustom && Array.isArray(savedCustom)) {
      EQ_PRESETS['Custom'] = savedCustom;
    } else {
      EQ_PRESETS['Custom'] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    const savedPresetName = window.MediaXStorage.getSetting('eqPreset') || 'Flat';
    this.currentPreset = savedPresetName;

    this.renderSliders();
    this.applyPreset(this.currentPreset, false);
  }

  renderSliders() {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = '';

    FREQ_LABELS.forEach((label, idx) => {
      const col = document.createElement('div');
      col.className = 'eq-band-col';

      const valDisplay = document.createElement('div');
      valDisplay.className = 'eq-band-value';
      valDisplay.id = `eq-val-${idx}`;
      valDisplay.textContent = this.formatDb(this.currentBands[idx]);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'eq-slider-vertical';
      slider.id = `eq-slider-${idx}`;
      slider.min = '-12';
      slider.max = '12';
      slider.step = '0.5';
      slider.value = this.currentBands[idx];
      slider.setAttribute('aria-label', `Equalizer band ${label}`);

      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.currentBands[idx] = val;
        valDisplay.textContent = this.formatDb(val);
        window.MediaXAudio.setBandGain(idx, val);
        this.markCustom();
      });

      const freqLabel = document.createElement('div');
      freqLabel.className = 'eq-band-freq';
      freqLabel.textContent = label;

      col.appendChild(valDisplay);
      col.appendChild(slider);
      col.appendChild(freqLabel);
      this.containerEl.appendChild(col);
    });
  }

  formatDb(val) {
    const rounded = Math.round(val * 10) / 10;
    return (rounded > 0 ? `+${rounded}` : `${rounded}`) + 'dB';
  }

  applyPreset(presetName, notify = true) {
    if (!EQ_PRESETS[presetName]) presetName = 'Flat';
    this.currentPreset = presetName;
    const values = [...EQ_PRESETS[presetName]];
    this.currentBands = values;

    if (this.presetSelectEl) {
      this.presetSelectEl.value = presetName;
    }

    values.forEach((val, idx) => {
      const slider = document.getElementById(`eq-slider-${idx}`);
      const valDisplay = document.getElementById(`eq-val-${idx}`);
      if (slider) slider.value = val;
      if (valDisplay) valDisplay.textContent = this.formatDb(val);
    });

    window.MediaXAudio.setAllBands(values);
    window.MediaXStorage.setSetting('eqPreset', presetName);
  }

  markCustom() {
    this.currentPreset = 'Custom';
    EQ_PRESETS['Custom'] = [...this.currentBands];
    if (this.presetSelectEl) {
      this.presetSelectEl.value = 'Custom';
    }
    window.MediaXStorage.setSetting('eqPreset', 'Custom');
    window.MediaXStorage.saveCustomEQ(this.currentBands);
  }

  reset() {
    this.applyPreset('Flat', true);
  }

  saveCustomPreset() {
    EQ_PRESETS['Custom'] = [...this.currentBands];
    window.MediaXStorage.saveCustomEQ(this.currentBands);
    this.applyPreset('Custom', true);
  }
}

window.MediaXEqualizer = new EqualizerController();
