import type { ArsenalModeId, FestivalWorldId, GulalColorId } from './rules';

export const REPLAY_WINDOW_SEC = 30;
export const REPLAY_SAMPLE_HZ = 20;
export const REPLAY_SAMPLE_INTERVAL_SEC = 1 / REPLAY_SAMPLE_HZ;

export type ReplayActionType =
  | 'attack'
  | 'dash'
  | 'shield'
  | 'jump'
  | 'fireworks'
  | 'rhythm'
  | 'diya'
  | 'rangoli';

export type ReplayCameraStyle = 'cinematic' | 'low_hero' | 'chase';

export interface ReplayKeyframe {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  walkPhase: number;
  isDashing: boolean;
  shieldActive: boolean;
  armRecoil: boolean;
  spinKick: boolean;
}

export interface ReplayActionEvent {
  t: number;
  type: ReplayActionType;
  x: number;
  y: number;
  z: number;
  yaw: number;
  arsenal?: ArsenalModeId;
  gulal?: GulalColorId;
}

export interface ReplayRecording {
  id: number;
  world: FestivalWorldId;
  durationSec: number;
  startTimeSec: number;
  endTimeSec: number;
  keyframes: ReplayKeyframe[];
  actions: ReplayActionEvent[];
}

export interface SampledReplayFrame {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  walkPhase: number;
  isDashing: boolean;
  shieldActive: boolean;
  armRecoil: boolean;
  spinKick: boolean;
}

export interface ReplayCameraPose {
  camX: number;
  camY: number;
  camZ: number;
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
  fov: number;
  rollRad: number;
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

function lerpAngle(a: number, b: number, alpha: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * alpha;
}

/**
 * Rolling 30-second ring-style recorder storing player movement keyframes
 * and discrete combat/festival action events.
 */
export class ReplayRecorder {
  private keyframes: ReplayKeyframe[] = [];
  private actions: ReplayActionEvent[] = [];
  private lastSampleTimeSec = -Infinity;
  private windowSec: number;
  private nextId = 1;

  constructor(windowSec = REPLAY_WINDOW_SEC) {
    this.windowSec = Math.max(1, windowSec);
  }

  reset(): void {
    this.keyframes = [];
    this.actions = [];
    this.lastSampleTimeSec = -Infinity;
  }

  getKeyframeCount(): number {
    return this.keyframes.length;
  }

  getActionCount(): number {
    return this.actions.length;
  }

  private pruneBefore(minTimeSec: number): void {
    while (this.keyframes.length > 1 && this.keyframes[1].t <= minTimeSec) {
      this.keyframes.shift();
    }
    while (this.actions.length > 0 && this.actions[0].t < minTimeSec) {
      this.actions.shift();
    }
  }

  maybeRecordKeyframe(frame: ReplayKeyframe, force = false): boolean {
    if (!Number.isFinite(frame.t) || frame.t < 0) return false;
    if (
      !force &&
      frame.t - this.lastSampleTimeSec < REPLAY_SAMPLE_INTERVAL_SEC * 0.92
    ) {
      return false;
    }

    // Ensure monotonically non-decreasing timestamps
    if (
      this.keyframes.length > 0 &&
      frame.t <= this.keyframes[this.keyframes.length - 1].t
    ) {
      return false;
    }

    this.lastSampleTimeSec = frame.t;
    this.keyframes.push({ ...frame });
    this.pruneBefore(frame.t - this.windowSec);
    return true;
  }

  recordAction(event: ReplayActionEvent): void {
    if (!Number.isFinite(event.t) || event.t < 0) return;
    this.actions.push({ ...event });
    this.pruneBefore(event.t - this.windowSec);
  }

