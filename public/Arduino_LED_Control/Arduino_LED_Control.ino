/**
 * Arduino Sketch for LED Control via Web Serial API
 * 
 * This sketch receives commands from the web application and controls an LED.
 * Commands format: "PIN,STATE,DURATION\n"
 * Example: "13,ON,500\n" - Turn on LED on pin 13 for 500ms
 *          "13,OFF,0\n" - Turn off LED on pin 13
 * 
 * Upload this sketch to your Arduino using the Arduino IDE.
 * Then use the web app to connect via Web Serial API.
 */

// Default LED pin (change if using a different pin)
const int LED_PIN = 13;

// Buffer for serial input
String serialBuffer = "";

void setup() {
  // Initialize serial communication at 9600 baud
  Serial.begin(9600);
  
  // Initialize LED pin as output
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  
  Serial.println("Arduino ready - waiting for commands");
  Serial.println("Format: PIN,STATE,DURATION (e.g., 13,ON,500)");
}

void loop() {
  // Check for incoming serial data
  while (Serial.available() > 0) {
    char inChar = Serial.read();
    
    // Build the command string until newline
    if (inChar == '\n') {
      // Process the complete command
      processCommand(serialBuffer);
      serialBuffer = ""; // Clear the buffer
    } else if (inChar != '\r') {
      // Add character to buffer (skip carriage return)
      serialBuffer += inChar;
    }
  }
}

void processCommand(String command) {
  // Parse the command: "PIN,STATE,DURATION"
  
  // Find the positions of the commas
  int firstComma = command.indexOf(',');
  int secondComma = command.indexOf(',', firstComma + 1);
  
  if (firstComma == -1 || secondComma == -1) {
    Serial.println("ERROR: Invalid format");
    return;
  }
  
  // Extract pin number
  int pin = command.substring(0, firstComma).toInt();
  
  // Extract state (ON or OFF)
  String state = command.substring(firstComma + 1, secondComma);
  state.trim();
  state.toUpperCase();
  
  // Extract duration
  int duration = command.substring(secondComma + 1).toInt();
  
  // Validate pin
  if (pin < 0 || pin > 13) {
    Serial.println("ERROR: Invalid pin");
    return;
  }
  
  // Set pin mode (make sure it's an output)
  pinMode(pin, OUTPUT);
  
  // Process the command
  if (state == "ON") {
    digitalWrite(pin, HIGH);
    Serial.print("LED ON: Pin ");
    Serial.println(pin);
    
    // If duration is specified, automatically turn off after duration
    if (duration > 0) {
      delay(duration);
      digitalWrite(pin, LOW);
      Serial.print("LED OFF: Pin ");
      Serial.print(pin);
      Serial.print(" (after ");
      Serial.print(duration);
      Serial.println("ms)");
    }
  } else if (state == "OFF") {
    digitalWrite(pin, LOW);
    Serial.print("LED OFF: Pin ");
    Serial.println(pin);
  } else {
    Serial.println("ERROR: Invalid state (use ON or OFF)");
  }
}
