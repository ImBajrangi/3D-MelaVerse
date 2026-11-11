// Pure, deterministic game logic, physics math, AI policies, and governance rules for MELAVERSE

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';
export type GameOutcome = 'none' | 'victory' | 'defeat';
export type FestivalWorldId = 'holi_braj' | 'diwali_ghat' | 'mela_central';
export type GulalColorId = 'gulabi' | 'haldi' | 'neel';
export type ArsenalModeId =
  | 'pichkari'
  | 'punch_kick'
  | 'balloon_throw'
  | 'hawai_rocket'
  | 'sutli_bomb';
export type ChallengerArchetype = 'sprinter' | 'lobber' | 'captain';

export interface ArsenalModeSpec {
  id: ArsenalModeId;
  key: '1' | '2' | '3' | '4' | '5';
  name: string;
  shortLabel: string;
  roleClue: string;
  hex: string;
  threeHex: number;
  cooldown: number;
  damage: number;
  blastRadius: number;
}

export const ARSENAL_MODES: Record<ArsenalModeId, ArsenalModeSpec> = {
  pichkari: {
    id: 'pichkari',
    key: '1',
    name: 'Brass Pichkari',
    shortLabel: 'Pichkari',
    roleClue: 'Pressurized Stream Jet',
    hex: '#E11D48',
    threeHex: 0xf43f5e,
    cooldown: 0.2,
    damage: 42,
    blastRadius: 2.0,
  },
  punch_kick: {
    id: 'punch_kick',
    key: '2',
    name: 'Punch & Kick',
    shortLabel: 'Punch/Kick',
    roleClue: 'Martial Lunge & Spin Kick',
    hex: '#F59E0B',
    threeHex: 0xfbbf24,
    cooldown: 0.22,
    damage: 62,
    blastRadius: 4.4,
  },
  balloon_throw: {
    id: 'balloon_throw',
    key: '3',
    name: 'Gubbara Throw',
    shortLabel: 'Throw',
    roleClue: '3-Arc Water Balloons',
    hex: '#0284C7',
    threeHex: 0x38bdf8,
    cooldown: 0.26,
    damage: 52,
    blastRadius: 3.8,
  },
  hawai_rocket: {
    id: 'hawai_rocket',
    key: '4',
    name: 'Hawai Rocket',
    shortLabel: 'Rocket',
    roleClue: 'Homing Firework Rocket',
    hex: '#9333EA',
    threeHex: 0xa855f7,
    cooldown: 0.32,
    damage: 80,
    blastRadius: 4.8,
  },
  sutli_bomb: {
    id: 'sutli_bomb',
    key: '5',
    name: 'Sutli Color Bomb',
    shortLabel: 'Bomb',
    roleClue: 'Mega AoE Shockwave',
    hex: '#059669',
    threeHex: 0x10b981,
    cooldown: 0.38,
    damage: 98,
    blastRadius: 6.5,
  },
};

export interface GulalWeaponSpec {
  id: GulalColorId;
  key: '1' | '2' | '3';
  name: string;
  roleClue: string;
  hex: string;
  threeHex: number;
  cooldown: number;
  speed: number;
  spreadCount: number;
  damage: number;
  range: number;
}

export const GULAL_WEAPONS: Record<GulalColorId, GulalWeaponSpec> = {
  gulabi: {
    id: 'gulabi',
    key: '1',
    name: 'Gulabi Burst',
    roleClue: 'Homing 3-Stream Spread',
    hex: '#E11D48',
    threeHex: 0xf43f5e,
    cooldown: 0.2,
    speed: 38,
    spreadCount: 3,
    damage: 38,
    range: 25,
  },
  haldi: {
    id: 'haldi',
    key: '2',
    name: 'Haldi Wave',
    roleClue: '5-Stream Arc & Ignites Diyas',
    hex: '#F59E0B',
    threeHex: 0xfbbf24,
    cooldown: 0.26,
    speed: 35,
    spreadCount: 5,
    damage: 32,
    range: 22,
  },
  neel: {
    id: 'neel',
    key: '3',
    name: 'Neel Pichkari',
    roleClue: 'High-Impact Homing Jet',
    hex: '#38BDF8',
    threeHex: 0x38bdf8,
    cooldown: 0.3,
    speed: 42,
    spreadCount: 1,
    damage: 65,
    range: 28,
  },
};

export interface ChallengerState {
  id: number;
  archetype: ChallengerArchetype;
  x: number;
  z: number;
  vx: number;
  vz: number;
  hp: number;
  maxHp: number;
  state: 'seek' | 'windup' | 'active' | 'recovery' | 'ko';
  stateTimer: number;
  targetX: number;
  targetZ: number;
  orbitSign: 1 | -1;
  hitFlashTimer: number;
  koProgress: number;
  weaknessColor: GulalColorId;
}

/**
 * Clamps raw delta time to prevent physics tunneling on tab switch or lag spikes.
 */
export function clampDelta(rawDt: number): number {
  if (!Number.isFinite(rawDt) || rawDt < 0) return 0;
  return Math.min(rawDt, 0.05);
}

/**
 * Calculates score, combo progression, Festival Coins, and XP on splashing a challenger.
 */
export function calculateSplashScore(
  basePoints: number,
  currentCombo: number,
  matchedWeakness: boolean
): {
  pointsEarned: number;
  nextCombo: number;
  coinsEarned: number;
  xpEarned: number;
} {
  const safeCombo = Math.max(1, Math.min(10, Math.floor(currentCombo)));
  const weaknessMultiplier = matchedWeakness ? 1.5 : 1.0;
  const pointsEarned = Math.round(basePoints * safeCombo * weaknessMultiplier);
  const nextCombo = Math.min(10, safeCombo + 1);
  const coinsEarned = Math.max(5, Math.round(pointsEarned / 15));
  const xpEarned = Math.max(10, Math.round(pointsEarned / 8));
  return { pointsEarned, nextCombo, coinsEarned, xpEarned };
}

/**
 * Evaluates whether the active Festival Celebration round is still playing, won, or lost.
 */
export function evaluateRoundOutcome(params: {
  spiritPips: number;
  revelersSplashed: number;
  targetRevelers: number;
  diyasLit: number;
  targetDiyas: number;
}): 'playing' | 'victory' | 'defeat' {
  if (params.spiritPips <= 0) {
    return 'defeat';
  }
  if (
    params.revelersSplashed >= params.targetRevelers &&
    params.diyasLit >= params.targetDiyas
  ) {
    return 'victory';
  }
  return 'playing';
}

/**
 * Calculates player level and progress bar percentage from total XP.
 */
export function calculatePlayerLevel(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(totalXp));
  const xpPerLevel = 250;
  const level = Math.floor(safeXp / xpPerLevel) + 1;
  const currentLevelXp = safeXp % xpPerLevel;
  const progressPct = Math.min(100, Math.round((currentLevelXp / xpPerLevel) * 100));
  return {
    level,
    currentLevelXp,
    nextLevelXp: xpPerLevel,
    progressPct,
  };
}

export type AdaptiveDifficultyTierId = 'accessible' | 'balanced' | 'veteran';

export interface AdaptiveDifficultyProfile {
  tierId: AdaptiveDifficultyTierId;
  label: string;
  accuracyPct: number;
  movementSpeedScale: number;
  reactionFrequencyScale: number;
  maxConcurrentAttackers: number;
}

