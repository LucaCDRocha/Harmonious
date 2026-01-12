// Audio codec module for encoding/decoding text to audio frequencies
console.log('Audio codec module loading...');

// Constants for audio encoding
export const START_FREQUENCY = 1000; // Hz
export const END_FREQUENCY = 800; // Hz
export const MINIMUM_VALID_FREQUENCY = 400;
export const MAXIMUM_VALID_FREQUENCY = 8300;

// Timing constants - Slowed down for whale-like communication
const START_MARKER_DURATION = 1.5; // seconds (long opening call)
const END_MARKER_DURATION = 1.5; // seconds (long closing call)
const CHARACTER_DURATION = 1.2; // seconds (very long sustained tones)
const CHARACTER_GAP = 0.5; // seconds (long dramatic pauses)
const VOLUME = 0.85; // Optimized for human ears

// Parallel tone transmission
const USE_PARALLEL_TONES = false;
const PARALLEL_TONE_OFFSET = 75; // Hz (even larger for deeper harmonics)
const PARALLEL_TONE_VOLUME = 0.9; // Higher to emphasize rich harmonics

// Whale-like modulation
const USE_FREQUENCY_SWEEP = false; // Frequency modulation like whale song
const SWEEP_RANGE = 40; // Hz range for frequency sweep (increased for more dramatic effect)
const VIBRATO_RATE = 4; // Hz (whale song vibrato)
const VIBRATO_AMOUNT = 50; // Hz (vibrato depth - increased for more noticeable wobble)

// Detection thresholds
const FREQUENCY_TOLERANCE = 45;
const SIGNAL_THRESHOLD = 135;
const DEBOUNCE_TIME = 350; // Increased for slower timing
const CHARACTER_LOCKOUT_TIME = 1800; // Must cover CHARACTER_DURATION (1.2s) + CHARACTER_GAP (0.5s)

const DEBUG_AUDIO = true;

// Character to frequency mapping
const CHAR_FREQUENCIES: { [char: string]: number } = {
  ' ': 900,
  'A': 500, 'B': 600, 'C': 700, 'D': 1100, 'E': 1200, 'F': 1300, 'G': 1400, 'H': 1500, 'I': 1600, 'J': 1700,
  'K': 1800, 'L': 1900, 'M': 2000, 'N': 2100, 'O': 2200, 'P': 2300, 'Q': 2400, 'R': 2500, 'S': 2600, 'T': 2700,
  'U': 2800, 'V': 2900, 'W': 3000, 'X': 3100, 'Y': 3200, 'Z': 3300, '*': 5000
};

console.log(`Initialized frequency map for ${Object.keys(CHAR_FREQUENCIES).length} characters`);

// Decoding state
let isReceivingMessage = false;
let messageBuffer: string = '';
let startMarkerDetectionCount = 0;
let endMarkerDetectionCount = 0;
let lastDetectedFrequency = 0;
let lastDetectedTime = 0;
let lastDetectedChar = '';
let transmissionStartTime = 0;
let recentCharacters: { char: string, time: number }[] = [];
let charFrequencyCounts: Map<string, number> = new Map();

// Track transmission pause state
let isTransmissionPaused = false;
let pauseStartTime = 0;
let totalPausedDuration = 0;
let activeOscillators: Array<{ oscillator: OscillatorNode | null; gainNode: GainNode; stopTime: number }> = [];
const logMessage = (msg: string) => {
  if (DEBUG_AUDIO) {
    console.log(`%c${msg}`, 'color: #4a6bff; font-weight: bold;');
  }
};

const ensureAudioContextReady = async (audioContext: AudioContext): Promise<boolean> => {
  if (audioContext.state === 'closed') {
    console.error('AudioContext is closed and cannot be used');
    return false;
  }
  
  if (audioContext.state === 'suspended') {
    try {
      console.log('Resuming suspended AudioContext');
      await audioContext.resume();
      return audioContext.state !== 'suspended';
    } catch (error) {
      console.error('Failed to resume AudioContext:', error);
      return false;
    }
  }
  
  return true;
};

