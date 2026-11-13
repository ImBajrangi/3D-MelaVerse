import * as THREE from 'three';
import {
  MELA_STALLS,
  computeRideCabinCameraPose,
  cubicEaseInOut,
  stepCriticallyDampedSpring,
  stepHandheldBreathingPhase,
  computeHandheldBreathing,
  computeTargetGameplayFov,
  computeCorneringDutchRoll,
  computeSpringArmDesiredPose,
  resolveWhiskerCollisionDistance,
  computeStarWhiskerOffsets,
  resolveMultiWhiskerCollisionDistance,
  stepScreenShake,
  type FestivalWorldId,
} from './rules';
import type {
  RideId,
  MiniGameStallId,
  CameraPerspectiveMode,
} from '../store/useMelaStore';

export type ScreenShakeStepResult = ReturnType<typeof stepScreenShake>;

interface WorldDroneSplineRig {
  camCurve: THREE.CatmullRomCurve3;
  targetCurve: THREE.CatmullRomCurve3;
  cycleDurationSec: number;
}

function buildWorldDroneSplines(): Record<FestivalWorldId, WorldDroneSplineRig> {
  const holiCamCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.0, 3.5, 14.5),
      new THREE.Vector3(0.0, 3.5, -2.5),
      new THREE.Vector3(-9.5, 2.2, -5.5),
      new THREE.Vector3(8.5, 2.2, -4.5),
      new THREE.Vector3(16.5, 14.0, 13.5),
      new THREE.Vector3(-12.5, 11.5, 15.5),
    ],
    true,
    'catmullrom',
    0.5
  );

  const holiTargetCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.0, 5.2, -16.0),
      new THREE.Vector3(0.0, 6.8, -19.0),
      new THREE.Vector3(0.0, 9.0, -19.0),
      new THREE.Vector3(-2.0, 9.0, -18.5),
      new THREE.Vector3(0.0, 5.5, -10.5),
      new THREE.Vector3(0.0, 4.8, -12.0),
    ],
    true,
    'catmullrom',
    0.5
  );

  const diwaliCamCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-14.0, 3.5, 6.5),
      new THREE.Vector3(0.0, 3.5, 5.2),
      new THREE.Vector3(8.5, 2.2, 16.5),
      new THREE.Vector3(-6.5, 2.2, 18.0),
      new THREE.Vector3(18.5, 14.0, 24.0),
      new THREE.Vector3(-16.0, 11.0, 18.5),
    ],
    true,
    'catmullrom',
    0.5
  );

  const diwaliTargetCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.0, 5.0, -16.0),
      new THREE.Vector3(0.0, 6.4, -19.0),
      new THREE.Vector3(0.0, 9.0, -19.0),
      new THREE.Vector3(2.5, 9.0, -18.5),
      new THREE.Vector3(0.0, 5.2, -8.0),
      new THREE.Vector3(0.0, 4.5, -12.0),
    ],
    true,
    'catmullrom',
    0.5
  );

  const melaCamCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(21.5, 3.5, 2.5),
      new THREE.Vector3(11.5, 3.5, -6.5),
      new THREE.Vector3(-4.5, 2.2, 4.5),
      new THREE.Vector3(-11.5, 2.2, -3.5),
      new THREE.Vector3(6.5, 14.0, 14.5),
      new THREE.Vector3(18.5, 14.0, 16.5),
    ],
    true,
    'catmullrom',
    0.5
  );

  const melaTargetCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.0, 4.8, -14.0),
      new THREE.Vector3(0.0, 6.5, -18.5),
      new THREE.Vector3(0.0, 9.0, -19.0),
      new THREE.Vector3(8.0, 9.0, -21.0),
      new THREE.Vector3(21.0, 11.2, -22.0),
      new THREE.Vector3(24.0, 11.8, -23.0),
    ],
    true,
    'catmullrom',
    0.5
  );

  return {
    holi_braj: {
      camCurve: holiCamCurve,
      targetCurve: holiTargetCurve,
      cycleDurationSec: 28.0,
    },
    diwali_ghat: {
      camCurve: diwaliCamCurve,
      targetCurve: diwaliTargetCurve,
      cycleDurationSec: 28.0,
    },
    mela_central: {
      camCurve: melaCamCurve,
      targetCurve: melaTargetCurve,
      cycleDurationSec: 30.0,
    },
  };
}

