// Audio codec module for encoding/decoding text to audio frequencies
console.log('Audio codec module loading...');

// Constants for audio encoding
export const START_FREQUENCY = 2500; // Hz
export const END_FREQUENCY = 2700; // Hz
export const MINIMUM_VALID_FREQUENCY = 400;
export const MAXIMUM_VALID_FREQUENCY = 8300;

// Timing constants
const START_MARKER_DURATION = 0.12; // seconds
const END_MARKER_DURATION = 0.12; // seconds
const CHARACTER_DURATION = 0.07; // seconds
const CHARACTER_GAP = 0.03; // seconds
const VOLUME = 1.0;

// Parallel tone transmission
const USE_PARALLEL_TONES = true;
const PARALLEL_TONE_OFFSET = 35; // Hz
const PARALLEL_TONE_VOLUME = 0.75;

// Detection thresholds
const FREQUENCY_TOLERANCE = 45;
const SIGNAL_THRESHOLD = 135;
const DEBOUNCE_TIME = 75;
const CHARACTER_LOCKOUT_TIME = 120;

const DEBUG_AUDIO = true;

// Character to frequency mapping
const CHAR_FREQUENCIES: { [char: string]: number } = {
  ' ': 900,
  '!': 1300, '@': 1400, '#': 1500, '$': 1600, '%': 1700, '^': 1800, '&': 1900, '*': 2000,
  '(': 2100, ')': 2200, '-': 2300, '_': 2400, '+': 2600, '=': 2800, '{': 2900, '}': 3000,
  '[': 3100, ']': 3200, '|': 3300, '\\': 3400, ':': 3500, ';': 3600, '"': 3700, "'": 3800,
  '<': 3900, '>': 4000, ',': 4100, '.': 4200, '/': 4300, '?': 4400, '`': 4500, '~': 4600,
  '0': 4700, '1': 4800, '2': 4900, '3': 5000, '4': 5100, '5': 5200, '6': 5300, '7': 5400, '8': 5500, '9': 5600,
  'A': 5700, 'B': 5800, 'C': 5900, 'D': 6000, 'E': 6100, 'F': 6200, 'G': 6300, 'H': 6400, 'I': 6500, 'J': 6600,
  'K': 6700, 'L': 6800, 'M': 6900, 'N': 7000, 'O': 7100, 'P': 7200, 'Q': 7300, 'R': 7400, 'S': 7500, 'T': 7600,
  'U': 7700, 'V': 7800, 'W': 7900, 'X': 8000, 'Y': 8100, 'Z': 8200,
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
  
  const fadeTime = Math.min(0.004, duration / 18);
  
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + fadeTime);
  gainNode.gain.setValueAtTime(volume, startTime + duration - fadeTime);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
  
  if (USE_PARALLEL_TONES && frequency !== START_FREQUENCY && frequency !== END_FREQUENCY) {
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    
    oscillator2.type = 'sine';
    oscillator2.frequency.value = frequency + PARALLEL_TONE_OFFSET;
    
    gainNode2.gain.setValueAtTime(0, startTime);
    gainNode2.gain.linearRampToValueAtTime(PARALLEL_TONE_VOLUME, startTime + fadeTime);
    gainNode2.gain.setValueAtTime(PARALLEL_TONE_VOLUME, startTime + duration - fadeTime);
    gainNode2.gain.linearRampToValueAtTime(0, startTime + duration);
    
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

export const encodeText = async (
  text: string,
  audioContext: AudioContext
): Promise<void> => {
  return new Promise(async (resolve) => {
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
      
      const fadeTime = Math.min(0.005, CHARACTER_DURATION / 12);
      
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(VOLUME, currentTime + fadeTime);
      gainNode.gain.setValueAtTime(VOLUME, currentTime + CHARACTER_DURATION - fadeTime);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + CHARACTER_DURATION);
      
      oscillator.start(currentTime);
      oscillator.stop(currentTime + CHARACTER_DURATION);
      
      if (USE_PARALLEL_TONES && oscillator2 && gainNode2) {
        gainNode2.gain.setValueAtTime(0, currentTime);
        gainNode2.gain.linearRampToValueAtTime(PARALLEL_TONE_VOLUME, currentTime + fadeTime);
        gainNode2.gain.setValueAtTime(PARALLEL_TONE_VOLUME, currentTime + CHARACTER_DURATION - fadeTime);
        gainNode2.gain.linearRampToValueAtTime(0, currentTime + CHARACTER_DURATION);
        
        oscillator2.start(currentTime);
        oscillator2.stop(currentTime + CHARACTER_DURATION);
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
  
  recentCharacters = recentCharacters.filter(entry => (now - entry.time) < 450);
  
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
    
    if (isReceivingMessage && (currentTime - transmissionStartTime > 15000)) {
      console.log('⚠️ TRANSMISSION TIMEOUT - Force ending after 15 seconds');
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