const playTone = async (
  audioContext: AudioContext,
  frequency: number,
  duration: number,
  startTime: number,
  volume: number = VOLUME
): Promise<number> => {
  const isReady = await ensureAudioContextReady(audioContext);
  if (!isReady) {
    console.error('Cannot play tone - AudioContext is not ready');
    return startTime;
  }
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  
  const fadeTime = Math.min(0.1, duration / 3);
  
  // Add frequency sweep for whale-like effect
  if (USE_FREQUENCY_SWEEP && frequency !== START_FREQUENCY && frequency !== END_FREQUENCY) {
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency + SWEEP_RANGE, startTime + duration * 0.5);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, startTime + duration);
    
    // Add vibrato modulation on top of sweep
    const vibratoStartTime = startTime + (duration * 0.1);
    const vibratoEndTime = startTime + (duration * 0.9);
    const vibratoCount = Math.floor((vibratoEndTime - vibratoStartTime) * VIBRATO_RATE);
    
    for (let i = 0; i < vibratoCount; i++) {
      const vibTime = vibratoStartTime + (i / VIBRATO_RATE);
      const vibPhase = (i % 2 === 0) ? VIBRATO_AMOUNT : -VIBRATO_AMOUNT;
      
      if (vibTime + (1 / VIBRATO_RATE) <= vibratoEndTime) {
        oscillator.frequency.exponentialRampToValueAtTime(frequency + vibPhase, vibTime + (1 / (VIBRATO_RATE * 2)));
      }
    }
  }
  
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + fadeTime);
  gainNode.gain.setValueAtTime(volume, startTime + duration - fadeTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
  
  if (USE_PARALLEL_TONES && frequency !== START_FREQUENCY && frequency !== END_FREQUENCY) {
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    
    oscillator2.type = 'sine';
    oscillator2.frequency.value = frequency + PARALLEL_TONE_OFFSET;
    
    // Add frequency sweep to parallel tone too
    if (USE_FREQUENCY_SWEEP) {
      oscillator2.frequency.setValueAtTime(frequency + PARALLEL_TONE_OFFSET, startTime);
      oscillator2.frequency.exponentialRampToValueAtTime(frequency + PARALLEL_TONE_OFFSET + SWEEP_RANGE, startTime + duration * 0.9);
      oscillator2.frequency.exponentialRampToValueAtTime(frequency + PARALLEL_TONE_OFFSET, startTime + duration);
      
      // Add vibrato modulation to parallel tone too
      const vibratoStartTime = startTime + (duration * 0.1);
      const vibratoEndTime = startTime + (duration * 0.9);
      const vibratoCount = Math.floor((vibratoEndTime - vibratoStartTime) * VIBRATO_RATE);
      
      for (let i = 0; i < vibratoCount; i++) {
        const vibTime = vibratoStartTime + (i / VIBRATO_RATE);
        const vibPhase = (i % 2 === 0) ? VIBRATO_AMOUNT : -VIBRATO_AMOUNT;
        
        if (vibTime + (1 / VIBRATO_RATE) <= vibratoEndTime) {
          oscillator2.frequency.exponentialRampToValueAtTime(frequency + PARALLEL_TONE_OFFSET + vibPhase, vibTime + (1 / (VIBRATO_RATE * 2)));
        }
      }
    }
    
    gainNode2.gain.setValueAtTime(0, startTime);
    gainNode2.gain.exponentialRampToValueAtTime(PARALLEL_TONE_VOLUME, startTime + fadeTime);
    gainNode2.gain.setValueAtTime(PARALLEL_TONE_VOLUME, startTime + duration - fadeTime);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);
    
    oscillator2.start(startTime);
    oscillator2.stop(startTime + duration);
  }
  
  return startTime + duration;
};

const charToFrequency = (char: string): number => {
  const upperChar = char.toUpperCase();
  return CHAR_FREQUENCIES[upperChar] || 0;
};

