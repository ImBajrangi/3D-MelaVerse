import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampDelta,
  calculateSplashScore,
  evaluateRoundOutcome,
  calculatePlayerLevel,
  stepChallengerAI,
  scoreRangoliSymmetry,
  mergeRealtimeDelta,
  evaluateLocationConfidence,
  findBestAutoAimTarget,
  stepHomingProjectile,
  evaluateRhythmTap,
  computeSoftMagnetReticle,
  evaluateComboVisualState,
  evaluateAdaptiveDifficulty,
  createInitialScreenShakeState,
  triggerScreenShake,
  stepScreenShake,
  createInitialKarmaState,
  recordKarmaAction,
  stepKarmaState,
  computeRideCabinCameraPose,
  evaluateBalloonShotResult,
  simulateRingTossTrajectory,
  stepCrowdVisitorAI,
  computeSpatialAudioGain,
  detectFestivalZone,
  createInitialDayNightState,
  stepDayNightCycle,
  evaluateWorldPhysicsModifiers,
  createInitialInteractiveParticles,
  stepInteractiveAtmosphereParticles,
  cubicEaseInOut,
  computeHandheldBreathing,
  evaluateVistaFramingOffset,
  computeTargetGameplayFov,
  computeCorneringDutchRoll,
  computeSpringArmDesiredPose,
  resolveWhiskerCollisionDistance,
  computeStarWhiskerOffsets,
  resolveMultiWhiskerCollisionDistance,
  type ChallengerState,
} from './rules';

test('clampDelta clamps negative, NaN, and large deltas to [0, 0.05]', () => {
  assert.equal(clampDelta(-0.2), 0);
  assert.equal(clampDelta(Number.NaN), 0);
  assert.equal(clampDelta(0.016), 0.016);
  assert.equal(clampDelta(0.45), 0.05);
});

test('calculateSplashScore applies combo and weakness multipliers accurately', () => {
  const normal = calculateSplashScore(100, 2, false);
  assert.equal(normal.pointsEarned, 200);
  assert.equal(normal.nextCombo, 3);
  assert.ok(normal.coinsEarned >= 5);

  const weakness = calculateSplashScore(100, 2, true);
  assert.equal(weakness.pointsEarned, 300);
  assert.equal(weakness.nextCombo, 3);
});

test('evaluateRoundOutcome detects victory, defeat, and ongoing play', () => {
  assert.equal(
    evaluateRoundOutcome({
      spiritPips: 0,
      revelersSplashed: 4,
      targetRevelers: 8,
      diyasLit: 2,
      targetDiyas: 4,
    }),
    'defeat'
  );

  assert.equal(
    evaluateRoundOutcome({
      spiritPips: 3,
      revelersSplashed: 8,
      targetRevelers: 8,
      diyasLit: 4,
      targetDiyas: 4,
    }),
    'victory'
  );

  assert.equal(
    evaluateRoundOutcome({
      spiritPips: 4,
      revelersSplashed: 6,
      targetRevelers: 8,
      diyasLit: 4,
      targetDiyas: 4,
    }),
    'playing'
  );
});

test('calculatePlayerLevel computes level and percentage progress', () => {
  const lvl1 = calculatePlayerLevel(125);
  assert.equal(lvl1.level, 1);
  assert.equal(lvl1.progressPct, 50);

  const lvl3 = calculatePlayerLevel(550);
  assert.equal(lvl3.level, 3);
  assert.equal(lvl3.currentLevelXp, 50);
});