  /**
   * Produces a normalized ReplayRecording spanning [0, durationSec] (up to 30s).
   */
  finalizeRecording(world: FestivalWorldId): ReplayRecording | null {
    if (this.keyframes.length < 2) return null;

    const latestT = this.keyframes[this.keyframes.length - 1].t;
    const minWindowT = Math.max(this.keyframes[0].t, latestT - this.windowSec);

    const clippedFrames = this.keyframes
      .filter((kf) => kf.t >= minWindowT - 0.05)
      .map((kf) => ({
        ...kf,
        t: Number(Math.max(0, kf.t - minWindowT).toFixed(4)),
      }));

    if (clippedFrames.length < 2) return null;

    const durationSec = Math.max(
      0.1,
      Number(clippedFrames[clippedFrames.length - 1].t.toFixed(3))
    );

    const clippedActions = this.actions
      .filter((act) => act.t >= minWindowT && act.t <= latestT + 0.05)
      .map((act) => ({
        ...act,
        t: Number(Math.max(0, Math.min(durationSec, act.t - minWindowT)).toFixed(4)),
      }));

    return {
      id: this.nextId++,
      world,
      durationSec,
      startTimeSec: Number(minWindowT.toFixed(3)),
      endTimeSec: Number(latestT.toFixed(3)),
      keyframes: clippedFrames,
      actions: clippedActions,
    };
  }
}

/**
 * Samples an interpolated player pose & animation state at playbackTimeSec.
 */
export function sampleReplayFrame(
  recording: ReplayRecording,
  playbackTimeSec: number
): SampledReplayFrame {
  const frames = recording.keyframes;
  if (frames.length === 0) {
    return {
      t: 0,
      x: 0,
      y: 0,
      z: 6.5,
      yaw: Math.PI,
      vx: 0,
      vz: 0,
      speed: 0,
      walkPhase: 0,
      isDashing: false,
      shieldActive: false,
      armRecoil: false,
      spinKick: false,
    };
  }

  const clampedT = Math.max(0, Math.min(recording.durationSec, playbackTimeSec));

  if (clampedT <= frames[0].t || frames.length === 1) {
    const f = frames[0];
    return {
      ...f,
      t: clampedT,
      speed: Math.hypot(f.vx, f.vz),
    };
  }

  const last = frames[frames.length - 1];
  if (clampedT >= last.t) {
    return {
      ...last,
      t: clampedT,
      speed: Math.hypot(last.vx, last.vz),
    };
  }

  // Binary search for bracketing keyframes
  let low = 0;
  let high = frames.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (frames[mid].t <= clampedT) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const f0 = frames[low];
  const f1 = frames[high];
  const span = Math.max(0.0001, f1.t - f0.t);
  const alpha = Math.max(0, Math.min(1, (clampedT - f0.t) / span));

  const vx = lerp(f0.vx, f1.vx, alpha);
  const vz = lerp(f0.vz, f1.vz, alpha);

  return {
    t: clampedT,
    x: lerp(f0.x, f1.x, alpha),
    y: lerp(f0.y, f1.y, alpha),
    z: lerp(f0.z, f1.z, alpha),
    yaw: lerpAngle(f0.yaw, f1.yaw, alpha),
    vx,
    vz,
    speed: Math.hypot(vx, vz),
    walkPhase: lerp(f0.walkPhase, f1.walkPhase, alpha),
    isDashing: alpha < 0.5 ? f0.isDashing : f1.isDashing,
    shieldActive: f0.shieldActive || f1.shieldActive,
    armRecoil: alpha < 0.5 ? f0.armRecoil : f1.armRecoil,
    spinKick: alpha < 0.5 ? f0.spinKick : f1.spinKick,
  };
}

/**
 * Extracts discrete action events fired inside (prevTimeSec, currTimeSec].
 */
export function collectReplayActionsInWindow(
  recording: ReplayRecording,
  prevTimeSec: number,
  currTimeSec: number
): ReplayActionEvent[] {
  if (currTimeSec < prevTimeSec) return [];
  const includeZero = prevTimeSec <= 0 && currTimeSec >= 0;
  return recording.actions.filter((act) =>
    includeZero
      ? act.t >= 0 && act.t <= currTimeSec
      : act.t > prevTimeSec && act.t <= currTimeSec
  );
}

/**
 * Computes sweeping PlayStation-style replay cinematography camera coordinates.
 */
export function computeCinematicReplayCameraPose(params: {
  frame: SampledReplayFrame;
  playbackTimeSec: number;
  cameraStyle: ReplayCameraStyle;
  recentActionPulse: number; // [0..1]
}): ReplayCameraPose {
  const { frame, playbackTimeSec, cameraStyle, recentActionPulse } = params;

  if (cameraStyle === 'chase') {
    const backX = -Math.sin(frame.yaw);
    const backZ = -Math.cos(frame.yaw);
    const dist = 5.4 + Math.min(1.4, frame.speed * 0.08);
    return {
      camX: Number((frame.x + backX * dist + Math.cos(frame.yaw) * 0.7).toFixed(4)),
      camY: Number((frame.y + 2.55).toFixed(4)),
      camZ: Number((frame.z + backZ * dist - Math.sin(frame.yaw) * 0.7).toFixed(4)),
      lookAtX: Number((frame.x + Math.sin(frame.yaw) * 1.8).toFixed(4)),
      lookAtY: Number((frame.y + 1.45).toFixed(4)),
      lookAtZ: Number((frame.z + Math.cos(frame.yaw) * 1.8).toFixed(4)),
      fov: 54 + (frame.isDashing ? 5 : 0),
      rollRad: Number((Math.sin(playbackTimeSec * 1.1) * 0.008).toFixed(5)),
    };
  }

  if (cameraStyle === 'low_hero') {
    const heroAngle = frame.yaw + 0.55 + Math.sin(playbackTimeSec * 0.35) * 0.45;
    const dist = 4.4 - recentActionPulse * 0.5;
    return {
      camX: Number((frame.x + Math.sin(heroAngle) * dist).toFixed(4)),
      camY: Number((frame.y + 1.35 + Math.sin(playbackTimeSec * 0.8) * 0.15).toFixed(4)),
      camZ: Number((frame.z + Math.cos(heroAngle) * dist).toFixed(4)),
      lookAtX: Number(frame.x.toFixed(4)),
      lookAtY: Number((frame.y + 1.65).toFixed(4)),
      lookAtZ: Number(frame.z.toFixed(4)),
      fov: 42 - recentActionPulse * 3,
      rollRad: Number((Math.sin(playbackTimeSec * 0.9) * 0.015).toFixed(5)),
    };
  }

  // Default 'cinematic': sweeping crane-to-hero orbit with rhythmic focal breathing
  const orbitAngle = frame.yaw + Math.PI * 0.75 + playbackTimeSec * 0.28;
  const craneWave = Math.sin(playbackTimeSec * 0.42) * 0.5 + 0.5;
  const dist = lerp(4.8, 7.2, craneWave) - recentActionPulse * 0.55;
  const height = lerp(1.9, 3.85, craneWave);
  const leadX = frame.vx * 0.12;
  const leadZ = frame.vz * 0.12;

  return {
    camX: Number((frame.x + Math.sin(orbitAngle) * dist).toFixed(4)),
    camY: Number((frame.y + height).toFixed(4)),
    camZ: Number((frame.z + Math.cos(orbitAngle) * dist).toFixed(4)),
    lookAtX: Number((frame.x + leadX).toFixed(4)),
    lookAtY: Number((frame.y + 1.48).toFixed(4)),
    lookAtZ: Number((frame.z + leadZ).toFixed(4)),
    fov: 44 + (frame.isDashing ? 4.5 : 0) - recentActionPulse * 2.5,
    rollRad: Number(
      (Math.sin(playbackTimeSec * 0.65) * 0.014 + (frame.isDashing ? 0.018 : 0)).toFixed(5)
    ),
  };
}
