/*
  Arduino Starter Kit example
  Project 5 - Servo Mood Indicator

  This sketch is written to accompany Project 5 in the Arduino Starter Kit

  Parts required:
  - servo motor
  - 10 kilohm potentiometer
  - two 100 uF electrolytic capacitors

  created 13 Sep 2012
  by Scott Fitzgerald

  https://store.arduino.cc/genuino-starter-kit

  This example code is part of the public domain.
*/

// include the Servo library
#include <Servo.h>

Servo myServo;  // create a servo object

int const potPin = A0;  // analog pin used to connect the potentiometer
int const buttonPin = 3;

int const startAngle = 0;
int const endAngle = 120;

int potVal;             // variable to read the value from the analog pin
int angle;              // variable to hold the angle for the servo motor
bool loopActive = false; // flag to control servo loop
bool alertActive = false; // flag to control alert oscillation

void setup() {
  myServo.attach(9);   // attaches the servo on pin 9 to the servo object
  Serial.begin(9600);  // open a serial connection to your computer
  pinMode(buttonPin, INPUT);
  myServo.write(startAngle); // Start at initial position
}

void loop() {
  // Check for incoming serial commands from web app
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim(); // Remove whitespace
    
    // Parse command format: "PIN,STATE,DURATION"
    // For servo control, we use special command "SERVO,START", "SERVO,STOP", or "SERVO,ALERT"
    if (command.startsWith("SERVO,START")) {
      loopActive = true;
      alertActive = false;
      Serial.println("Transmission started - Servo loop activated");
    } 
    else if (command.startsWith("SERVO,STOP")) {
      loopActive = false;
      alertActive = false;
      myServo.write(startAngle);
      Serial.println("Transmission stopped - Servo at start position");
    }
    else if (command.startsWith("SERVO,ALERT")) {
      alertActive = true;
      loopActive = false;
      Serial.println("Alert triggered - Rapid oscillation activated");
    }
  }

  // If alert is active, oscillate rapidly in a small range
  if (alertActive) {
    Serial.println("Starting alert oscillation animation");
    // Rapid oscillation in a 20-degree range around the middle
    int midAngle = (startAngle + endAngle) / 2;
    int oscillationRange = 15;
    
    // Quick back and forth movement (about 10 seconds total)
    for (int cycle = 0; cycle < 20; cycle++) {
      Serial.print("Alert cycle: ");
      Serial.println(cycle);
      
      // Move up
      for (int a = midAngle; a <= midAngle + oscillationRange; a++) {
        myServo.write(a);
        delay(5);
      }
      // Move down
      for (int a = midAngle + oscillationRange; a >= midAngle - oscillationRange; a--) {
        myServo.write(a);
        delay(5);
      }
      // Move back to mid
      for (int a = midAngle - oscillationRange; a <= midAngle; a++) {
        myServo.write(a);
        delay(5);
      }
      
      // Pause between cycles to make movement more visible
      delay(50);
      
      // Only check for STOP or START commands during alert, ignore duplicate ALERT commands
      if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        if (cmd.startsWith("SERVO,STOP") || cmd.startsWith("SERVO,START")) {
          Serial.println("Stop/Start command received during alert - breaking");
          break; // Only break for explicit STOP or START commands
        }
        // Ignore any other commands (like duplicate SERVO,ALERT) and continue animation
      }
    }
    
    // After alert oscillation completes, return to start and deactivate
    alertActive = false;
    myServo.write(startAngle);
    Serial.println("Alert complete - Servo at start position");
    return; // Return immediately to restart loop
  }
  // If loop is active, sweep servo from start to end continuously
  else if (loopActive) {
    // Sweep from start to end
    for (angle = startAngle; angle <= endAngle; angle++) {
      myServo.write(angle);
      delay(15);
      
      // Check for stop or alert command during loop
      if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        if (cmd.startsWith("SERVO,STOP")) {
          loopActive = false;
          myServo.write(startAngle);
          Serial.println("Transmission stopped - Servo at start position");
          break;
        }
        else if (cmd.startsWith("SERVO,ALERT")) {
          loopActive = false;
          alertActive = true;
          Serial.println("Alert triggered during transmission - Switching to rapid oscillation");
          break;
        }
      }
    }
    
    // Sweep from end to start
    if (loopActive) {
      for (angle = endAngle; angle >= startAngle; angle--) {
        myServo.write(angle);
        delay(15);
        
        // Check for stop or alert command during loop
        if (Serial.available() > 0) {
          String cmd = Serial.readStringUntil('\n');
          cmd.trim();
          if (cmd.startsWith("SERVO,STOP")) {
            loopActive = false;
            myServo.write(startAngle);
            Serial.println("Transmission stopped - Servo at start position");
            break;
          }
          else if (cmd.startsWith("SERVO,ALERT")) {
            loopActive = false;
            alertActive = true;
            Serial.println("Alert triggered during transmission - Switching to rapid oscillation");
            break;
          }
        }
      }
    }
  } else {
    // When not looping, keep servo at start position
    myServo.write(startAngle);
    delay(15);
  }
}