test('stepChallengerAI executes distinct movement policies and windup telegraphs', () => {
  const baseSprinter: ChallengerState = {
    id: 1,
    archetype: 'sprinter',
    x: 10,
    z: 0,
    vx: 0,
    vz: 0,
    hp: 60,
    maxHp: 60,
    state: 'seek',
    stateTimer: 0,
    targetX: 0,
    targetZ: 0,
    orbitSign: 1,
    hitFlashTimer: 0,
    koProgress: 0,
    weaknessColor: 'gulabi',
  };

  // Sprinter chases toward player at (0,0)
  const step1 = stepChallengerAI(baseSprinter, 0, 0, 0.05, true);
  assert.ok(step1.updated.x < 10, 'Sprinter should move closer to player');

  // Lobber too close (< 9m) kites away from player
  const closeLobber: ChallengerState = {
    ...baseSprinter,
    id: 2,
    archetype: 'lobber',
    x: 5,
    z: 0,
  };
  const lobberStep = stepChallengerAI(closeLobber, 0, 0, 0.05, false);
  assert.ok(lobberStep.updated.x > 5, 'Lobber inside minimum range should kite away');

  // Sprinter within attack range acquires token and enters windup telegraph
  const nearSprinter: ChallengerState = {
    ...baseSprinter,
    x: 2.5,
    z: 0,
  };
  const telegraphStep = stepChallengerAI(nearSprinter, 0, 0, 0.05, true);
  assert.equal(telegraphStep.startedTelegraph, true);
  assert.equal(telegraphStep.updated.state, 'windup');
});

test('scoreRangoliSymmetry rewards symmetric 4-quadrant patterns', () => {
  const grid = Array.from({ length: 5 }, () => Array(5).fill(0));
  grid[0][0] = 2;
  grid[0][4] = 2;
  grid[4][0] = 2;
  grid[4][4] = 2;
  grid[2][2] = 3;

  const result = scoreRangoliSymmetry(grid);
  assert.equal(result.filledCells, 5);
  assert.ok(result.symmetryScore >= 80);
  assert.ok(result.coinsReward > 25);
});

test('mergeRealtimeDelta preserves omitted fields and clears explicit null (DATA-MERGE-001)', () => {
  const existing = {
    player_id: 'p1',
    display_name: 'Aarav',
    equipped_title: 'Braj Explorer',
    party_id: 'party-99' as string | null,
  };
  const merged = mergeRealtimeDelta(existing, {
    party_id: null,
  });
  assert.equal(merged.display_name, 'Aarav');
  assert.equal(merged.equipped_title, 'Braj Explorer');
  assert.equal(merged.party_id, null);
});

test('evaluateLocationConfidence gates uncertain GPS readings out of HIGH_CONFIDENCE (HW-GPS-001)', () => {
  const uncertain = evaluateLocationConfidence({
    accuracyMeters: 65,
    distanceMeters: 20,
    geofenceRadiusMeters: 50,
    sampleAgeMs: 2000,
    samplesInWindow: 4,
  });
  assert.notEqual(uncertain.status, 'HIGH_CONFIDENCE');
  assert.equal(uncertain.status, 'MEDIUM_CONFIDENCE');
  assert.equal(uncertain.requireOtp, true);
});

test('findBestAutoAimTarget locks onto nearest valid target in range', () => {
  const res = findBestAutoAimTarget(
    0,
    0,
    Math.PI,
    [
      { x: 0, z: -6, priorityWeight: 1.2 },
      { x: 12, z: 12, priorityWeight: 1.0 },
    ],
    18
  );
  assert.ok(res !== null);
  assert.equal(res?.targetX, 0);
  assert.equal(res?.targetZ, -6);
});

test('evaluateRhythmTap rewards on-beat taps with SAM_PERFECT and preserves forgiving floor', () => {
  const perf = evaluateRhythmTap(0.05, 3);
  assert.equal(perf.grade, 'SAM_PERFECT');
  assert.equal(perf.nextStreak, 4);
  assert.ok(perf.coins >= 30);

  const offBeat = evaluateRhythmTap(0.35, 2);
  assert.equal(offBeat.grade, 'UTSAV_BEAT');
  assert.ok(offBeat.coins >= 10);
});

test('stepHomingProjectile steers projectile velocity toward nearby target', () => {
  const initial = { x: 0, z: 0, vx: 0, vz: -30, speed: 30 };
  const target = { x: 6, z: -8 };
  const stepped = stepHomingProjectile(initial, [target], 0.05, 14);
  assert.ok(stepped.vx > 0, 'Projectile should steer right (+X) toward target');
  assert.ok(stepped.z < 0, 'Projectile should advance forward (-Z) toward target');
});