/**
 * Evaluates the player's recent hit accuracy (and current vitality) to compute
 * adaptive movement speed and reaction frequency multipliers for NPC revelers.
 * - Newcomers (low accuracy) get gentler movement speeds (0.72x-0.86x) and slower reaction frequency (0.70x-0.85x).
 * - Veterans (high accuracy) face brisker movement speeds (1.12x-1.28x) and snappier reaction frequency (1.15x-1.35x).
 */
export function evaluateAdaptiveDifficulty(
  recentOutcomes: readonly boolean[],
  spiritPips = 6
): AdaptiveDifficultyProfile {
  const sampleCount = recentOutcomes.length;
  const rawAccuracy =
    sampleCount === 0
      ? 0.6
      : recentOutcomes.filter(Boolean).length / sampleCount;

  // Gentle newcomer assist if vitality is critically low (<= 2 pips)
  const vitalityPenalty = spiritPips <= 2 ? 0.15 : 0;
  const effectiveAccuracy = Math.max(
    0,
    Math.min(1, rawAccuracy - vitalityPenalty)
  );
  const accuracyPct = Math.round(rawAccuracy * 100);

  // Smoothly interpolate movementSpeedScale [0.74 .. 1.26] and reactionFrequencyScale [0.72 .. 1.32]
  const movementSpeedScale = Number(
    (0.74 + effectiveAccuracy * 0.52).toFixed(2)
  );
  const reactionFrequencyScale = Number(
    (0.72 + effectiveAccuracy * 0.6).toFixed(2)
  );

  if (effectiveAccuracy < 0.45) {
    return {
      tierId: 'accessible',
      label: 'SAHAJ · ACCESSIBLE',
      accuracyPct,
      movementSpeedScale,
      reactionFrequencyScale,
      maxConcurrentAttackers: 1,
    };
  }

  if (effectiveAccuracy >= 0.75 && sampleCount >= 3) {
    return {
      tierId: 'veteran',
      label: 'VEER · VETERAN',
      accuracyPct,
      movementSpeedScale,
      reactionFrequencyScale,
      maxConcurrentAttackers: 3,
    };
  }

  return {
    tierId: 'balanced',
    label: 'SAMTULYA · BALANCED',
    accuracyPct,
    movementSpeedScale,
    reactionFrequencyScale,
    maxConcurrentAttackers: 2,
  };
}

/**
 * Advances a festival challenger AI by one simulation step.
 * Implements 3 genuinely distinct movement & attack telegraph policies, scaled by the
 * Adaptive Difficulty Profile (movementSpeedScale & reactionFrequencyScale):
 * 1. 'sprinter': Fast close-range chaser with a crouch-ring windup telegraph before splashing.
 * 2. 'lobber': Ranged kiter that maintains 9-14m spacing, retreats if player approaches, and telegraphs a ground target ring.
 * 3. 'captain': Flanker / line-of-sight charger that orbits laterally and telegraphs a charge lane before dashing rapidly.
 */
export function stepChallengerAI(
  enemy: ChallengerState,
  playerX: number,
  playerZ: number,
  dt: number,
  canAcquireAttackToken: boolean,
  arenaRadius = 26,
  adaptiveScaling?: {
    movementSpeedScale?: number;
    reactionFrequencyScale?: number;
  }
): {
  updated: ChallengerState;
  triggeredAttack: boolean;
  startedTelegraph: boolean;
} {
  const next: ChallengerState = { ...enemy };
  let triggeredAttack = false;
  let startedTelegraph = false;

  const speedScale = Math.max(
    0.5,
    Math.min(1.6, adaptiveScaling?.movementSpeedScale ?? 1.0)
  );
  const reactionScale = Math.max(
    0.5,
    Math.min(1.6, adaptiveScaling?.reactionFrequencyScale ?? 1.0)
  );

  if (next.hitFlashTimer > 0) {
    next.hitFlashTimer = Math.max(0, next.hitFlashTimer - dt);
  }

  if (next.state === 'ko') {
    next.koProgress = Math.min(1, next.koProgress + dt * 2.8);
    next.x += next.vx * dt;
    next.z += next.vz * dt;
    next.vx *= Math.exp(-6 * dt);
    next.vz *= Math.exp(-6 * dt);
    return { updated: next, triggeredAttack: false, startedTelegraph: false };
  }

  const dx = playerX - next.x;
  const dz = playerZ - next.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const dirX = dx / dist;
  const dirZ = dz / dist;

  if (next.state === 'windup') {
    next.stateTimer -= dt;
    // Decelerate during windup telegraph
    next.vx *= Math.exp(-10 * dt);
    next.vz *= Math.exp(-10 * dt);
    if (next.stateTimer <= 0) {
      next.state = 'active';
      next.stateTimer = next.archetype === 'captain' ? 0.38 : 0.18;
      triggeredAttack = true;
      if (next.archetype === 'captain') {
        const chargeDx = next.targetX - next.x;
        const chargeDz = next.targetZ - next.z;
        const chargeLen = Math.hypot(chargeDx, chargeDz) || 1;
        const chargeSpeed = 18.5 * speedScale;
        next.vx = (chargeDx / chargeLen) * chargeSpeed;
        next.vz = (chargeDz / chargeLen) * chargeSpeed;
      }
    }
  } else if (next.state === 'active') {
    next.stateTimer -= dt;
    next.x += next.vx * dt;
    next.z += next.vz * dt;
    if (next.stateTimer <= 0) {
      next.state = 'recovery';
      const baseRecovery = next.archetype === 'captain' ? 0.85 : 0.65;
      next.stateTimer = baseRecovery / reactionScale;
      next.vx = 0;
      next.vz = 0;
    }
  } else if (next.state === 'recovery') {
    next.stateTimer -= dt;
    if (next.stateTimer <= 0) {
      next.state = 'seek';
    }
  } else {
    // 'seek' policy differs sharply by archetype and scales with adaptive difficulty
    if (next.archetype === 'sprinter') {
      const speed = 5.2 * speedScale;
      const tangentX = -dirZ * next.orbitSign;
      const tangentZ = dirX * next.orbitSign;
      const weave = dist > 4.2 ? 0.28 : 0.0;
      next.vx = (dirX * (1 - weave) + tangentX * weave) * speed;
      next.vz = (dirZ * (1 - weave) + tangentZ * weave) * speed;
      next.x += next.vx * dt;
      next.z += next.vz * dt;

      if (dist <= 3.4 && canAcquireAttackToken) {
        next.state = 'windup';
        next.stateTimer = 0.48 / reactionScale;
        next.targetX = playerX;
        next.targetZ = playerZ;
        startedTelegraph = true;
      }
    } else if (next.archetype === 'lobber') {
      // Kiter / ranged balloon lobber: prefers 9.5m to 13.5m range
      const idealMin = 9.0;
      const idealMax = 13.5;
      const speed = 4.2 * speedScale;
      let moveX = 0;
      let moveZ = 0;

      if (dist < idealMin) {
        // Kite away from player
        moveX = -dirX * speed;
        moveZ = -dirZ * speed;
      } else if (dist > idealMax) {
        // Approach into lobbing range
        moveX = dirX * speed;
        moveZ = dirZ * speed;
      } else {
        // Strafe tangentially around player
        moveX = -dirZ * next.orbitSign * (speed * 0.65);
        moveZ = dirX * next.orbitSign * (speed * 0.65);
      }

      next.vx = moveX;
      next.vz = moveZ;
      next.x += next.vx * dt;
      next.z += next.vz * dt;

      if (dist >= 6.0 && dist <= 15.0 && canAcquireAttackToken) {
        next.state = 'windup';
        next.stateTimer = 0.65 / reactionScale;
        next.targetX = playerX;
        next.targetZ = playerZ;
        startedTelegraph = true;
      }
    } else if (next.archetype === 'captain') {
      // Orbiting flanker & line-of-sight charger
      const speed = 4.6 * speedScale;
      const tangentX = -dirZ * next.orbitSign;
      const tangentZ = dirX * next.orbitSign;
      const approachWeight = dist > 7.5 ? 0.75 : 0.25;
      const orbitWeight = 1 - approachWeight;

      next.vx = (dirX * approachWeight + tangentX * orbitWeight) * speed;
      next.vz = (dirZ * approachWeight + tangentZ * orbitWeight) * speed;
      next.x += next.vx * dt;
      next.z += next.vz * dt;

      if (dist <= 9.5 && dist >= 3.5 && canAcquireAttackToken) {
        next.state = 'windup';
        next.stateTimer = 0.6 / reactionScale;
        // Aim slightly past player along line of sight
        next.targetX = playerX + dirX * 3.5;
        next.targetZ = playerZ + dirZ * 3.5;
        startedTelegraph = true;
      }
    }
  }

  // Keep inside circular courtyard perimeter
  const radialDist = Math.hypot(next.x, next.z);
  if (radialDist > arenaRadius) {
    const scale = arenaRadius / radialDist;
    next.x *= scale;
    next.z *= scale;
  }

  return { updated: next, triggeredAttack, startedTelegraph };
}

