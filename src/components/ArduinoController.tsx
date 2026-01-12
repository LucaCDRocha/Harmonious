import React, { useState, useEffect } from 'react';
import { arduinoService } from '../utils/arduinoService';
import './ArduinoController.css';

interface ArduinoControllerProps {
  triggerAlertLED?: boolean;
  alertPin?: number;
}

const ArduinoController: React.FC<ArduinoControllerProps> = ({ 
  triggerAlertLED = false,
  alertPin = 13 // Default to pin 13 (built-in LED on most Arduinos)
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastCommand, setLastCommand] = useState('None');
  const [alertFlashCount, setAlertFlashCount] = useState(0);

  // Handle when alert is triggered - flash the LED
  useEffect(() => {
    if (triggerAlertLED && isConnected) {
      console.log('Alert triggered - flashing Arduino LED');
      
      // Flash the LED 3 times (500ms each flash)
      flashLEDSequence(alertPin);
      setAlertFlashCount(prev => prev + 1);
      setLastCommand(`LED flashed (Alert #${alertFlashCount + 1})`);
    }
  }, [triggerAlertLED, isConnected, alertPin]);

  /**
   * Flash LED in a sequence (3 quick flashes)
   */
  const flashLEDSequence = async (pin: number) => {
    try {
      // Flash 1
      await arduinoService.ledFlash(pin, 200);
      await sleep(300);

      // Flash 2
      await arduinoService.ledFlash(pin, 200);
      await sleep(300);

      // Flash 3
      await arduinoService.ledFlash(pin, 200);
    } catch (error) {
      console.error('Error flashing LED sequence:', error);
    }
  };

  /**
   * Sleep utility
   */
  const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  /**
   * Connect to Arduino
   */
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const connected = await arduinoService.connect();
      setIsConnected(connected);
      setLastCommand(connected ? 'Connected successfully' : 'Connection failed');
    } catch (error) {
      console.error('Connection error:', error);
      setLastCommand('Connection error');
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Disconnect from Arduino
   */
  const handleDisconnect = async () => {
    try {
      await arduinoService.disconnect();
      setIsConnected(false);
      setLastCommand('Disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  /**
   * Test LED
   */
  const handleTestLED = async () => {
    if (!isConnected) {
      setLastCommand('Not connected');
      return;
    }

    try {
      setLastCommand('Testing LED...');
      await arduinoService.ledFlash(alertPin, 500);
      setLastCommand('LED test complete');
    } catch (error) {
      console.error('Test error:', error);
      setLastCommand('Test failed');
    }
  };

  return (
    <div className="arduino-controller">
      <div className="controller-header">
        <h3>🤖 Arduino LED Control</h3>
        <div className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '● Disconnected'}
        </div>
      </div>

      <div className="controller-body">
        <div className="connection-section">
          {!isConnected ? (
            <button 
              className="btn-connect" 
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect Arduino'}
            </button>
          ) : (
            <>
              <button 
                className="btn-disconnect" 
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
              <button 
                className="btn-test" 
                onClick={handleTestLED}
              >
                Test LED
              </button>
            </>
          )}
        </div>

        <div className="info-section">
          <div className="info-row">
            <span className="info-label">Status:</span>
            <span className="info-value">
              {isConnected ? '🟢 Ready' : '🔴 Offline'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Alert Pin:</span>
            <span className="info-value">Pin {alertPin}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Last Command:</span>
            <span className="info-value">{lastCommand}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Alert Flashes:</span>
            <span className="info-value">{alertFlashCount}</span>
          </div>
        </div>

        <div className="help-section">
          <p>
            <strong>Setup Instructions:</strong>
          </p>
          <ol>
            <li>Connect Arduino to your computer via USB</li>
            <li>Upload the provided Arduino sketch to your board</li>
            <li>Click "Connect Arduino" and select the correct port</li>
            <li>When audio level reaches -10dB, the LED will flash automatically</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ArduinoController;
