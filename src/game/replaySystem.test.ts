import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPLAY_WINDOW_SEC,
  ReplayRecorder,
  sampleReplayFrame,
  collectReplayActionsInWindow,
  computeCinematicReplayCameraPose,
} from './replaySystem';

test('REPLAY_WINDOW_SEC is configured to 30 seconds', () => {
  assert.equal(REPLAY_WINDOW_SEC, 30);
});

test('ReplayRecorder maintains a rolling 30-second window and normalizes timestamps cleanly', () => {
  const recorder = new ReplayRecorder(30);

  // Record 45 seconds of movement at 10 Hz (0.1s step)
  for (let i = 0; i <= 450; i++) {
    const t = Number((i * 0.1).toFixed(2));
    recorder.maybeRecordKeyframe({
      t,
      x: t * 0.5,
      y: 0,
      z: 6.5 - t * 0.2,
      yaw: (t * 0.2) % (Math.PI * 2),
      vx: 0.5,
      vz: -0.2,
      walkPhase: t * 3.0,
      isDashing: false,
      shieldActive: false,
      armRecoil: false,
      spinKick: false,
    });
  }

  // Old action at t = 5s (outside final 15s..45s window) vs kept action at t = 32s
  recorder.recordAction({
    t: 5,
    type: 'attack',
    x: 2.5,
    y: 0,
    z: 5.5,
    yaw: 0,
    arsenal: 'pichkari',
    gulal: 'gulabi',
  });
  recorder.recordAction({
    t: 32,
    type: 'fireworks',
    x: 16,
    y: 0,
    z: 0.1,
    yaw: 1.2,
  });

  const rec = recorder.finalizeRecording('holi_braj');
  assert.ok(rec);
  assert.equal(rec.world, 'holi_braj');
  assert.ok(rec.durationSec <= 30.05 && rec.durationSec >= 29.8);
  assert.equal(rec.keyframes[0].t, 0);
  // Old action from t=5 should have been pruned; t=32 should map to ~17s inside normalized [0, 30]
  assert.equal(rec.actions.length, 1);
  assert.equal(rec.actions[0].type, 'fireworks');
  assert.ok(Math.abs(rec.actions[0].t - 17) < 0.2);
});

test('sampleReplayFrame interpolates position, velocity, and shortest-arc yaw smoothly', () => {
  const recorder = new ReplayRecorder(30);
  recorder.maybeRecordKeyframe({
    t: 0,
    x: 0,
    y: 0,
    z: 0,
    yaw: Math.PI - 0.1,
    vx: 4,
    vz: 0,
    walkPhase: 0,
    isDashing: false,
    shieldActive: false,
    armRecoil: false,
    spinKick: false,
  });
  recorder.maybeRecordKeyframe({
    t: 1,
    x: 4,
    y: 2,
    z: -2,
    yaw: -Math.PI + 0.1, // +0.2 rad crossing PI wrap-around
    vx: 8,
    vz: -4,
    walkPhase: 6,
    isDashing: true,
    shieldActive: true,
    armRecoil: true,
    spinKick: false,
  });

  const rec = recorder.finalizeRecording('diwali_ghat');
  assert.ok(rec);

  const mid = sampleReplayFrame(rec, 0.5);
  assert.ok(Math.abs(mid.x - 2) < 0.001);
  assert.ok(Math.abs(mid.y - 1) < 0.001);
  assert.ok(Math.abs(mid.z - -1) < 0.001);
  // Shortest arc between (PI - 0.1) and (-PI + 0.1) passes through PI / -PI, not 0!
  assert.ok(Math.abs(Math.abs(mid.yaw) - Math.PI) < 0.02);
  assert.equal(mid.shieldActive, true);
});

test('collectReplayActionsInWindow extracts actions only within the stepped playback slice', () => {
  const recorder = new ReplayRecorder(30);
  recorder.maybeRecordKeyframe({
    t: 0,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 0,
    walkPhase: 0,
    isDashing: false,
    shieldActive: false,
    armRecoil: false,
    spinKick: false,
  });
  recorder.maybeRecordKeyframe({
    t: 5,
    x: 2,
    y: 0,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 0,
    walkPhase: 0,
    isDashing: false,
    shieldActive: false,
    armRecoil: false,
    spinKick: false,
  });
  recorder.recordAction({ t: 0.2, type: 'dash', x: 0.5, y: 0, z: 0, yaw: 0 });
  recorder.recordAction({ t: 2.5, type: 'shield', x: 1, y: 0, z: 0, yaw: 0 });
  recorder.recordAction({ t: 4.1, type: 'diya', x: 2, y: 0, z: 0, yaw: 0 });

  const rec = recorder.finalizeRecording('mela_central');
  assert.ok(rec);

  const slice1 = collectReplayActionsInWindow(rec, 0, 1.0);
  assert.equal(slice1.length, 1);
  assert.equal(slice1[0].type, 'dash');

  const slice2 = collectReplayActionsInWindow(rec, 1.0, 3.0);
  assert.equal(slice2.length, 1);
  assert.equal(slice2[0].type, 'shield');

  const slice3 = collectReplayActionsInWindow(rec, 3.0, 5.0);
  assert.equal(slice3.length, 1);
  assert.equal(slice3[0].type, 'diya');
});

test('computeCinematicReplayCameraPose produces valid distinct camera poses for cinematic, low_hero, and chase modes', () => {
  const recorder = new ReplayRecorder(30);
  recorder.maybeRecordKeyframe({
    t: 0,
    x: 5,
    y: 0.5,
    z: -3,
    yaw: 1.0,
    vx: 3,
    vz: -2,
    walkPhase: 2,
    isDashing: true,
    shieldActive: false,
    armRecoil: false,
    spinKick: false,
  });
  recorder.maybeRecordKeyframe({
    t: 2,
    x: 8,
    y: 0.5,
    z: -5,
    yaw: 1.0,
    vx: 3,
    vz: -2,
    walkPhase: 4,
    isDashing: true,
    shieldActive: false,
    armRecoil: false,
    spinKick: false,
  });
  const rec = recorder.finalizeRecording('holi_braj');
  assert.ok(rec);
  const frame = sampleReplayFrame(rec, 1);

  const cinematic = computeCinematicReplayCameraPose({
    frame,
    playbackTimeSec: 1,
    cameraStyle: 'cinematic',
    recentActionPulse: 0.8,
  });
  const lowHero = computeCinematicReplayCameraPose({
    frame,
    playbackTimeSec: 1,
    cameraStyle: 'low_hero',
    recentActionPulse: 0.8,
  });
  const chase = computeCinematicReplayCameraPose({
    frame,
    playbackTimeSec: 1,
    cameraStyle: 'chase',
    recentActionPulse: 0,
  });

  assert.ok(Number.isFinite(cinematic.camX) && Number.isFinite(cinematic.camY));
  assert.ok(lowHero.camY < chase.camY);
  assert.ok(chase.fov > lowHero.fov);
});