test('computeSoftMagnetReticle pulls reticle softly toward nearest target and intensifies when firing', () => {
  const candidates = [
    {
      id: 'rev-1',
      kind: 'reveler' as const,
      label: 'Braj Sprinter',
      weaknessColor: 'gulabi' as const,
      x: 4,
      z: -6,
      priorityWeight: 1.4,
    },
  ];

  const hoverRes = computeSoftMagnetReticle({
    rawAimX: 1,
    rawAimZ: -4,
    playerX: 0,
    playerZ: 4,
    playerYaw: Math.PI,
    isFiring: false,
    candidates,
  });

  const fireRes = computeSoftMagnetReticle({
    rawAimX: 1,
    rawAimZ: -4,
    playerX: 0,
    playerZ: 4,
    playerYaw: Math.PI,
    isFiring: true,
    candidates,
  });

  assert.equal(hoverRes.lockedTarget?.id, 'rev-1');
  assert.ok(hoverRes.reticleX > 1 && hoverRes.reticleX < 4);
  assert.ok(fireRes.magnetStrength > hoverRes.magnetStrength);
  assert.ok(
    Math.hypot(fireRes.reticleX - 4, fireRes.reticleZ - -6) <
      Math.hypot(hoverRes.reticleX - 4, hoverRes.reticleZ - -6)
  );
});

test('evaluateComboVisualState scales up and intensifies glow as consecutive hits increase', () => {
  const baseState = evaluateComboVisualState(1, 0, 0);
  const midState = evaluateComboVisualState(4, 3, 0.75);
  const maxState = evaluateComboVisualState(10, 12, 0.95);

  assert.equal(baseState.tierId, 'calm');
  assert.equal(baseState.scaleFactor, 1.0);
  assert.equal(baseState.isGlowing, false);

  assert.equal(midState.tierId, 'blazing');
  assert.ok(midState.scaleFactor > baseState.scaleFactor);
  assert.ok(midState.glowIntensity > baseState.glowIntensity);
  assert.equal(midState.isGlowing, true);
  assert.equal(midState.timerPct, 75);

  assert.equal(maxState.tierId, 'mahotsav_legend');
  assert.ok(maxState.scaleFactor > midState.scaleFactor);
  assert.ok(maxState.glowIntensity > midState.glowIntensity);
  assert.equal(maxState.multiplier, 10);
});

test('evaluateAdaptiveDifficulty scales NPC movement speed and reaction frequency based on hit accuracy', () => {
  const newcomer = evaluateAdaptiveDifficulty([false, false, true, false, false], 5);
  const balanced = evaluateAdaptiveDifficulty([true, false, true, false, true], 5);
  const veteran = evaluateAdaptiveDifficulty([true, true, true, true, true], 6);

  assert.equal(newcomer.tierId, 'accessible');
  assert.equal(balanced.tierId, 'balanced');
  assert.equal(veteran.tierId, 'veteran');

  assert.ok(newcomer.movementSpeedScale < balanced.movementSpeedScale);
  assert.ok(veteran.movementSpeedScale > balanced.movementSpeedScale);
  assert.ok(newcomer.reactionFrequencyScale < balanced.reactionFrequencyScale);
  assert.ok(veteran.reactionFrequencyScale > balanced.reactionFrequencyScale);

  const baseSprinter: ChallengerState = {
    id: 1,
    archetype: 'sprinter',
    x: 0,
    z: -3.0,
    vx: 0,
    vz: 0,
    hp: 80,
    maxHp: 80,
    state: 'seek',
    stateTimer: 0,
    targetX: 0,
    targetZ: 0,
    orbitSign: 1,
    hitFlashTimer: 0,
    koProgress: 0,
    weaknessColor: 'gulabi',
  };

  const steppedNewcomer = stepChallengerAI(baseSprinter, 0, 0, 0.05, true, 26, newcomer);
  const steppedVeteran = stepChallengerAI(baseSprinter, 0, 0, 0.05, true, 26, veteran);

  // Newcomer gets a longer windup telegraph window than Veteran
  assert.equal(steppedNewcomer.updated.state, 'windup');
  assert.equal(steppedVeteran.updated.state, 'windup');
  assert.ok(
    steppedNewcomer.updated.stateTimer > steppedVeteran.updated.stateTimer,
    'Newcomers should receive a longer windup telegraph window than veterans'
  );
});

