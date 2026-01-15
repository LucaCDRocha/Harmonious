/**
 * Arduino Sketch for LED Control via Web Serial API
 * 
 * This sketch receives commands from the web application and controls LEDs.
 * Commands: "SERVO,START" - Start breathing LED on pin 11
 *           "SERVO,STOP" - Stop and turn off LEDs
 *           "SERVO,ALERT" - Trigger blinking alert on pin 13
 * 
 * Note: Uses "SERVO" prefix to match the web app's command format
 * 
 * Upload this sketch to your Arduino using the Arduino IDE.
 * Then use the web app to connect via Web Serial API.
 */

// LED pins
const int breatheLedPin = 11;  // PWM LED for breathing effect
const int alertLedPin = 13;    // LED for alert blinking

// State flags
bool loopActive = false;       // flag to control breathing loop
bool alertActive = false;      // flag to control alert blinking

// Breathing LED variables
int breatheValue = 0;
int breatheDirection = 1;
unsigned long lastBreatheUpdate = 0;
int breatheSpeed = 5;          // milliseconds between updates

// Alert LED variables
unsigned long lastAlertBlink = 0;
int alertBlinkInterval = 100;  // milliseconds (faster blinking)
bool alertLedState = false;
int alertCycleCount = 0;
const int maxAlertCycles = 50;  // Number of blinks before auto-stop

void setup() {
  // Initialize serial communication at 9600 baud
  Serial.begin(9600);
  
  // Initialize LED pins as output
  pinMode(breatheLedPin, OUTPUT);
  pinMode(alertLedPin, OUTPUT);
  
  // Start with LEDs off
  analogWrite(breatheLedPin, 0);
  digitalWrite(alertLedPin, LOW);
  
  Serial.println("Arduino ready - waiting for commands");
  Serial.println("Commands: SERVO,START / SERVO,STOP / SERVO,ALERT");
  
  // Startup test - blink both LEDs to confirm they work
  Serial.println("Testing LEDs...");
  digitalWrite(alertLedPin, HIGH);
  delay(300);
  digitalWrite(alertLedPin, LOW);
  delay(200);
  analogWrite(breatheLedPin, 255);
  delay(300);
  analogWrite(breatheLedPin, 0);
  delay(200);
  Serial.println("LED test complete!");
  Serial.println("Ready for transmission");
}

void loop() {
  // Update breathing LED (non-blocking)
  updateBreathingLED();
  
  // Update alert LED blinking if alert is active
  if (alertActive) {
    updateAlertLED();
    
    // Check if alert cycle limit reached
    if (alertCycleCount >= maxAlertCycles) {
      alertActive = false;
      alertCycleCount = 0;
      digitalWrite(alertLedPin, LOW);
      Serial.println("Alert complete - LED off");
    }
  } else {
    digitalWrite(alertLedPin, LOW);  // Turn off alert LED when not alerting
  }
  
  // Check for incoming serial commands from web app
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim(); // Remove whitespace
    
    // Parse command format: "SERVO,START", "SERVO,STOP", or "SERVO,ALERT"
    // (Using "SERVO" prefix to match the web app's command format)
    if (command.startsWith("SERVO,START")) {
      loopActive = true;
      alertActive = false;
      Serial.println("Transmission started - LED breathing activated");
    } 
    else if (command.startsWith("SERVO,STOP")) {
      loopActive = false;
      alertActive = false;
      analogWrite(breatheLedPin, 0);
      digitalWrite(alertLedPin, LOW);
      Serial.println("Transmission stopped - LEDs off");
    }
    else if (command.startsWith("SERVO,ALERT")) {
      alertActive = true;
      loopActive = false;
      alertCycleCount = 0;  // Reset cycle counter
      analogWrite(breatheLedPin, 0);  // Turn off breathing LED during alert
      Serial.println("Alert triggered - Rapid blinking activated");
    }
  }
  
  delay(1);  // Small delay for stability
}

// Non-blocking breathing LED function
void updateBreathingLED() {
  // Only update if loop is active
  if (!loopActive) {
    analogWrite(breatheLedPin, 0);  // Turn off when not transmitting
    return;
  }
  
  unsigned long currentMillis = millis();
  if (currentMillis - lastBreatheUpdate >= breatheSpeed) {
    lastBreatheUpdate = currentMillis;
    
    // Update breathing value
    breatheValue += breatheDirection * 3;
    
    // Reverse direction at extremes
    if (breatheValue >= 255) {
      breatheValue = 255;
      breatheDirection = -1;
    } else if (breatheValue <= 0) {
      breatheValue = 0;
      breatheDirection = 1;
    }
    
    // Write PWM value to LED
    analogWrite(breatheLedPin, breatheValue);
  }
}

// Non-blocking alert LED blinking function
void updateAlertLED() {
  unsigned long currentMillis = millis();
  if (currentMillis - lastAlertBlink >= alertBlinkInterval) {
    lastAlertBlink = currentMillis;
    alertLedState = !alertLedState;
    digitalWrite(alertLedPin, alertLedState ? HIGH : LOW);
    
    // Increment cycle counter on each blink
    if (alertLedState == false) {  // Count on the off transition
      alertCycleCount++;
    }
  }
}
