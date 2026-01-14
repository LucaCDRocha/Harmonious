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
    // For servo control, we use special command "SERVO,START" or "SERVO,STOP"
    if (command.startsWith("SERVO,START")) {
      loopActive = true;
      Serial.println("Transmission started - Servo loop activated");
    } 
    else if (command.startsWith("SERVO,STOP")) {
      loopActive = false;
      myServo.write(startAngle);
      Serial.println("Transmission stopped - Servo at start position");
    }
  }

  // If loop is active, sweep servo from start to end continuously
  if (loopActive) {
    // Sweep from start to end
    for (angle = startAngle; angle <= endAngle; angle++) {
      myServo.write(angle);
      delay(15);
      
      // Check for stop command during loop
      if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        if (cmd.startsWith("SERVO,STOP")) {
          loopActive = false;
          myServo.write(startAngle);
          Serial.println("Transmission stopped - Servo at start position");
          break;
        }
      }
    }
    
    // Sweep from end to start
    if (loopActive) {
      for (angle = endAngle; angle >= startAngle; angle--) {
        myServo.write(angle);
        delay(15);
        
        // Check for stop command during loop
        if (Serial.available() > 0) {
          String cmd = Serial.readStringUntil('\n');
          cmd.trim();
          if (cmd.startsWith("SERVO,STOP")) {
            loopActive = false;
            myServo.write(startAngle);
            Serial.println("Transmission stopped - Servo at start position");
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