test('triggerScreenShake and stepScreenShake produce subtle impact offsets for projectile hits and stronger shockwaves for bombs, decaying smoothly to zero', () => {
  const initial = createInitialScreenShakeState();
  const projectileHitShake = triggerScreenShake(initial, {
    traumaDelta: 0.25,
    dirX: 1,
    dirZ: -1,
    frequencyHz: 28,
  });
  const bombBlastShake = triggerScreenShake(initial, {
    traumaDelta: 0.68,
    dirX: 0,
    dirZ: -1,
    verticalKick: 0.24,
    frequencyHz: 18,
  });

  const stepProj = stepScreenShake(projectileHitShake, 0.016);
  const stepBomb = stepScreenShake(bombBlastShake, 0.016);

  assert.ok(
    Math.hypot(stepProj.offsetX, stepProj.offsetY) > 0,
    'Projectile hit produces non-zero subtle camera shake offset'
  );
  assert.ok(
    Math.hypot(stepBomb.offsetX, stepBomb.offsetY) >
      Math.hypot(stepProj.offsetX, stepProj.offsetY),
    'Bomb explosion produces stronger camera shake offset than a single projectile hit'
  );
  assert.ok(Math.abs(stepBomb.rollRad) > Math.abs(stepProj.rollRad));

  // Verify decay back to rest over time
  let s = bombBlastShake;
  for (let i = 0; i < 30; i++) {
    s = stepScreenShake(s, 0.05).state;
  }
  const settled = stepScreenShake(s, 0.016);
  assert.equal(settled.state.trauma, 0);
  assert.equal(settled.offsetX, 0);
  assert.equal(settled.offsetY, 0);
  assert.equal(settled.rollRad, 0);
});

test('recordKarmaAction and stepKarmaState track positive deeds and award Divine Blessings that boost speed and shield strength', () => {
  const initial = createInitialKarmaState();
  // First diya lit grants immediate introductory Garuda Vega speed blessing
  const afterFirstDiya = recordKarmaAction(initial, 'light_diya');
  assert.equal(afterFirstDiya.triggeredNewBlessing, true);
  assert.equal(afterFirstDiya.state.activeBlessingId, 'garuda_vega');
  assert.equal(afterFirstDiya.state.diyasLitDeeds, 1);

  const steppedSpeed = stepKarmaState(afterFirstDiya.state, 0.05);
  assert.ok(steppedSpeed.speedMultiplier > 1.3, 'Garuda Vega boosts movement speed by +35%');

  // Helping an NPC grants Brahma Kavach (2x Shield Strength)
  const afterNpcHelp = recordKarmaAction(steppedSpeed.state, 'help_npc');
  assert.equal(afterNpcHelp.triggeredNewBlessing, true);
  assert.equal(afterNpcHelp.state.activeBlessingId, 'brahma_kavach');
  assert.equal(afterNpcHelp.state.npcsHelpedDeeds, 1);

  const steppedShield = stepKarmaState(afterNpcHelp.state, 0.05);
  assert.equal(
    steppedShield.shieldDurationMultiplier,
    2.0,
    'Brahma Kavach doubles shield duration'
  );
  assert.ok(
    steppedShield.shieldCooldownMultiplier < 0.5,
    'Brahma Kavach halves shield cooldown'
  );
});

test('computeRideCabinCameraPose computes distinct 1st-person cabin positions in Carnival Ride Grounds (x: 38, z: -25) with 360 look offsets', () => {
  const wheel0 = computeRideCabinCameraPose('giant_wheel', 0, 0, 0);
  const wheel5 = computeRideCabinCameraPose('giant_wheel', 5, 0, 0);
  assert.notEqual(wheel0.camY, wheel5.camY, 'Giant wheel cabin altitude changes over time');
  assert.ok(wheel0.camX > 30, 'Giant wheel is zoned in East Carnival Ride Grounds (x: 38)');

  const wheelLookRight = computeRideCabinCameraPose('giant_wheel', 0, Math.PI / 2, 0.25);
  assert.notEqual(wheel0.lookX, wheelLookRight.lookX, '360 yaw offset rotates gondola look target');
  assert.notEqual(wheel0.lookY, wheelLookRight.lookY, 'Pitch offset tilts gondola look target');

  const carouselPose = computeRideCabinCameraPose('carousel', 2.5);
  assert.ok(carouselPose.camY > 1.5 && carouselPose.camY < 5.0);

  const boatPose = computeRideCabinCameraPose('columbus_boat', 1.2);
  assert.ok(
    Math.abs(boatPose.swingAngleRad) > 0,
    'Columbus boat imparts pendulum swing angle'
  );
});

