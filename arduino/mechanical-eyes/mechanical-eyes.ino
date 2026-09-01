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
// lookLeft()/lookRight()/lookUp()/lookDown()/blinkOpen()/blinkClose() drive
// both eyes together for that motion, each for a short timed pulse (no
// position feedback exists, so "how far" is just "how long at what speed" --
// tune LOOK_SPEED_US/LOOK_DURATION_MS and the blink equivalents to taste).
// Test each one individually with short/slow values before trusting it.
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

// Standard R/C convention: pulse above neutral = clockwise (viewed from the
// output shaft/horn), below = counter-clockwise. If real behavior comes out
// backwards on the bench, it'll be backwards for all six the same way (a
// servo-firmware property, not a per-unit thing) -- fix it by swapping these
// two values, nothing else needs to change.
const int8_t CW = +1;
const int8_t CCW = -1;

// Measured on the actual hardware: which rotation direction produces which
// physical motion, per servo. Left/right eyes are mechanically mirrored, so
// these are NOT symmetric.
const int8_t LEFT_LR_RIGHT = CW;      // left eye L/R servo
const int8_t LEFT_LR_LEFT = CCW;
const int8_t LEFT_UD_UP = CW;         // left eye U/D servo
const int8_t LEFT_UD_DOWN = CCW;
const int8_t LEFT_BLINK_OPEN = CW;    // left eye blink servo
const int8_t LEFT_BLINK_CLOSE = CCW;

const int8_t RIGHT_LR_LEFT = CW;      // right eye L/R servo
const int8_t RIGHT_LR_RIGHT = CCW;
const int8_t RIGHT_UD_DOWN = CW;      // right eye U/D servo
const int8_t RIGHT_UD_UP = CCW;
const int8_t RIGHT_BLINK_CLOSE = CW;  // right eye blink servo
const int8_t RIGHT_BLINK_OPEN = CCW;

// How far off neutral (speed) and how long to run for a single look/blink
// move. These are placeholders -- start small and increase to taste once
// wired up; too large a value on the up/down axis risks the semi-hard stop.
const uint16_t LOOK_SPEED_US = 120;
const unsigned long LOOK_DURATION_MS = 150;
const uint16_t BLINK_SPEED_US = 150;
const unsigned long BLINK_DURATION_MS = 150;

void stopAll() {
  for (uint8_t i = 0; i < NUM_CHANNELS; i++) {
    pwm.writeMicroseconds(ALL_CHANNELS[i], stopPulseUs[i]);
  }
}

// Drives a set of channels simultaneously (so paired eyes move together
// rather than one after the other), holds for durationMs, then returns every
// channel driven to its own neutral point.
void driveChannels(const uint8_t *channels, const int8_t *directions, uint8_t count,
                    uint16_t speedOffsetUs, unsigned long durationMs) {
  for (uint8_t i = 0; i < count; i++) {
    uint8_t ch = channels[i];
    pwm.writeMicroseconds(ch, stopPulseUs[ch] + directions[i] * (int16_t)speedOffsetUs);
  }
  delay(durationMs);
  for (uint8_t i = 0; i < count; i++) {
    uint8_t ch = channels[i];
    pwm.writeMicroseconds(ch, stopPulseUs[ch]);
  }
}

void lookRight(unsigned long durationMs = LOOK_DURATION_MS, uint16_t speedUs = LOOK_SPEED_US) {
  uint8_t channels[2] = {CH_LEFT_LR, CH_RIGHT_LR};
  int8_t directions[2] = {LEFT_LR_RIGHT, RIGHT_LR_RIGHT};
  driveChannels(channels, directions, 2, speedUs, durationMs);
}

void lookLeft(unsigned long durationMs = LOOK_DURATION_MS, uint16_t speedUs = LOOK_SPEED_US) {
  uint8_t channels[2] = {CH_LEFT_LR, CH_RIGHT_LR};
  int8_t directions[2] = {LEFT_LR_LEFT, RIGHT_LR_LEFT};
  driveChannels(channels, directions, 2, speedUs, durationMs);
}

void lookUp(unsigned long durationMs = LOOK_DURATION_MS, uint16_t speedUs = LOOK_SPEED_US) {
  uint8_t channels[2] = {CH_LEFT_UD, CH_RIGHT_UD};
  int8_t directions[2] = {LEFT_UD_UP, RIGHT_UD_UP};
  driveChannels(channels, directions, 2, speedUs, durationMs);
}

void lookDown(unsigned long durationMs = LOOK_DURATION_MS, uint16_t speedUs = LOOK_SPEED_US) {
  uint8_t channels[2] = {CH_LEFT_UD, CH_RIGHT_UD};
  int8_t directions[2] = {LEFT_UD_DOWN, RIGHT_UD_DOWN};
  driveChannels(channels, directions, 2, speedUs, durationMs);
}

void blinkClose(unsigned long durationMs = BLINK_DURATION_MS, uint16_t speedUs = BLINK_SPEED_US) {
  uint8_t channels[2] = {CH_LEFT_BLINK, CH_RIGHT_BLINK};
  int8_t directions[2] = {LEFT_BLINK_CLOSE, RIGHT_BLINK_CLOSE};
  driveChannels(channels, directions, 2, speedUs, durationMs);
}

void blinkOpen(unsigned long durationMs = BLINK_DURATION_MS, uint16_t speedUs = BLINK_SPEED_US) {
  uint8_t channels[2] = {CH_LEFT_BLINK, CH_RIGHT_BLINK};
  int8_t directions[2] = {LEFT_BLINK_OPEN, RIGHT_BLINK_OPEN};
  driveChannels(channels, directions, 2, speedUs, durationMs);
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
  // Nothing runs automatically -- lookLeft()/lookRight()/lookUp()/lookDown()/
  // blinkOpen()/blinkClose() are ready to call, but test them one at a time
  // by hand first (uncomment ONE line below, upload, watch, comment it back
  // out) before chaining them into any kind of demo sequence. Confirm each
  // axis moves the direction its name says -- if everything is backwards,
  // swap the CW/CCW values near the top rather than editing every function.

  // lookRight(100, 80); delay(1000);
  // lookLeft(100, 80); delay(1000);
  // lookUp(100, 80); delay(1000);
  // lookDown(100, 80); delay(1000);
  // blinkClose(); delay(500); blinkOpen(); delay(1000);
}
