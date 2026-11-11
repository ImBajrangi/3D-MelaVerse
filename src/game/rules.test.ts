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