test('evaluateBalloonShotResult and simulateRingTossTrajectory award accurate Mini-Game Tickets', () => {
  const balloonRes = evaluateBalloonShotResult(10, 9, 6);
  assert.equal(balloonRes.accuracyPct, 90);
  assert.ok(balloonRes.ticketsAwarded >= 25);
  assert.equal(balloonRes.gradeLabel, 'SHAHI NISHANEBAZ (SHARPSHOOTER)');

  const ringRes = simulateRingTossTrajectory(
    0,
    26,
    [
      {
        id: 'peg_center',
        label: 'Brass Kalash Peg',
        x: 0,
        z: 2.5,
        ticketValue: 8,
        accentHex: '#FBBF24',
      },
    ],
    0.55
  );
  assert.ok(ringRes.capturedPeg !== null, 'Calibrated ring toss lands on center peg');
  assert.equal(ringRes.ticketsWon, 8);
});

test('stepCrowdVisitorAI and computeSpatialAudioGain handle autonomous crowd walking and 3D audio falloff', () => {
  const steppedVisitor = stepCrowdVisitorAI(
    {
      id: 1,
      x: 15,
      z: 0,
      vx: 0,
      vz: 0,
      targetX: 15,
      targetZ: 5,
      speed: 2.0,
      stridePhase: 0,
      paletteIndex: 0,
    },
    [{ x: 0, z: 0, radius: 2 }],
    0.1
  );
  assert.ok(steppedVisitor.z > 0, 'Visitor advances toward target waypoint');

  const nearAudio = computeSpatialAudioGain(0, 0, 0, 0, -5, 30);
  const farAudio = computeSpatialAudioGain(0, 0, 0, 0, -40, 30);
  assert.ok(nearAudio.gain > 0.6, 'Near sound emitter has strong gain');
  assert.equal(farAudio.gain, 0, 'Emitter beyond maxDistance has zero gain');
});