const frequencyToChar = (frequency: number): string | null => {
  for (const [char, charFreq] of Object.entries(CHAR_FREQUENCIES)) {
    if (Math.abs(frequency - charFreq) < FREQUENCY_TOLERANCE) {
      return char;
    }
  }
  return null;
};

/**
 * Pause the transmission by muting and stopping active oscillators
 */
export const pauseTransmission = async (): Promise<void> => {
  if (!isTransmissionPaused) {
    console.log('⏸️ PAUSING TRANSMISSION - Stopping all active oscillators');
    isTransmissionPaused = true;
    pauseStartTime = performance.now();
    
    // Stop all active oscillators immediately by ramping gain to 0
    activeOscillators.forEach(({ gainNode }) => {
      try {
        gainNode.gain.cancelScheduledValues(0);
        gainNode.gain.setValueAtTime(0, 0);
      } catch (e) {
        // Already stopped or disposed
      }
    });
  }
};

/**
 * Resume the transmission - oscillators will resume from their scheduled times
 */
export const resumeTransmission = async (): Promise<void> => {
  if (isTransmissionPaused) {
    const pauseDuration = performance.now() - pauseStartTime;
    totalPausedDuration += pauseDuration;
    console.log(`▶️ RESUMING TRANSMISSION - Paused for ${pauseDuration.toFixed(0)}ms`);
    isTransmissionPaused = false;
    // Clear the active oscillators list as they've been muted
    activeOscillators = [];
  }
};

/**
 * Get the transmission pause state
 */
export const getTransmissionPauseState = (): boolean => {
  return isTransmissionPaused;
};

/**
 * Stop all active oscillators immediately (for alert triggers)
 */
export const stopAllOscillators = (): void => {
  try {
    const now = performance.now();
    for (const item of activeOscillators) {
      if (item.oscillator) {
        try {
          item.oscillator.stop(0); // Stop immediately
        } catch (e) {
          // Oscillator may have already stopped
        }
      }
    }
    activeOscillators = [];
    console.log(`🛑 Stopped all active oscillators at ${now.toFixed(0)}ms`);
  } catch (error) {
    console.error('Error stopping oscillators:', error);
  }
};
/**
 * Get total pause duration
 */
export const getTotalPausedDuration = (): number => {
  return totalPausedDuration;
};


