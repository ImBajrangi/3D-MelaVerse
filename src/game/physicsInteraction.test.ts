import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialWeatherState,
  stepWeatherSystem,
} from './weatherSystem';
import {
  PhysicsInteraction,
  modifyCharacterVelocity,
  stepProjectileTrajectory,
  stepOrdnanceWindDeflection,
  computeGulalWashRate,
  stepWindBlownParticle,
} from './physicsInteraction';
import {
  ORBITAL_CAMERA_DEFAULTS,
  computeCameraRelativeMoveVector,
  computeOrbitalGameplayFov,
  computeOrbitalCorneringRoll,
  computeOrbitalThirdPersonPose,
  computePreviewArcPose,
  dampAngleRad,
} from './rules';

test('weatherSystem creates world-specific conditions and transitions smoothly across phases', () => {
  let braj = createInitialWeatherState('holi_braj');
  assert.equal(braj.weatherId, 'braj_monsoon_rain');
  assert.ok(braj.rainIntensity > 0.5);
  assert.ok(braj.washRateMultiplier > 2.5);
  assert.ok(braj.airDragMultiplier > 1.3);

  // Advance past 65% of 40s cycle (~28s) into sunlit courtyard
  for (let i = 0; i < 600; i++) {
    braj = stepWeatherSystem(braj, {
      dt: 0.05,
      elapsedSec: i * 0.05,
      activeWorld: 'holi_braj',
    });
  }
  assert.equal(braj.weatherId, 'clear_sun');
  assert.ok(braj.rainIntensity < 0.08);

  const ghat = createInitialWeatherState('diwali_ghat');
  assert.equal(ghat.weatherId, 'ghat_river_breeze');
  assert.equal(ghat.rainIntensity, 0);
  assert.ok(ghat.windSpeed > 4.5);

  const mela = createInitialWeatherState('mela_central');
  assert.equal(mela.weatherId, 'mela_gusts');
  assert.ok(mela.windSpeed > 3.0);
});

test('PhysicsInteraction.modifyCharacterVelocity applies rain drag and wind drift accurately', () => {
  const rainWeather = createInitialWeatherState('holi_braj');
  const dryWeather = {
    ...rainWeather,
    weatherId: 'clear_sun' as const,
    rainIntensity: 0,
    windX: 0,
    windZ: 0,
    windSpeed: 0,
  };

  const dryWalk = modifyCharacterVelocity({
    vx: 8.8,
    vz: 0,
    weather: dryWeather,
    isDashing: false,
    isAirborne: false,
    dt: 0.016,
  });
  const rainWalk = modifyCharacterVelocity({
    vx: 8.8,
    vz: 0,
    weather: rainWeather,
    isDashing: false,
    isAirborne: false,
    dt: 0.016,
  });
  const rainDash = modifyCharacterVelocity({
    vx: 20.0,
    vz: 0,
    weather: rainWeather,
    isDashing: true,
    isAirborne: false,
    dt: 0.016,
  });

  assert.ok(rainWalk.effectiveDragScale < dryWalk.effectiveDragScale);
  assert.ok(rainDash.effectiveDragScale > rainWalk.effectiveDragScale);

  const ghatWind = createInitialWeatherState('diwali_ghat');
  const groundDrift = modifyCharacterVelocity({
    vx: 0,
    vz: 0,
    weather: ghatWind,
    isDashing: false,
    isAirborne: false,
    dt: 0.016,
  });
  const airDrift = modifyCharacterVelocity({
    vx: 0,
    vz: 0,
    weather: ghatWind,
    isDashing: false,
    isAirborne: true,
    dt: 0.016,
  });

  assert.ok(groundDrift.windDriftX > 0.1);
  assert.ok(airDrift.windDriftX > groundDrift.windDriftX * 2.5);
});

test('PhysicsInteraction.stepProjectileTrajectory slows forward travel in rain and deflects along wind', () => {
  const calmWeather = {
    ...createInitialWeatherState('diwali_ghat'),
    rainIntensity: 0,
    windX: 0,
    windZ: 0,
    windSpeed: 0,
    airDragMultiplier: 1.0,
  };
  const rainyWeather = createInitialWeatherState('holi_braj');
  const windyWeather = createInitialWeatherState('diwali_ghat');

  const calmStep = stepProjectileTrajectory({
    x: 0,
    y: 1.5,
    z: 0,
    vx: 0,
    vy: 2,
    vz: -20,
    gravity: 9.8,
    weather: calmWeather,
    dt: 0.05,
  });

  const rainStep = stepProjectileTrajectory({
    x: 0,
    y: 1.5,
    z: 0,
    vx: 0,
    vy: 2,
    vz: -20,
    gravity: 9.8,
    weather: rainyWeather,
    dt: 0.05,
  });

  const windStep = stepProjectileTrajectory({
    x: 0,
    y: 1.5,
    z: 0,
    vx: 0,
    vy: 2,
    vz: -20,
    gravity: 9.8,
    weather: windyWeather,
    dt: 0.05,
  });

  // Rain increases air drag & accelerates vertical drop
  assert.ok(Math.abs(rainStep.vz) < Math.abs(calmStep.vz));
  assert.ok(rainStep.vy < calmStep.vy);

  // River breeze pushes projectile laterally along windX (> 0)
  assert.ok(windStep.vx > 0.15);
  assert.ok(windStep.x > 0);
});