test('detectFestivalZone and stepDayNightCycle shift lighting and atmosphere across celestial phases and zone dwell time', () => {
  assert.equal(detectFestivalZone(0, 0, 'holi_braj', false), 'sanctum_plaza');
  assert.equal(detectFestivalZone(38, -25, 'mela_central', false), 'carnival_grounds');
  assert.equal(detectFestivalZone(-24, -10, 'mela_central', false), 'meena_bazaar');
  assert.equal(detectFestivalZone(8, 12, 'diwali_ghat', false), 'sacred_groves');
  assert.equal(detectFestivalZone(0, 0, 'mela_central', true), 'carnival_grounds');

  let state = createInitialDayNightState('holi_braj');
  let lastAtmosphere = stepDayNightCycle(state, {
    dt: 0.05,
    playerX: 0,
    playerZ: 0,
    activeWorld: 'holi_braj',
  }).atmosphere;

  // Spend time in Meena Bazaar and verify dwell time and zone influence increase
  for (let i = 0; i < 60; i++) {
    const res = stepDayNightCycle(state, {
      dt: 0.05,
      playerX: -22,
      playerZ: -12,
      activeWorld: 'mela_central',
    });
    state = res.state;
    lastAtmosphere = res.atmosphere;
  }

  assert.equal(lastAtmosphere.zoneId, 'meena_bazaar');
  assert.ok(state.activeZoneDwellSec >= 2.9, 'Dwell timer accumulates in Meena Bazaar');
  assert.ok(lastAtmosphere.zoneInfluencePct > 35, 'Zone atmospheric influence grows with dwell time');

  // Lock to Day phase and verify sunlit atmosphere vs Night phase starlit atmosphere
  let dayState = state;
  for (let i = 0; i < 40; i++) {
    dayState = stepDayNightCycle(dayState, {
      dt: 0.05,
      playerX: 0,
      playerZ: 0,
      activeWorld: 'holi_braj',
      overrideMode: 'day',
    }).state;
  }
  const daySnap = stepDayNightCycle(dayState, {
    dt: 0.05,
    playerX: 0,
    playerZ: 0,
    activeWorld: 'holi_braj',
    overrideMode: 'day',
  }).atmosphere;

  let nightState = state;
  for (let i = 0; i < 40; i++) {
    nightState = stepDayNightCycle(nightState, {
      dt: 0.05,
      playerX: 38,
      playerZ: -25,
      activeWorld: 'mela_central',
      overrideMode: 'night',
    }).state;
  }
  const nightSnap = stepDayNightCycle(nightState, {
    dt: 0.05,
    playerX: 38,
    playerZ: -25,
    activeWorld: 'mela_central',
    overrideMode: 'night',
  }).atmosphere;

  assert.equal(daySnap.phaseId, 'day');
  assert.equal(daySnap.zenithHex, 0x2b82d9);
  assert.equal(daySnap.midSkyHex, 0x7cc2f5);
  assert.equal(daySnap.horizonHex, 0xf7d4b2);
  assert.equal(daySnap.fogHex, 0xf4c29f);
  assert.equal(daySnap.fogDensity, 0.0012);
  assert.equal(daySnap.sunColorHex, 0xfff1d0);
  assert.equal(daySnap.sunIntensity, 2.0);
  assert.equal(daySnap.hemiIntensity, 0.45);
  assert.equal(daySnap.ambientIntensity, 0.45);
  assert.equal(daySnap.toneMappingExposure, 0.75);
  assert.equal(daySnap.bloomStrength, 0.08);
  assert.equal(daySnap.bloomThreshold, 0.96);
  assert.equal(nightSnap.phaseId, 'night');
  assert.equal(nightSnap.bloomStrength, 0.34);
  assert.equal(nightSnap.bloomThreshold, 0.88);
  assert.ok(daySnap.sunIntensity > nightSnap.sunIntensity, 'Day has stronger solar intensity than Night');
  assert.ok(nightSnap.starVisibility > daySnap.starVisibility, 'Night has higher star visibility than Day');
  assert.ok(
    nightSnap.emissiveScale > daySnap.emissiveScale,
    'Night boosts lantern and fairy light emissive intensity over Day'
  );
});

test('evaluateWorldPhysicsModifiers applies Holi mud drag, Diwali river boat-bobbing, and Mela jump-padding platforms', () => {
  const holiMud = evaluateWorldPhysicsModifiers({
    activeWorld: 'holi_braj',
    playerX: -10.5,
    playerZ: 3.5,
    playerY: 0,
    elapsedSec: 1.0,
  });
  assert.equal(holiMud.inHoliMud, true);
  assert.ok(holiMud.speedMultiplier < 1.0, 'Holi mud slows player movement');

  const diwaliRiver = evaluateWorldPhysicsModifiers({
    activeWorld: 'diwali_ghat',
    playerX: 4.0,
    playerZ: 8.0,
    playerY: 0,
    elapsedSec: 1.2,
  });
  assert.equal(diwaliRiver.onDiwaliRiver, true);
  assert.notEqual(diwaliRiver.buoyancyYOffset, 0, 'Diwali river applies vertical boat-bobbing oscillation');

  const melaPad = evaluateWorldPhysicsModifiers({
    activeWorld: 'mela_central',
    playerX: 13.5,
    playerZ: 3.5,
    playerY: 0,
    elapsedSec: 2.0,
  });
  assert.ok(melaPad.activeJumpPad !== null, 'Mela Central Hub detects jump-padding platform');
  assert.ok(melaPad.activeJumpPad!.impulseY >= 14.0, 'Jump pad provides high vertical impulse');
});