export const encodeText = async (
  text: string,
  audioContext: AudioContext
): Promise<void> => {
  return new Promise(async (resolve) => {
    // Reset pause state and active oscillators for new transmission
    isTransmissionPaused = false;
    totalPausedDuration = 0;
    activeOscillators = [];
    
    const isReady = await ensureAudioContextReady(audioContext);
    if (!isReady) {
      console.error('Cannot encode text - AudioContext is not ready');
      resolve();
      return;
    }
    
    text = text.toUpperCase();
    
    logMessage(`Encoding text: "${text}"`);
    const startTime = audioContext.currentTime;
    let currentTime = startTime;
    
    currentTime += 0.03;
    
    logMessage('Playing start marker');
    currentTime = await playTone(
      audioContext,
      START_FREQUENCY,
      START_MARKER_DURATION,
      currentTime,
      VOLUME
    );
    
    currentTime += 0.03;
    
    const characters = text.split('');
    
    type AudioNodeSet = {
      char: string;
      frequency: number;
      oscillator: OscillatorNode;
      gainNode: GainNode;
      oscillator2: OscillatorNode | null;
      gainNode2: GainNode | null;
    };
    
    const nodes: AudioNodeSet[] = characters
      .map(char => {
        const frequency = charToFrequency(char);
        
        if (frequency === 0) {
          console.warn(`Skipping unsupported character: '${char}'`);
          return null;
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        let oscillator2: OscillatorNode | null = null;
        let gainNode2: GainNode | null = null;
        
        if (USE_PARALLEL_TONES) {
          oscillator2 = audioContext.createOscillator();
          gainNode2 = audioContext.createGain();
          
          oscillator2.type = 'sine';
          oscillator2.frequency.value = frequency + PARALLEL_TONE_OFFSET;
          
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);
        }
        
        return { 
          char, 
          frequency, 
          oscillator, 
          gainNode, 
          oscillator2, 
          gainNode2 
        };
      })
      .filter((node): node is AudioNodeSet => node !== null);
    
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const { char, frequency, oscillator, gainNode, oscillator2, gainNode2 } = node;
      
      // Wait if transmission is paused
      while (isTransmissionPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const fadeTime = Math.min(0.005, CHARACTER_DURATION / 12);
      
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(VOLUME, currentTime + fadeTime);
      gainNode.gain.setValueAtTime(VOLUME, currentTime + CHARACTER_DURATION - fadeTime);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + CHARACTER_DURATION);
      
      oscillator.start(currentTime);
      oscillator.stop(currentTime + CHARACTER_DURATION);
      
      // Track this oscillator as active
      activeOscillators.push({
        oscillator,
        gainNode,
        stopTime: currentTime + CHARACTER_DURATION
      });
      
      if (USE_PARALLEL_TONES && oscillator2 && gainNode2) {
        gainNode2.gain.setValueAtTime(0, currentTime);
        gainNode2.gain.linearRampToValueAtTime(PARALLEL_TONE_VOLUME, currentTime + fadeTime);
        gainNode2.gain.setValueAtTime(PARALLEL_TONE_VOLUME, currentTime + CHARACTER_DURATION - fadeTime);
        gainNode2.gain.linearRampToValueAtTime(0, currentTime + CHARACTER_DURATION);
        
        oscillator2.start(currentTime);
        oscillator2.stop(currentTime + CHARACTER_DURATION);
        
        activeOscillators.push({
          oscillator: oscillator2,
          gainNode: gainNode2,
          stopTime: currentTime + CHARACTER_DURATION
        });
      }
      
      if (i % 5 === 0 || i === nodes.length - 1) {
        console.log(`Scheduling character '${char}' at ${frequency}Hz at time ${currentTime.toFixed(3)}`);
      }
      
      currentTime += CHARACTER_DURATION + CHARACTER_GAP;
    }
    
    currentTime += 0.03;
    
    logMessage('Playing end marker');
    currentTime = await playTone(
      audioContext,
      END_FREQUENCY,
      END_MARKER_DURATION,
      currentTime,
      VOLUME
    );
    
    const totalDuration = (currentTime - startTime) * 1000;
    const charsPerSecond = text.length / ((totalDuration) / 1000);
    logMessage(`Transmission complete, duration: ${totalDuration.toFixed(0)}ms, speed: ${charsPerSecond.toFixed(1)} chars/sec`);
    
    const endBuffer = Math.max(100, totalDuration * 0.05);
    logMessage(`Waiting ${endBuffer.toFixed(0)}ms for audio to complete...`);
    
    setTimeout(() => {
      logMessage('Transmission fully complete');
      resolve();
    }, totalDuration + endBuffer);
  });
};