test('PhysicsInteraction washes away Gulal splatters faster in rain and blows firework particles in wind', () => {
  const rainWeather = createInitialWeatherState('holi_braj');
  const clearWeather = {
    ...rainWeather,
    weatherId: 'clear_sun' as const,
    rainIntensity: 0,
    washRateMultiplier: 1.0,
  };

  const rainWash = computeGulalWashRate(rainWeather, 0.014);
  const clearWash = computeGulalWashRate(clearWeather, 0.014);
  assert.ok(rainWash > clearWash * 3.0);

  const ghatWind = createInitialWeatherState('diwali_ghat');
  let p = { x: 0, y: 12, z: -10, vx: 0, vy: 5, vz: 0 };
  for (let i = 0; i < 20; i++) {
    p = PhysicsInteraction.stepWindBlownParticle({
      ...p,
      gravity: 6.0,
      weather: ghatWind,
      elapsedSec: i * 0.05,
      particleSeed: 1.25,
      dt: 0.05,
      isFirework: true,
    });
  }
  assert.ok(p.x > 1.5, `Expected firework sparks to drift significantly with windX, got x=${p.x}`);

  const ordnance = stepOrdnanceWindDeflection({
    targetX: 10,
    targetZ: -10,
    weather: ghatWind,
    dt: 0.05,
  });
  assert.ok(ordnance.targetX > 10);
  assert.ok(ordnance.targetZ < -10);
});

test('Orbital Third-Person Spring-Arm Camera & Preview Director framing match specification', () => {
  assert.equal(ORBITAL_CAMERA_DEFAULTS.distance, 5.4);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.minDistance, 3.0);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.maxDistance, 9.5);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.pivotHeight, 1.65);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.rightShoulderOffset, 0.55);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.idleWalkFov, 45);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.sprintDashFov, 54);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.previewHeight, 4.2);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.previewLookAtY, 7.2);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.previewFov, 42);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.previewArcRadius, 26);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.previewArcSpeedRadPerSec, 0.08);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.enterWorldSwoopSec, 1.5);
  assert.equal(ORBITAL_CAMERA_DEFAULTS.rideStallTransitionSec, 0.85);

  const pose = computeOrbitalThirdPersonPose({
    playerX: 0,
    playerY: 0,
    playerZ: 0,
    camYawRad: Math.PI, // facing North (-Z)
    camPitchRad: ORBITAL_CAMERA_DEFAULTS.defaultPitchRad,
    distance: 5.4,
    shieldBlend: 0,
    recoilImpulseMeters: 0,
  });

  // Right shoulder offset +0.55 on X when facing -Z
  assert.ok(Math.abs(pose.pivotX - 0.55) < 0.01);
  assert.equal(pose.pivotY, 1.65);
  // Camera sits behind player (+Z) and slightly elevated at 12 deg pitch
  assert.ok(pose.desiredCamZ > 5.0);
  assert.ok(pose.desiredCamY > 2.6 && pose.desiredCamY < 3.0);
  // Looking forward into -Z courtyard, never staring steeply down at ground
  assert.ok(pose.desiredLookAtZ < -10);
  assert.ok(pose.desiredLookAtY > 1.8);

  // Shield pullback +1.4 units
  const shieldPose = computeOrbitalThirdPersonPose({
    playerX: 0,
    playerY: 0,
    playerZ: 0,
    camYawRad: Math.PI,
    camPitchRad: ORBITAL_CAMERA_DEFAULTS.defaultPitchRad,
    distance: 5.4,
    shieldBlend: 1,
  });
  assert.ok(Math.abs(shieldPose.effectiveDistance - 6.8) < 0.001);

  // Clamp zoom distance and pitch
  const clampedPose = computeOrbitalThirdPersonPose({
    playerX: 0,
    playerY: 0,
    playerZ: 0,
    camYawRad: Math.PI,
    camPitchRad: 2.0,
    distance: 20.0,
  });
  assert.equal(clampedPose.effectiveDistance, 9.5);

  // Camera-relative WASD facing North (-Z, camYaw = PI)
  const wMove = computeCameraRelativeMoveVector({
    forwardInput: 1,
    rightInput: 0,
    camYawRad: Math.PI,
  });
  assert.ok(Math.abs(wMove.moveX) < 0.001);
  assert.ok(wMove.moveZ < -0.99);

  const dMove = computeCameraRelativeMoveVector({
    forwardInput: 0,
    rightInput: 1,
    camYawRad: Math.PI,
  });
  assert.ok(dMove.moveX > 0.99);
  assert.ok(Math.abs(dMove.moveZ) < 0.001);

  // Dynamic FOV & ±1.8° cornering roll
  assert.equal(computeOrbitalGameplayFov({ isSprintingOrDashing: false }), 45);
  assert.equal(computeOrbitalGameplayFov({ isSprintingOrDashing: true }), 54);
  const roll = computeOrbitalCorneringRoll({
    strafeInputX: 1,
    yawRateRadPerSec: -4,
    moveSpeed: 8,
  });
  assert.ok(Math.abs(roll) <= ORBITAL_CAMERA_DEFAULTS.maxCornerRollRad + 1e-6);

  // Preview arc pose
  const preview = computePreviewArcPose({
    elapsedSec: 5,
    activeWorld: 'holi_braj',
  });
  assert.equal(preview.camY, 4.2);
  assert.equal(preview.lookAtY, 7.2);
  assert.equal(preview.fov, 42);
  assert.ok(Math.abs(Math.hypot(preview.camX, preview.camZ) - 26) < 0.01);

  // Shortest-path angle damping
  const wrapped = dampAngleRad(Math.PI - 0.1, -Math.PI + 0.1, 10, 0.05);
  assert.ok(Math.abs(wrapped) > 2.9);
});