/**
 * Evaluates symmetry and coverage of a 9x9 Rangoli Studio grid.
 */
export function scoreRangoliSymmetry(grid: number[][]): {
  filledCells: number;
  symmetryScore: number;
  coinsReward: number;
  xpReward: number;
} {
  const size = grid.length;
  if (size === 0) {
    return { filledCells: 0, symmetryScore: 0, coinsReward: 0, xpReward: 0 };
  }

  let filledCells = 0;
  let symmetricMatches = 0;
  let totalChecks = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const val = grid[r][c];
      if (val > 0) {
        filledCells++;
        const mirrorR = size - 1 - r;
        const mirrorC = size - 1 - c;
        totalChecks += 3;
        if (grid[r][mirrorC] === val) symmetricMatches++;
        if (grid[mirrorR][c] === val) symmetricMatches++;
        if (grid[mirrorR][mirrorC] === val) symmetricMatches++;
      }
    }
  }

  if (filledCells === 0) {
    return { filledCells: 0, symmetryScore: 0, coinsReward: 0, xpReward: 0 };
  }

  const rawSymmetry = totalChecks > 0 ? symmetricMatches / totalChecks : 0;
  const coverageBonus = Math.min(1, filledCells / 25);
  const symmetryScore = Math.round((rawSymmetry * 0.75 + coverageBonus * 0.25) * 100);
  const coinsReward = Math.round(symmetryScore * 1.2) + 25;
  const xpReward = Math.round(symmetryScore * 1.5) + 40;

  return { filledCells, symmetryScore, coinsReward, xpReward };
}

/**
 * Rule SEC-AUTH-001: Strictly for UI hydration and anti-flicker rendering only.
 * Never use client role state to authorize sensitive server mutations.
 */
export function resolveDisplayRoleForHydration(
  serverProfile?: { role?: string } | null,
  cachedRole?: string | null
): string {
  if (serverProfile && serverProfile.role) return serverProfile.role;
  if (cachedRole) return cachedRole;
  return 'explorer';
}

/**
 * Rule DATA-MERGE-001: Non-destructive realtime delta merge (RFC 7396 semantics).
 * Omitted properties (undefined) remain untouched; explicit null clears the target field.
 */
