// East Troy mechanical eyes: PCA9685-driven, 6x FS90R continuous-rotation servos.
//
// FS90R servos have no position feedback -- they only respond to speed/direction,
// not angle. Rather than homing against a physical stop (which risks bending the
// thin wire linkages on the semi-hard-stopped up/down axis), this sketch trusts
// you to manually position both eyes -- centered look direction, eyelids closed --
// BEFORE powering on. At boot it simply commands every channel to "stop" and
// holds that as the reference position.
//
// Wiring:
//   PCA9685 VCC -> Uno 5V        PCA9685 SDA -> Uno A4
//   PCA9685 GND -> Uno GND       PCA9685 SCL -> Uno A5
//   PCA9685 V+ terminal block -> external 5-6V supply (NOT the Uno), with that
//   supply's GND tied to the Uno's GND.
//
// Channel assignment (edit to match how you actually plug them in):
//   0 = left eye  left/right       3 = right eye left/right
//   1 = left eye  up/down          4 = right eye up/down
//   2 = left eye  blink            5 = right eye blink
//
// Requires the "Adafruit PWM Servo Driver Library" (Library Manager).

#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

const uint8_t CH_LEFT_LR = 0;
const uint8_t CH_LEFT_UD = 1;
const uint8_t CH_LEFT_BLINK = 2;
const uint8_t CH_RIGHT_LR = 3;
const uint8_t CH_RIGHT_UD = 4;
const uint8_t CH_RIGHT_BLINK = 5;

const uint8_t NUM_CHANNELS = 6;
const uint8_t ALL_CHANNELS[NUM_CHANNELS] = {
    CH_LEFT_LR, CH_LEFT_UD, CH_LEFT_BLINK, CH_RIGHT_LR, CH_RIGHT_UD, CH_RIGHT_BLINK};

// Neutral ("stop") pulse width per channel, in microseconds. FS90R spec-neutral
// is 1500us, but manufacturing tolerance means a given unit's true stop point
// can be off by +/-50us. If a servo still creeps while holding neutral, nudge
// its entry here in 5-10us steps until it sits still.
uint16_t stopPulseUs[NUM_CHANNELS] = {1500, 1500, 1500, 1500, 1500, 1500};

void stopAll() {
  for (uint8_t i = 0; i < NUM_CHANNELS; i++) {
    pwm.writeMicroseconds(ALL_CHANNELS[i], stopPulseUs[i]);
  }
}

void setup() {
  Serial.begin(9600);
  Serial.println(F("Mechanical eyes: starting up."));
  Serial.println(F("Assuming eyes were positioned by hand before power-on (centered, lids closed)."));

  pwm.begin();
  pwm.setOscillatorFrequency(27000000);
  pwm.setPWMFreq(50);
  delay(10);

  stopAll();
  Serial.println(F("All channels holding neutral. Ready."));
}

void loop() {
  // Movement functions (look left/right/up/down, blink) come next, once we
  // know which rotation direction -- CW or CCW -- corresponds to which
  // physical motion on each of the 6 servos.
}