const shouldAddCharacter = (char: string): boolean => {
  const now = Date.now();
  
  recentCharacters = recentCharacters.filter(entry => (now - entry.time) < 2000); // Extended window for longer timing
  
  for (const entry of recentCharacters) {
    if (entry.char === char && (now - entry.time) < CHARACTER_LOCKOUT_TIME) {
      console.log(`Rejecting duplicate '${char}' - detected ${now - entry.time}ms ago`);
      return false;
    }
  }
  
  let consecutiveCount = 0;
  const recentCharsToCheck = Math.min(recentCharacters.length, 4);
  
  for (let i = recentCharacters.length - 1; i >= recentCharacters.length - recentCharsToCheck; i--) {
    if (i < 0) break;
    if (recentCharacters[i].char === char) {
      consecutiveCount++;
      if (consecutiveCount >= 3 && char !== ' ' && !isCommonRepeatingChar(char)) {
        console.log(`Rejecting unusual frequency of character '${char}'`);
        return false;
      }
    } else {
      break;
    }
  }
  
  if (char.match(/[-_+=$&@#%^*(){}[\]|\\:;"'<>,.?/]/)) {
    for (const entry of recentCharacters) {
      if (entry.char === char && (now - entry.time) < 350) {
        console.log(`Rejecting duplicate special character '${char}'`);
        return false;
      }
    }
  }
  
  recentCharacters.push({ char, time: now });
  return true;
};

const isCommonRepeatingChar = (char: string): boolean => {
  return ['E', 'L', 'O', 'T', 'M', 'S', 'P', 'A'].includes(char);
};

const postProcessMessage = (message: string): string => {
  return message;
};

export const decodeAudio = (
  frequencyData: Uint8Array,
  sampleRate: number
): string | null => {
  try {
    let maxBin = 0;
    let maxValue = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i];
        maxBin = i;
      }
    }
    
    if (maxValue < SIGNAL_THRESHOLD) return null;
    
    const binFrequency = maxBin * sampleRate / (frequencyData.length * 2);
    
    if (binFrequency < MINIMUM_VALID_FREQUENCY || binFrequency > MAXIMUM_VALID_FREQUENCY) {
      if (maxValue > SIGNAL_THRESHOLD + 50) {
        console.log(`Ignoring out-of-range frequency: ${binFrequency.toFixed(0)}Hz (${maxValue})`);
      }
      return null;
    }
    
    const currentTime = Date.now();
    
    if (Math.abs(binFrequency - lastDetectedFrequency) < 15 && 
        currentTime - lastDetectedTime < DEBOUNCE_TIME) {
      return null;
    }
    
    if (maxValue > SIGNAL_THRESHOLD) {
      lastDetectedFrequency = binFrequency;
      lastDetectedTime = currentTime;
    }
    
    if (isReceivingMessage && (currentTime - transmissionStartTime > 50000)) {
      console.log('⚠️ TRANSMISSION TIMEOUT - Force ending after 50 seconds');
      const message = messageBuffer;
      
      isReceivingMessage = false;
      messageBuffer = '';
      
      charFrequencyCounts.clear();
      
      if (message.length > 0) {
        return "[STREAM_END] " + message + " (timeout)";
      }
      
      return "[STREAM_END] (timeout)";
    }
    
    if (!isReceivingMessage && 
        Math.abs(binFrequency - START_FREQUENCY) < FREQUENCY_TOLERANCE && 
        maxValue > SIGNAL_THRESHOLD) {
      
      startMarkerDetectionCount++;
      
      console.log(`Potential start marker detected (${startMarkerDetectionCount}/2), freq: ${binFrequency.toFixed(0)}Hz, strength: ${maxValue}`);
      
      if (startMarkerDetectionCount >= 2) {
        console.log('***** DETECTED START MARKER *****');
        isReceivingMessage = true;
        messageBuffer = '';
        transmissionStartTime = currentTime;
        startMarkerDetectionCount = 0;
        recentCharacters = [];
        charFrequencyCounts.clear();
        
        return "[STREAM_START]";
      }
      return null;
    } else if (!isReceivingMessage) {
      startMarkerDetectionCount = 0;
    }
    
    if (isReceivingMessage && 
        Math.abs(binFrequency - END_FREQUENCY) < FREQUENCY_TOLERANCE && 
        maxValue > SIGNAL_THRESHOLD) {
      
      endMarkerDetectionCount++;
      
      console.log(`Potential end marker detected (${endMarkerDetectionCount}/2), freq: ${binFrequency.toFixed(0)}Hz, strength: ${maxValue}`);
      
      if (endMarkerDetectionCount >= 2) {
        console.log('***** DETECTED END MARKER *****');
        
        const message = messageBuffer;
        isReceivingMessage = false;
        messageBuffer = '';
        endMarkerDetectionCount = 0;
        recentCharacters = [];
        charFrequencyCounts.clear();
        
        const processedMessage = postProcessMessage(message);
        
        if (processedMessage.length > 0) {
          console.log(`Decoded message: "${processedMessage}"`);
          return "[STREAM_END] " + processedMessage;
        }
        
        return "[STREAM_END]";
      }
      return null;
    } else if (isReceivingMessage) {
      endMarkerDetectionCount = 0;
      
      if (binFrequency >= MINIMUM_VALID_FREQUENCY && binFrequency <= MAXIMUM_VALID_FREQUENCY) {
        const char = frequencyToChar(binFrequency);
        
        if (char !== null) {
          const upperChar = char.toUpperCase();
          
          console.log(`Detected character: '${upperChar}' from frequency ${binFrequency.toFixed(0)}Hz, strength: ${maxValue}`);
          
          if (shouldAddCharacter(upperChar)) {
            console.log(`Adding character '${upperChar}' to message buffer`);
            messageBuffer += upperChar;
            lastDetectedChar = upperChar;
            
            return "[STREAM]" + upperChar;
          } else {
            console.log(`Filtered out potential duplicate: '${upperChar}'`);
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in decodeAudio:', error);
    return null;
  }
};

export const resetDecoder = () => {
  console.log('Decoder reset');
  isReceivingMessage = false;
  messageBuffer = '';
  startMarkerDetectionCount = 0;
  endMarkerDetectionCount = 0;
  lastDetectedFrequency = 0;
  lastDetectedTime = 0;
  lastDetectedChar = '';
  transmissionStartTime = 0;
  recentCharacters = [];
  charFrequencyCounts.clear();
};

// Audio level monitoring
export interface AudioLevel {
  db: number;
  percentage: number;
  isSpeaking: boolean;
}

let analyserNode: AnalyserNode | null = null;
let audioLevelCallback: ((level: AudioLevel) => void) | null = null;
let monitoringAnimationFrameId: number | null = null;

export const initializeAudioLevelMonitoring = (
  audioContext: AudioContext,
  stream: MediaStream,
  onLevelUpdate: (level: AudioLevel) => void
): void => {
  try {
    // Create analyser node
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    
    // Create source from microphone stream
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyserNode);
    
    audioLevelCallback = onLevelUpdate;
    
    logMessage('Audio level monitoring initialized');
    
    // Start monitoring
    monitorAudioLevel();
  } catch (error) {
    console.error('Failed to initialize audio level monitoring:', error);
  }
};

const monitorAudioLevel = (): void => {
  if (!analyserNode || !audioLevelCallback) return;
  
  try {
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(dataArray);
    
    // Calculate RMS (root mean square) for more accurate level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    // Convert to dB (0-255 scale to dB)
    // Range approximately -80dB to 0dB
    const db = 20 * Math.log10(Math.max(rms, 0.0001)); // Avoid log(0)
    
    // Map dB to percentage (0-100)
    // -80dB = 0%, 0dB = 100%
    const percentage = Math.min(100, Math.max(0, ((db + 80) / 80) * 100));
    
    // Consider it "speaking" above -40dB
    const isSpeaking = db > -40;
    
    audioLevelCallback({
      db,
      percentage,
      isSpeaking
    });
    
    // Continue monitoring
    monitoringAnimationFrameId = requestAnimationFrame(monitorAudioLevel);
  } catch (error) {
    console.error('Error monitoring audio level:', error);
  }
};

export const stopAudioLevelMonitoring = (): void => {
  if (monitoringAnimationFrameId !== null) {
    cancelAnimationFrame(monitoringAnimationFrameId);
    monitoringAnimationFrameId = null;
  }
  analyserNode?.disconnect();
  analyserNode = null;
  audioLevelCallback = null;
  logMessage('Audio level monitoring stopped');
};

// Play end marker tone (800 Hz)
export const playEndMarker = async (audioContext: AudioContext): Promise<void> => {
  try {
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = END_FREQUENCY;
    
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + END_MARKER_DURATION);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + END_MARKER_DURATION);
    
    console.log(`🎵 Playing END MARKER: ${END_FREQUENCY} Hz for ${END_MARKER_DURATION}s`);
  } catch (error) {
    console.error('Error playing end marker:', error);
  }
};
