import React, { useState, useEffect, useRef } from 'react';
import './AudioLevelIndicator.css';
import { AudioLevel } from '../utils/audioCodec';

interface AudioLevelIndicatorProps {
  audioLevel: AudioLevel | null;
}

const AudioLevelIndicator: React.FC<AudioLevelIndicatorProps> = ({ audioLevel }) => {
  const [showAlert, setShowAlert] = useState(false);
  const [showAlertStyling, setShowAlertStyling] = useState(false);
  const canTriggerAlertRef = useRef(true);
  const alertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const alertStylingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if we've crossed the -10dB threshold
  useEffect(() => {
    if (!audioLevel) return;

    const isAboveThreshold = audioLevel.db >= -10;

    if (isAboveThreshold && canTriggerAlertRef.current) {
      // Trigger alert
      canTriggerAlertRef.current = false;
      setShowAlert(true);
      setShowAlertStyling(true);

      // Clear any existing timeouts
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      if (alertStylingTimeoutRef.current) {
        clearTimeout(alertStylingTimeoutRef.current);
      }

      // Hide banner after 2.5 seconds
      alertTimeoutRef.current = setTimeout(() => {
        setShowAlert(false);
      }, 2500);

      // Hide styling and reset alert capability after 3 seconds total
      alertStylingTimeoutRef.current = setTimeout(() => {
        setShowAlertStyling(false);
        canTriggerAlertRef.current = true; // Allow alert to trigger again
      }, 3000);

      // Play alert sound
      playAlertSound();
    } else if (!isAboveThreshold && !canTriggerAlertRef.current) {
      // Immediately reset if we drop below threshold while alert is active
      setShowAlert(false);
      setShowAlertStyling(false);
      canTriggerAlertRef.current = true;
      
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
    };
  }, [audioLevel]);

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
