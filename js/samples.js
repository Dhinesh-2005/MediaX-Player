/**
 * MediaX Player - Built-in Sample Media & Offline Audio Synthesizer
 * Provides instant demo media including video samples, an offline Web Audio synthesizer track,
 * and sample subtitle generator for effortless testing.
 */

class SampleMediaManager {
  constructor() {
    this.samples = [
      {
        id: 'sample-video-1',
        title: 'Big Buck Bunny (HD MP4)',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      },
      {
        id: 'sample-video-2',
        title: 'Tears of Steel (Sci-Fi 1080p)',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
      },
      {
        id: 'sample-video-3',
        title: 'For Bigger Blazes (Action Demo)',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
      }
    ];
  }

  /**
   * Generates a rich, harmonic synthwave audio track 100% locally in the browser
   * using Web Audio API OfflineAudioContext and exports as a WAV audio Blob.
   * Works completely offline without any internet connection!
   */
  async generateOfflineAudio() {
    const duration = 30; // 30 seconds
    const sampleRate = 44100;
    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtxClass) return null;

    const offlineCtx = new OfflineCtxClass(2, sampleRate * duration, sampleRate);

    // Chord progression frequencies (Am -> F -> C -> G)
    const chords = [
      [220.00, 261.63, 329.63, 440.00], // Am (A3, C4, E4, A4)
      [174.61, 220.00, 261.63, 349.23], // F  (F3, A3, C4, F4)
      [130.81, 164.81, 196.00, 261.63], // C  (C3, E3, G3, C4)
      [196.00, 246.94, 293.66, 392.00]  // G  (G3, B3, D4, G4)
    ];

    const chordDuration = 3.75;
    const totalLoops = Math.ceil(duration / (chordDuration * chords.length));

    // Master bus
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 0.55;
    masterGain.connect(offlineCtx.destination);

    // Ambient reverb / delay
    const delay = offlineCtx.createDelay(1.0);
    delay.delayTime.value = 0.35;
    const delayGain = offlineCtx.createGain();
    delayGain.gain.value = 0.28;
    delay.connect(delayGain);
    delayGain.connect(delay);
    delayGain.connect(masterGain);

    let currentTime = 0;
    for (let loop = 0; loop < totalLoops; loop++) {
      for (const chord of chords) {
        if (currentTime >= duration) break;

        // Bass root note
        const bassOsc = offlineCtx.createOscillator();
        const bassGain = offlineCtx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.value = chord[0] / 2; // sub octave

        const bassFilter = offlineCtx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.value = 350;

        bassGain.gain.setValueAtTime(0.001, currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.4, currentTime + 0.1);
        bassGain.gain.exponentialRampToValueAtTime(0.001, currentTime + chordDuration - 0.05);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(masterGain);

        bassOsc.start(currentTime);
        bassOsc.stop(currentTime + chordDuration);

        // Synth pad notes
        chord.forEach((freq) => {
          const osc = offlineCtx.createOscillator();
          const gain = offlineCtx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;

          gain.gain.setValueAtTime(0.001, currentTime);
          gain.gain.exponentialRampToValueAtTime(0.12, currentTime + 0.5);
          gain.gain.exponentialRampToValueAtTime(0.001, currentTime + chordDuration - 0.05);

          osc.connect(gain);
          gain.connect(masterGain);
          gain.connect(delay);

          osc.start(currentTime);
          osc.stop(currentTime + chordDuration);
        });

        // Arpeggiated high chime
        for (let a = 0; a < 8; a++) {
          const arpTime = currentTime + (a * (chordDuration / 8));
          if (arpTime >= duration) break;
          const arpFreq = chord[a % chord.length] * 2;

          const arpOsc = offlineCtx.createOscillator();
          const arpGain = offlineCtx.createGain();
          arpOsc.type = 'triangle';
          arpOsc.frequency.value = arpFreq;

          arpGain.gain.setValueAtTime(0.001, arpTime);
          arpGain.gain.exponentialRampToValueAtTime(0.08, arpTime + 0.03);
          arpGain.gain.exponentialRampToValueAtTime(0.0001, arpTime + 0.35);

          arpOsc.connect(arpGain);
          arpGain.connect(delay);
          arpGain.connect(masterGain);

          arpOsc.start(arpTime);
          arpOsc.stop(arpTime + 0.4);
        }

        currentTime += chordDuration;
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return this.audioBufferToWavBlob(renderedBuffer);
  }

  /**
   * Encodes an AudioBuffer into standard WAV Blob format
   */
  audioBufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const numSamples = buffer.length;
    const dataByteCount = numSamples * blockAlign;
    const bufferByteLength = 44 + dataByteCount;

    const arrayBuffer = new ArrayBuffer(bufferByteLength);
    const view = new DataView(arrayBuffer);

    // RIFF chunk
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataByteCount, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataByteCount, true);

