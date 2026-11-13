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
 * Autonomous Mela Visitor Crowd AI (36+ procedural multi-part revelers with idle, greeting & celebratory emotes)
 */
export type CrowdBehaviorState =
  | 'strolling'
  | 'idle_chat'
  | 'admiring_player'
  | 'celebrate_cheer'
  | 'celebrate_dance'
  | 'celebrate_namaste';

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
  behaviorState?: CrowdBehaviorState;
  behaviorTimer?: number;
  emotePhase?: number;
  reactionCooldown?: number;
  facingYaw?: number;
  scaleFactor?: number;
}

export interface ProceduralCrowdPlayerContext {
  playerX: number;
  playerZ: number;
  playerSpeed: number;
  activeWorld: FestivalWorldId;
}

export interface CrowdMemberPose {
  pelvisY: number;
  yaw: number;
  torsoPitch: number;
  torsoRoll: number;
  headYaw: number;
  headPitch: number;
  leftArmX: number;
  leftArmZ: number;
  rightArmX: number;
  rightArmZ: number;
  strideSwing: number;
  dupattaTiltX: number;
  scale: number;
}

function wrapAngleRad(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

function pickWorldPromenadeWaypoint(
  id: number,
  x: number,
  z: number,
  activeWorld: FestivalWorldId,
  seedStep: number
): { targetX: number; targetZ: number } {
  if (activeWorld === 'diwali_ghat') {
    // Keep Diwali Ghat crowd safely on the Upper Sandstone Ghat Terrace (-26..26 x, -16..-10.8 z)
    const lanes = [-24, -17, -11, -6, 6, 11, 17, 24];
    const laneIdx = (id * 3 + seedStep) % lanes.length;
    const tx = lanes[laneIdx] + Math.sin(id * 1.7 + seedStep) * 2.2;
    const tz = -15.4 + ((id + seedStep * 2) % 4) * 1.15;
    return { targetX: tx, targetZ: tz };
  }
  const currentAngle = Math.atan2(z, x);
  const nextAngle = currentAngle + 0.55 + (id % 3) * 0.18;
  const promenadeRadius = 11.5 + (id % 6) * 3.8;
  return {
    targetX: Math.cos(nextAngle) * promenadeRadius,
    targetZ: Math.sin(nextAngle) * promenadeRadius,
  };
}

export function stepProceduralCrowdVisitor(
  visitor: CrowdVisitorState,
  obstacles: { x: number; z: number; radius: number }[],
  playerCtx: ProceduralCrowdPlayerContext,
  dt: number
): CrowdVisitorState {
  const safeDt = clampDelta(dt);
  const behavior: CrowdBehaviorState = visitor.behaviorState ?? 'strolling';
  let behaviorTimer = Math.max(0, (visitor.behaviorTimer ?? 0) - safeDt);
  let reactionCooldown = Math.max(0, (visitor.reactionCooldown ?? 0) - safeDt);
  const emotePhase = (visitor.emotePhase ?? visitor.id * 0.63) + safeDt;
  let nextBehavior: CrowdBehaviorState = behavior;
  let nextTargetX = visitor.targetX;
  let nextTargetZ = visitor.targetZ;

  // Keep visitor inside walkable Diwali Ghat upper terrace if world changed
  let curX = visitor.x;
  let curZ = visitor.z;
  if (playerCtx.activeWorld === 'diwali_ghat' && curZ > -10.5) {
    const wp = pickWorldPromenadeWaypoint(
      visitor.id,
      curX,
      -13.5,
      'diwali_ghat',
      1
    );
    curX = wp.targetX;
    curZ = wp.targetZ;
    nextTargetX = -wp.targetX * 0.5;
    nextTargetZ = wp.targetZ;
  }

  const toPlayerX = playerCtx.playerX - curX;
  const toPlayerZ = playerCtx.playerZ - curZ;
  const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

  // Trigger dynamic proximity reaction when player approaches within 8.5m
  if (
    behavior !== 'celebrate_cheer' &&
    behavior !== 'celebrate_dance' &&
    behavior !== 'celebrate_namaste' &&
    behavior !== 'admiring_player' &&
    distToPlayer < 8.5 &&
    reactionCooldown <= 0
  ) {
    nextBehavior =
      visitor.id % 3 === 0
        ? 'celebrate_namaste'
        : visitor.id % 3 === 1
        ? 'celebrate_cheer'
        : 'admiring_player';
    behaviorTimer = 2.6 + (visitor.id % 3) * 0.65;
    reactionCooldown = 9.0;
  } else if (behavior !== 'strolling' && behaviorTimer <= 0) {
    nextBehavior = 'strolling';
    const wp = pickWorldPromenadeWaypoint(
      visitor.id,
      curX,
      curZ,
      playerCtx.activeWorld,
      Math.floor(emotePhase)
    );
    nextTargetX = wp.targetX;
    nextTargetZ = wp.targetZ;
  }

  const isStationaryEmote =
    nextBehavior === 'idle_chat' ||
    nextBehavior === 'admiring_player' ||
    nextBehavior === 'celebrate_cheer' ||
    nextBehavior === 'celebrate_dance' ||
    nextBehavior === 'celebrate_namaste';

  let nextVx = visitor.vx;
  let nextVz = visitor.vz;
  let nextX = curX;
  let nextZ = curZ;
  let stridePhase = visitor.stridePhase;
  let desiredYaw = visitor.facingYaw ?? Math.atan2(visitor.vx || 0.01, visitor.vz || 1);

  if (isStationaryEmote) {
    const decay = Math.exp(-10 * safeDt);
    nextVx *= decay;
    nextVz *= decay;
    if (distToPlayer < 16) {
      desiredYaw = Math.atan2(toPlayerX, toPlayerZ);
    }
  } else {
    let dx = nextTargetX - curX;
    let dz = nextTargetZ - curZ;
    const distToTarget = Math.hypot(dx, dz);

    if (distToTarget < 1.8) {
      // 35% chance of pausing briefly for a natural courtyard chat
      if ((visitor.id + Math.floor(emotePhase * 2)) % 3 === 0 && reactionCooldown <= 4.0) {
        nextBehavior = 'idle_chat';
        behaviorTimer = 2.4 + (visitor.id % 4) * 0.55;
      } else {
        const wp = pickWorldPromenadeWaypoint(
          visitor.id,
          curX,
          curZ,
          playerCtx.activeWorld,
          Math.floor(emotePhase * 3) + 1
        );
        nextTargetX = wp.targetX;
        nextTargetZ = wp.targetZ;
        dx = nextTargetX - curX;
        dz = nextTargetZ - curZ;
      }
    }

    const len = Math.max(0.001, Math.hypot(dx, dz));
    let steerX = dx / len;
    let steerZ = dz / len;

    // Obstacle repulsion (rides, stalls, central stage, temple)
    for (const obs of obstacles) {
      const ox = curX - obs.x;
      const oz = curZ - obs.z;
      const oDist = Math.hypot(ox, oz);
      const minSep = obs.radius + 1.25;
      if (oDist > 0.001 && oDist < minSep) {
        const push = (minSep - oDist) / minSep;
        steerX += (ox / oDist) * push * 2.6;
        steerZ += (oz / oDist) * push * 2.6;
      }
    }

    // Soft personal space from player so crowd parts naturally around player
    if (distToPlayer > 0.001 && distToPlayer < 2.2) {
      const push = (2.2 - distToPlayer) / 2.2;
      steerX -= (toPlayerX / distToPlayer) * push * 2.4;
      steerZ -= (toPlayerZ / distToPlayer) * push * 2.4;
    }

    const steerLen = Math.max(0.001, Math.hypot(steerX, steerZ));
    const targetVx = (steerX / steerLen) * visitor.speed;
    const targetVz = (steerZ / steerLen) * visitor.speed;
    const velBlend = 1 - Math.exp(-8.5 * safeDt);
    nextVx = visitor.vx + (targetVx - visitor.vx) * velBlend;
    nextVz = visitor.vz + (targetVz - visitor.vz) * velBlend;
    nextX = curX + nextVx * safeDt;
    nextZ = curZ + nextVz * safeDt;

    if (playerCtx.activeWorld === 'diwali_ghat') {
      nextX = Math.max(-29, Math.min(29, nextX));
      nextZ = Math.max(-17.5, Math.min(-10.7, nextZ));
    } else {
      const radialDist = Math.hypot(nextX, nextZ);
      if (radialDist > 42) {
        nextX = (nextX / radialDist) * 42;
        nextZ = (nextZ / radialDist) * 42;
      }
    }

    if (Math.hypot(nextVx, nextVz) > 0.12) {
      desiredYaw = Math.atan2(nextVx, nextVz);
    }
    stridePhase += Math.hypot(nextVx, nextVz) * safeDt * 3.4;
  }

  const prevYaw = visitor.facingYaw ?? desiredYaw;
  const yawDiff = wrapAngleRad(desiredYaw - prevYaw);
  const nextYaw = wrapAngleRad(prevYaw + yawDiff * (1 - Math.exp(-7.5 * safeDt)));

  return {
    ...visitor,
    x: nextX,
    z: nextZ,
    vx: nextVx,
    vz: nextVz,
    targetX: nextTargetX,
    targetZ: nextTargetZ,
    stridePhase,
    behaviorState: nextBehavior,
    behaviorTimer,
    emotePhase,
    reactionCooldown,
    facingYaw: nextYaw,
    scaleFactor: visitor.scaleFactor ?? 0.92 + (visitor.id % 5) * 0.04,
  };
}

export function computeCrowdMemberPose(
  visitor: CrowdVisitorState,
  elapsedSec: number
): CrowdMemberPose {
  const behavior: CrowdBehaviorState = visitor.behaviorState ?? 'strolling';
  const phase = visitor.emotePhase ?? elapsedSec + visitor.id * 0.6;
  const speed = Math.hypot(visitor.vx, visitor.vz);
  const yaw = visitor.facingYaw ?? Math.atan2(visitor.vx || 0.01, visitor.vz || 1);
  const scale = visitor.scaleFactor ?? 1.0;

  let pelvisY = 0;
  let torsoPitch = 0;
  let torsoRoll = 0;
  let headYaw = 0;
  let headPitch = 0;
  let leftArmX = 0;
  let leftArmZ = 0.14;
  let rightArmX = 0;
  let rightArmZ = -0.14;
  let strideSwing = 0;
  let dupattaTiltX = 0.14;

  if (behavior === 'celebrate_cheer') {
    const bounce = Math.abs(Math.sin(phase * 7.2));
    pelvisY = bounce * 0.16;
    torsoPitch = -0.06;
    torsoRoll = Math.sin(phase * 3.6) * 0.07;
    headPitch = -0.14 + Math.sin(phase * 7.2) * 0.06;
    // Arms raised cheering overhead
    leftArmX = -2.45 + Math.sin(phase * 8.5) * 0.28;
    leftArmZ = 0.35 + Math.cos(phase * 4.2) * 0.12;
    rightArmX = -2.45 - Math.sin(phase * 8.5) * 0.28;
    rightArmZ = -0.35 - Math.cos(phase * 4.2) * 0.12;
    dupattaTiltX = 0.32 + bounce * 0.22;
  } else if (behavior === 'celebrate_dance') {
    // Festive Garba / Bhangra dance bounce + alternating shoulder pump
    const beat = phase * 6.4;
    pelvisY = Math.abs(Math.sin(beat)) * 0.14;
    torsoRoll = Math.sin(beat * 0.5) * 0.14;
    headYaw = Math.sin(beat * 0.5) * 0.22;
    leftArmX = -1.75 + Math.sin(beat) * 0.65;
    leftArmZ = 0.45 + Math.cos(beat) * 0.2;
    rightArmX = -1.75 - Math.sin(beat) * 0.65;
    rightArmZ = -0.45 - Math.cos(beat) * 0.2;
    strideSwing = Math.sin(beat * 0.5) * 0.28;
    dupattaTiltX = 0.28 + Math.abs(Math.cos(beat)) * 0.25;
  } else if (behavior === 'celebrate_namaste') {
    // Respectful Namaste bow toward player with hands brought together in front of chest
    const breathe = Math.sin(phase * 3.0);
    pelvisY = Math.abs(breathe) * 0.03;
    torsoPitch = 0.18;
    headPitch = 0.12;
    leftArmX = -1.05;
    leftArmZ = -0.42;
    rightArmX = -1.05;
    rightArmZ = 0.42;
    dupattaTiltX = 0.08;
  } else if (behavior === 'admiring_player') {
    pelvisY = Math.sin(phase * 2.6) * 0.025;
    headYaw = Math.sin(phase * 1.4) * 0.18;
    leftArmX = -0.25;
    leftArmZ = 0.22;
    rightArmX = -1.55 + Math.sin(phase * 5.2) * 0.22; // Friendly wave
    rightArmZ = -0.32;
  } else if (behavior === 'idle_chat') {
    pelvisY = Math.sin(phase * 2.1) * 0.022;
    torsoRoll = Math.sin(phase * 1.1) * 0.035;
    headYaw = Math.sin(phase * 1.8) * 0.24;
    headPitch = Math.cos(phase * 2.4) * 0.06;
    leftArmX = -0.35 + Math.sin(phase * 2.2) * 0.18;
    leftArmZ = 0.16;
    rightArmX = -0.45 + Math.cos(phase * 2.6) * 0.22;
    rightArmZ = -0.16;
  } else {
    // Strolling with natural stride bob & counter-swinging arms
    const walkActivity = Math.min(1, speed / 1.4);
    strideSwing = Math.sin(visitor.stridePhase) * 0.52 * walkActivity;
    pelvisY = Math.abs(Math.sin(visitor.stridePhase)) * 0.06 * walkActivity;
    torsoPitch = 0.05 * walkActivity;
    leftArmX = strideSwing * 0.85;
    rightArmX = -strideSwing * 0.85;
    dupattaTiltX = 0.14 + walkActivity * 0.24;
  }

  return {
    pelvisY,
    yaw,
    torsoPitch,
    torsoRoll,
    headYaw,
    headPitch,
    leftArmX,
    leftArmZ,
    rightArmX,
    rightArmZ,
    strideSwing,
    dupattaTiltX,
    scale,
  };
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

// ============================================================================
// DYNAMIC DAY-NIGHT CYCLE & FESTIVAL ZONE ATMOSPHERE ENGINE
// ============================================================================

export type FestivalZoneId =
  | 'sanctum_plaza'
  | 'carnival_grounds'
  | 'meena_bazaar'
  | 'sacred_groves';

export type DayNightPhaseId = 'dawn' | 'day' | 'dusk' | 'night';
export type DayNightCycleMode = 'auto' | DayNightPhaseId;

export interface FestivalZoneSpec {
  id: FestivalZoneId;
  name: string;
  shortLabel: string;
  atmosphereHint: string;
  targetPhaseAffinity: DayNightPhaseId;
  preferredTimeOfDay: number; // [0..1)
  warmthMultiplier: number;
  fogMultiplier: number;
  accentHex: string;
  tintHex: number;
}

export const FESTIVAL_ZONES: Record<FestivalZoneId, FestivalZoneSpec> = {
  sanctum_plaza: {
    id: 'sanctum_plaza',
    name: 'Sanctum Mandap & Rangoli Plaza',
    shortLabel: 'Sanctum Plaza',
    atmosphereHint: 'Sacred Aarti Gold · Warm Sandstone & Diya Glow',
    targetPhaseAffinity: 'dusk',
    preferredTimeOfDay: 0.62,
    warmthMultiplier: 1.22,
    fogMultiplier: 0.92,
    accentHex: '#F59E0B',
    tintHex: 0xff9e44,
  },
  carnival_grounds: {
    id: 'carnival_grounds',
    name: 'Aakash Jhula Carnival Grounds',
    shortLabel: 'Carnival Grounds',
    atmosphereHint: 'Starlit Mela Indigo · Neon Wheel & Electric Twilight',
    targetPhaseAffinity: 'night',
    preferredTimeOfDay: 0.86,
    warmthMultiplier: 1.08,
    fogMultiplier: 0.88,
    accentHex: '#EC4899',
    tintHex: 0xc084fc,
  },
  meena_bazaar: {
    id: 'meena_bazaar',
    name: 'Meena Bazaar & Craft Pavilions',
    shortLabel: 'Meena Bazaar',
    atmosphereHint: 'Silk Canopy Amber · Brass Lantern & Zari Warmth',
    targetPhaseAffinity: 'dusk',
    preferredTimeOfDay: 0.56,
    warmthMultiplier: 1.28,
    fogMultiplier: 0.95,
    accentHex: '#FB7185',
    tintHex: 0xf97316,
  },
  sacred_groves: {
    id: 'sacred_groves',
    name: 'Kadamba Groves & Riverside Ghat',
    shortLabel: 'Sacred Groves',
    atmosphereHint: 'Braj Sunlit Mist & River Ghat Reflections',
    targetPhaseAffinity: 'dawn',
    preferredTimeOfDay: 0.22,
    warmthMultiplier: 1.0,
    fogMultiplier: 1.12,
    accentHex: '#38BDF8',
    tintHex: 0x38bdf8,
  },
};

export interface DayNightPhaseKeyframe {
  id: DayNightPhaseId;
  sanskritName: string;
  label: string;
  centerTime: number; // [0..1)
  zenithHex: number;
  midSkyHex: number;
  horizonHex: number;
  fogHex: number;
  fogDensity: number;
  sunColorHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  ambientHex: number;
  ambientIntensity: number;
  rimLightHex: number;
  rimIntensity: number;
  pointLightIntensityScale: number;
  emissiveScale: number;
  starVisibility: number; // 0..1
  fireflyActivity: number; // 0..1
  toneMappingExposure: number;
}

export const DAY_NIGHT_KEYFRAMES: Record<DayNightPhaseId, DayNightPhaseKeyframe> = {
  dawn: {
    id: 'dawn',
    sanskritName: 'Usha · Saffron Dawn',
    label: 'Usha Dawn',
    centerTime: 0.125, // ~06:00
    zenithHex: 0x241b45,
    midSkyHex: 0x6b3054,
    horizonHex: 0xe87a54,
    fogHex: 0x42213d,
    fogDensity: 0.0015,
    sunColorHex: 0xffa66b,
    sunIntensity: 1.25,
    hemiSkyHex: 0xfca5a5,
    hemiGroundHex: 0x5c3422,
    hemiIntensity: 0.55,
    ambientHex: 0x4a2c40,
    ambientIntensity: 0.38,
    rimLightHex: 0xffb76b,
    rimIntensity: 1.18,
    pointLightIntensityScale: 0.72,
    emissiveScale: 0.85,
    starVisibility: 0.0,
    fireflyActivity: 0.35,
    toneMappingExposure: 0.75,
  },
  day: {
    id: 'day',
    sanskritName: 'Madhyahna · Golden-Hour Braj Sun',
    label: 'Madhyahna Day',
    centerTime: 0.375, // ~12:00
    zenithHex: 0x2b82d9,
    midSkyHex: 0x7cc2f5,
    horizonHex: 0xf7d4b2,
    fogHex: 0xf4c29f,
    fogDensity: 0.0012,
    sunColorHex: 0xfff1d0,
    sunIntensity: 2.0,
    hemiSkyHex: 0x7cc2f5,
    hemiGroundHex: 0xc27838,
    hemiIntensity: 0.45,
    ambientHex: 0xfff5eb,
    ambientIntensity: 0.45,
    rimLightHex: 0xffe099,
    rimIntensity: 0.65,
    pointLightIntensityScale: 0.0,
    emissiveScale: 0.15,
    starVisibility: 0.0,
    fireflyActivity: 0.0,
    toneMappingExposure: 0.75,
  },
  dusk: {
    id: 'dusk',
    sanskritName: 'Godhuli · Golden Aarti Sunset',
    label: 'Godhuli Dusk',
    centerTime: 0.625, // ~18:00
    zenithHex: 0x140c2c,
    midSkyHex: 0x4c1d4b,
    horizonHex: 0xd95338,
    fogHex: 0x2b132e,
    fogDensity: 0.0016,
    sunColorHex: 0xff7b29,
    sunIntensity: 1.18,
    hemiSkyHex: 0xfb923c,
    hemiGroundHex: 0x431f16,
    hemiIntensity: 0.52,
    ambientHex: 0x381c30,
    ambientIntensity: 0.3,
    rimLightHex: 0xff8c3b,
    rimIntensity: 1.32,
    pointLightIntensityScale: 1.08,
    emissiveScale: 1.45,
    starVisibility: 0.62,
    fireflyActivity: 0.82,
    toneMappingExposure: 0.9,
  },
  night: {
    id: 'night',
    sanskritName: 'Nishitha · Starlit Deepotsav',
    label: 'Nishitha Night',
    centerTime: 0.875, // ~22:00
    zenithHex: 0x090c26,
    midSkyHex: 0x161c46,
    horizonHex: 0x2c1f4e,
    fogHex: 0x0c0a20,
    fogDensity: 0.0018,
    sunColorHex: 0x6b7cff, // Cool silver-indigo moonlight
    sunIntensity: 0.82,
    hemiSkyHex: 0x6b7cff,
    hemiGroundHex: 0x3b1f14,
    hemiIntensity: 0.45,
    ambientHex: 0x241b38,
    ambientIntensity: 0.22,
    rimLightHex: 0xffa94d,
    rimIntensity: 0.98,
    pointLightIntensityScale: 1.35,
    emissiveScale: 2.15,
    starVisibility: 1.0,
    fireflyActivity: 1.0,
    toneMappingExposure: 0.9,
  },
};

export interface DayNightCycleState {
  timeOfDay: number; // Normalized [0, 1) where 0.125=Dawn, 0.375=Day, 0.625=Dusk, 0.875=Night
  mode: DayNightCycleMode;
  currentZone: FestivalZoneId;
  activeZoneDwellSec: number;
  zoneDwellTotals: Record<FestivalZoneId, number>;
  zoneInfluenceStrength: number; // [0..1] grows as player spends time in the current zone
}

export interface DayNightAtmosphereProfile {
  phaseId: DayNightPhaseId;
  sanskritLabel: string;
  shortPhaseLabel: string;
  clockLabel: string; // e.g. "18:24"
  timeOfDay: number;
  mode: DayNightCycleMode;
  zoneId: FestivalZoneId;
  zoneName: string;
  zoneShortLabel: string;
  zoneAtmosphereHint: string;
  zoneAccentHex: string;
  zoneDwellSec: number;
  zoneInfluencePct: number;
  zenithHex: number;
  midSkyHex: number;
  horizonHex: number;
  fogHex: number;
  fogDensity: number;
  sunColorHex: number;
  sunIntensity: number;
  sunPosition: { x: number; y: number; z: number };
  moonPosition: { x: number; y: number; z: number };
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  ambientHex: number;
  ambientIntensity: number;
  rimLightHex: number;
  rimIntensity: number;
  pointLightIntensityScale: number;
  emissiveScale: number;
  starVisibility: number;
  fireflyActivity: number;
  toneMappingExposure: number;
  bloomStrength: number;
  bloomThreshold: number;
}

function lerpHexColor(hexA: number, hexB: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const rA = (hexA >> 16) & 0xff;
  const gA = (hexA >> 8) & 0xff;
  const bA = hexA & 0xff;

  const rB = (hexB >> 16) & 0xff;
  const gB = (hexB >> 8) & 0xff;
  const bB = hexB & 0xff;

  const r = Math.round(rA + (rB - rA) * clamped);
  const g = Math.round(gA + (gB - gA) * clamped);
  const b = Math.round(bA + (bB - bA) * clamped);

  return (r << 16) | (g << 8) | b;
}

/**
 * Classifies the player's current 3D position and active world/ride into one of the 4 Festival Zones.
 */
export function detectFestivalZone(
  playerX: number,
  playerZ: number,
  activeWorld: FestivalWorldId = 'holi_braj',
  isMountedOnRide = false
): FestivalZoneId {
  if (isMountedOnRide || playerX >= 15.5) {
    return 'carnival_grounds';
  }
  if (playerX <= -13.5) {
    return 'meena_bazaar';
  }
  // In Diwali Ghat, stepping toward the riverside ghat steps (z >= 4.2) enters the Sacred Groves / Riverfront zone
  if (activeWorld === 'diwali_ghat' && playerZ >= 4.2) {
    return 'sacred_groves';
  }
  const distToSanctumOrRangoli = Math.min(
    Math.hypot(playerX, playerZ),
    Math.hypot(playerX, playerZ + 18)
  );
  if (distToSanctumOrRangoli <= 16.5) {
    return 'sanctum_plaza';
  }
  return 'sacred_groves';
}

/**
 * Creates the initial Day-Night Cycle state tailored to the starting festival world.
 */
export function createInitialDayNightState(
  activeWorld: FestivalWorldId = 'holi_braj'
): DayNightCycleState {
  // Holi Braj begins in radiant sunlit Indian daylight (0.375); Diwali Ghat in starlit Deepotsav night (0.875); Mela Hub in royal carnival night (0.82)
  const initialTime =
    activeWorld === 'holi_braj'
      ? 0.375
      : activeWorld === 'diwali_ghat'
      ? 0.875
      : 0.82;

  return {
    timeOfDay: initialTime,
    mode: 'auto',
    currentZone: 'sanctum_plaza',
    activeZoneDwellSec: 0,
    zoneDwellTotals: {
      sanctum_plaza: 0,
      carnival_grounds: 0,
      meena_bazaar: 0,
      sacred_groves: 0,
    },
    zoneInfluenceStrength: 0.25,
  };
}

export function formatTimeOfDayClock(timeOfDay: number): string {
  const wrapped = ((timeOfDay % 1) + 1) % 1;
  // Map [0..1) where 0.0 = 03:00, 0.125 = 06:00 (Dawn), 0.375 = 12:00 (Noon), 0.625 = 18:00 (Dusk), 0.875 = 24:00
  const totalHours = (wrapped * 24 + 3) % 24;
  const hours = Math.floor(totalHours);
  const minutes = Math.floor((totalHours - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function resolvePhaseIdFromTime(timeOfDay: number): DayNightPhaseId {
  const wrapped = ((timeOfDay % 1) + 1) % 1;
  // 07:00 corresponds to (7 - 3)/24 = 0.1667; 16:30 corresponds to (16.5 - 3)/24 = 0.5625
  if (wrapped < 4 / 24) return 'dawn';
  if (wrapped <= 13.5 / 24) return 'day';
  if (wrapped < 0.75) return 'dusk';
  return 'night';
}

/**
 * Advances the dynamic day-night cycle and computes the blended 3D lighting & atmosphere profile
 * based on both time progression and the zone where the player is spending time.
 */
export function stepDayNightCycle(
  prevState: DayNightCycleState,
  params: {
    dt: number;
    playerX: number;
    playerZ: number;
    activeWorld: FestivalWorldId;
    isMountedOnRide?: boolean;
    overrideMode?: DayNightCycleMode;
  }
): {
  state: DayNightCycleState;
  atmosphere: DayNightAtmosphereProfile;
} {
  const safeDt = clampDelta(params.dt);
  const nextZone = detectFestivalZone(
    params.playerX,
    params.playerZ,
    params.activeWorld,
    Boolean(params.isMountedOnRide)
  );

  const sameZone = nextZone === prevState.currentZone;
  const activeZoneDwellSec = sameZone
    ? prevState.activeZoneDwellSec + safeDt
    : safeDt;

  const nextTotals: Record<FestivalZoneId, number> = {
    ...prevState.zoneDwellTotals,
    [nextZone]: (prevState.zoneDwellTotals[nextZone] ?? 0) + safeDt,
  };

  // Zone influence builds up smoothly over ~8 seconds of dwelling in a festival zone
  const targetInfluence = Math.min(1, 0.2 + activeZoneDwellSec / 8.0);
  const zoneInfluenceStrength =
    prevState.zoneInfluenceStrength +
    (targetInfluence - prevState.zoneInfluenceStrength) *
      Math.min(1, safeDt * 2.5);

  const activeMode = params.overrideMode ?? prevState.mode;
  const zoneSpec = FESTIVAL_ZONES[nextZone];

  let nextTime = prevState.timeOfDay;
  if (activeMode === 'auto') {
    // Full base cycle every 10 minutes (600 seconds) of active play, plus gentle gravitational pull toward the zone's signature time of day as dwell increases
    const baseRatePerSec = 1 / 600;
    const deltaT = baseRatePerSec * safeDt;

    // Keep World 01: Holi — Braj anchored in radiant sunlit daytime (0.375) when in Sanctum Plaza / Sacred Groves
    const effectivePreferredTime =
      params.activeWorld === 'holi_braj' &&
      (nextZone === 'sanctum_plaza' || nextZone === 'sacred_groves')
        ? 0.375
        : zoneSpec.preferredTimeOfDay;

    // Shortest circular distance on [0, 1) toward the zone's preferred atmospheric hour
    let circularDiff = effectivePreferredTime - nextTime;
    if (circularDiff > 0.5) circularDiff -= 1;
    if (circularDiff < -0.5) circularDiff += 1;

    // Spending time in a zone gently accelerates the cycle toward that zone's signature lighting phase
    const zonePull =
      Math.abs(circularDiff) > 0.03
        ? circularDiff * 0.045 * zoneInfluenceStrength * safeDt
        : 0;
    nextTime = (((nextTime + deltaT + zonePull) % 1) + 1) % 1;
  } else {
    // Snap immediately when user selects a manual phase button (Dawn | Day | Dusk | Night), and hold steady at its canonical center time
    const targetCenter = DAY_NIGHT_KEYFRAMES[activeMode].centerTime;
    if (prevState.mode !== activeMode) {
      nextTime = targetCenter;
    } else {
      let diff = targetCenter - nextTime;
      if (diff > 0.5) diff -= 1;
      if (diff < -0.5) diff += 1;
      nextTime =
        Math.abs(diff) < 0.02
          ? targetCenter
          : (((nextTime + diff * Math.min(1, safeDt * 18.0)) % 1) + 1) % 1;
    }
  }

  // Interpolate between the 4 ordered keyframes: dawn (0.125), day (0.375), dusk (0.625), night (0.875)
  const orderedPhases: DayNightPhaseId[] = ['dawn', 'day', 'dusk', 'night'];
  const shifted = (((nextTime - 0.125) % 1) + 1) % 1; // 0 at dawn center, 0.25 at day, 0.5 at dusk, 0.75 at night
  const segmentFloat = shifted * 4;
  const idxA = Math.floor(segmentFloat) % 4;
  const idxB = (idxA + 1) % 4;
  const localT = segmentFloat - Math.floor(segmentFloat);
  // Smoothstep for silky lighting transitions
  const smoothT = localT * localT * (3 - 2 * localT);

  const kfA = DAY_NIGHT_KEYFRAMES[orderedPhases[idxA]];
  const kfB = DAY_NIGHT_KEYFRAMES[orderedPhases[idxB]];

  const lerpNum = (a: number, b: number) => a + (b - a) * smoothT;
  const phaseId = resolvePhaseIdFromTime(nextTime);

  // Preserve crisp radiant sky colors (#3a8ee6, #7ec8f8, #ffe0cc, fog #f5d6e0, sun #fff3d6 @ 2.4) across the Day window (07:00 to 16:30)
  const isDaytime = phaseId === 'day';
  const dayKf = DAY_NIGHT_KEYFRAMES.day;
  const zoneTintBlend = isDaytime ? 0 : zoneInfluenceStrength * 0.22;
  const zenithHex = isDaytime
    ? dayKf.zenithHex
    : lerpHexColor(
        lerpHexColor(kfA.zenithHex, kfB.zenithHex, smoothT),
        zoneSpec.tintHex,
        zoneTintBlend * 0.35
      );
  const midSkyHex = isDaytime
    ? dayKf.midSkyHex
    : lerpHexColor(
        lerpHexColor(kfA.midSkyHex, kfB.midSkyHex, smoothT),
        zoneSpec.tintHex,
        zoneTintBlend * 0.55
      );
  const horizonHex = isDaytime
    ? dayKf.horizonHex
    : lerpHexColor(
        lerpHexColor(kfA.horizonHex, kfB.horizonHex, smoothT),
        zoneSpec.tintHex,
        zoneTintBlend * 0.75
      );
  const fogHex = isDaytime
    ? dayKf.fogHex
    : lerpHexColor(
        lerpHexColor(kfA.fogHex, kfB.fogHex, smoothT),
        zoneSpec.tintHex,
        zoneTintBlend * 0.45
      );

  const sunColorHex = isDaytime
    ? dayKf.sunColorHex
    : lerpHexColor(
        lerpHexColor(kfA.sunColorHex, kfB.sunColorHex, smoothT),
        zoneSpec.tintHex,
        zoneTintBlend * 0.5
      );
  const hemiSkyHex = lerpHexColor(
    kfA.hemiSkyHex,
    kfB.hemiSkyHex,
    smoothT
  );
  const hemiGroundHex = lerpHexColor(
    kfA.hemiGroundHex,
    kfB.hemiGroundHex,
    smoothT
  );
  const ambientHex = lerpHexColor(kfA.ambientHex, kfB.ambientHex, smoothT);
  const rimLightHex = lerpHexColor(
    lerpHexColor(kfA.rimLightHex, kfB.rimLightHex, smoothT),
    zoneSpec.tintHex,
    zoneTintBlend * 0.65
  );

  // Compute 3D orbital arc for Sun and Moon across the festival sky
  // At dawn (0.125), sun rises in East (+X); at day (0.375), high overhead; at dusk (0.625), sets in West (-X)
  const solarAngle = (nextTime - 0.125) * Math.PI * 2;
  const orbitRadius = 62;
  const sunX = Math.cos(solarAngle) * orbitRadius;
  const sunY = Math.max(8, Math.sin(solarAngle) * 46 + 14);
  const sunZ = 18 + Math.sin(solarAngle * 0.5) * 14;

  const moonAngle = solarAngle + Math.PI;
  const moonX = Math.cos(moonAngle) * orbitRadius;
  const moonY = Math.max(12, Math.sin(moonAngle) * 44 + 16);
  const moonZ = 18 + Math.cos(moonAngle * 0.5) * 14;

  const phaseSpec = DAY_NIGHT_KEYFRAMES[phaseId];

  const nextState: DayNightCycleState = {
    timeOfDay: nextTime,
    mode: activeMode,
    currentZone: nextZone,
    activeZoneDwellSec,
    zoneDwellTotals: nextTotals,
    zoneInfluenceStrength,
  };

  const atmosphere: DayNightAtmosphereProfile = {
    phaseId,
    sanskritLabel: phaseSpec.sanskritName,
    shortPhaseLabel: phaseSpec.label,
    clockLabel: formatTimeOfDayClock(nextTime),
    timeOfDay: nextTime,
    mode: activeMode,
    zoneId: nextZone,
    zoneName: zoneSpec.name,
    zoneShortLabel: zoneSpec.shortLabel,
    zoneAtmosphereHint: zoneSpec.atmosphereHint,
    zoneAccentHex: zoneSpec.accentHex,
    zoneDwellSec: Math.round(activeZoneDwellSec),
    zoneInfluencePct: Math.round(zoneInfluenceStrength * 100),
    zenithHex,
    midSkyHex,
    horizonHex,
    fogHex,
    fogDensity: isDaytime
      ? dayKf.fogDensity
      : Number(
          (
            lerpNum(kfA.fogDensity, kfB.fogDensity) * zoneSpec.fogMultiplier
          ).toFixed(5)
        ),
    sunColorHex,
    sunIntensity: isDaytime
      ? dayKf.sunIntensity
      : Number(lerpNum(kfA.sunIntensity, kfB.sunIntensity).toFixed(3)),
    sunPosition: { x: sunX, y: sunY, z: sunZ },
    moonPosition: { x: moonX, y: moonY, z: moonZ },
    hemiSkyHex,
    hemiGroundHex,
    hemiIntensity: isDaytime
      ? dayKf.hemiIntensity
      : Number(lerpNum(kfA.hemiIntensity, kfB.hemiIntensity).toFixed(3)),
    ambientHex,
    ambientIntensity: isDaytime
      ? dayKf.ambientIntensity
      : Number(lerpNum(kfA.ambientIntensity, kfB.ambientIntensity).toFixed(3)),
    rimLightHex,
    rimIntensity: Number(
      (
        lerpNum(kfA.rimIntensity, kfB.rimIntensity) * zoneSpec.warmthMultiplier
      ).toFixed(3)
    ),
    pointLightIntensityScale: Number(
      (
        lerpNum(kfA.pointLightIntensityScale, kfB.pointLightIntensityScale) *
        zoneSpec.warmthMultiplier
      ).toFixed(3)
    ),
    emissiveScale: Number(
      lerpNum(kfA.emissiveScale, kfB.emissiveScale).toFixed(3)
    ),
    starVisibility: Number(
      lerpNum(kfA.starVisibility, kfB.starVisibility).toFixed(3)
    ),
    fireflyActivity: Number(
      lerpNum(kfA.fireflyActivity, kfB.fireflyActivity).toFixed(3)
    ),
    toneMappingExposure:
      phaseId === 'dawn' || phaseId === 'day'
        ? 0.75
        : Number(
            lerpNum(kfA.toneMappingExposure, kfB.toneMappingExposure).toFixed(3)
          ),
    bloomStrength: phaseId === 'dawn' || phaseId === 'day' ? 0.08 : 0.34,
    bloomThreshold: phaseId === 'dawn' || phaseId === 'day' ? 0.96 : 0.88,
  };

  return { state: nextState, atmosphere };
}

// ============================================================================
// WORLD-SPECIFIC GRAVITY & MOVEMENT PHYSICS MODIFIERS
// - World 01 (Holi — Braj): Grounded wet-color mud drag around Haudi vats & puddles
// - World 02 (Diwali — Ghat): Buoyant river boat-bobbing oscillation & gentle current
// - Mela Central Hub: Springy carnival jump-padding platforms with high vertical arc
// ============================================================================
export interface JumpPadPlatformSpec {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
  impulseY: number;
  colorHex: number;
}

export const MELA_JUMP_PAD_PLATFORMS: readonly JumpPadPlatformSpec[] = [
  {
    id: 'pad_plaza_east',
    label: 'Aakash Utsav Bounce Pad · East',
    x: 13.5,
    z: 3.5,
    radius: 2.25,
    impulseY: 14.8,
    colorHex: 0xf43f5e,
  },
  {
    id: 'pad_carnival_entry',
    label: 'Jhula Midway Launch Pad',
    x: 23.5,
    z: -10.5,
    radius: 2.35,
    impulseY: 15.6,
    colorHex: 0xfbbf24,
  },
  {
    id: 'pad_bazaar_arch',
    label: 'Meena Bazaar Spring Pad · West',
    x: -13.5,
    z: 3.5,
    radius: 2.25,
    impulseY: 14.8,
    colorHex: 0x38bdf8,
  },
] as const;

export const HOLI_MUD_PUDDLE_ZONES: readonly {
  x: number;
  z: number;
  radius: number;
}[] = [
  { x: -10.5, z: 3.5, radius: 4.2 },
  { x: 10.5, z: 3.5, radius: 4.2 },
  { x: -11.5, z: -13.5, radius: 4.2 },
  { x: 11.5, z: -13.5, radius: 4.2 },
  { x: 0.0, z: -6.5, radius: 3.6 },
] as const;

export interface WorldPhysicsModifiers {
  gravityScale: number;
  speedMultiplier: number;
  inHoliMud: boolean;
  onDiwaliRiver: boolean;
  buoyancyYOffset: number;
  riverDriftVx: number;
  activeJumpPad: JumpPadPlatformSpec | null;
}

export function evaluateWorldPhysicsModifiers(params: {
  activeWorld: FestivalWorldId;
  playerX: number;
  playerZ: number;
  playerY: number;
  elapsedSec: number;
}): WorldPhysicsModifiers {
  const { activeWorld, playerX, playerZ, playerY, elapsedSec } = params;

  if (activeWorld === 'holi_braj') {
    const inHoliMud =
      playerY <= 0.35 &&
      HOLI_MUD_PUDDLE_ZONES.some(
        (z) => Math.hypot(playerX - z.x, playerZ - z.z) <= z.radius
      );
    return {
      gravityScale: inHoliMud ? 1.18 : 1.0,
      speedMultiplier: inHoliMud ? 0.68 : 1.0,
      inHoliMud,
      onDiwaliRiver: false,
      buoyancyYOffset: 0,
      riverDriftVx: 0,
      activeJumpPad: null,
    };
  }

  if (activeWorld === 'diwali_ghat') {
    const onDiwaliRiver = playerZ >= -2.2;
    const buoyancyYOffset = onDiwaliRiver
      ? Math.sin(elapsedSec * 2.4 + playerX * 0.35) * 0.16 +
        Math.cos(elapsedSec * 1.7 + playerZ * 0.25) * 0.08
      : 0;
    const riverDriftVx = onDiwaliRiver
      ? Math.cos(elapsedSec * 0.45 + playerZ * 0.12) * 0.42
      : 0;
    return {
      gravityScale: onDiwaliRiver ? 0.78 : 1.0,
      speedMultiplier: onDiwaliRiver ? 0.92 : 1.0,
      inHoliMud: false,
      onDiwaliRiver,
      buoyancyYOffset,
      riverDriftVx,
      activeJumpPad: null,
    };
  }

  // mela_central: Check springy carnival jump-padding platforms
  const activeJumpPad =
    playerY <= 0.45
      ? MELA_JUMP_PAD_PLATFORMS.find(
          (pad) => Math.hypot(playerX - pad.x, playerZ - pad.z) <= pad.radius
        ) ?? null
      : null;

  return {
    gravityScale: 0.86,
    speedMultiplier: 1.04,
    inHoliMud: false,
    onDiwaliRiver: false,
    buoyancyYOffset: 0,
    riverDriftVx: 0,
    activeJumpPad,
  };
}

// ============================================================================
// PLAYER-RESPONSIVE ATMOSPHERIC PARTICLE SYSTEM
// ('Holi Petal Swirls' & 'Diya Flickers' responding to player proximity & movement)
// ============================================================================
export type InteractiveParticleKind = 'holi_petal' | 'diya_flicker';

export interface InteractiveAtmosphereParticle {
  id: number;
  anchorX: number;
  anchorZ: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  phase: number;
  swirlEnergy: number; // [0..1] boosted by player proximity and movement speed
  scale: number;
  colorIndex: number;
}

export function createInitialInteractiveParticles(
  count = 64
): InteractiveAtmosphereParticle[] {
  const list: InteractiveAtmosphereParticle[] = [];
  for (let i = 0; i < count; i++) {
    // Distribute across the courtyard and ghat walkways (radius 4..26m)
    const angle = i * 2.39996;
    const rad = 4.2 + ((i * 37) % 220) * 0.1;
    const ax = Math.cos(angle) * rad;
    const az = Math.sin(angle) * rad - 3.5;
    const baseY = 0.28 + ((i * 19) % 14) * 0.08;
    list.push({
      id: i,
      anchorX: ax,
      anchorZ: az,
      x: ax,
      y: baseY,
      z: az,
      vx: 0,
      vy: 0,
      vz: 0,
      phase: (i * 0.77) % (Math.PI * 2),
      swirlEnergy: 0,
      scale: 0.55 + (i % 4) * 0.12,
      colorIndex: i % 4,
    });
  }
  return list;
}

export function stepInteractiveAtmosphereParticles(
  particles: readonly InteractiveAtmosphereParticle[],
  params: {
    dt: number;
    elapsedSec: number;
    playerX: number;
    playerY: number;
    playerZ: number;
    playerSpeed: number;
    activeWorld: FestivalWorldId;
    phaseId: DayNightPhaseId;
  }
): {
  kind: InteractiveParticleKind;
  particles: InteractiveAtmosphereParticle[];
} {
  const safeDt = clampDelta(params.dt);
  const kind: InteractiveParticleKind =
    params.activeWorld === 'diwali_ghat' ||
    params.phaseId === 'night' ||
    params.phaseId === 'dusk'
      ? 'diya_flicker'
      : 'holi_petal';

  const proximityRadius = 8.5;
  const speedFactor = Math.min(2.2, 0.35 + params.playerSpeed * 0.18);

  const updated = particles.map((p) => {
    const dx = p.x - params.playerX;
    const dz = p.z - params.playerZ;
    const dist = Math.hypot(dx, dz);

    let nextEnergy = Math.max(0, p.swirlEnergy - safeDt * 0.85);
    let vx = p.vx * Math.exp(-3.2 * safeDt);
    let vy = p.vy * Math.exp(-2.8 * safeDt);
    let vz = p.vz * Math.exp(-3.2 * safeDt);

    if (dist < proximityRadius) {
      const proxRatio = 1 - dist / proximityRadius;
      nextEnergy = Math.min(1, nextEnergy + proxRatio * speedFactor * safeDt * 4.2);

      // Tangential swirl + gentle outward wake around the moving player
      const invDist = dist > 0.05 ? 1 / dist : 1;
      const nx = dx * invDist;
      const nz = dz * invDist;
      const tx = -nz;
      const tz = nx;

      const swirlStrength = (1.6 + params.playerSpeed * 0.38) * proxRatio;
      vx += (tx * swirlStrength + nx * 0.55 * proxRatio) * safeDt * 6.0;
      vz += (tz * swirlStrength + nz * 0.55 * proxRatio) * safeDt * 6.0;
      vy +=
        (kind === 'diya_flicker' ? 1.45 : 1.15) *
        proxRatio *
        speedFactor *
        safeDt *
        4.5;
    }

    // Gentle spring tether back toward home anchor when calm
    const homeDx = p.anchorX - p.x;
    const homeDz = p.anchorZ - p.z;
    vx += homeDx * 0.85 * safeDt;
    vz += homeDz * 0.85 * safeDt;

    const ambientFlutterX =
      Math.sin(params.elapsedSec * 1.6 + p.phase) *
      (kind === 'holi_petal' ? 0.42 : 0.25);
    const ambientFlutterZ =
      Math.cos(params.elapsedSec * 1.4 + p.phase) *
      (kind === 'holi_petal' ? 0.42 : 0.25);

    const nextX = p.x + (vx + ambientFlutterX) * safeDt;
    const nextZ = p.z + (vz + ambientFlutterZ) * safeDt;

    const baseBobY =
      0.32 +
      ((p.id * 19) % 14) * 0.08 +
      Math.sin(params.elapsedSec * 2.2 + p.phase) * 0.14;
    let nextY = p.y + vy * safeDt;
    // Settle smoothly toward baseBobY + swirl lift
    const targetY = baseBobY + nextEnergy * (kind === 'diya_flicker' ? 1.65 : 1.35);
    nextY += (targetY - nextY) * Math.min(1, safeDt * 3.5);

    return {
      ...p,
      x: nextX,
      y: Math.max(0.18, Math.min(3.8, nextY)),
      z: nextZ,
      vx,
      vy,
      vz,
      swirlEnergy: Number(nextEnergy.toFixed(4)),
    };
  });

  return { kind, particles: updated };
}

// ============================================================================
// AAA DYNAMIC CAMERA DIRECTOR — PURE MATHEMATICAL & COMPOSITIONAL SOLVERS
// ============================================================================

/**
 * Cubic ease-in-out S-curve interpolation for 2.0s "One-Take" Dive Transitions
 * and 0.8s Stall/Gondola camera transitions.
 */
/**
 * Critically Damped Second-Order Spring-Damper Solver (Game Programming Gems 4)
 * Guarantees C¹ continuous position and velocity with zero overshoot and zero frame-rate variance.
 */
export function stepCriticallyDampedSpring(
  current: number,
  velocity: number,
  target: number,
  smoothTime: number,
  dt: number,
  maxSpeed = Infinity
): { value: number; velocity: number } {
  const safeDt = Math.max(0.0001, Math.min(0.1, Number.isFinite(dt) ? dt : 0.016));
  const safeSmooth = Math.max(0.005, smoothTime);
  const omega = 2.0 / safeSmooth;
  const x = omega * safeDt;
  const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);

  let change = current - target;
  const originalTarget = target;
  const maxChange = Number.isFinite(maxSpeed) ? maxSpeed * safeSmooth : Infinity;
  if (Number.isFinite(maxChange)) {
    change = Math.max(-maxChange, Math.min(maxChange, change));
  }
  const adjustedTarget = current - change;
  const temp = (velocity + omega * change) * safeDt;
  let nextVelocity = (velocity - omega * temp) * exp;
  let nextValue = adjustedTarget + (change + temp) * exp;

  // Prevent overshoot across the original target
  if ((originalTarget - current > 0) === (nextValue > originalTarget)) {
    nextValue = originalTarget;
    nextVelocity = (nextValue - originalTarget) / safeDt;
  }

  return { value: nextValue, velocity: nextVelocity };
}

/**
 * Shortest-arc Critically Damped Angular Spring-Damper
 */
export function stepCriticallyDampedAngle(
  currentRad: number,
  velocityRad: number,
  targetRad: number,
  smoothTime: number,
  dt: number
): { value: number; velocity: number } {
  let diff = targetRad - currentRad;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const res = stepCriticallyDampedSpring(0, velocityRad, diff, smoothTime, dt);
  return {
    value: currentRad + res.value,
    velocity: res.velocity,
  };
}

export function cubicEaseInOut(t: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export interface HandheldBreathingOptions {
  moveSpeed?: number;
  isSprintingOrDashing?: boolean;
  intensityScale?: number;
  phaseOverride?: number;
}

/**
 * Integrates continuous camera breathing phase so changing movement speed or sprint
 * smoothly accelerates cadence without discontinuous phase jumps.
 */
export function stepHandheldBreathingPhase(
  currentPhase: number,
  dt: number,
  options?: Pick<HandheldBreathingOptions, 'moveSpeed' | 'isSprintingOrDashing'>
): number {
  const safeDt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
  const speed = Math.max(0, options?.moveSpeed ?? 0);
  const isSprint = Boolean(options?.isSprintingOrDashing);
  const speedCadence = isSprint ? 2.5 : 1.0 + Math.min(1.2, speed * 0.12);
  return (Number.isFinite(currentPhase) ? currentPhase : 0) + safeDt * speedCadence;
}

/**
 * Dual-frequency Perlin-style handheld camera breathing (±0.08m vertical, ±0.004 rad roll)
 * with dynamic movement speed and sprint cadence scaling.
 */
export function computeHandheldBreathing(
  elapsedSec: number,
  options?: HandheldBreathingOptions
): {
  verticalOffsetM: number;
  horizontalOffsetM: number;
  rollRad: number;
} {
  const t = Number.isFinite(elapsedSec) ? elapsedSec : 0;
  const speed = Math.max(0, options?.moveSpeed ?? 0);
  const isSprint = Boolean(options?.isSprintingOrDashing);
  const userScale = Math.max(0.1, Math.min(3.0, options?.intensityScale ?? 1.0));

  // If caller supplies integrated continuous phaseOverride, evaluate directly at continuous phase
  // to avoid phase jumps on speed/sprint transitions.
  const speedCadence = isSprint ? 2.5 : 1.0 + Math.min(1.2, speed * 0.12);
  const effectivePhase =
    options?.phaseOverride !== undefined && Number.isFinite(options.phaseOverride)
      ? options.phaseOverride
      : t * speedCadence;

  const breathFreq = effectivePhase * 1.35;
  const secondaryFreq = effectivePhase * 2.45;
  const rollFreq = effectivePhase * 1.15;

  const speedAmpFactor = isSprint ? 1.25 : 1.0 + Math.min(0.4, speed * 0.04);
  const verticalOffsetM =
    (Math.sin(breathFreq) * 0.052 + Math.cos(secondaryFreq + 0.7) * 0.028) *
    speedAmpFactor *
    userScale;
  const horizontalOffsetM =
    (Math.cos(effectivePhase * 0.95) * 0.035 +
      Math.sin(effectivePhase * 1.85 + 1.2) * 0.018) *
    speedAmpFactor *
    userScale;
  const rollRad =
    (Math.sin(rollFreq + 0.4) * 0.0026 +
      Math.cos(effectivePhase * 2.1) * 0.0014) *
    speedAmpFactor *
    userScale;

  return {
    verticalOffsetM: Number(verticalOffsetM.toFixed(5)),
    horizontalOffsetM: Number(horizontalOffsetM.toFixed(5)),
    rollRad: Number(rollRad.toFixed(6)),
  };
}

/**
 * Context-Sensitive Monument / Vista Auto-Framing:
 * When the player walks within 22 units of the Central Temple (0, -19) or
 * the Aakash Jhula Giant Wheel (38, -25 in Mela Central Hub), pulls camera
 * distance back from 5.2 up to 8.2 (+3.0m) and raises lookAt.y by up to +3.5m.
 */
export function evaluateVistaFramingOffset(params: {
  playerX: number;
  playerZ: number;
  activeWorld: FestivalWorldId;
}): {
  vistaBlend: number; // [0..1]
  extraDistance: number; // [0..3.0] -> total distance 5.2..8.2
  extraLookAtY: number; // [0..3.5]
  nearestLandmark: 'temple' | 'giant_wheel' | 'none';
} {
  const templeDist = Math.hypot(params.playerX - 0, params.playerZ - -19.0);
  const wheelDist =
    params.activeWorld === 'mela_central'
      ? Math.hypot(params.playerX - 38.0, params.playerZ - -25.0)
      : Infinity;

  const minDist = Math.min(templeDist, wheelDist);
  if (minDist >= 22.0) {
    return {
      vistaBlend: 0,
      extraDistance: 0,
      extraLookAtY: 0,
      nearestLandmark: 'none',
    };
  }

  // Smoothly ramp blend as player moves from 22m inward toward 6m
  const rawRatio = Math.max(0, Math.min(1, (22.0 - minDist) / 16.0));
  const vistaBlend = cubicEaseInOut(rawRatio);

  return {
    vistaBlend: Number(vistaBlend.toFixed(4)),
    extraDistance: Number((vistaBlend * 3.0).toFixed(4)),
    extraLookAtY: Number((vistaBlend * 3.5).toFixed(4)),
    nearestLandmark: wheelDist < templeDist ? 'giant_wheel' : 'temple',
  };
}

/**
 * Computes target gameplay FOV:
 * - Idle / Standing: 43°
 * - Normal Walk (WASD): 46°
 * - Marigold Dash / Sprint (Shift): 58°
 * - Fire Gulal Recoil Impulse (80ms): -1.5°
 */
export function computeTargetGameplayFov(params: {
  moveSpeed: number;
  isSprintingOrDashing: boolean;
  fireRecoilTimerSec: number;
}): number {
  let baseFov = 43.0;
  if (params.isSprintingOrDashing) {
    baseFov = 58.0;
  } else if (params.moveSpeed > 0.35) {
    baseFov = 46.0;
  }

  const recoilDip = params.fireRecoilTimerSec > 0 ? -1.5 : 0;
  return Number((baseFov + recoilDip).toFixed(2));
}

/**
 * Cornering Dutch Roll:
 * When the player strafes (A/D) or turns rapidly while moving, banks the camera
 * roll by up to ±2.5 degrees (±0.043 rad) into the turn, returning to 0 when straight.
 */
export function computeCorneringDutchRoll(params: {
  strafeInputX: number; // -1 (left/A) .. +1 (right/D)
  yawRateRadPerSec: number;
  moveSpeed: number;
}): number {
  const MAX_ROLL_RAD = 0.043; // ~2.5 degrees
  const speedScale = Math.max(0, Math.min(1, params.moveSpeed / 6.0));
  const strafeTerm = -params.strafeInputX * MAX_ROLL_RAD * 0.85;
  const turnTerm =
    Math.max(-1, Math.min(1, params.yawRateRadPerSec / 3.5)) *
    MAX_ROLL_RAD *
    0.55 *
    speedScale;

  const combined = Math.max(
    -MAX_ROLL_RAD,
    Math.min(MAX_ROLL_RAD, strafeTerm + turnTerm)
  );
  return Number(combined.toFixed(5));
}

/**
 * Computes the desired Over-The-Shoulder Spring-Arm Camera Pose and Velocity Look-Ahead Target,
 * incorporating Rule-of-Thirds offset (x: +0.65, y: 2.1, base distance: 5.2),
 * Vista Auto-Framing, Lotus Shield Low-Angle Orbit (+1.8m dolly, 0.3 rad/s),
 * optional smooth camera orbit/zoom overrides, and Fireworks Sky-Tracking (+6.0m vertical lookAt lift for 1.8s).
 */
export function computeSpringArmDesiredPose(params: {
  playerX: number;
  playerY: number;
  playerZ: number;
  velocityX: number;
  velocityZ: number;
  activeWorld: FestivalWorldId;
  shieldActive: boolean;
  fireworkLookUpTimerSec: number;
  elapsedSec: number;
  shieldOrbitAngleOverride?: number;
  shieldBlendOverride?: number;
  orbitYawOffset?: number;
  orbitPitchOffset?: number;
  zoomDistanceOffset?: number;
}): {
  desiredCamX: number;
  desiredCamY: number;
  desiredCamZ: number;
  desiredLookAtX: number;
  desiredLookAtY: number;
  desiredLookAtZ: number;
  desiredDistance: number;
} {
  const vista = evaluateVistaFramingOffset({
    playerX: params.playerX,
    playerZ: params.playerZ,
    activeWorld: params.activeWorld,
  });

  const shieldBlend =
    params.shieldBlendOverride !== undefined
      ? Math.max(0, Math.min(1, params.shieldBlendOverride))
      : params.shieldActive
      ? 1
      : 0;

  // Base distance 5.2m -> up to 8.2m near monuments, +1.8m during Lotus Shield, + user zoom
  const shieldDolly = shieldBlend * 1.8;
  const zoomOffset = params.zoomDistanceOffset ?? 0;
  const desiredDistance = Math.max(
    3.6,
    5.2 + vista.extraDistance + shieldDolly + zoomOffset
  );

  // Combine smooth shield orbit with optional player camera drag orbit
  const baseShieldAngle =
    params.shieldOrbitAngleOverride !== undefined
      ? params.shieldOrbitAngleOverride
      : params.shieldActive
      ? params.elapsedSec * 0.3
      : 0;
  const totalOrbitYaw = baseShieldAngle + (params.orbitYawOffset ?? 0);
  const sinOrbit = Math.sin(totalOrbitYaw);
  const cosOrbit = Math.cos(totalOrbitYaw);

  const pitchOffset = Math.max(-0.42, Math.min(0.65, params.orbitPitchOffset ?? 0));
  const horizScale = Math.cos(pitchOffset);
  const vertLift = Math.sin(pitchOffset) * desiredDistance;

  // Rule-of-Thirds Right-Shoulder Local Offset: x = +0.65, y = 2.1 (smoothly blends to 1.55 heroic low angle when shield active)
  const localRightOffset = 0.65;
  const normalHeightOffset = 2.1 + vista.vistaBlend * 0.45;
  const localHeightOffset =
    normalHeightOffset + (1.55 - normalHeightOffset) * shieldBlend + vertLift;

  const planarDist = desiredDistance * horizScale;
  const worldOffsetX = localRightOffset * cosOrbit + planarDist * sinOrbit;
  const worldOffsetZ = -localRightOffset * sinOrbit + planarDist * cosOrbit;

  const desiredCamX = params.playerX + worldOffsetX;
  const desiredCamY = Math.max(0.85, params.playerY + localHeightOffset);
  const desiredCamZ = params.playerZ + worldOffsetZ;

  // Velocity Look-Ahead: offset up to 1.8 units ahead of player's current velocity vector (playerPos + velocity * 0.25)
  const rawLeadX = params.velocityX * 0.25;
  const rawLeadZ = params.velocityZ * 0.25;
  const leadMag = Math.hypot(rawLeadX, rawLeadZ);
  const leadClampScale = leadMag > 1.8 ? 1.8 / leadMag : 1.0;
  const lookAheadX = rawLeadX * leadClampScale;
  const lookAheadZ = rawLeadZ * leadClampScale;

  // Fireworks Sky-Tracking (+6.0 units upward tilt with smooth envelope over 1.8s)
  let fireworkLiftY = 0;
  if (params.fireworkLookUpTimerSec > 0) {
    const fwNorm = Math.max(0, Math.min(1, params.fireworkLookUpTimerSec / 1.8));
    const fwEnvelope = Math.sin(fwNorm * Math.PI);
    fireworkLiftY = 6.0 * fwEnvelope;
  }

  // Rotate forward look-at vector cleanly with camera orbit yaw so orbiting looks around the player smoothly
  const baseLookFwdX = 0.28;
  const baseLookFwdZ = -3.6;
  const rotLookX = baseLookFwdX * cosOrbit - baseLookFwdZ * sinOrbit;
  const rotLookZ = baseLookFwdX * sinOrbit + baseLookFwdZ * cosOrbit;

  const desiredLookAtX = params.playerX + rotLookX + lookAheadX;
  const desiredLookAtY =
    params.playerY +
    1.55 +
    vista.extraLookAtY +
    fireworkLiftY -
    pitchOffset * 1.4;
  const desiredLookAtZ = params.playerZ + rotLookZ + lookAheadZ;

  return {
    desiredCamX: Number(desiredCamX.toFixed(4)),
    desiredCamY: Number(desiredCamY.toFixed(4)),
    desiredCamZ: Number(desiredCamZ.toFixed(4)),
    desiredLookAtX: Number(desiredLookAtX.toFixed(4)),
    desiredLookAtY: Number(desiredLookAtY.toFixed(4)),
    desiredLookAtZ: Number(desiredLookAtZ.toFixed(4)),
    desiredDistance: Number(desiredDistance.toFixed(4)),
  };
}

/**
 * Anti-Clip Camera Collision Whisker Distance Resolver:
 * If a raycast from the player's head/shoulder anchor (playerPos + (0, 1.6, 0))
 * hits world architecture at distance d < desiredDistance, pulls the camera
 * forward to d - 0.35 (clamped to >= 1.1m).
 */
export function resolveWhiskerCollisionDistance(
  desiredDistance: number,
  hitDistance: number | null
): number {
  if (hitDistance === null || !Number.isFinite(hitDistance)) {
    return desiredDistance;
  }
  if (hitDistance < desiredDistance) {
    return Number(Math.max(1.1, hitDistance - 0.35).toFixed(4));
  }
  return desiredDistance;
}

export interface StarWhiskerOffset {
  id: 'center' | 'left' | 'right' | 'crown' | 'ground';
  anchorOffsetX: number;
  anchorOffsetY: number;
  anchorOffsetZ: number;
  camOffsetX: number;
  camOffsetY: number;
  camOffsetZ: number;
}

/**
 * 5-Ray Star Array Whisker Offset Solver:
 * Generates anchor origin and camera frustum clearance offsets for:
 * 1. Center Ray
 * 2. Left Shoulder Whisker (-0.55m)
 * 3. Right Shoulder Whisker (+0.55m)
 * 4. Crown/Eaves Whisker (+0.40m)
 * 5. Ground/Step Clearance Whisker (-0.35m)
 */
export function computeStarWhiskerOffsets(playerYaw: number): StarWhiskerOffset[] {
  const yaw = Number.isFinite(playerYaw) ? playerYaw : 0;
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);

  return [
    {
      id: 'center',
      anchorOffsetX: 0,
      anchorOffsetY: 0,
      anchorOffsetZ: 0,
      camOffsetX: 0,
      camOffsetY: 0,
      camOffsetZ: 0,
    },
    {
      id: 'left',
      anchorOffsetX: -rightX * 0.55,
      anchorOffsetY: 0,
      anchorOffsetZ: -rightZ * 0.55,
      camOffsetX: -rightX * 0.35,
      camOffsetY: 0,
      camOffsetZ: -rightZ * 0.35,
    },
    {
      id: 'right',
      anchorOffsetX: rightX * 0.55,
      anchorOffsetY: 0,
      anchorOffsetZ: rightZ * 0.55,
      camOffsetX: rightX * 0.35,
      camOffsetY: 0,
      camOffsetZ: rightZ * 0.35,
    },
    {
      id: 'crown',
      anchorOffsetX: 0,
      anchorOffsetY: 0.4,
      anchorOffsetZ: 0,
      camOffsetX: 0,
      camOffsetY: 0.25,
      camOffsetZ: 0,
    },
    {
      id: 'ground',
      anchorOffsetX: 0,
      anchorOffsetY: -0.35,
      anchorOffsetZ: 0,
      camOffsetX: 0,
      camOffsetY: -0.2,
      camOffsetZ: 0,
    },
  ];
}

/**
 * Resolves safe camera distance across all 5 star-array whiskers.
 * Finds the minimum valid obstacle distance and applies safety margin (d - 0.35m, clamped >= 1.1m).
 */
export function resolveMultiWhiskerCollisionDistance(
  desiredDistance: number,
  hitDistances: (number | null | undefined)[]
): number {
  let minHit: number | null = null;
  for (const dist of hitDistances) {
    if (dist !== null && dist !== undefined && Number.isFinite(dist) && dist > 0) {
      if (minHit === null || dist < minHit) {
        minHit = dist;
      }
    }
  }
  return resolveWhiskerCollisionDistance(desiredDistance, minHit);
}