test('stepInteractiveAtmosphereParticles generates Holi petal swirls by day and Diya flickers by night that respond to player proximity and movement', () => {
  const initial = createInitialInteractiveParticles(16);
  const targetParticle = initial[0];

  const holiStep = stepInteractiveAtmosphereParticles(initial, {
    dt: 0.05,
    elapsedSec: 1.0,
    playerX: targetParticle.x + 0.8,
    playerY: 0,
    playerZ: targetParticle.z + 0.6,
    playerSpeed: 8.5,
    activeWorld: 'holi_braj',
    phaseId: 'day',
  });
  assert.equal(holiStep.kind, 'holi_petal');
  assert.ok(
    holiStep.particles[0].swirlEnergy > 0,
    'Nearby Holi petal gains swirl energy when player moves close'
  );
  assert.ok(
    holiStep.particles[0].vy > 0,
    'Nearby Holi petal lifts upward in player wake'
  );

  const diwaliStep = stepInteractiveAtmosphereParticles(initial, {
    dt: 0.05,
    elapsedSec: 2.0,
    playerX: targetParticle.x + 0.5,
    playerY: 0,
    playerZ: targetParticle.z + 0.5,
    playerSpeed: 6.0,
    activeWorld: 'diwali_ghat',
    phaseId: 'night',
  });
  assert.equal(diwaliStep.kind, 'diya_flicker');
  assert.ok(
    diwaliStep.particles[0].swirlEnergy > 0,
    'Nearby Diya flicker responds to player proximity in Diwali Ghat'
  );
});

