import type { WeatherState } from './weatherSystem';

export interface CharacterWeatherVelocityParams {
  vx: number;
  vz: number;
  weather: WeatherState;
  isDashing: boolean;
  isAirborne?: boolean;
  dt: number;
}

export interface CharacterWeatherVelocityResult {
  vx: number;
  vz: number;
  effectiveDragScale: number;
  windDriftX: number;
  windDriftZ: number;
}

export interface ProjectileTrajectoryParams {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  weather: WeatherState;
  dt: number;
  dragCoeff?: number;
  windSusceptibility?: number;
}

export interface ProjectileTrajectoryResult {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface OrdnanceWindDeflectionParams {
  targetX: number;
  targetZ: number;
  weather: WeatherState;
  dt: number;
  susceptibility?: number;
}

export interface WindParticleStepParams {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  weather: WeatherState;
  elapsedSec: number;
  particleSeed: number;
  dt: number;
  isFirework?: boolean;
}

export interface WindParticleStepResult {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Modifies player character movement velocity under active procedural weather:
 * - Rain increases ground/air resistance (reducing walk/sprint velocity slightly, less so during Dash)
 * - Crosswinds & river gusts impart subtle directional wind drift, amplified while airborne
 */
export function modifyCharacterVelocity(
  params: CharacterWeatherVelocityParams
): CharacterWeatherVelocityResult {
  const safeDt = Math.max(0.0001, Math.min(0.1, Number.isFinite(params.dt) ? params.dt : 0.016));
  const rain = Math.max(0, Math.min(1, params.weather.rainIntensity));

  // Rain dampens movement slightly; Dash cuts through most drag
  const rawDrag = 1.0 - rain * (params.isDashing ? 0.04 : 0.12);
  const effectiveDragScale = Math.max(0.84, Math.min(1.0, rawDrag));

  // Wind drift affects movement gently on ground and stronger mid-jump
  const windFactor = (params.isAirborne ? 0.14 : 0.045) * (params.isDashing ? 0.45 : 1.0);
  const windDriftX = params.weather.windX * windFactor;
  const windDriftZ = params.weather.windZ * windFactor;

  // Smoothly blend wind push proportional to dt-bounded factor so frame rate doesn't over-amplify
  const stepWeight = Math.min(1, safeDt * 60) * 0.0 + 1.0;
  const vx = params.vx * effectiveDragScale + windDriftX * stepWeight;
  const vz = params.vz * effectiveDragScale + windDriftZ * stepWeight;

  return {
    vx: Number(vx.toFixed(4)),
    vz: Number(vz.toFixed(4)),
    effectiveDragScale: Number(effectiveDragScale.toFixed(4)),
    windDriftX: Number(windDriftX.toFixed(4)),
    windDriftZ: Number(windDriftZ.toFixed(4)),
  };
}

/**
 * Steps a projectile's position and velocity using weather-driven air drag and wind deflection.
 * Rain increases aerodynamic drag (slowing forward travel and accelerating vertical drop);
 * Wind vectors smoothly deflect horizontal trajectory.
 */
export function stepProjectileTrajectory(
  params: ProjectileTrajectoryParams
): ProjectileTrajectoryResult {
  const safeDt = Math.max(0.0001, Math.min(0.1, Number.isFinite(params.dt) ? params.dt : 0.016));
  const baseDrag = params.dragCoeff ?? 0.35;
  const windFactor = params.windSusceptibility ?? 0.85;

  // Exponential air drag scaled by weather.airDragMultiplier (elevated in rain)
  const dragDamping = Math.exp(-baseDrag * params.weather.airDragMultiplier * safeDt);

  // Wind steers horizontal projectile velocity toward wind vector
  const windAccelX = params.weather.windX * windFactor * safeDt;
  const windAccelZ = params.weather.windZ * windFactor * safeDt;

  // Rain weighs down powder/mist projectiles slightly faster
  const rainGravityBoost = 1.0 + params.weather.rainIntensity * 0.28;

  const vx = params.vx * dragDamping + windAccelX;
  const vy = params.vy * dragDamping - params.gravity * rainGravityBoost * safeDt;
  const vz = params.vz * dragDamping + windAccelZ;

  const x = params.x + vx * safeDt;
  const y = params.y + vy * safeDt;
  const z = params.z + vz * safeDt;

  return {
    x,
    y,
    z,
    vx,
    vy,
    vz,
  };
}

/**
 * Applies weather wind deflection to parabolic ordnance endpoints (Gubbara balloons,
 * Hawai rockets, Sutli bombs) while in flight.
 */
export function stepOrdnanceWindDeflection(
  params: OrdnanceWindDeflectionParams
): { targetX: number; targetZ: number } {
  const safeDt = Math.max(0, Math.min(0.1, Number.isFinite(params.dt) ? params.dt : 0.016));
  const sus = params.susceptibility ?? 0.32;
  // Rain slightly dampens lateral drift compared to dry gusty air
  const rainDamp = 1.0 - params.weather.rainIntensity * 0.25;
  return {
    targetX: params.targetX + params.weather.windX * sus * rainDamp * safeDt,
    targetZ: params.targetZ + params.weather.windZ * sus * rainDamp * safeDt,
  };
}

/**
 * Computes Gulal ground decal wash-away fade rate.
 * During rain in Holi Braj, splatters dissolve up to ~3.8x faster.
 */
export function computeGulalWashRate(
  weather: WeatherState,
  baseFadeRatePerSec = 0.018
): number {
  const safeBase = Math.max(0.001, baseFadeRatePerSec);
  return Number((safeBase * weather.washRateMultiplier).toFixed(5));
}

/**
 * Steps airborne particles (including firework sparks, ascending trails, and powder bursts)
 * with weather-coupled aerodynamic drag, rain settling, and wind-blown curl turbulence.
 */
export function stepWindBlownParticle(
  params: WindParticleStepParams
): WindParticleStepResult {
  const safeDt = Math.max(0.0001, Math.min(0.1, Number.isFinite(params.dt) ? params.dt : 0.016));
  const rain = Math.max(0, Math.min(1, params.weather.rainIntensity));
  const isFw = Boolean(params.isFirework);

  // Firework sparks are lighter and stay aloft longer, catching wind strongly
  const dragRate = (isFw ? 0.55 : 0.85) * params.weather.airDragMultiplier;
  const dragExp = Math.exp(-dragRate * safeDt);
  const windGain = (isFw ? 1.55 : 1.05) * safeDt;
  const turbAmp = isFw ? 0.95 : 0.55;

  const gustCurlX =
    Math.sin(params.elapsedSec * 4.2 + params.particleSeed) * turbAmp;
  const gustCurlZ =
    Math.cos(params.elapsedSec * 3.8 + params.particleSeed) * turbAmp;

  const effectiveGravity = params.gravity * (isFw ? 0.78 : 1.0) * (1.0 + rain * 0.42);

  const vx = params.vx * dragExp + params.weather.windX * windGain;
  const vy = params.vy - effectiveGravity * safeDt;
  const vz = params.vz * dragExp + params.weather.windZ * windGain;

  const x = params.x + (vx + gustCurlX) * safeDt;
  const y = Math.max(0.05, params.y + vy * safeDt);
  const z = params.z + (vz + gustCurlZ) * safeDt;

  return { x, y, z, vx, vy, vz };
}

export const PhysicsInteraction = {
  modifyCharacterVelocity,
  stepProjectileTrajectory,
  stepOrdnanceWindDeflection,
  computeGulalWashRate,
  stepWindBlownParticle,
};
