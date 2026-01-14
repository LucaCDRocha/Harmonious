/**
 * Arduino Service - Handles communication with Arduino via Web Serial API
 * Used to control LED lights when audio level alerts are triggered
 */

interface ArduinoConnection {
  port: SerialPort | null;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
  isConnected: boolean;
}

class ArduinoService {
  private connection: ArduinoConnection = {
    port: null,
    reader: null,
    writer: null,
    isConnected: false
  };

  private baudRate = 9600; // Standard Arduino baud rate
  private commandQueue: string[] = [];
  private isProcessingQueue = false;

  /**
   * Check if the Web Serial API is supported
   */
  isWebSerialSupported(): boolean {
    return 'serial' in navigator;
  }

  /**
   * Connect to Arduino via Web Serial API
   */
  async connect(): Promise<boolean> {
    try {
      if (!this.isWebSerialSupported()) {
        console.error('Web Serial API not supported in this browser');
        return false;
      }

      // Request port from user
      const port = await (navigator.serial as any).requestPort();
      if (!port) {
        console.log('No port selected');
        return false;
      }

      // Open the port
      await port.open({ baudRate: this.baudRate });

      this.connection.port = port;
      this.connection.isConnected = true;

      // Set up reader
      const reader = port.readable!.getReader();
      this.connection.reader = reader;

      // Set up writer
      const writer = port.writable!.getWriter();
      this.connection.writer = writer;

      // Start listening for incoming data
      this.listenForData();

      console.log('Arduino connected successfully');
      return true;
    } catch (error) {
      console.error('Error connecting to Arduino:', error);
      this.connection.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Arduino
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connection.reader) {
        await this.connection.reader.cancel();
        this.connection.reader = null;
      }

      if (this.connection.writer) {
        await this.connection.writer.close();
        this.connection.writer = null;
      }

      if (this.connection.port) {
        await this.connection.port.close();
        this.connection.port = null;
      }

      this.connection.isConnected = false;
      console.log('Arduino disconnected');
    } catch (error) {
      console.error('Error disconnecting from Arduino:', error);
    }
  }

  /**
   * Send command to Arduino
   * @param pin Pin number (e.g., 13 for LED)
   * @param state 'ON' or 'OFF'
   * @param duration Optional duration in milliseconds (0 for continuous)
   */
  async sendCommand(pin: number, state: 'ON' | 'OFF', duration: number = 0): Promise<boolean> {
    if (!this.connection.isConnected || !this.connection.writer) {
      console.warn('Arduino not connected. Command queued.');
      this.commandQueue.push(`${pin},${state},${duration}`);
      return false;
    }

    try {
      // Format: "PIN,STATE,DURATION\n"
      // Example: "13,ON,0\n" or "13,ON,2000\n"
      const command = `${pin},${state},${duration}\n`;
      const encoder = new TextEncoder();
      const data = encoder.encode(command);

      await this.connection.writer.write(data);
      console.log(`Sent command to Arduino: ${command.trim()}`);
      return true;
    } catch (error) {
      console.error('Error sending command to Arduino:', error);
      return false;
    }
  }

  /**
   * Turn on LED on specific pin
   */
  async ledOn(pin: number): Promise<boolean> {
    return this.sendCommand(pin, 'ON', 0);
  }

  /**
   * Turn off LED on specific pin
   */
  async ledOff(pin: number): Promise<boolean> {
    return this.sendCommand(pin, 'OFF', 0);
  }

  /**
   * Flash LED (turn on for duration, then off)
   */
  async ledFlash(pin: number, duration: number): Promise<boolean> {
    return this.sendCommand(pin, 'ON', duration);
  }

  /**
   * Send servo start command (triggers continuous servo loop)
   */
  async servoStart(): Promise<boolean> {
    if (!this.connection.isConnected || !this.connection.writer) {
      console.warn('Arduino not connected. Servo start command queued.');
      return false;
    }

    try {
      const command = 'SERVO,START\n';
      const encoder = new TextEncoder();
      const data = encoder.encode(command);

      await this.connection.writer.write(data);
      console.log('Sent servo start command to Arduino');
      return true;
    } catch (error) {
      console.error('Error sending servo start command to Arduino:', error);
      return false;
    }
  }

  /**
   * Send servo stop command (stops servo loop and returns to start position)
   */
  async servoStop(): Promise<boolean> {
    if (!this.connection.isConnected || !this.connection.writer) {
      console.warn('Arduino not connected. Servo stop command queued.');
      return false;
    }

    try {
      const command = 'SERVO,STOP\n';
      const encoder = new TextEncoder();
      const data = encoder.encode(command);

      await this.connection.writer.write(data);
      console.log('Sent servo stop command to Arduino');
      return true;
    } catch (error) {
      console.error('Error sending servo stop command to Arduino:', error);
      return false;
    }
  }

  /**
   * Send servo alert command (triggers rapid oscillation for alert)
   */
  async servoAlert(): Promise<boolean> {
    if (!this.connection.isConnected || !this.connection.writer) {
      console.warn('Arduino not connected. Servo alert command queued.');
      return false;
    }

    try {
      const command = 'SERVO,ALERT\n';
      const encoder = new TextEncoder();
      const data = encoder.encode(command);

      await this.connection.writer.write(data);
      console.log('Sent servo alert command to Arduino');
      return true;
    } catch (error) {
      console.error('Error sending servo alert command to Arduino:', error);
      return false;
    }
  }

  /**
   * Listen for incoming data from Arduino
   */
  private async listenForData(): Promise<void> {
    try {
      if (!this.connection.reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await this.connection.reader.read();

        if (done) {
          console.log('Serial reader closed');
          break;
        }

        if (value) {
          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              console.log('Arduino response:', line);
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error reading from Arduino:', error);
      }
    }
  }

  /**
   * Check if Arduino is connected
   */
  isConnected(): boolean {
    return this.connection.isConnected;
  }

  /**
   * Get list of available ports
   */
  async getAvailablePorts(): Promise<any[]> {
    try {
      if (!this.isWebSerialSupported()) {
        return [];
      }
      const ports = await (navigator.serial as any).getPorts();
      return ports;
    } catch (error) {
      console.error('Error getting available ports:', error);
      return [];
    }
  }
}

// Export singleton instance
export const arduinoService = new ArduinoService();