export interface CameraDirectorStepInput {
  dt: number;
  elapsedSec: number;
  isPlaying: boolean;
  activeWorld: FestivalWorldId;
  cameraMode: CameraPerspectiveMode;
  mountedRide: RideId | null;
  activeStallModal?: MiniGameStallId | null;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
  velocityX: number;
  velocityZ: number;
  strafeInputX: number;
  isSprintingOrDashing: boolean;
  shieldActive: boolean;
  justFiredGulal: boolean;
  justLaunchedFirework: boolean;
  rideLookYawOffset: number;
  rideLookPitchOffset: number;
  shakeStep: ScreenShakeStepResult;
  colliderMeshes: THREE.Object3D[];
  isPhotoMode?: boolean;
  photoOrbitYaw?: number;
  photoOrbitPitch?: number;
  photoZoomDist?: number;
  photoFov?: number;
  orbitYawOffset?: number;
  orbitPitchOffset?: number;
  zoomDistanceOffset?: number;
}

export class MelaCameraDirector {
  private readonly splines = buildWorldDroneSplines();
  private readonly raycaster = new THREE.Raycaster();

  // Critically damped position, lookAt, FOV & roll states + derivatives (velocities)
  private readonly currentPos = new THREE.Vector3(14, 3.5, 14);
  private posVelX = 0;
  private posVelY = 0;
  private posVelZ = 0;

  private readonly currentLookAt = new THREE.Vector3(0, 6.2, -16);
  private lookVelX = 0;
  private lookVelY = 0;
  private lookVelZ = 0;

  private currentFov = 40;
  private fovVel = 0;

  private currentRollRad = 0;
  private rollVel = 0;

  private smoothedWhiskerDist = 5.2;
  private whiskerDistVel = 0;

  // Input & continuous state smoothing (prevents micro-stutter on key tap, snap-aim, sprint & shield toggles)
  private smoothedVelX = 0;
  private smoothedVelZ = 0;
  private smoothedYawRate = 0;
  private breathPhase = 0;
  private shieldBlend = 0;
  private shieldOrbitAngle = 0;

  // 2.0-second "One-Take" Dive Transition state (Preview -> Gameplay)
  private wasPlaying = false;
  private diveTransitionActive = false;
  private diveTransitionElapsedSec = 0;
  private readonly diveDurationSec = 2.0;
  private readonly diveStartPos = new THREE.Vector3();
  private readonly diveStartLookAt = new THREE.Vector3();
  private diveStartFov = 40;

  // 0.8-second S-curve Ride / Stall Camera Transition state
  private lastMountedRide: RideId | null = null;
  private rideTransitionProgress = 1.0;
  private readonly rideTransitionDurationSec = 0.8;
  private readonly rideBlendStartPos = new THREE.Vector3();
  private readonly rideBlendStartLookAt = new THREE.Vector3();

  private lastStallModal: MiniGameStallId | null = null;
  private stallTransitionProgress = 1.0;
  private readonly stallBlendStartPos = new THREE.Vector3();
  private readonly stallBlendStartLookAt = new THREE.Vector3();

  // Ability & Action Camera Timers
  private fireRecoilTimerSec = 0;
  private fireworkLookUpTimerSec = 0;
  private prevPlayerYaw = Math.PI;
  private whiskerFrameCounter = 0;
  private lastCachedHitDist: number | null = null;
  private initializedPreviewPose = false;

  // Cached architectural collider meshes (rebuilt only on world/root change — zero per-frame traversal)
  private cachedColliderSignature = '';
  private cachedColliderMeshes: THREE.Object3D[] = [];
  private readonly _rayHitBuf: THREE.Intersection[] = [];

  // Reusable scratch vectors (zero per-frame GC allocation)
  private readonly _splinePos = new THREE.Vector3();
  private readonly _splineLook = new THREE.Vector3();
  private readonly _anchorOrigin = new THREE.Vector3();
  private readonly _rayDir = new THREE.Vector3();
  private readonly _desiredPos = new THREE.Vector3();
  private readonly _desiredLook = new THREE.Vector3();
  private readonly _whiskerOrigin = new THREE.Vector3();
  private readonly _whiskerTarget = new THREE.Vector3();
  private readonly _whiskerRay = new THREE.Vector3();
  private readonly _whiskerHitDists: (number | null)[] = [null, null, null, null, null];

  public triggerFireGulalRecoil(): void {
    this.fireRecoilTimerSec = 0.08;
  }

  public triggerFireworkSkyLook(): void {
    this.fireworkLookUpTimerSec = 1.8;
  }