test('AAA Camera Director solvers compute cubic ease-in-out, vista framing, dynamic speed FOV, cornering dutch roll, spring-arm pose, and anti-clip whisker collision', () => {
  // 1. Cubic ease-in-out bounds and midpoint
  assert.equal(cubicEaseInOut(0), 0);
  assert.equal(cubicEaseInOut(0.5), 0.5);
  assert.equal(cubicEaseInOut(1), 1);

  // 2. Handheld breathing stays within ±0.08m vertical and ±0.004 rad roll
  for (let t = 0; t < 10; t += 0.35) {
    const breath = computeHandheldBreathing(t);
    assert.ok(Math.abs(breath.verticalOffsetM) <= 0.081);
    assert.ok(Math.abs(breath.rollRad) <= 0.0041);
  }

  // 3. Monument / Vista Auto-Framing within 22 units of Temple (0, -19) or Giant Wheel (38, -25)
  const farVista = evaluateVistaFramingOffset({
    playerX: 0,
    playerZ: 12,
    activeWorld: 'holi_braj',
  });
  assert.equal(farVista.vistaBlend, 0);
  assert.equal(farVista.extraDistance, 0);

  const nearTemple = evaluateVistaFramingOffset({
    playerX: 0,
    playerZ: -13,
    activeWorld: 'holi_braj',
  });
  assert.equal(nearTemple.nearestLandmark, 'temple');
  assert.equal(nearTemple.vistaBlend, 1);
  assert.equal(nearTemple.extraDistance, 3.0);
  assert.equal(nearTemple.extraLookAtY, 3.5);

  const nearWheel = evaluateVistaFramingOffset({
    playerX: 35,
    playerZ: -22,
    activeWorld: 'mela_central',
  });
  assert.equal(nearWheel.nearestLandmark, 'giant_wheel');
  assert.ok(nearWheel.extraDistance > 2.0);

  // 4. Dynamic Speed FOV (43 idle, 46 walk, 58 sprint/dash, -1.5 recoil dip)
  assert.equal(
    computeTargetGameplayFov({
      moveSpeed: 0,
      isSprintingOrDashing: false,
      fireRecoilTimerSec: 0,
    }),
    43
  );
  assert.equal(
    computeTargetGameplayFov({
      moveSpeed: 6.5,
      isSprintingOrDashing: false,
      fireRecoilTimerSec: 0,
    }),
    46
  );
  assert.equal(
    computeTargetGameplayFov({
      moveSpeed: 10.5,
      isSprintingOrDashing: true,
      fireRecoilTimerSec: 0,
    }),
    58
  );
  assert.equal(
    computeTargetGameplayFov({
      moveSpeed: 6.5,
      isSprintingOrDashing: false,
      fireRecoilTimerSec: 0.06,
    }),
    44.5
  );

  // 5. Cornering Dutch Roll clamped to ±0.043 rad (±2.5 degrees)
  const leftStrafeRoll = computeCorneringDutchRoll({
    strafeInputX: -1,
    yawRateRadPerSec: 0,
    moveSpeed: 7,
  });
  assert.ok(leftStrafeRoll > 0 && leftStrafeRoll <= 0.043);
  const straightRoll = computeCorneringDutchRoll({
    strafeInputX: 0,
    yawRateRadPerSec: 0,
    moveSpeed: 0,
  });
  assert.equal(straightRoll, 0);

  // 6. Over-The-Shoulder Spring-Arm Pose & Action Beats (Shield dolly +1.8m, Firework sky tilt +6.0m)
  const basePose = computeSpringArmDesiredPose({
    playerX: 0,
    playerY: 0,
    playerZ: 10,
    velocityX: 4,
    velocityZ: -4,
    activeWorld: 'holi_braj',
    shieldActive: false,
    fireworkLookUpTimerSec: 0,
    elapsedSec: 0,
  });
  assert.equal(basePose.desiredDistance, 5.2);
  assert.equal(basePose.desiredCamX, 0.65);

  const shieldFireworkPose = computeSpringArmDesiredPose({
    playerX: 0,
    playerY: 0,
    playerZ: 10,
    velocityX: 0,
    velocityZ: 0,
    activeWorld: 'holi_braj',
    shieldActive: true,
    fireworkLookUpTimerSec: 0.9,
    elapsedSec: 1.0,
  });
  assert.equal(shieldFireworkPose.desiredDistance, 7.0); // 5.2 + 1.8m shield dolly
  assert.ok(
    shieldFireworkPose.desiredLookAtY > basePose.desiredLookAtY + 5.5,
    'Firework launch tilts camera lookAt upward by +6.0 units at peak'
  );

  // 7. Anti-Clip Camera Collision Whisker pulls camera forward by d - 0.35
  assert.equal(resolveWhiskerCollisionDistance(5.2, null), 5.2);
  assert.equal(resolveWhiskerCollisionDistance(5.2, 3.35), 3.0);

  // 8. Dynamic Perlin-Style Camera Breathing (scales amplitude & cadence with movement and sprint)
  const idleBreath = computeHandheldBreathing(1.0, { moveSpeed: 0, isSprintingOrDashing: false });
  assert.ok(Math.abs(idleBreath.verticalOffsetM) <= 0.081, 'Idle vertical breathing stays within ±0.08m');
  assert.ok(Math.abs(idleBreath.rollRad) <= 0.0041, 'Idle roll breathing stays within ±0.004 rad');

  const sprintBreath = computeHandheldBreathing(1.0, { moveSpeed: 9.0, isSprintingOrDashing: true });
  assert.ok(
    Math.abs(sprintBreath.verticalOffsetM) > 0,
    'Sprint breathing produces distinct kinematic displacement'
  );

  // 9. 5-Ray Star Array Whisker Offsets & Multi-Whisker Resolution
  const starWhiskers = computeStarWhiskerOffsets(0); // Yaw 0 (facing +Z, right is +X)
  assert.equal(starWhiskers.length, 5);
  const whiskerIds = starWhiskers.map((w) => w.id);
  assert.deepEqual(whiskerIds, ['center', 'left', 'right', 'crown', 'ground']);

  const crownWhisker = starWhiskers.find((w) => w.id === 'crown')!;
  assert.equal(crownWhisker.anchorOffsetY, 0.4);
  const groundWhisker = starWhiskers.find((w) => w.id === 'ground')!;
  assert.equal(groundWhisker.anchorOffsetY, -0.35);

  // Multi-whisker picks the closest obstacle hit and applies safety margin (d - 0.35m)
  const safeDist = resolveMultiWhiskerCollisionDistance(5.2, [null, 4.2, 2.85, null, 3.8]);
  assert.equal(safeDist, 2.5); // 2.85 - 0.35 = 2.50m
});




