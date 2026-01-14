import React, { useState, useEffect, useRef } from 'react';
import './AudioLevelIndicator.css';
import { AudioLevel, stopAllOscillators, encodeText } from '../utils/audioCodec';
import { arduinoService } from '../utils/arduinoService';

interface AudioLevelIndicatorProps {
  audioLevel: AudioLevel | null;
  onAlertTriggered?: (isTriggered: boolean) => void;
  isTransmitting?: boolean;
  onTransmissionStop?: () => void;
  onPlayEndMarker?: () => void;
  alertPin?: number;
  audioContext?: AudioContext;
}

const AudioLevelIndicator: React.FC<AudioLevelIndicatorProps> = ({ 
  audioLevel,
  onAlertTriggered,
  isTransmitting = false,
  onTransmissionStop,
  onPlayEndMarker,
  audioContext,
  alertPin = 13
}) => {
  const [showAlert, setShowAlert] = useState(false);
  const [showAlertStyling, setShowAlertStyling] = useState(false);
  const canTriggerAlertRef = useRef(true);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const alertStylingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const alertToneTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if we've crossed the -10dB threshold
  useEffect(() => {
    if (!audioLevel) return;

    const isAboveThreshold = audioLevel.db >= -10;

    if (isAboveThreshold && canTriggerAlertRef.current) {
      // Trigger alert
      canTriggerAlertRef.current = false;
      setShowAlert(true);
      setShowAlertStyling(true);

      // Notify parent component
      if (onAlertTriggered) {
        onAlertTriggered(true);
      }

      // If transmitting, STOP transmission immediately
      if (isTransmitting && onTransmissionStop) {
        console.log('🛑 High audio level detected during transmission - STOPPING IMMEDIATELY');
        stopAllOscillators(); // Stop all currently playing oscillators
        onTransmissionStop();
      }

      // Flash Arduino LED and trigger servo alert if connected
      if (arduinoService.isConnected()) {
        console.log('Alert triggered - flashing Arduino LED on pin', alertPin);
        flashArduinoLED(alertPin);
        // Trigger rapid servo oscillation
        arduinoService.servoAlert();
        console.log('Alert triggered - servo rapid oscillation activated');
      }

      // Clear any existing timeouts
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      if (alertStylingTimeoutRef.current) {
        clearTimeout(alertStylingTimeoutRef.current);
      }
      if (alertToneTimeoutRef.current) {
        clearTimeout(alertToneTimeoutRef.current);
      }

      // Send alert signal - just play 5000 Hz tone (no encoding)
      if (audioContext) {
        console.log('🔊 Sending alert signal to other robot (5000 Hz tone)');
        play5000HzTone(3000);
      }

      // Hide banner after 2.5 seconds
      alertTimeoutRef.current = setTimeout(() => {
        setShowAlert(false);
      }, 2500);

      // After 3 seconds: Play end marker sound (only if not transmitting)
      alertStylingTimeoutRef.current = setTimeout(() => {
        setShowAlertStyling(false);
        canTriggerAlertRef.current = true; // Allow alert to trigger again
        if (onAlertTriggered) {
          onAlertTriggered(false);
        }
        // Play end marker only if we were NOT transmitting when alert triggered
        // (if we were transmitting, the transmission was interrupted and shouldn't play end marker)
        if (onPlayEndMarker && !isTransmitting) {
          console.log('🎵 Playing END MARKER after 3 seconds');
          onPlayEndMarker();
        } else if (isTransmitting) {
          console.log('🔇 Skipping END MARKER - transmission was interrupted by alert');
        }
      }, 3000);
    } else if (!isAboveThreshold && !canTriggerAlertRef.current) {
      // Immediately reset if we drop below threshold while alert is active
      setShowAlert(false);
      setShowAlertStyling(false);
      canTriggerAlertRef.current = true;
      
      if (onAlertTriggered) {
        onAlertTriggered(false);
      }
      
      // Clear any existing timeouts
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      if (alertStylingTimeoutRef.current) {
        clearTimeout(alertStylingTimeoutRef.current);
      }
    }

    return () => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      if (alertStylingTimeoutRef.current) {
        clearTimeout(alertStylingTimeoutRef.current);
      }
      if (alertToneTimeoutRef.current) {
        clearTimeout(alertToneTimeoutRef.current);
      }
    };
  }, [audioLevel, onAlertTriggered, isTransmitting, onTransmissionStop, onPlayEndMarker, alertPin]);

  const flashArduinoLED = async (pin: number) => {
    try {
      // Flash 3 times
      for (let i = 0; i < 3; i++) {
        await arduinoService.ledFlash(pin, 150);
        // Wait between flashes
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } catch (error) {
      console.error('Error flashing Arduino LED:', error);
    }
  };

  const play5000HzTone = (duration: number) => {
    try {
      if (!audioContext) {
        console.error('AudioContext not available');
        return;
      }
      const now = audioContext.currentTime;

      // Create 5000 Hz sine wave tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.frequency.value = 5000;
      oscillator.type = 'sine';

      // Set volume (start loud, fade out at end)
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration / 1000);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + duration / 1000);

      console.log('🔊 Playing 5000 Hz tone for', duration, 'ms');
    } catch (error) {
      console.log('Could not play 5000 Hz tone:', error);
    }
  };

  const playAlertSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      // Create alert tone - two beeps
      const oscillator1 = audioContext.createOscillator();
      const gainNode1 = audioContext.createGain();

      oscillator1.frequency.value = 800;
      oscillator1.type = 'sine';

      gainNode1.gain.setValueAtTime(0.3, now);
      gainNode1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      oscillator1.connect(gainNode1);
      gainNode1.connect(audioContext.destination);

      oscillator1.start(now);
      oscillator1.stop(now + 0.1);

      // Second beep
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();

      oscillator2.frequency.value = 1000;
      oscillator2.type = 'sine';

      gainNode2.gain.setValueAtTime(0.3, now + 0.15);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);

      oscillator2.start(now + 0.15);
      oscillator2.stop(now + 0.25);
    } catch (error) {
      console.log('Could not play alert sound:', error);
    }
  };

  if (!audioLevel) {
    return (
      <div className="audio-level-indicator">
        <div className="db-display">-- dB</div>
        <div className="level-bar-container">
          <div className="level-bar" style={{ width: '0%' }}></div>
        </div>
        <div className="level-text">Waiting for audio...</div>
      </div>
    );
  }

  return (
    <div className="audio-level-indicator">
      {showAlert && (
        <div className="audio-alert active">
          ⚠️ HIGH AUDIO LEVEL DETECTED (-10dB threshold)
        </div>
      )}
      <div className={`db-display ${audioLevel.isSpeaking ? 'speaking' : ''} ${showAlertStyling ? 'alert-threshold' : ''}`}>
        {audioLevel.db.toFixed(1)} dB
      </div>
      <div className="level-bar-container">
        <div 
          className={`level-bar ${audioLevel.isSpeaking ? 'speaking' : ''} ${showAlertStyling ? 'alert' : ''}`}
          style={{ width: `${audioLevel.percentage}%` }}
        ></div>
      </div>
      <div className="level-text">
        {audioLevel.isSpeaking ? '🔊 Speaking' : '🔇 Silent'}
      </div>
    </div>
  );
};

export default AudioLevelIndicator;