  /**
   * Synchronizes internal spring position/lookAt/FOV after external camera overrides
   * (such as Replay Playback exit) so resuming gameplay never snaps.
   */
  public syncPose(
    camPos: THREE.Vector3,
    lookAtPos: THREE.Vector3,
    fov = 45
  ): void {
    this.currentPos.copy(camPos);
    this.currentLookAt.copy(lookAtPos);
    this.currentFov = fov;
    this.posVelX = 0;
    this.posVelY = 0;
    this.posVelZ = 0;
    this.lookVelX = 0;
    this.lookVelY = 0;
    this.lookVelZ = 0;
    this.fovVel = 0;
    this.rollVel = 0;
    this.diveTransitionActive = false;
  }

  public invalidateColliderCache(): void {
    this.cachedColliderSignature = '';
  }

  private ensureColliderCache(
    activeWorld: FestivalWorldId,
    roots: THREE.Object3D[]
  ): THREE.Object3D[] {
    let sig = `${activeWorld}:${roots.length}`;
    for (let i = 0; i < roots.length; i++) {
      const r = roots[i];
      if (!r) continue;
      sig += `:${r.id}:${r.visible ? 1 : 0}:${r.children.length}`;
    }
    if (sig === this.cachedColliderSignature && this.cachedColliderMeshes.length > 0) {
      return this.cachedColliderMeshes;
    }
    this.cachedColliderSignature = sig;
    const solidMeshes: THREE.Object3D[] = [];
    for (let i = 0; i < roots.length; i++) {
      const rootObj = roots[i];
      if (!rootObj || !rootObj.visible) continue;
      rootObj.traverseVisible((child) => {
        const asMesh = child as THREE.Mesh;
        if (
          asMesh.isMesh &&
          !(child as THREE.Sprite).isSprite &&
          !(child as THREE.Points).isPoints &&
          !(child as THREE.InstancedMesh).isInstancedMesh
        ) {
          solidMeshes.push(asMesh);
        }
      });
    }
    this.cachedColliderMeshes = solidMeshes;
    return this.cachedColliderMeshes;
  }

  private springMovePos(
    targetX: number,
    targetY: number,
    targetZ: number,
    smoothTime: number,
    dt: number
  ): void {
    const sx = stepCriticallyDampedSpring(
      this.currentPos.x,
      this.posVelX,
      targetX,
      smoothTime,
      dt
    );
    const sy = stepCriticallyDampedSpring(
      this.currentPos.y,
      this.posVelY,
      targetY,
      smoothTime,
      dt
    );
    const sz = stepCriticallyDampedSpring(
      this.currentPos.z,
      this.posVelZ,
      targetZ,
      smoothTime,
      dt
    );
    this.currentPos.set(sx.value, sy.value, sz.value);
    this.posVelX = sx.velocity;
    this.posVelY = sy.velocity;
    this.posVelZ = sz.velocity;
  }

  private springMoveLookAt(
    targetX: number,
    targetY: number,
    targetZ: number,
    smoothTime: number,
    dt: number
  ): void {
    const sx = stepCriticallyDampedSpring(
      this.currentLookAt.x,
      this.lookVelX,
      targetX,
      smoothTime,
      dt
    );
    const sy = stepCriticallyDampedSpring(
      this.currentLookAt.y,
      this.lookVelY,
      targetY,
      smoothTime,
      dt
    );
    const sz = stepCriticallyDampedSpring(
      this.currentLookAt.z,
      this.lookVelZ,
      targetZ,
      smoothTime,
      dt
    );
    this.currentLookAt.set(sx.value, sy.value, sz.value);
    this.lookVelX = sx.velocity;
    this.lookVelY = sy.velocity;
    this.lookVelZ = sz.velocity;
  }

  private springMoveFov(
    camera: THREE.PerspectiveCamera,
    targetFov: number,
    smoothTime: number,
    dt: number
  ): void {
    const sf = stepCriticallyDampedSpring(
      this.currentFov,
      this.fovVel,
      targetFov,
      smoothTime,
      dt
    );
    this.currentFov = sf.value;
    this.fovVel = sf.velocity;
    if (Math.abs(camera.fov - this.currentFov) > 0.015) {
      camera.fov = this.currentFov;
      camera.updateProjectionMatrix();
    }
  }

