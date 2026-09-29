# MediaX Player 🎬
> Universal Client-Side Media Player for the Web. Play anything. Your way.

**MediaX Player** is a production-quality, standalone universal media player web application built entirely on modern web standards. It brings the power, versatility, and responsiveness of desktop media players (VLC, MPC-HC, PotPlayer) directly into any modern browser with **zero backend dependencies** and **100% local processing**.

---

## 🔒 Privacy & Local Processing Guarantee

> **Your media stays on your device.** Files are processed locally in your browser. No files are ever uploaded to any external server or cloud service.

* **Client-side only**: HTML5, CSS3, Vanilla JavaScript, Web Audio API, Canvas API, Fullscreen API, PiP API.
* **No Server, No Database, No Authentication**: All preferences, bookmarks, and playlists remain strictly inside your browser's local memory and `localStorage`.

---

## ✨ Key Features

### 1. Playback & Timeline
* **Custom Seek Bar**: Smooth dragging, multi-range buffered status, played indicator, and precise hover time tooltip.
* **Keyboard Navigation**: Seek 10s (`←` / `→`), Seek 30s (`Shift + ←` / `Shift + →`), Frame-by-frame stepping (`,` / `.`).
* **Playback Speed**: Standard presets (`0.25x` to `3.0x`) and custom speed stepping up to `4.0x`.
* **A-B Section Looping**: Mark point A, mark point B, visual seekbar markers, and continuous seamless section looping.
* **Automatic Resume**: Automatically remembers last playback position per file with a smooth prompt on reopen.

### 2. Professional Audio Suite (Web Audio API)
* **10-Band Graphic Equalizer**:
  * ISO Frequencies: `31Hz`, `62Hz`, `62Hz`, `125Hz`, `250Hz`, `500Hz`, `1kHz`, `2kHz`, `4kHz`, `8kHz`, `16kHz`.
  * Presets: Flat, Bass Boost, Treble Boost, Vocal, Movie, Music, Rock, Classical, Pop, and Custom.
* **Audio Synchronization (Delay / Advance)**:
  * Range: `-5000 ms` to `+5000 ms` with fine 50ms stepping and instant presets (`-500ms`, `-250ms`, `0ms`, `+250ms`, `+500ms`).
* **Volume Amplification & Boost**: Up to `300%` amplification with GainNode and smart clipping warning indicators.
* **Audio Normalization**: Real-time `DynamicsCompressorNode` to balance whisper-quiet dialogues and loud explosions.
* **Stereo Panning & Balance**: Left/Right balance control and mono downmix switch.
* **Real-time Canvas Audio Visualizer**:
  * Animated neon frequency bars with peak decay physics.
  * Fluid oscilloscope waveform.
  * Radial spectrum with rotating vinyl disc for audio files (MP3, WAV, FLAC, M4A).

### 3. Video Transformations & Image Adjustments
* **Display Modes**: Fit to Screen, Fill Screen, Original Size, 16:9, 4:3, Stretch, Crop.
* **Transformations**:
  * Rotate: `90°`, `180°`, `270°`, `Reset`.
  * Flip: Horizontal, Vertical, Reset.
  * Zoom: `100%` to `250%` with smooth mouse drag panning when zoomed in.
* **Hardware-Accelerated CSS Filters**:
  * Real-time sliders for Brightness, Contrast, Saturation, Hue Rotation, and Sharpness/Blur.
  * Individual reset and Master reset.

### 4. High-Resolution Screenshots
* Direct canvas capture at the video's native intrinsic resolution (e.g. 1080p, 4K) without controls overlay.
* Multi-format export: **PNG**, **JPG**, **WEBP**.
* Camera shutter flash animation.
* **Copy to Clipboard** (`navigator.clipboard.write`) and Instant Download with timestamped filename (`screenshot-YYYY-MM-DD-HH-mm-ss.png`).

### 5. Subtitle Engine (.srt & .vtt)
* Fully client-side SRT and WebVTT parser.
* Real-time subtitle cue rendering.
* **Subtitle Delay Sync**: `-5000 ms` to `+5000 ms`.
* Customizable subtitle styling: Font size, Color (White, Yellow, Cyan, Green), Background box opacity, and Vertical position.

### 6. Local Playlist & Queue
* Drag & drop multi-file queueing.
* Reorder items, Remove, Clear.
* Shuffle mode & Repeat modes (`Off`, `All`, `One`).
* Auto-advances to the next media upon track completion.

### 7. Custom Context Menu & Keyboard Shortcuts
* Right-click inside video opens a media player context menu.
* Comprehensive keyboard map with safeguards when typing inside input elements.

### 8. Client-Side FFmpeg WebAssembly
* On-demand WebAssembly decoding when encountering non-native browser codecs (e.g. MKV/AVI).
* Local progress tracking and cancellation.

---

## ⌨ Keyboard Shortcuts Reference

| Key | Action |
| :--- | :--- |
| **Space** | Play / Pause |
| **←** | Rewind 10s |
| **→** | Forward 10s |
| **Shift + ←** | Rewind 30s |
| **Shift + →** | Forward 30s |
| **, (comma)** | Previous frame (when paused) |
| **. (period)**| Next frame (when paused) |
| **↑** | Volume + 5% |
| **↓** | Volume - 5% |
| **M** | Mute / Unmute |
| **F** | Fullscreen toggle |
| **P** | Picture-in-Picture |
| **S** | Capture frame screenshot |
| **E** | Open 10-band Equalizer drawer |
| **A** | Audio sync delay drawer |
| **C** | Toggle Subtitles on/off |
| **L** | Set / clear A-B Loop |
| **R** | Reset video adjustments & transformations |
| **I** | Inspect Media Information |
| **Esc** | Close drawers / exit modals / exit fullscreen |

---

## 🚀 Running Locally

Because this is a completely static, client-side web application, you can run it using any local web server:

```bash
# Using Python 3:
python -m http.server 5500

# Or using Node.js npx serve:
npx -y serve .
```

Then open your browser at `http://localhost:5500`.