    // Interleave channels
    let offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }

    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        let sample = channelData[channel][i];
        sample = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Attaches embedded WebVTT subtitle tracks (Default Caption, Tamil, Hindi, Spanish, Japanese)
   * directly to the video element for instant multi-language testing.
   */
  attachSampleTracks(videoEl) {
    if (!videoEl) return;
    const existing = videoEl.querySelectorAll('track');
    existing.forEach(t => t.remove());

    const tracksData = [
      {
        lang: 'en',
        label: 'English (Default Caption)',
        isDefault: true,
        vtt: `WEBVTT

00:00:01.000 --> 00:00:05.000
Welcome to MediaX Player!

00:00:05.500 --> 00:00:09.500
Universal high-performance media playback on your device.

00:00:10.000 --> 00:00:14.500
Audio tracks & multi-language subtitles are active!

00:00:15.000 --> 00:00:20.000
Enjoy 10-band Equalizer, Audio Sync & Video Zoom.`
      },
      {
        lang: 'ta',
        label: 'Tamil [தமிழ்]',
        isDefault: false,
        vtt: `WEBVTT

00:00:01.000 --> 00:00:05.000
மீடியாஎக்ஸ் பிளேயருக்கு வரவேற்கிறோம்!

00:00:05.500 --> 00:00:09.500
உங்கள் சாதனத்திலேயே இயங்கும் அதிவேக மீடியா பிளேயர்.

00:00:10.000 --> 00:00:14.500
ஆடியோ டிராக்குகள் மற்றும் பல மொழி வசனங்கள் தயார்!

00:00:15.000 --> 00:00:20.000
10-பேண்ட் ஈக்வலைசர் மற்றும் ஆடியோ சின்க் மகிழுங்கள்.`
      },
      {
        lang: 'hi',
        label: 'Hindi [हिन्दी]',
        isDefault: false,
        vtt: `WEBVTT

00:00:01.000 --> 00:00:05.000
मीडियाएक्स प्लेयर में आपका स्वागत है!

00:00:05.500 --> 00:00:09.500
आपके डिवाइस पर पूर्णतः स्थानीय मीडिया प्लेबैक।

00:00:10.000 --> 00:00:14.500
ऑडियो ट्रैक और उपशीर्षक भाषाएँ सक्रिय हैं!

00:00:15.000 --> 00:00:20.000
10-बैंड इक्वलाइज़र और वीडियो ज़ूम का आनंद लें।`
      },
      {
        lang: 'es',
        label: 'Spanish [Español]',
        isDefault: false,
        vtt: `WEBVTT

00:00:01.000 --> 00:00:05.000
¡Bienvenido a MediaX Player!

00:00:05.500 --> 00:00:09.500
Reproducción universal del lado del cliente en su dispositivo.

00:00:10.000 --> 00:00:14.500
¡Pistas de audio y subtítulos en varios idiomas activos!

00:00:15.000 --> 00:00:20.000
Disfrute del ecualizador de 10 bandas y sincronización.`
      },
      {
        lang: 'ja',
        label: 'Japanese [日本語]',
        isDefault: false,
        vtt: `WEBVTT

00:00:01.000 --> 00:00:05.000
MediaX Playerへようこそ！

00:00:05.500 --> 00:00:09.500
お使いのデバイス上で完全ローカルに再生されます。

00:00:10.000 --> 00:00:14.500
音声トラックと言語字幕が利用可能です！

00:00:15.000 --> 00:00:20.000
10バンドイコライザーとオーディオ同期をお楽しみください。`
      }
    ];

    tracksData.forEach(td => {
      const blob = new Blob([td.vtt], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = td.label;
      track.srclang = td.lang;
      track.src = url;
      if (td.isDefault) track.default = true;
      videoEl.appendChild(track);
    });
  }

  /**
   * Generates a sample subtitle file (.srt)
   */
  getSampleSubtitleContent() {
    return `1
00:00:01,000 --> 00:00:04,500
Welcome to <b>MediaX Player</b>!

2
00:00:05,000 --> 00:00:09,000
Universal client-side playback with <i>zero data upload</i>.

3
00:00:09,500 --> 00:00:14,000
Enjoy 10-band Equalizer, Audio Sync, and Video Zoom!

4
00:00:15,000 --> 00:00:20,000
Keyboard shortcuts: Space for Play/Pause, F for Fullscreen, S for Screenshot.
`;
  }
}

window.MediaXSamples = new SampleMediaManager();
