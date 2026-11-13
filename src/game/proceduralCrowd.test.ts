import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepCriticallyDampedSpring,
  stepCriticallyDampedAngle,
  stepHandheldBreathingPhase,
  computeHandheldBreathing,
  computeSpringArmDesiredPose,
  stepProceduralCrowdVisitor,
  computeCrowdMemberPose,
  type CrowdVisitorState,
} from './rules';

test('stepCriticallyDampedSpring converges smoothly without overshoot across abrupt target changes', () => {
  let value = 0;
  let velocity = 0;
  const target = 10;
  const dt = 1 / 60;
  let prevDelta = Infinity;

  for (let i = 0; i < 60; i++) {
    const step = stepCriticallyDampedSpring(value, velocity, target, 0.14, dt);
    assert.ok(Number.isFinite(step.value));
    assert.ok(Number.isFinite(step.velocity));
    assert.ok(step.value <= target + 1e-6, 'Spring must never overshoot target');
    const curDelta = Math.abs(target - step.value);
    assert.ok(curDelta <= prevDelta + 1e-9, 'Spring monotonically approaches target');
    prevDelta = curDelta;
    value = step.value;
    velocity = step.velocity;
  }

  assert.ok(Math.abs(value - target) < 0.05, 'Spring settles within 1 second');

  const ang = stepCriticallyDampedAngle(Math.PI - 0.1, 0, -Math.PI + 0.1, 0.12, 0.016);
  assert.ok(ang.value > Math.PI - 0.1, 'Angular spring takes shortest arc across PI/-PI wrap');
});

test('stepHandheldBreathingPhase produces continuous motion without jump on sprint toggle', () => {
  let phase = 0;
  phase = stepHandheldBreathingPhase(phase, 0.016, { moveSpeed: 0, isSprintingOrDashing: false });
  const beforeSprint = computeHandheldBreathing(12.0, {
    moveSpeed: 0,
    isSprintingOrDashing: false,
    phaseOverride: phase,
  });

  // Switch instantaneously to sprint
  phase = stepHandheldBreathingPhase(phase, 0.016, { moveSpeed: 12, isSprintingOrDashing: true });
  const afterSprint = computeHandheldBreathing(12.016, {
    moveSpeed: 12,
    isSprintingOrDashing: true,
    phaseOverride: phase,
  });

  const deltaY = Math.abs(afterSprint.verticalOffsetM - beforeSprint.verticalOffsetM);
  assert.ok(
    deltaY < 0.03,
    `Expected continuous vertical offset across sprint toggle, got jump ${deltaY}`
  );
});

test('computeSpringArmDesiredPose supports smooth shield blend and manual camera orbit', () => {
  const halfShield = computeSpringArmDesiredPose({
    playerX: 0,
    playerY: 0,
    playerZ: 10,
    velocityX: 0,
    velocityZ: 0,
    activeWorld: 'holi_braj',
    shieldActive: true,
    shieldBlendOverride: 0.5,
    shieldOrbitAngleOverride: 0.25,
    orbitYawOffset: 0.5,
    zoomDistanceOffset: 1.0,
    fireworkLookUpTimerSec: 0,
    elapsedSec: 5.0,
  });

  // 5.2 base + 0.5*1.8 shield dolly + 1.0 zoomOffset = 7.1
  assert.equal(halfShield.desiredDistance, 7.1);
  assert.ok(halfShield.desiredCamX > 2.0, 'Orbit yaw moves camera horizontally around player');
});

test('stepProceduralCrowdVisitor triggers dynamic proximity greeting and respects Diwali Ghat upper terrace', () => {
  const baseVisitor: CrowdVisitorState = {
    id: 3, // id % 3 === 0 -> celebrate_namaste on player approach
    x: 4,
    z: 0,
    vx: 1.5,
    vz: 0,
    targetX: 12,
    targetZ: 0,
    speed: 1.8,
    stridePhase: 0,
    paletteIndex: 0,
    behaviorState: 'strolling',
    behaviorTimer: 0,
    reactionCooldown: 0,
  };

  // Player stands 3m away at (7, 0)
  const reacted = stepProceduralCrowdVisitor(
    baseVisitor,
    [],
    { playerX: 7, playerZ: 0, playerSpeed: 2.0, activeWorld: 'holi_braj' },
    0.05
  );
  assert.equal(reacted.behaviorState, 'celebrate_namaste');

  const namastePose = computeCrowdMemberPose(reacted, 1.0);
  assert.ok(namastePose.torsoPitch > 0.1, 'Namaste greeting bows torso forward');
  assert.ok(namastePose.leftArmX < -0.5 && namastePose.rightArmX < -0.5, 'Hands raised in Namaste');

  // Celebratory cheer & dance poses raise arms high overhead with joyful bounce
  const cheeringVisitor: CrowdVisitorState = {
    ...baseVisitor,
    behaviorState: 'celebrate_cheer',
    behaviorTimer: 2.5,
    emotePhase: 0.2,
  };
  const cheerPose = computeCrowdMemberPose(cheeringVisitor, 0.2);
  assert.ok(cheerPose.leftArmX < -2.0 && cheerPose.rightArmX < -2.0, 'Cheer raises both arms high');
  assert.ok(cheerPose.pelvisY > 0.05, 'Cheer hops joyfully');

  // Diwali Ghat bounds check: crowd member never enters river (z > -10.5)
  const ghatVisitor: CrowdVisitorState = {
    ...baseVisitor,
    x: 0,
    z: 4, // Starts in river zone before world switch correction
    reactionCooldown: 5,
  };
  const corrected = stepProceduralCrowdVisitor(
    ghatVisitor,
    [],
    { playerX: 0, playerZ: -12, playerSpeed: 0, activeWorld: 'diwali_ghat' },
    0.05
  );
  assert.ok(corrected.z <= -10.5, `Expected visitor on Diwali Ghat terrace (z <= -10.5), got ${corrected.z}`);
});
