# Sea to Land - Audio Data Transmission

A minimal audio-based text communication system that encodes text into sound frequencies and decodes them back.

**Based on the [Chirp](https://github.com/solst-ice/chirp) project by [solst/ICE](https://github.com/solst-ice)**

This project extends the original Chirp audio transmission system with:

- Auto-idle mode for continuous robot animation
- Alert system with automatic restart
- Integration with Arduino servo control

## Quick Start

```bash
npm install
npm run dev
```

## Features

- **Text-to-Audio Encoding**: Converts text to audio frequencies
- **Audio-to-Text Decoding**: Decodes audio back to text
- **Real-time Visualization**: See frequency spectrum as you transmit/receive
- **No Network Required**: Direct audio communication between devices

## How It Works

1. Each character is mapped to a specific frequency (900-8200 Hz)
2. Messages are "played" as sequences of tones
3. Microphone captures and decodes the tones back to text
4. Works across any speakers → microphone setup

## Technology

- React + TypeScript
- Web Audio API
- Vite build tool