export function mergeRealtimeDelta<T extends Record<string, unknown>>(
  existingRecord: T,
  deltaPayload: Partial<T> | null | undefined
): T {
  if (!existingRecord) return (deltaPayload ?? {}) as T;
  if (!deltaPayload) return existingRecord;

  const result: Record<string, unknown> = { ...existingRecord };
  for (const [key, value] of Object.entries(deltaPayload)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Rule HW-GPS-001: Multi-Factor Location Confidence for regional festival geofence check-ins.
 */
export function evaluateLocationConfidence({
  accuracyMeters,
  distanceMeters,
  geofenceRadiusMeters,
  sampleAgeMs,
  samplesInWindow,
  calibrationProfile = {
    accuracyWeight: 45,
    staleWeight: 30,
    jitterWeight: 15,
    distanceWeight: 50,
    staleAgeMs: 15000,
    highThreshold: 85,
    mediumThreshold: 50,
    isCalibrated: true,
  },
}: {
  accuracyMeters: number;
  distanceMeters: number;
  geofenceRadiusMeters: number;
  sampleAgeMs: number;
  samplesInWindow: number;
  calibrationProfile?: {
    accuracyWeight: number;
    staleWeight: number;
    jitterWeight: number;
    distanceWeight: number;
    staleAgeMs: number;
    highThreshold: number;
    mediumThreshold: number;
    isCalibrated: boolean;
  };
}): {
  status: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE';
  score: number;
  proceed: boolean;
  requireOtp?: boolean;
  error?: string;
} {
  let score = 100;

  const accuracyRatio = accuracyMeters / Math.max(1, geofenceRadiusMeters);
  if (accuracyRatio > 1.0) score -= calibrationProfile.accuracyWeight;
  else if (accuracyRatio > 0.5)
    score -= Math.round(calibrationProfile.accuracyWeight * 0.44);

  if (sampleAgeMs > calibrationProfile.staleAgeMs)
    score -= calibrationProfile.staleWeight;
  else if (sampleAgeMs > 5000)
    score -= Math.round(calibrationProfile.staleWeight * 0.33);

  if (samplesInWindow < 3) score -= calibrationProfile.jitterWeight;

  if (distanceMeters > geofenceRadiusMeters)
    score -= calibrationProfile.distanceWeight;

  if (score >= calibrationProfile.highThreshold) {
    return { status: 'HIGH_CONFIDENCE', score, proceed: true };
  }
  if (score >= calibrationProfile.mediumThreshold) {
    return { status: 'MEDIUM_CONFIDENCE', score, proceed: false, requireOtp: true };
  }
  return {
    status: 'LOW_CONFIDENCE',
    score,
    proceed: false,
    error: 'Uncertain GPS signal for regional festival portal',
  };
}

/**
 * Smart Magnetic Aim Assistant:
 * Finds the best nearby Challenger or unlit Sacred Diya within maxRange so
 * pressing Space or clicking effortlessly aims toward the most helpful target.
 */
export function findBestAutoAimTarget(
  playerX: number,
  playerZ: number,
  playerYaw: number,
  candidates: { x: number; z: number; priorityWeight?: number }[],
  maxRange = 34
): { targetYaw: number; targetX: number; targetZ: number } | null {
  let bestScore = Infinity;
  let bestCandidate: { x: number; z: number } | null = null;

  const lookX = Math.sin(playerYaw);
  const lookZ = Math.cos(playerYaw);

  for (const c of candidates) {
    const dx = c.x - playerX;
    const dz = c.z - playerZ;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1 || dist > maxRange) continue;

    const dirX = dx / dist;
    const dirZ = dz / dist;
    const dot = lookX * dirX + lookZ * dirZ;
    // Gentle angle preference so any target in the arena locks on reliably
    const anglePenalty = (1 - dot) * 1.8;
    const weight = c.priorityWeight ?? 1;
    const effectiveCost = (dist + anglePenalty) / weight;

    if (effectiveCost < bestScore) {
      bestScore = effectiveCost;
      bestCandidate = c;
    }
  }

  if (!bestCandidate) return null;

  const targetYaw = Math.atan2(
    bestCandidate.x - playerX,
    bestCandidate.z - playerZ
  );
  return {
    targetYaw,
    targetX: bestCandidate.x,
    targetZ: bestCandidate.z,
  };
}

/**
 * Steers an active Gulal projectile strongly toward its nearest target (Challenger or unlit Diya)
 * so shots curve in mid-air and effortlessly connect even against moving targets.
 */
export function stepHomingProjectile(
  proj: { x: number; z: number; vx: number; vz: number; speed: number },
  targets: { x: number; z: number }[],
  dt: number,
  homingStrength = 14
): { x: number; z: number; vx: number; vz: number } {
  let nearest: { x: number; z: number } | null = null;
  let minDist = 22;

  for (const t of targets) {
    const d = Math.hypot(t.x - proj.x, t.z - proj.z);
    if (d < minDist) {
      minDist = d;
      nearest = t;
    }
  }

  let vx = proj.vx;
  let vz = proj.vz;

  if (nearest && minDist > 0.05) {
    const desiredVx = ((nearest.x - proj.x) / minDist) * proj.speed;
    const desiredVz = ((nearest.z - proj.z) / minDist) * proj.speed;
    const blend = Math.min(1, homingStrength * dt);
    vx = vx + (desiredVx - vx) * blend;
    vz = vz + (desiredVz - vz) * blend;
    const spd = Math.hypot(vx, vz) || 1;
    vx = (vx / spd) * proj.speed;
    vz = (vz / spd) * proj.speed;
  }

  return {
    x: proj.x + vx * dt,
    z: proj.z + vz * dt,
    vx,
    vz,
  };
}

/**
 * Evaluates a player's beat tap in the Dhol & Dandiya Rhythm Mini-Game.
 * Designed to be forgiving and celebratory: every tap earns coins & XP, with bonus multipliers on beat sync.
 */
export function evaluateRhythmTap(beatPhaseZeroToOne: number, currentStreak: number): {
  grade: 'SAM_PERFECT' | 'TAAL_GOOD' | 'UTSAV_BEAT';
  points: number;
  coins: number;
  xp: number;
  nextStreak: number;
} {
  const distToBeat = Math.min(
    Math.abs(beatPhaseZeroToOne),
    Math.abs(1 - beatPhaseZeroToOne)
  );

  const safeStreak = Math.max(1, Math.min(12, currentStreak));

  if (distToBeat <= 0.14) {
    const nextStreak = Math.min(12, safeStreak + 1);
    return {
      grade: 'SAM_PERFECT',
      points: 150 * nextStreak,
      coins: 25 + nextStreak * 3,
      xp: 35 + nextStreak * 4,
      nextStreak,
    };
  }
  if (distToBeat <= 0.28) {
    const nextStreak = Math.min(12, safeStreak + 1);
    return {
      grade: 'TAAL_GOOD',
      points: 100 * nextStreak,
      coins: 15 + nextStreak * 2,
      xp: 25 + nextStreak * 2,
      nextStreak,
    };
  }
  return {
    grade: 'UTSAV_BEAT',
    points: 60,
    coins: 10,
    xp: 15,
    nextStreak: Math.max(1, safeStreak),
  };
}

export interface MagnetTargetCandidate {
  id: string;
  kind: 'reveler' | 'diya';
  label: string;
  weaknessColor?: GulalColorId;
  x: number;
  z: number;
  priorityWeight?: number;
}

export interface SoftMagnetReticleResult {
  reticleX: number;
  reticleZ: number;
  aimYaw: number;
  magnetStrength: number;
  lockedTarget: MagnetTargetCandidate | null;
}

/**
 * Soft 'Magnet' Target Acquisition System:
 * Smoothly pulls the aiming reticle toward the nearest Challenger Reveler or unlit Sacred Diya,
 * and surges magnetic pull when firing so hitting targets feels fluid, tactile, and effortless.
 */
export function computeSoftMagnetReticle(params: {
  rawAimX: number;
  rawAimZ: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  isFiring: boolean;
  candidates: MagnetTargetCandidate[];
  passiveRadius?: number;
  firingRadius?: number;
}): SoftMagnetReticleResult {
  const {
    rawAimX,
    rawAimZ,
    playerX,
    playerZ,
    playerYaw,
    isFiring,
    candidates,
    passiveRadius = 8.5,
    firingRadius = 24.0,
  } = params;

  const effectiveRadius = isFiring ? firingRadius : passiveRadius;

  let bestCandidate: MagnetTargetCandidate | null = null;
  let bestCost = Infinity;
  let bestCursorDist = Infinity;

  for (const c of candidates) {
    const cursorDist = Math.hypot(c.x - rawAimX, c.z - rawAimZ);
    const playerDist = Math.hypot(c.x - playerX, c.z - playerZ);
    if (cursorDist > effectiveRadius || playerDist > 26.5) continue;

    const weight = c.priorityWeight ?? 1.0;
    const cost = (cursorDist * 0.72 + playerDist * 0.28) / weight;
    if (cost < bestCost) {
      bestCost = cost;
      bestCandidate = c;
      bestCursorDist = cursorDist;
    }
  }

  // Fallback when firing if no candidate was inside cursor radius: pick closest valid candidate to player
  if (!bestCandidate && isFiring && candidates.length > 0) {
    for (const c of candidates) {
      const playerDist = Math.hypot(c.x - playerX, c.z - playerZ);
      if (playerDist > 26.5) continue;
      const weight = c.priorityWeight ?? 1.0;
      const cost = playerDist / weight;
      if (cost < bestCost) {
        bestCost = cost;
        bestCandidate = c;
        bestCursorDist = Math.hypot(c.x - rawAimX, c.z - rawAimZ);
      }
    }
  }

  if (!bestCandidate) {
    const dx = rawAimX - playerX;
    const dz = rawAimZ - playerZ;
    const aimYaw =
      Math.hypot(dx, dz) > 0.1 ? Math.atan2(dx, dz) : playerYaw;
    return {
      reticleX: rawAimX,
      reticleZ: rawAimZ,
      aimYaw,
      magnetStrength: 0,
      lockedTarget: null,
    };
  }

  const normalizedProximity = Math.max(
    0,
    Math.min(1, 1 - bestCursorDist / Math.max(0.1, effectiveRadius))
  );

  // Soft pull (0.42..0.82) while aiming; strong pull (0.84..0.98) when firing
  const magnetStrength = isFiring
    ? Math.min(0.98, 0.84 + 0.14 * normalizedProximity)
    : 0.42 + 0.4 * normalizedProximity;

  const reticleX = rawAimX + (bestCandidate.x - rawAimX) * magnetStrength;
  const reticleZ = rawAimZ + (bestCandidate.z - rawAimZ) * magnetStrength;
  const aimYaw = Math.atan2(
    reticleX - playerX,
    reticleZ - playerZ
  );

  return {
    reticleX,
    reticleZ,
    aimYaw,
    magnetStrength,
    lockedTarget: bestCandidate,
  };
}

export type ComboTierId =
  | 'calm'
  | 'rising'
  | 'blazing'
  | 'utsav_frenzy'
  | 'mahotsav_legend';

export interface ComboVisualState {
  multiplier: number;
  streakHits: number;
  tierId: ComboTierId;
  tierTitle: string;
  scaleFactor: number;
  glowIntensity: number;
  accentHex: string;
  glowRgba: string;
  timerPct: number;
  isGlowing: boolean;
}

/**
 * Computes deterministic growth scale, glow intensity, tier title, and color tokens
 * for the Visual Combo Multiplier UI component based on consecutive target hits.
 */
export function evaluateComboVisualState(
  rawCombo: number,
  rawStreakHits: number,
  rawTimerRatio: number
): ComboVisualState {
  const multiplier = Math.max(
    1,
    Math.min(10, Number.isFinite(rawCombo) ? Math.floor(rawCombo) : 1)
  );
  const streakHits = Math.max(
    0,
    Number.isFinite(rawStreakHits) ? Math.floor(rawStreakHits) : 0
  );
  const clampedTimerRatio = Math.max(
    0,
    Math.min(1, Number.isFinite(rawTimerRatio) ? rawTimerRatio : 0)
  );
  const timerPct = Math.round(clampedTimerRatio * 100);

  // Progressive scale growth from 1.00x (at 1x) up to 1.36x (at 10x)
  const normalizedProgress = (multiplier - 1) / 9;
  const scaleFactor = Number((1.0 + normalizedProgress * 0.36).toFixed(3));
  const glowIntensity = Number(
    (multiplier > 1 ? 0.25 + normalizedProgress * 0.75 : 0).toFixed(3)
  );
  const isGlowing = multiplier >= 2 || streakHits >= 1;

  if (multiplier >= 9) {
    return {
      multiplier,
      streakHits,
      tierId: 'mahotsav_legend',
      tierTitle: 'MAHOTSAV EMPEROR!',
      scaleFactor,
      glowIntensity,
      accentHex: '#FBBF24',
      glowRgba: 'rgba(251, 191, 36, 0.78)',
      timerPct,
      isGlowing,
    };
  }

  if (multiplier >= 6) {
    return {
      multiplier,
      streakHits,
      tierId: 'utsav_frenzy',
      tierTitle: 'BRAJ TOOFAN!!',
      scaleFactor,
      glowIntensity,
      accentHex: '#A855F7',
      glowRgba: 'rgba(168, 85, 247, 0.72)',
      timerPct,
      isGlowing,
    };
  }

  if (multiplier >= 4) {
    return {
      multiplier,
      streakHits,
      tierId: 'blazing',
      tierTitle: 'DHOLAK SURGE!',
      scaleFactor,
      glowIntensity,
      accentHex: '#F43F5E',
      glowRgba: 'rgba(244, 63, 94, 0.65)',
      timerPct,
      isGlowing,
    };
  }

  if (multiplier >= 2) {
    return {
      multiplier,
      streakHits,
      tierId: 'rising',
      tierTitle: 'RANG TARANG!',
      scaleFactor,
      glowIntensity,
      accentHex: '#38BDF8',
      glowRgba: 'rgba(56, 189, 248, 0.58)',
      timerPct,
      isGlowing,
    };
  }

  return {
    multiplier: 1,
    streakHits,
    tierId: 'calm',
    tierTitle: 'UTSAV SPARK',
    scaleFactor: 1.0,
    glowIntensity: 0,
    accentHex: '#F59E0B',
    glowRgba: 'rgba(245, 158, 11, 0.22)',
    timerPct,
    isGlowing,
  };
}

export interface ScreenShakeState {
  trauma: number;
  phase: number;
  impulseX: number;
  impulseY: number;
  impulseZ: number;
  frequencyHz: number;
}

export interface ScreenShakeOffsets {
  state: ScreenShakeState;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rollRad: number;
}

export function createInitialScreenShakeState(): ScreenShakeState {
  return {
    trauma: 0,
    phase: 0,
    impulseX: 0,
    impulseY: 0,
    impulseZ: 0,
    frequencyHz: 24,
  };
}

/**
 * Triggers a directional or radial screen-shake impulse:
 * - Projectile hit on reveler: subtle crisp impact (traumaDelta ~ 0.24..0.42, frequencyHz ~ 28)
 * - Sutli Bomb throw / detonation: deep shockwave rumble (traumaDelta ~ 0.20 on throw, 0.68 on detonation, frequencyHz ~ 19)
 */
export function triggerScreenShake(
  current: ScreenShakeState,
  params: {
    traumaDelta: number;
    dirX?: number;
    dirZ?: number;
    verticalKick?: number;
    frequencyHz?: number;
  }
): ScreenShakeState {
  const safeDelta = Number.isFinite(params.traumaDelta)
    ? Math.max(0, params.traumaDelta)
    : 0;
  const nextTrauma = Math.min(1.0, current.trauma + safeDelta);
  const dx = params.dirX ?? 0;
  const dz = params.dirZ ?? 0;
  const len = Math.hypot(dx, dz);
  const normX = len > 0.001 ? dx / len : 0;
  const normZ = len > 0.001 ? dz / len : 0;
  const kickScale = Math.min(0.35, safeDelta * 0.42);

  return {
    trauma: nextTrauma,
    phase: current.phase,
    impulseX: Math.max(-0.4, Math.min(0.4, current.impulseX + normX * kickScale)),
    impulseY: Math.max(
      -0.4,
      Math.min(0.4, current.impulseY + (params.verticalKick ?? safeDelta * 0.28))
    ),
    impulseZ: Math.max(-0.4, Math.min(0.4, current.impulseZ + normZ * kickScale)),
    frequencyHz: params.frequencyHz ?? current.frequencyHz,
  };
}

/**
 * Advances the harmonic + directional screen-shake state by dt seconds and returns
 * smooth positional (offsetX, offsetY, offsetZ) and rotational (rollRad) camera offsets.
 */
export function stepScreenShake(
  current: ScreenShakeState,
  dt: number
): ScreenShakeOffsets {
  const safeDt = clampDelta(dt);
  if (
    current.trauma <= 0.0005 &&
    Math.abs(current.impulseX) <= 0.0005 &&
    Math.abs(current.impulseY) <= 0.0005 &&
    Math.abs(current.impulseZ) <= 0.0005
  ) {
    return {
      state: {
        ...current,
        trauma: 0,
        impulseX: 0,
        impulseY: 0,
        impulseZ: 0,
      },
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rollRad: 0,
    };
  }

  const nextPhase =
    current.phase + safeDt * current.frequencyHz * Math.PI * 2;
  // Quadratic trauma curve ensures subtle hits feel gentle while heavy bombs feel punchy
  const shakePower = current.trauma * current.trauma;

  const waveX =
    Math.sin(nextPhase) * 0.65 + Math.cos(nextPhase * 1.73) * 0.35;
  const waveY =
    Math.cos(nextPhase * 1.31) * 0.65 + Math.sin(nextPhase * 2.17) * 0.35;
  const waveZ = Math.sin(nextPhase * 0.89) * 0.5;
  const waveRoll = Math.sin(nextPhase * 1.15);

  const offsetX = waveX * shakePower * 0.42 + current.impulseX;
  const offsetY = waveY * shakePower * 0.36 + current.impulseY;
  const offsetZ = waveZ * shakePower * 0.28 + current.impulseZ;
  const rollRad = waveRoll * shakePower * 0.024;

  const decayRate = 2.35;
  const damp = Math.exp(-14 * safeDt);

  return {
    state: {
      trauma: Math.max(0, current.trauma - safeDt * decayRate),
      phase: nextPhase,
      impulseX: current.impulseX * damp,
      impulseY: current.impulseY * damp,
      impulseZ: current.impulseZ * damp,
      frequencyHz: current.frequencyHz,
    },
    offsetX,
    offsetY,
    offsetZ,
    rollRad,
  };
}

export type DivineBlessingId =
  | 'garuda_vega'
  | 'brahma_kavach'
  | 'surya_tejas';

export type KarmaActionType =
  | 'light_diya'
  | 'help_npc'
  | 'sacred_offering';

export interface DivineBlessingSpec {
  id: DivineBlessingId;
  name: string;
  shortTitle: string;
  effectSummary: string;
  accentHex: string;
  threeHex: number;
  durationSec: number;
  speedMultiplier: number;
  shieldDurationMultiplier: number;
  shieldCooldownMultiplier: number;
  shieldRadiusMultiplier: number;
}

export const DIVINE_BLESSINGS: Record<DivineBlessingId, DivineBlessingSpec> = {
  garuda_vega: {
    id: 'garuda_vega',
    name: 'Garuda Vega',
    shortTitle: 'GARUDA VEGA · +35% SPEED',
    effectSummary: '+35% Movement & Dash Velocity',
    accentHex: '#FBBF24',
    threeHex: 0xfbbf24,
    durationSec: 10.0,
    speedMultiplier: 1.35,
    shieldDurationMultiplier: 1.15,
    shieldCooldownMultiplier: 0.85,
    shieldRadiusMultiplier: 1.2,
  },
  brahma_kavach: {
    id: 'brahma_kavach',
    name: 'Brahma Kavach',
    shortTitle: 'BRAHMA KAVACH · 2× SHIELD',
    effectSummary: '2× Water-Lotus Shield Duration & 4.8m Aegis',
    accentHex: '#38BDF8',
    threeHex: 0x38bdf8,
    durationSec: 10.0,
    speedMultiplier: 1.15,
    shieldDurationMultiplier: 2.0,
    shieldCooldownMultiplier: 0.45,
    shieldRadiusMultiplier: 1.6,
  },
  surya_tejas: {
    id: 'surya_tejas',
    name: 'Surya Tejas',
    shortTitle: 'SURYA TEJAS · SPEED + SHIELD',
    effectSummary: '+30% Speed & 1.85× Solar Shield Strength',
    accentHex: '#F43F5E',
    threeHex: 0xf43f5e,
    durationSec: 12.0,
    speedMultiplier: 1.3,
    shieldDurationMultiplier: 1.85,
    shieldCooldownMultiplier: 0.5,
    shieldRadiusMultiplier: 1.5,
  },
};

const BLESSING_ORDER: DivineBlessingId[] = [
  'garuda_vega',
  'brahma_kavach',
  'surya_tejas',
];

export interface KarmaState {
  karmaPoints: number;
  maxKarma: number;
  totalPositiveDeeds: number;
  diyasLitDeeds: number;
  npcsHelpedDeeds: number;
  activeBlessingId: DivineBlessingId | null;
  blessingRemainingSec: number;
  blessingTotalSec: number;
  blessingsGrantedCount: number;
  lastDeedLabel: string;
}

export function createInitialKarmaState(): KarmaState {
  return {
    karmaPoints: 0,
    maxKarma: 100,
    totalPositiveDeeds: 0,
    diyasLitDeeds: 0,
    npcsHelpedDeeds: 0,
    activeBlessingId: null,
    blessingRemainingSec: 0,
    blessingTotalSec: 10,
    blessingsGrantedCount: 0,
    lastDeedLabel: 'Light Diyas or Help Elders',
  };
}

/**
 * Records a positive Karma interaction (lighting a sacred diya, helping an NPC elder,
 * or completing a sacred offering). Awards unique Divine Blessings that boost
 * movement speed or shield strength.
 */
export function recordKarmaAction(
  current: KarmaState,
  action: KarmaActionType,
  customLabel?: string
): {
  state: KarmaState;
  triggeredNewBlessing: boolean;
  grantedBlessing: DivineBlessingSpec | null;
} {
  const deltaMap: Record<KarmaActionType, number> = {
    light_diya: 55,
    help_npc: 100,
    sacred_offering: 50,
  };
  const defaultLabelMap: Record<KarmaActionType, string> = {
    light_diya: '+55 Karma · Sacred Diya Lit',
    help_npc: '+100 Karma · Elder Helped',
    sacred_offering: '+50 Karma · Festival Offering',
  };

  const gain = deltaMap[action] ?? 50;
  const nextRawKarma = current.karmaPoints + gain;
  const nextTotalDeeds = current.totalPositiveDeeds + 1;
  const nextDiyas =
    current.diyasLitDeeds + (action === 'light_diya' ? 1 : 0);
  const nextNpcs =
    current.npcsHelpedDeeds + (action === 'help_npc' ? 1 : 0);

  // Trigger a full Divine Blessing when reaching maxKarma (100), OR grant an immediate
  // introductory Divine Blessing on the player's very first positive deed so feedback is instant!
  const shouldGrantFullBlessing =
    nextRawKarma >= current.maxKarma || current.totalPositiveDeeds === 0;

  if (shouldGrantFullBlessing) {
    // Select blessing based on deed type or cycle through Garuda Vega -> Brahma Kavach -> Surya Tejas
    const chosenId: DivineBlessingId =
      action === 'help_npc'
        ? 'brahma_kavach'
        : BLESSING_ORDER[current.blessingsGrantedCount % BLESSING_ORDER.length];
    const spec = DIVINE_BLESSINGS[chosenId];
    const carryOverKarma =
      nextRawKarma >= current.maxKarma
        ? nextRawKarma - current.maxKarma
        : nextRawKarma;

    return {
      state: {
        karmaPoints: Math.min(current.maxKarma - 5, carryOverKarma),
        maxKarma: current.maxKarma,
        totalPositiveDeeds: nextTotalDeeds,
        diyasLitDeeds: nextDiyas,
        npcsHelpedDeeds: nextNpcs,
        activeBlessingId: chosenId,
        blessingRemainingSec: spec.durationSec,
        blessingTotalSec: spec.durationSec,
        blessingsGrantedCount: current.blessingsGrantedCount + 1,
        lastDeedLabel: customLabel ?? defaultLabelMap[action],
      },
      triggeredNewBlessing: true,
      grantedBlessing: spec,
    };
  }

  return {
    state: {
      ...current,
      karmaPoints: Math.min(current.maxKarma, nextRawKarma),
      totalPositiveDeeds: nextTotalDeeds,
      diyasLitDeeds: nextDiyas,
      npcsHelpedDeeds: nextNpcs,
      lastDeedLabel: customLabel ?? defaultLabelMap[action],
    },
    triggeredNewBlessing: false,
    grantedBlessing: null,
  };
}

/**
 * Steps the active Divine Blessing timer and returns effective player speed and shield multipliers.
 */
export function stepKarmaState(
  current: KarmaState,
  dt: number
): {
  state: KarmaState;
  speedMultiplier: number;
  shieldDurationMultiplier: number;
  shieldCooldownMultiplier: number;
  shieldRadiusMultiplier: number;
} {
  const safeDt = clampDelta(dt);
  if (!current.activeBlessingId || current.blessingRemainingSec <= 0) {
    return {
      state:
        current.activeBlessingId !== null || current.blessingRemainingSec !== 0
          ? {
              ...current,
              activeBlessingId: null,
              blessingRemainingSec: 0,
            }
          : current,
      speedMultiplier: 1.0,
      shieldDurationMultiplier: 1.0,
      shieldCooldownMultiplier: 1.0,
      shieldRadiusMultiplier: 1.0,
    };
  }

  const spec = DIVINE_BLESSINGS[current.activeBlessingId];
  const nextRem = Math.max(0, current.blessingRemainingSec - safeDt);

  return {
    state: {
      ...current,
      activeBlessingId: nextRem > 0 ? current.activeBlessingId : null,
      blessingRemainingSec: nextRem,
    },
    speedMultiplier: spec.speedMultiplier,
    shieldDurationMultiplier: spec.shieldDurationMultiplier,
    shieldCooldownMultiplier: spec.shieldCooldownMultiplier,
    shieldRadiusMultiplier: spec.shieldRadiusMultiplier,
  };
}

/**
 * Interactive Mela Rides (Mount & Ride System):
 * Computes exact delta-time kinematic pose (world position + look target) for the player camera
 * when mounted on the Giant Wheel (Aakash Jhula), Carousel, or Columbus Swinging Boat.
 */
export interface MelaRidePlacement {
  id: 'giant_wheel' | 'carousel' | 'columbus_boat';
  name: string;
  hindiSubtitle: string;
  x: number;
  z: number;
  ticketCostCoins: number;
  interactionRadius: number;
}

export const MELA_RIDES: MelaRidePlacement[] = [
  {
    id: 'giant_wheel',
    name: 'Aakash Jhula (Giant Wheel)',
    hindiSubtitle: 'आकाश झूला · Sky Ferris Wheel',
    x: 38,
    z: -25,
    ticketCostCoins: 10,
    interactionRadius: 10.5,
  },
  {
    id: 'carousel',
    name: 'Rajwada Carousel (Merry-Go-Round)',
    hindiSubtitle: 'राजवाड़ा चकरी · Royal Carousel',
    x: 24,
    z: -34,
    ticketCostCoins: 10,
    interactionRadius: 8.0,
  },
  {
    id: 'columbus_boat',
    name: 'Samudra Nauka (Columbus Swinging Boat)',
    hindiSubtitle: 'समुद्र नौका · Swinging Pirate Ship',
    x: 42,
    z: -6,
    ticketCostCoins: 10,
    interactionRadius: 8.5,
  },
];

export interface MelaStallPlacement {
  id: 'balloon_shoot' | 'ring_toss' | 'prize_shop';
  name: string;
  promptLabel: string;
  x: number;
  z: number;
  interactionRadius: number;
}

export const MELA_STALLS: MelaStallPlacement[] = [
  {
    id: 'balloon_shoot',
    name: 'Gubbara Nishana (Balloon Shooting Stall)',
    promptLabel: 'Press E to Play Balloon Shoot (Earn Tickets)',
    x: -35,
    z: -20,
    interactionRadius: 6.8,
  },
  {
    id: 'ring_toss',
    name: 'Challa Pheko (Ring Toss Stall)',
    promptLabel: 'Press E to Play Ring Toss (Earn Tickets)',
    x: -35,
    z: -10,
    interactionRadius: 6.8,
  },
  {
    id: 'prize_shop',
    name: 'Shahi Inam Ghar (Mela Prize & Chaat Shop)',
    promptLabel: 'Press E to Redeem Tickets at Prize Shop',
    x: -32,
    z: 1,
    interactionRadius: 6.8,
  },
];

export function computeRideCabinCameraPose(
  rideId: 'giant_wheel' | 'carousel' | 'columbus_boat',
  elapsedSec: number,
  lookYawOffsetRad = 0,
  lookPitchOffsetRad = 0
): {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  wheelAngleRad: number;
  swingAngleRad: number;
} {
  const clampedPitch = Math.max(-0.85, Math.min(0.85, lookPitchOffsetRad));

  if (rideId === 'giant_wheel') {
    // Giant Wheel hub at (38, 12.5, -25) in Carnival Ride Grounds, radius 9.2m
    const angularSpeed = 0.48;
    const angle = elapsedSec * angularSpeed;
    const radius = 9.2;
    const hubX = 38;
    const hubY = 12.5;
    const hubZ = -25;

    const cabinX = hubX + Math.cos(angle) * radius;
    const cabinY = hubY + Math.sin(angle) * radius;
    const cabinZ = hubZ + 1.1;

    // Look out across the Central Sanctum Plaza & Meena Bazaar, with full 360° look-around
    const baseYaw = -0.72 + Math.sin(elapsedSec * 0.25) * 0.22 + lookYawOffsetRad;
    const lookDist = 28;
    const lookX = cabinX + Math.sin(baseYaw) * lookDist;
    const lookY = Math.max(2.2, cabinY * 0.55 + Math.sin(clampedPitch) * 14);
    const lookZ = cabinZ + Math.cos(baseYaw) * lookDist;

    return {
      camX: cabinX,
      camY: cabinY + 0.35,
      camZ: cabinZ,
      lookX,
      lookY,
      lookZ,
      wheelAngleRad: angle,
      swingAngleRad: 0,
    };
  }

  if (rideId === 'carousel') {
    // Carousel center at (24, 0, -34), radius 4.1m, bobbing horses
    const angularSpeed = 0.95;
    const angle = elapsedSec * angularSpeed;
    const radius = 4.1;
    const centerX = 24;
    const centerZ = -34;

    const seatX = centerX + Math.cos(angle) * radius;
    const seatZ = centerZ + Math.sin(angle) * radius;
    const bobY = 2.4 + Math.sin(elapsedSec * 3.2) * 0.38;

    const tangentAngle = angle + lookYawOffsetRad;
    const tangentX = -Math.sin(tangentAngle);
    const tangentZ = Math.cos(tangentAngle);

    return {
      camX: seatX,
      camY: bobY,
      camZ: seatZ,
      lookX: seatX + tangentX * 10 - 3,
      lookY: bobY - 0.15 + Math.sin(clampedPitch) * 6,
      lookZ: seatZ + tangentZ * 10 + 3,
      wheelAngleRad: angle,
      swingAngleRad: 0,
    };
  }

  // Columbus Swinging Boat at (42, 0, -6), pivot at Y = 11.5m, arm length 7.6m
  const pivotX = 42;
  const pivotY = 11.5;
  const pivotZ = -6;
  const armLength = 7.6;
  const maxSwingRad = 0.78;
  const swingAngle = Math.sin(elapsedSec * 1.65) * maxSwingRad;

  const deckX = pivotX;
  const deckY = pivotY - Math.cos(swingAngle) * armLength + 1.25;
  const deckZ = pivotZ + Math.sin(swingAngle) * armLength;

  return {
    camX: deckX - 0.6,
    camY: deckY,
    camZ: deckZ,
    lookX: Math.sin(lookYawOffsetRad) * 16,
    lookY: Math.max(2.5, deckY * 0.7 + Math.sin(clampedPitch) * 8),
    lookZ: deckZ + Math.cos(swingAngle) * 6 + Math.cos(lookYawOffsetRad) * 6,
    wheelAngleRad: 0,
    swingAngleRad: swingAngle,
  };
}

/**
 * Mini-Game 1: Balloon Shooting Stall Accuracy & Ticket Payout Calculator
 */
export function evaluateBalloonShotResult(
  shotsFired: number,
  balloonsPopped: number,
  bestStreak: number
): {
  accuracyPct: number;
  ticketsAwarded: number;
  coinsBonus: number;
  gradeLabel: string;
} {
  const safeShots = Math.max(1, shotsFired);
  const clampedHits = Math.max(0, Math.min(shotsFired, balloonsPopped));
  const accuracyPct =
    shotsFired === 0 ? 0 : Math.round((clampedHits / safeShots) * 100);

  const baseTickets = clampedHits * 2;
  const accuracyBonus = accuracyPct >= 80 ? 8 : accuracyPct >= 60 ? 4 : 0;
  const streakBonus = Math.floor(Math.max(0, bestStreak) / 3) * 2;
  const ticketsAwarded = Math.max(2, baseTickets + accuracyBonus + streakBonus);
  const coinsBonus = clampedHits * 5;

  const gradeLabel =
    accuracyPct >= 85
      ? 'SHAHI NISHANEBAZ (SHARPSHOOTER)'
      : accuracyPct >= 60
      ? 'USTAD SHOOTER'
      : 'MELA CHALLENGER';

  return {
    accuracyPct,
    ticketsAwarded,
    coinsBonus,
    gradeLabel,
  };
}

/**
 * Mini-Game 2: Ring Toss Stall Trajectory & Peg Capture Solver
 */
export interface RingTossPeg {
  id: string;
  label: string;
  x: number; // meters relative to stall center (-1.8 to +1.8)
  z: number; // distance from throw line (2.0 to 5.2m)
  ticketValue: number;
  accentHex: string;
}

export function simulateRingTossTrajectory(
  angleDeg: number, // -35 to +35 degrees
  powerPct: number, // 10 to 100%
  pegs: RingTossPeg[],
  captureRadius = 0.46
): {
  landingX: number;
  landingZ: number;
  capturedPeg: RingTossPeg | null;
  ticketsWon: number;
} {
  const clampedAngleDeg = Math.max(-40, Math.min(40, angleDeg));
  const clampedPower = Math.max(5, Math.min(100, powerPct));
  const angleRad = (clampedAngleDeg * Math.PI) / 180;

  // Map power [5..100] to throw distance [1.6m .. 5.6m]
  const throwDistance = 1.4 + (clampedPower / 100) * 4.2;
  const landingX = Number((Math.sin(angleRad) * throwDistance).toFixed(2));
  const landingZ = Number((Math.cos(angleRad) * throwDistance).toFixed(2));

  let bestPeg: RingTossPeg | null = null;
  let bestDist = Infinity;

  for (const peg of pegs) {
    const dist = Math.hypot(landingX - peg.x, landingZ - peg.z);
    if (dist <= captureRadius && dist < bestDist) {
      bestDist = dist;
      bestPeg = peg;
    }
  }

  return {
    landingX,
    landingZ,
    capturedPeg: bestPeg,
    ticketsWon: bestPeg ? bestPeg.ticketValue : 0,
  };
}

/**
 * Autonomous Mela Visitor Crowd AI (30+ visitors walking pathways with obstacle avoidance)
 */
export interface CrowdVisitorState {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  targetX: number;
  targetZ: number;
  speed: number;
  stridePhase: number;
  paletteIndex: number;
}

export function stepCrowdVisitorAI(
  visitor: CrowdVisitorState,
  obstacles: { x: number; z: number; radius: number }[],
  dt: number
): CrowdVisitorState {
  const safeDt = clampDelta(dt);
  let dx = visitor.targetX - visitor.x;
  let dz = visitor.targetZ - visitor.z;
  const distToTarget = Math.hypot(dx, dz);

  let nextTargetX = visitor.targetX;
  let nextTargetZ = visitor.targetZ;

  // Pick next waypoint along the Mela promenade ring when reaching current waypoint
  if (distToTarget < 1.8) {
    const currentAngle = Math.atan2(visitor.z, visitor.x);
    const nextAngle = currentAngle + 0.55 + (visitor.id % 3) * 0.18;
    const promenadeRadius = 14 + (visitor.id % 6) * 4.2;
    nextTargetX = Math.cos(nextAngle) * promenadeRadius;
    nextTargetZ = Math.sin(nextAngle) * promenadeRadius;
    dx = nextTargetX - visitor.x;
    dz = nextTargetZ - visitor.z;
  }

  const len = Math.max(0.001, Math.hypot(dx, dz));
  let steerX = dx / len;
  let steerZ = dz / len;

  // Obstacle repulsion (rides, stalls, central stage, player)
  for (const obs of obstacles) {
    const ox = visitor.x - obs.x;
    const oz = visitor.z - obs.z;
    const oDist = Math.hypot(ox, oz);
    const minSep = obs.radius + 1.2;
    if (oDist > 0.001 && oDist < minSep) {
      const push = (minSep - oDist) / minSep;
      steerX += (ox / oDist) * push * 2.6;
      steerZ += (oz / oDist) * push * 2.6;
    }
  }

  const steerLen = Math.max(0.001, Math.hypot(steerX, steerZ));
  const normX = steerX / steerLen;
  const normZ = steerZ / steerLen;

  const nextVx = normX * visitor.speed;
  const nextVz = normZ * visitor.speed;
  let nextX = visitor.x + nextVx * safeDt;
  let nextZ = visitor.z + nextVz * safeDt;

  // Keep inside expanded Mela perimeter (radius 54m)
  const radialDist = Math.hypot(nextX, nextZ);
  if (radialDist > 54) {
    nextX = (nextX / radialDist) * 54;
    nextZ = (nextZ / radialDist) * 54;
  }

  return {
    ...visitor,
    x: nextX,
    z: nextZ,
    vx: nextVx,
    vz: nextVz,
    targetX: nextTargetX,
    targetZ: nextTargetZ,
    stridePhase: visitor.stridePhase + visitor.speed * safeDt * 3.4,
  };
}

/**
 * 3D Spatial Audio Distance Attenuation & Stereo Pan Calculator
 */
export function computeSpatialAudioGain(
  listenerX: number,
  listenerZ: number,
  listenerYaw: number,
  sourceX: number,
  sourceZ: number,
  maxDistance = 42
): { gain: number; pan: number; distance: number } {
  const dx = sourceX - listenerX;
  const dz = sourceZ - listenerZ;
  const distance = Math.hypot(dx, dz);
  if (distance >= maxDistance) {
    return { gain: 0, pan: 0, distance };
  }

  // Inverse-square inspired smooth falloff
  const normalized = 1 - distance / maxDistance;
  const gain = Number((normalized * normalized).toFixed(3));

  // Right vector of listener from listenerYaw
  const rightX = Math.cos(listenerYaw);
  const rightZ = -Math.sin(listenerYaw);
  const dirX = distance > 0.001 ? dx / distance : 0;
  const dirZ = distance > 0.001 ? dz / distance : 0;
  const rawPan = dirX * rightX + dirZ * rightZ;
  const pan = Number(Math.max(-1, Math.min(1, rawPan)).toFixed(2));

  return { gain, pan, distance };
}
