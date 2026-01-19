# Sea to Land - Audio Data Transmission

A minimal audio-based text communication system that encodes text into sound frequencies and decodes them back.

**Based on the [Chirp](https://github.com/solst-ice/chirp) project by [solst/ICE](https://github.com/solst-ice)**

## Project Harmonious

**Harmonious** is a concept that explores the fragile nature of marine communication systems, inspired by whale vocalizations and the acoustic distortion caused by human activity in our oceans.

### Concept

The project demonstrates whale-like communication through frequency-based audio transmission. Just as whales use sophisticated sound patterns to communicate across vast ocean distances, this application enables communication through pure audio frequencies. However, like the real-world impact of marine ship noise on whale populations, excessive ambient sound disrupts the communication system.

When the surrounding environment becomes too noisy (simulating ship traffic and human acoustic pollution), the application triggers an alert and interrupts the ongoing communication. The conversation must then start over, mirroring how whales lose contact and must re-establish their connections when overwhelmed by anthropogenic noise.

This interactive experience raises awareness about the impact of human activities on marine ecosystems, demonstrating how noise pollution affects the delicate communication systems that marine life depends on for survival.

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