  public step(camera: THREE.PerspectiveCamera, input: CameraDirectorStepInput): void {
    const dt = Math.max(0.001, Math.min(0.05, input.dt));

    if (input.justFiredGulal) {
      this.triggerFireGulalRecoil();
    }
    if (input.justLaunchedFirework) {
      this.triggerFireworkSkyLook();
    }

    this.fireRecoilTimerSec = Math.max(0, this.fireRecoilTimerSec - dt);
    this.fireworkLookUpTimerSec = Math.max(0, this.fireworkLookUpTimerSec - dt);

    // Detect transition Preview -> Gameplay
    if (input.isPlaying && !this.wasPlaying) {
      this.diveTransitionActive = true;
      this.diveTransitionElapsedSec = 0;
      this.diveStartPos.copy(this.currentPos);
      this.diveStartLookAt.copy(this.currentLookAt);
      this.diveStartFov = this.currentFov;
      this.smoothedVelX = 0;
      this.smoothedVelZ = 0;
      this.prevPlayerYaw = input.playerYaw;
    } else if (!input.isPlaying && this.wasPlaying) {
      this.diveTransitionActive = false;
      this.diveTransitionElapsedSec = 0;
    }
    this.wasPlaying = input.isPlaying;

    // Detect Gondola Ride transitions
    if (input.mountedRide !== this.lastMountedRide) {
      this.lastMountedRide = input.mountedRide;
      this.rideTransitionProgress = 0;
      this.rideBlendStartPos.copy(this.currentPos);
      this.rideBlendStartLookAt.copy(this.currentLookAt);
    }
    if (this.rideTransitionProgress < 1.0) {
      this.rideTransitionProgress = Math.min(
        1.0,
        this.rideTransitionProgress + dt / this.rideTransitionDurationSec
      );
    }

    // Detect Stall Modal transitions
    const currentStall = input.activeStallModal ?? null;
    if (currentStall !== this.lastStallModal) {
      this.lastStallModal = currentStall;
      this.stallTransitionProgress = 0;
      this.stallBlendStartPos.copy(this.currentPos);
      this.stallBlendStartLookAt.copy(this.currentLookAt);
    }
    if (this.stallTransitionProgress < 1.0) {
      this.stallTransitionProgress = Math.min(
        1.0,
        this.stallTransitionProgress + dt / this.rideTransitionDurationSec
      );
    }

    // =========================================================================
    // STATE 1: CINEMATIC DRONE SPLINE DIRECTOR IN PREVIEW MODE (`!isPlaying`)
    // =========================================================================
    if (!input.isPlaying) {
      const rig = this.splines[input.activeWorld] ?? this.splines.holi_braj;
      const u = (input.elapsedSec % rig.cycleDurationSec) / rig.cycleDurationSec;

      rig.camCurve.getPointAt(u, this._splinePos);
      rig.targetCurve.getPointAt(u, this._splineLook);

      this.breathPhase = stepHandheldBreathingPhase(this.breathPhase, dt, {
        moveSpeed: 0,
        isSprintingOrDashing: false,
      });
      const breathing = computeHandheldBreathing(input.elapsedSec, {
        phaseOverride: this.breathPhase,
      });
      this._splinePos.y += breathing.verticalOffsetM;
      this._splinePos.x += breathing.horizontalOffsetM;

      if (!this.initializedPreviewPose) {
        this.initializedPreviewPose = true;
        this.currentPos.copy(this._splinePos);
        this.currentLookAt.copy(this._splineLook);
      } else {
        this.springMovePos(
          this._splinePos.x,
          this._splinePos.y,
          this._splinePos.z,
          0.22,
          dt
        );
        this.springMoveLookAt(
          this._splineLook.x,
          this._splineLook.y,
          this._splineLook.z,
          0.16,
          dt
        );
      }

      this.springMoveFov(camera, 40.0, 0.18, dt);

      const sRoll = stepCriticallyDampedSpring(
        this.currentRollRad,
        this.rollVel,
        breathing.rollRad,
        0.16,
        dt
      );
      this.currentRollRad = sRoll.value;
      this.rollVel = sRoll.velocity;

      camera.up.set(0, 1, 0);
      camera.position.copy(this.currentPos);
      camera.lookAt(this.currentLookAt);
      if (Math.abs(this.currentRollRad) > 0.00005) {
        camera.rotateZ(this.currentRollRad);
      }
      return;
    }

    // =========================================================================
    // STATE 2: MOUNTED RIDE GONDOLA CAMERA
    // =========================================================================
    if (input.mountedRide) {
      const cabinPose = computeRideCabinCameraPose(
        input.mountedRide,
        input.elapsedSec,
        input.rideLookYawOffset,
        input.rideLookPitchOffset
      );
      const sCurve = cubicEaseInOut(this.rideTransitionProgress);

      this._desiredPos.set(cabinPose.camX, cabinPose.camY, cabinPose.camZ);
      this._desiredLook.set(cabinPose.lookX, cabinPose.lookY, cabinPose.lookZ);

      const targetX = THREE.MathUtils.lerp(this.rideBlendStartPos.x, this._desiredPos.x, sCurve);
      const targetY = THREE.MathUtils.lerp(this.rideBlendStartPos.y, this._desiredPos.y, sCurve);
      const targetZ = THREE.MathUtils.lerp(this.rideBlendStartPos.z, this._desiredPos.z, sCurve);
      const lookX = THREE.MathUtils.lerp(this.rideBlendStartLookAt.x, this._desiredLook.x, sCurve);
      const lookY = THREE.MathUtils.lerp(this.rideBlendStartLookAt.y, this._desiredLook.y, sCurve);
      const lookZ = THREE.MathUtils.lerp(this.rideBlendStartLookAt.z, this._desiredLook.z, sCurve);

      this.springMovePos(targetX, targetY, targetZ, 0.055, dt);
      this.springMoveLookAt(lookX, lookY, lookZ, 0.045, dt);
      this.springMoveFov(camera, 48.0, 0.16, dt);

      const gondolaPendulumSway =
        cabinPose.swingAngleRad !== 0
          ? cabinPose.swingAngleRad * 0.22
          : Math.sin(input.elapsedSec * 1.65) * 0.018;
      const sRoll = stepCriticallyDampedSpring(
        this.currentRollRad,
        this.rollVel,
        gondolaPendulumSway,
        0.14,
        dt
      );
      this.currentRollRad = sRoll.value;
      this.rollVel = sRoll.velocity;

      camera.up.set(0, 1, 0);
      camera.position.copy(this.currentPos);
      camera.lookAt(this.currentLookAt);
      if (Math.abs(this.currentRollRad) > 0.00005) {
        camera.rotateZ(this.currentRollRad);
      }
      return;
    }

    // =========================================================================
    // STATE 3: FIRST-PERSON CAMERA (`[V]` Toggle)
    // =========================================================================
    if (input.cameraMode === 'first_person') {
      const eyeX =
        input.playerX +
        Math.sin(input.playerYaw) * 0.25 +
        input.shakeStep.offsetX * 0.4;
      const eyeY = input.playerY + 1.65 + input.shakeStep.offsetY * 0.4;
      const eyeZ =
        input.playerZ +
        Math.cos(input.playerYaw) * 0.25 +
        input.shakeStep.offsetZ * 0.4;
      const lookX = eyeX + Math.sin(input.playerYaw) * 10;
      const lookY = eyeY - 0.35 + (this.fireworkLookUpTimerSec > 0 ? 3.5 : 0);
      const lookZ = eyeZ + Math.cos(input.playerYaw) * 10;

      // Fast critically damped tracking prevents hard snaps entering/leaving 1st person
      this.springMovePos(eyeX, eyeY, eyeZ, 0.035, dt);
      this.springMoveLookAt(lookX, lookY, lookZ, 0.035, dt);
      this.springMoveFov(camera, 52.0, 0.14, dt);

      camera.up.set(0, 1, 0);
      camera.position.copy(this.currentPos);
      camera.lookAt(this.currentLookAt);
      if (input.shakeStep.rollRad !== 0) {
        camera.rotateZ(input.shakeStep.rollRad * 0.6);
      }
      return;
    }

    // =========================================================================
    // STATE 3.5: CINEMATIC PHOTO MODE
    // =========================================================================
    if (input.isPhotoMode) {
      const orbitYaw = input.photoOrbitYaw ?? 0;
      const orbitPitch = Math.max(
        -0.6,
        Math.min(0.85, input.photoOrbitPitch ?? 0.15)
      );
      const zoomDist = Math.max(
        1.8,
        Math.min(9.0, input.photoZoomDist ?? 3.8)
      );

      const focalX = input.playerX;
      const focalY = input.playerY + 1.45;
      const focalZ = input.playerZ;

      const cosP = Math.cos(orbitPitch);
      const sinP = Math.sin(orbitPitch);
      const sinY = Math.sin(orbitYaw);
      const cosY = Math.cos(orbitYaw);

      this.breathPhase = stepHandheldBreathingPhase(this.breathPhase, dt, {
        moveSpeed: 0,
        isSprintingOrDashing: false,
      });
      const photoBreathing = computeHandheldBreathing(input.elapsedSec, {
        intensityScale: 0.45,
        phaseOverride: this.breathPhase,
      });

      const targetCamX = focalX + sinY * cosP * zoomDist + photoBreathing.horizontalOffsetM;
      const targetCamY = focalY + sinP * zoomDist + photoBreathing.verticalOffsetM;
      const targetCamZ = focalZ + cosY * cosP * zoomDist;

      this.springMovePos(targetCamX, targetCamY, targetCamZ, 0.11, dt);
      this.springMoveLookAt(focalX, focalY, focalZ, 0.09, dt);
      this.springMoveFov(camera, input.photoFov ?? 45, 0.14, dt);

      camera.up.set(0, 1, 0);
      camera.position.copy(this.currentPos);
      camera.lookAt(this.currentLookAt);
      if (Math.abs(photoBreathing.rollRad) > 0.0001) {
        camera.rotateZ(photoBreathing.rollRad);
      }
      return;
    }

    // =========================================================================
    // STATE 4: AAA CRITICALLY DAMPED OVER-THE-SHOULDER SPRING-ARM GAMEPLAY CAMERA
    // =========================================================================

    // Smooth velocity & yaw-rate inputs so WASD start/stop and auto-aim never whip the camera
    const velAlpha = 1 - Math.exp(-10.5 * dt);
    this.smoothedVelX += (input.velocityX - this.smoothedVelX) * velAlpha;
    this.smoothedVelZ += (input.velocityZ - this.smoothedVelZ) * velAlpha;
    const moveSpeed = Math.hypot(this.smoothedVelX, this.smoothedVelZ);

    // Smooth shield blend & continuous shield orbit angle (eliminates shield-toggle teleport!)
    const targetShieldBlend = input.shieldActive ? 1.0 : 0.0;
    const shieldAlpha = 1 - Math.exp(-8.5 * dt);
    this.shieldBlend += (targetShieldBlend - this.shieldBlend) * shieldAlpha;
    if (this.shieldBlend > 0.01) {
      this.shieldOrbitAngle += dt * 0.3 * this.shieldBlend;
    } else if (Math.abs(this.shieldOrbitAngle) > 0.0005) {
      // Gently unwind shortest arc back to 0 when shield closes
      let wrapped = this.shieldOrbitAngle % (Math.PI * 2);
      if (wrapped > Math.PI) wrapped -= Math.PI * 2;
      if (wrapped < -Math.PI) wrapped += Math.PI * 2;
      this.shieldOrbitAngle = wrapped * Math.exp(-5.0 * dt);
    }

    // Stall modal smooth S-curve framing
    if (input.activeStallModal) {
      const stallSpec = MELA_STALLS.find((s) => s.id === input.activeStallModal);
      if (stallSpec) {
        const sCurve = cubicEaseInOut(this.stallTransitionProgress);
        const sx = THREE.MathUtils.lerp(this.stallBlendStartPos.x, stallSpec.x + 1.2, sCurve);
        const sy = THREE.MathUtils.lerp(this.stallBlendStartPos.y, 2.05, sCurve);
        const sz = THREE.MathUtils.lerp(this.stallBlendStartPos.z, stallSpec.z + 3.4, sCurve);
        const lx = THREE.MathUtils.lerp(this.stallBlendStartLookAt.x, stallSpec.x, sCurve);
        const ly = THREE.MathUtils.lerp(this.stallBlendStartLookAt.y, 1.75, sCurve);
        const lz = THREE.MathUtils.lerp(this.stallBlendStartLookAt.z, stallSpec.z - 0.5, sCurve);

        this.springMovePos(sx, sy, sz, 0.06, dt);
        this.springMoveLookAt(lx, ly, lz, 0.05, dt);
        this.springMoveFov(camera, 42.0, 0.16, dt);

        camera.up.set(0, 1, 0);
        camera.position.copy(this.currentPos);
        camera.lookAt(this.currentLookAt);
        return;
      }
    }

    // 4A. Compute Desired Spring-Arm Pose using smoothed velocity & continuous shield state
    const desiredPose = computeSpringArmDesiredPose({
      playerX: input.playerX,
      playerY: input.playerY,
      playerZ: input.playerZ,
      velocityX: this.smoothedVelX,
      velocityZ: this.smoothedVelZ,
      activeWorld: input.activeWorld,
      shieldActive: input.shieldActive,
      shieldBlendOverride: this.shieldBlend,
      shieldOrbitAngleOverride: this.shieldOrbitAngle,
      orbitYawOffset: input.orbitYawOffset,
      orbitPitchOffset: input.orbitPitchOffset,
      zoomDistanceOffset: input.zoomDistanceOffset,
      fireworkLookUpTimerSec: this.fireworkLookUpTimerSec,
      elapsedSec: input.elapsedSec,
    });

    // 4B. Zero-GC Cached Anti-Clip 5-Ray Star Array Camera Collision Whiskers
    this._anchorOrigin.set(input.playerX, input.playerY + 1.6, input.playerZ);
    this._desiredPos.set(
      desiredPose.desiredCamX,
      desiredPose.desiredCamY,
      desiredPose.desiredCamZ
    );
    this._rayDir.subVectors(this._desiredPos, this._anchorOrigin);
    const fullRayLen = this._rayDir.length();

    if (fullRayLen > 0.1 && input.colliderMeshes.length > 0) {
      this._rayDir.divideScalar(fullRayLen);
      this.whiskerFrameCounter = (this.whiskerFrameCounter + 1) % 2;
      if (this.whiskerFrameCounter === 0) {
        this.raycaster.camera = camera;
        const solidMeshes = this.ensureColliderCache(
          input.activeWorld,
          input.colliderMeshes
        );
        const starOffsets = computeStarWhiskerOffsets(input.playerYaw);

        for (let w = 0; w < starOffsets.length; w++) {
          const off = starOffsets[w];
          this._whiskerOrigin.set(
            this._anchorOrigin.x + off.anchorOffsetX,
            this._anchorOrigin.y + off.anchorOffsetY,
            this._anchorOrigin.z + off.anchorOffsetZ
          );
          this._whiskerTarget.set(
            this._desiredPos.x + off.camOffsetX,
            this._desiredPos.y + off.camOffsetY,
            this._desiredPos.z + off.camOffsetZ
          );
          this._whiskerRay.subVectors(this._whiskerTarget, this._whiskerOrigin);
          const wLen = this._whiskerRay.length();
          if (wLen > 0.1 && solidMeshes.length > 0) {
            this._whiskerRay.divideScalar(wLen);
            this.raycaster.set(this._whiskerOrigin, this._whiskerRay);
            this.raycaster.near = 0.45;
            this.raycaster.far = wLen;
            this._rayHitBuf.length = 0;
            this.raycaster.intersectObjects(solidMeshes, false, this._rayHitBuf);
            let bestHitDist: number | null = null;
            for (let h = 0; h < this._rayHitBuf.length; h++) {
              const hit = this._rayHitBuf[h];
              if (hit.point.y > 0.45) {
                bestHitDist = hit.distance;
                break;
              }
            }
            this._whiskerHitDists[w] = bestHitDist;
          } else {
            this._whiskerHitDists[w] = null;
          }
        }

        this.lastCachedHitDist = resolveMultiWhiskerCollisionDistance(
          fullRayLen,
          this._whiskerHitDists
        );
      }

      const safeDist = resolveWhiskerCollisionDistance(
        fullRayLen,
        this.lastCachedHitDist
      );
      // Asymmetric damping: fast pull-in on wall clip (0.06s), silky ease-out once clear (0.32s)
      const whiskerSmoothTime =
        safeDist < this.smoothedWhiskerDist ? 0.06 : 0.32;
      const sw = stepCriticallyDampedSpring(
        this.smoothedWhiskerDist,
        this.whiskerDistVel,
        safeDist,
        whiskerSmoothTime,
        dt
      );
      this.smoothedWhiskerDist = sw.value;
      this.whiskerDistVel = sw.velocity;

      this._desiredPos
        .copy(this._anchorOrigin)
        .addScaledVector(this._rayDir, this.smoothedWhiskerDist);
    } else {
      const sw = stepCriticallyDampedSpring(
        this.smoothedWhiskerDist,
        this.whiskerDistVel,
        fullRayLen,
        0.24,
        dt
      );
      this.smoothedWhiskerDist = sw.value;
      this.whiskerDistVel = sw.velocity;
    }

    // Add directional recoil / impact shake offsets
    const finalTargetCamX = this._desiredPos.x + input.shakeStep.offsetX * 0.55;
    const finalTargetCamY = this._desiredPos.y + input.shakeStep.offsetY * 0.55;
    const finalTargetCamZ = this._desiredPos.z + input.shakeStep.offsetZ * 0.55;

    const finalTargetLookX = desiredPose.desiredLookAtX + input.shakeStep.offsetX * 0.6;
    const finalTargetLookY = desiredPose.desiredLookAtY + input.shakeStep.offsetY * 0.6;
    const finalTargetLookZ = desiredPose.desiredLookAtZ + input.shakeStep.offsetZ * 0.4;

    // 4C. Continuous Handheld Breathing Phase + Critically Damped Camera Rig
    this.breathPhase = stepHandheldBreathingPhase(this.breathPhase, dt, {
      moveSpeed,
      isSprintingOrDashing: input.isSprintingOrDashing,
    });
    const gameplayBreathing = computeHandheldBreathing(input.elapsedSec, {
      moveSpeed,
      isSprintingOrDashing: input.isSprintingOrDashing,
      phaseOverride: this.breathPhase,
    });

    const targetGameplayFov = computeTargetGameplayFov({
      moveSpeed,
      isSprintingOrDashing: input.isSprintingOrDashing,
      fireRecoilTimerSec: this.fireRecoilTimerSec,
    });

    if (this.diveTransitionActive) {
      this.diveTransitionElapsedSec += dt;
      const rawProgress = Math.min(
        1.0,
        this.diveTransitionElapsedSec / this.diveDurationSec
      );
      const eased = cubicEaseInOut(rawProgress);

      const springSettle =
        rawProgress > 0.75
          ? Math.sin(((rawProgress - 0.75) / 0.25) * Math.PI) * -0.1
          : 0;

      const guideCamX = THREE.MathUtils.lerp(this.diveStartPos.x, finalTargetCamX, eased);
      const guideCamY =
        THREE.MathUtils.lerp(this.diveStartPos.y, finalTargetCamY, eased) + springSettle;
      const guideCamZ = THREE.MathUtils.lerp(this.diveStartPos.z, finalTargetCamZ, eased);

      const guideLookX = THREE.MathUtils.lerp(
        this.diveStartLookAt.x,
        finalTargetLookX,
        eased
      );
      const guideLookY = THREE.MathUtils.lerp(
        this.diveStartLookAt.y,
        finalTargetLookY,
        eased
      );
      const guideLookZ = THREE.MathUtils.lerp(
        this.diveStartLookAt.z,
        finalTargetLookZ,
        eased
      );

      // Smoothly ramp spring smoothTime toward gameplay values so exit at 2.0s has C¹ velocity continuity
      const posSmooth = 0.06 + eased * 0.08;
      const lookSmooth = 0.05 + eased * 0.035;
      this.springMovePos(
        guideCamX + gameplayBreathing.horizontalOffsetM * 0.45,
        guideCamY + gameplayBreathing.verticalOffsetM,
        guideCamZ,
        posSmooth,
        dt
      );
      this.springMoveLookAt(guideLookX, guideLookY, guideLookZ, lookSmooth, dt);

      const guideFov = THREE.MathUtils.lerp(this.diveStartFov, targetGameplayFov, eased);
      this.springMoveFov(camera, guideFov, 0.1, dt);

      if (rawProgress >= 1.0) {
        this.diveTransitionActive = false;
      }
    } else {
      // Critically damped spring-arm follow (Pos 0.14s smoothTime, LookAt 0.085s smoothTime)
      this.springMovePos(
        finalTargetCamX + gameplayBreathing.horizontalOffsetM * 0.45,
        finalTargetCamY + gameplayBreathing.verticalOffsetM,
        finalTargetCamZ,
        0.14,
        dt
      );
      this.springMoveLookAt(
        finalTargetLookX,
        finalTargetLookY,
        finalTargetLookZ,
        0.085,
        dt
      );
      this.springMoveFov(camera, targetGameplayFov, 0.16, dt);
    }

    // 4E. Smoothed Cornering Dutch Roll (±2.5° / ±0.043 rad)
    let yawDiff = input.playerYaw - this.prevPlayerYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.prevPlayerYaw = input.playerYaw;
    const rawYawRate = Math.max(-6.0, Math.min(6.0, yawDiff / dt));
    this.smoothedYawRate += (rawYawRate - this.smoothedYawRate) * (1 - Math.exp(-9.0 * dt));

    const targetDutchRoll = computeCorneringDutchRoll({
      strafeInputX: input.strafeInputX,
      yawRateRadPerSec: this.smoothedYawRate,
      moveSpeed,
    });

    const targetRollWithBreathing =
      targetDutchRoll + input.shakeStep.rollRad + gameplayBreathing.rollRad;
    const sRoll = stepCriticallyDampedSpring(
      this.currentRollRad,
      this.rollVel,
      targetRollWithBreathing,
      0.13,
      dt
    );
    this.currentRollRad = sRoll.value;
    this.rollVel = sRoll.velocity;

    camera.up.set(0, 1, 0);
    camera.position.copy(this.currentPos);
    camera.lookAt(this.currentLookAt);
    if (Math.abs(this.currentRollRad) > 0.00005) {
      camera.rotateZ(this.currentRollRad);
    }
  }
}
