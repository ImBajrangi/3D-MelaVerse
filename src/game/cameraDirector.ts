import * as THREE from 'three';
import {
  MELA_STALLS,
  ORBITAL_CAMERA_DEFAULTS,
  computeRideCabinCameraPose,
  cubicEaseInOut,
  dampAngleRad,
  normalizeAngleRad,
  stepHandheldBreathingPhase,
  computeHandheldBreathing,
  computeOrbitalThirdPersonPose,
  computeOrbitalGameplayFov,
  computeOrbitalCorneringRoll,
  computePreviewArcPose,
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
  isOrbitDragging?: boolean;
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
}

export class MelaCameraDirector {
  private readonly raycaster = new THREE.Raycaster();

  // Orbital Third-Person Spring-Arm targets & damped states
  private targetYaw = Math.PI;
  private currentYaw = Math.PI;
  private targetPitch: number = ORBITAL_CAMERA_DEFAULTS.defaultPitchRad; // 12 deg
  private currentPitch: number = ORBITAL_CAMERA_DEFAULTS.defaultPitchRad;
  private targetDistance: number = ORBITAL_CAMERA_DEFAULTS.distance; // 5.4 units
  private currentDistance: number = ORBITAL_CAMERA_DEFAULTS.distance;

  // Damped final camera position, lookAt, FOV, roll & wall anti-clip distance
  private readonly currentPos = new THREE.Vector3(-4.6, 4.2, 25.5);
  private readonly currentLookAt = new THREE.Vector3(-4.2, 7.2, -21.5);
  private currentFov: number = ORBITAL_CAMERA_DEFAULTS.previewFov;
  private currentRollRad = 0;
  private smoothedClipDist: number = ORBITAL_CAMERA_DEFAULTS.distance;

  // Motion & action smoothing states
  private smoothedVelX = 0;
  private smoothedVelZ = 0;
  private smoothedYawRate = 0;
  private breathPhase = 0;
  private shieldBlend = 0;

  // 1.5-second smooth swoop transition (Preview -> Behind-the-Back Third-Person Rig)
  private wasPlaying = false;
  private diveTransitionActive = false;
  private diveTransitionElapsedSec = 0;
  private readonly diveDurationSec = ORBITAL_CAMERA_DEFAULTS.enterWorldSwoopSec; // 1.5s
  private readonly diveStartPos = new THREE.Vector3();
  private readonly diveStartLookAt = new THREE.Vector3();
  private diveStartFov: number = ORBITAL_CAMERA_DEFAULTS.previewFov;

  // 0.85-second cubic ease-in-out Ride & Stall camera transitions (enter + exit)
  private lastMountedRide: RideId | null = null;
  private rideTransitionProgress = 1.0;
  private readonly rideOrStallDurationSec = ORBITAL_CAMERA_DEFAULTS.rideStallTransitionSec; // 0.85s
  private readonly rideBlendStartPos = new THREE.Vector3();
  private readonly rideBlendStartLookAt = new THREE.Vector3();

  private lastStallModal: MiniGameStallId | null = null;
  private stallTransitionProgress = 1.0;
  private readonly stallBlendStartPos = new THREE.Vector3();
  private readonly stallBlendStartLookAt = new THREE.Vector3();

  // Tactile action camera beats
  private fireRecoilTimerSec = 0; // 120ms recoil settle
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
  private readonly _anchorOrigin = new THREE.Vector3();
  private readonly _rayDir = new THREE.Vector3();
  private readonly _desiredPos = new THREE.Vector3();
  private readonly _desiredLook = new THREE.Vector3();
  private readonly _whiskerOrigin = new THREE.Vector3();
  private readonly _whiskerTarget = new THREE.Vector3();
  private readonly _whiskerRay = new THREE.Vector3();
  private readonly _whiskerHitDists: (number | null)[] = [null, null, null, null, null];

  public getCurrentYaw(): number {
    return this.currentYaw;
  }

  public getTargetYaw(): number {
    return this.targetYaw;
  }

  public orbitByDelta(deltaYawRad: number, deltaPitchRad: number): void {
    if (Number.isFinite(deltaYawRad)) {
      this.targetYaw = normalizeAngleRad(this.targetYaw + deltaYawRad);
    }
    if (Number.isFinite(deltaPitchRad)) {
      this.targetPitch = Math.max(
        ORBITAL_CAMERA_DEFAULTS.minPitchRad,
        Math.min(ORBITAL_CAMERA_DEFAULTS.maxPitchRad, this.targetPitch + deltaPitchRad)
      );
    }
  }

  public zoomByDelta(deltaDistance: number): void {
    if (!Number.isFinite(deltaDistance)) return;
    this.targetDistance = Math.max(
      ORBITAL_CAMERA_DEFAULTS.minDistance,
      Math.min(ORBITAL_CAMERA_DEFAULTS.maxDistance, this.targetDistance + deltaDistance)
    );
  }

  public resetBehindPlayer(playerYaw: number): void {
    const yaw = Number.isFinite(playerYaw) ? playerYaw : Math.PI;
    this.targetYaw = yaw;
    this.targetPitch = ORBITAL_CAMERA_DEFAULTS.defaultPitchRad;
    this.targetDistance = ORBITAL_CAMERA_DEFAULTS.distance;
  }

  public triggerFireGulalRecoil(): void {
    this.fireRecoilTimerSec = ORBITAL_CAMERA_DEFAULTS.fireRecoilSettleSec; // 0.12s (120ms)
  }

  public triggerFireworkSkyLook(): void {
    this.fireworkLookUpTimerSec = 1.8;
  }

  /**
   * Synchronizes internal damped pose after external camera overrides
   * (such as Replay Playback exit) so resuming gameplay never snaps.
   */
  public syncPose(
    camPos: THREE.Vector3,
    lookAtPos: THREE.Vector3,
    fov: number = ORBITAL_CAMERA_DEFAULTS.idleWalkFov,
    yawRad?: number
  ): void {
    this.currentPos.copy(camPos);
    this.currentLookAt.copy(lookAtPos);
    this.currentFov = fov;
    if (yawRad !== undefined && Number.isFinite(yawRad)) {
      this.targetYaw = yawRad;
      this.currentYaw = yawRad;
    }
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

  private applyCameraFov(
    camera: THREE.PerspectiveCamera,
    targetFov: number,
    lambda: number,
    dt: number
  ): void {
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, lambda, dt);
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

    // Detect Preview -> Gameplay transition (1.5-second smooth swoop)
    if (input.isPlaying && !this.wasPlaying) {
      this.diveTransitionActive = true;
      this.diveTransitionElapsedSec = 0;
      this.diveStartPos.copy(this.currentPos);
      this.diveStartLookAt.copy(this.currentLookAt);
      this.diveStartFov = this.currentFov;
      this.targetYaw = input.playerYaw;
      this.currentYaw = input.playerYaw;
      this.targetPitch = ORBITAL_CAMERA_DEFAULTS.defaultPitchRad;
      this.currentPitch = ORBITAL_CAMERA_DEFAULTS.defaultPitchRad;
      this.targetDistance = ORBITAL_CAMERA_DEFAULTS.distance;
      this.currentDistance = ORBITAL_CAMERA_DEFAULTS.distance;
      this.smoothedClipDist = ORBITAL_CAMERA_DEFAULTS.distance;
      this.smoothedVelX = 0;
      this.smoothedVelZ = 0;
      this.prevPlayerYaw = input.playerYaw;
    } else if (!input.isPlaying && this.wasPlaying) {
      this.diveTransitionActive = false;
      this.diveTransitionElapsedSec = 0;
    }
    this.wasPlaying = input.isPlaying;

    // Detect Gondola Ride enter & exit transitions (0.85s cubic ease-in-out)
    if (input.mountedRide !== this.lastMountedRide) {
      this.lastMountedRide = input.mountedRide;
      this.rideTransitionProgress = 0;
      this.rideBlendStartPos.copy(this.currentPos);
      this.rideBlendStartLookAt.copy(this.currentLookAt);
    }
    if (this.rideTransitionProgress < 1.0) {
      this.rideTransitionProgress = Math.min(
        1.0,
        this.rideTransitionProgress + dt / this.rideOrStallDurationSec
      );
    }

    // Detect Stall Modal enter & exit transitions (0.85s cubic ease-in-out)
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
        this.stallTransitionProgress + dt / this.rideOrStallDurationSec
      );
    }

    // =========================================================================
    // STATE 1: PREVIEW MODE (`isPlaying === false`)
    // y = 4.2, lookAt.y = 7.2, fov = 42, wide arc (radius 26, speed 0.08 rad/s)
    // =========================================================================
    if (!input.isPlaying) {
      const preview = computePreviewArcPose({
        elapsedSec: input.elapsedSec,
        activeWorld: input.activeWorld,
      });

      this.breathPhase = stepHandheldBreathingPhase(this.breathPhase, dt, {
        moveSpeed: 0,
        isSprintingOrDashing: false,
      });
      const breathing = computeHandheldBreathing(input.elapsedSec, {
        intensityScale: 0.55,
        phaseOverride: this.breathPhase,
      });

      const targetX = preview.camX + breathing.horizontalOffsetM;
      const targetY = preview.camY + breathing.verticalOffsetM;
      const targetZ = preview.camZ;

      if (!this.initializedPreviewPose) {
        this.initializedPreviewPose = true;
        this.currentPos.set(targetX, targetY, targetZ);
        this.currentLookAt.set(preview.lookAtX, preview.lookAtY, preview.lookAtZ);
        this.currentFov = preview.fov;
        camera.fov = preview.fov;
        camera.updateProjectionMatrix();
      } else {
        this.currentPos.x = THREE.MathUtils.damp(this.currentPos.x, targetX, 6.0, dt);
        this.currentPos.y = THREE.MathUtils.damp(this.currentPos.y, targetY, 6.0, dt);
        this.currentPos.z = THREE.MathUtils.damp(this.currentPos.z, targetZ, 6.0, dt);
        this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, preview.lookAtX, 6.0, dt);
        this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, preview.lookAtY, 6.0, dt);
        this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, preview.lookAtZ, 6.0, dt);
      }

      this.applyCameraFov(camera, preview.fov, 8.0, dt);
      this.currentRollRad = THREE.MathUtils.damp(
        this.currentRollRad,
        breathing.rollRad,
        8.0,
        dt
      );

      camera.up.set(0, 1, 0);
      camera.position.copy(this.currentPos);
      camera.lookAt(this.currentLookAt);
      if (Math.abs(this.currentRollRad) > 0.00005) {
        camera.rotateZ(this.currentRollRad);
      }
      return;
    }

    // =========================================================================
    // STATE 2: MOUNTED RIDE GONDOLA CAMERA (0.85s cubic ease-in-out)
    // =========================================================================
    if (input.mountedRide) {
      const cabinPose = computeRideCabinCameraPose(
        input.mountedRide,
        input.elapsedSec,
        input.rideLookYawOffset,
        input.rideLookPitchOffset
      );
      const sCurve = cubicEaseInOut(this.rideTransitionProgress);

      this.currentPos.set(
        THREE.MathUtils.lerp(this.rideBlendStartPos.x, cabinPose.camX, sCurve),
        THREE.MathUtils.lerp(this.rideBlendStartPos.y, cabinPose.camY, sCurve),
        THREE.MathUtils.lerp(this.rideBlendStartPos.z, cabinPose.camZ, sCurve)
      );
      this.currentLookAt.set(
        THREE.MathUtils.lerp(this.rideBlendStartLookAt.x, cabinPose.lookX, sCurve),
        THREE.MathUtils.lerp(this.rideBlendStartLookAt.y, cabinPose.lookY, sCurve),
        THREE.MathUtils.lerp(this.rideBlendStartLookAt.z, cabinPose.lookZ, sCurve)
      );

      this.applyCameraFov(camera, 48.0, 8.0, dt);

      const gondolaPendulumSway =
        cabinPose.swingAngleRad !== 0
          ? cabinPose.swingAngleRad * 0.22
          : Math.sin(input.elapsedSec * 1.65) * 0.018;
      this.currentRollRad = THREE.MathUtils.damp(
        this.currentRollRad,
        gondolaPendulumSway,
        8.0,
        dt
      );

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
      const lookX = eyeX + Math.sin(this.currentYaw) * 10;
      const lookY = eyeY - 0.35 + (this.fireworkLookUpTimerSec > 0 ? 3.5 : 0);
      const lookZ = eyeZ + Math.cos(this.currentYaw) * 10;

      this.currentPos.x = THREE.MathUtils.damp(this.currentPos.x, eyeX, 18, dt);
      this.currentPos.y = THREE.MathUtils.damp(this.currentPos.y, eyeY, 18, dt);
      this.currentPos.z = THREE.MathUtils.damp(this.currentPos.z, eyeZ, 18, dt);
      this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, lookX, 18, dt);
      this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, lookY, 18, dt);
      this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, lookZ, 18, dt);
      this.applyCameraFov(camera, 52.0, 10, dt);

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

      this.currentPos.x = THREE.MathUtils.damp(this.currentPos.x, targetCamX, 12, dt);
      this.currentPos.y = THREE.MathUtils.damp(this.currentPos.y, targetCamY, 12, dt);
      this.currentPos.z = THREE.MathUtils.damp(this.currentPos.z, targetCamZ, 12, dt);
      this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, focalX, 14, dt);
      this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, focalY, 14, dt);
      this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, focalZ, 14, dt);
      this.applyCameraFov(camera, input.photoFov ?? 45, 10, dt);

      camera.up.set(0, 1, 0);
      camera.position.copy(this.currentPos);
      camera.lookAt(this.currentLookAt);
      if (Math.abs(photoBreathing.rollRad) > 0.0001) {
        camera.rotateZ(photoBreathing.rollRad);
      }
      return;
    }

    // =========================================================================
    // STATE 4: STALL MODAL BOOTH CAMERA (0.85s cubic ease-in-out)
    // =========================================================================
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

        this.currentPos.set(sx, sy, sz);
        this.currentLookAt.set(lx, ly, lz);
        this.applyCameraFov(camera, 42.0, 10, dt);

        camera.up.set(0, 1, 0);
        camera.position.copy(this.currentPos);
        camera.lookAt(this.currentLookAt);
        return;
      }
    }

    // =========================================================================
    // STATE 5: TRUE BEHIND-THE-BACK THIRD-PERSON ORBIT & SPRING-ARM RIG
    // - Pivot height: 1.65, Right-shoulder offset: +0.55, Distance: 5.4 (3.0..9.5)
    // - Default pitch: 12 deg (-8 deg..+45 deg)
    // - Keyboard Auto-Follow Assist (lambda = 2.2) when A/D walking without mouse drag
    // - Exponential Damping (lambda = 10) on currentYaw, currentPitch, currentDistance
    // =========================================================================
    this.smoothedVelX = THREE.MathUtils.damp(this.smoothedVelX, input.velocityX, 11, dt);
    this.smoothedVelZ = THREE.MathUtils.damp(this.smoothedVelZ, input.velocityZ, 11, dt);
    const moveSpeed = Math.hypot(this.smoothedVelX, this.smoothedVelZ);

    // Keyboard Auto-Follow Assist: when turning/strafing with A/D without dragging the mouse
    if (!input.isOrbitDragging && Math.abs(input.strafeInputX) > 0.1 && moveSpeed > 0.5) {
      this.targetYaw = dampAngleRad(this.targetYaw, input.playerYaw, 2.2, dt);
    }

    // Frame-rate independent exponential damping (lambda = 10)
    this.currentYaw = dampAngleRad(this.currentYaw, this.targetYaw, 10, dt);
    this.currentPitch = THREE.MathUtils.damp(this.currentPitch, this.targetPitch, 10, dt);
    this.currentDistance = THREE.MathUtils.damp(this.currentDistance, this.targetDistance, 10, dt);

    // Smooth Lotus Shield pullback (+1.4 units)
    this.shieldBlend = THREE.MathUtils.damp(
      this.shieldBlend,
      input.shieldActive ? 1.0 : 0.0,
      9.0,
      dt
    );

    // Tactile Gulal recoil kick (0.05m impulse settling smoothly over 120ms)
    const recoilNorm =
      this.fireRecoilTimerSec > 0
        ? this.fireRecoilTimerSec / ORBITAL_CAMERA_DEFAULTS.fireRecoilSettleSec
        : 0;
    const recoilImpulseMeters =
      ORBITAL_CAMERA_DEFAULTS.fireRecoilMeters * recoilNorm;

    const desiredPose = computeOrbitalThirdPersonPose({
      playerX: input.playerX,
      playerY: input.playerY,
      playerZ: input.playerZ,
      camYawRad: this.currentYaw,
      camPitchRad: this.currentPitch,
      distance: this.currentDistance,
      shieldBlend: this.shieldBlend,
      recoilImpulseMeters,
      fireworkLookUpTimerSec: this.fireworkLookUpTimerSec,
    });

    // Camera Collision Anti-Clip: THREE.Raycaster from shoulder pivot toward desired camera pos
    this._anchorOrigin.set(
      desiredPose.pivotX,
      desiredPose.pivotY,
      desiredPose.pivotZ
    );
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
        const starOffsets = computeStarWhiskerOffsets(this.currentYaw);

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
      this.smoothedClipDist = THREE.MathUtils.damp(
        this.smoothedClipDist,
        safeDist,
        safeDist < this.smoothedClipDist ? 20 : 10,
        dt
      );
      this._desiredPos
        .copy(this._anchorOrigin)
        .addScaledVector(this._rayDir, this.smoothedClipDist);
    } else {
      this.smoothedClipDist = THREE.MathUtils.damp(
        this.smoothedClipDist,
        fullRayLen,
        14,
        dt
      );
    }

    // Handheld Perlin-style breathing (0.08m vertical, 0.004 rad roll scaled by speed)
    this.breathPhase = stepHandheldBreathingPhase(this.breathPhase, dt, {
      moveSpeed,
      isSprintingOrDashing: input.isSprintingOrDashing,
    });
    const gameplayBreathing = computeHandheldBreathing(input.elapsedSec, {
      moveSpeed,
      isSprintingOrDashing: input.isSprintingOrDashing,
      phaseOverride: this.breathPhase,
    });

    const targetCamX =
      this._desiredPos.x +
      gameplayBreathing.horizontalOffsetM * 0.45 +
      input.shakeStep.offsetX * 0.45;
    const targetCamY =
      this._desiredPos.y +
      gameplayBreathing.verticalOffsetM +
      input.shakeStep.offsetY * 0.45;
    const targetCamZ = this._desiredPos.z + input.shakeStep.offsetZ * 0.45;

    const targetLookX = desiredPose.desiredLookAtX + input.shakeStep.offsetX * 0.4;
    const targetLookY = desiredPose.desiredLookAtY + input.shakeStep.offsetY * 0.4;
    const targetLookZ = desiredPose.desiredLookAtZ + input.shakeStep.offsetZ * 0.3;

    const targetGameplayFov = computeOrbitalGameplayFov({
      isSprintingOrDashing: input.isSprintingOrDashing,
    });

    // Blend smooth 1.5s Enter [World] swoop OR 0.85s ride/stall exit blend
    if (this.diveTransitionActive) {
      this.diveTransitionElapsedSec += dt;
      const rawProgress = Math.min(
        1.0,
        this.diveTransitionElapsedSec / this.diveDurationSec
      );
      const eased = cubicEaseInOut(rawProgress);

      this.currentPos.set(
        THREE.MathUtils.lerp(this.diveStartPos.x, targetCamX, eased),
        THREE.MathUtils.lerp(this.diveStartPos.y, targetCamY, eased),
        THREE.MathUtils.lerp(this.diveStartPos.z, targetCamZ, eased)
      );
      this.currentLookAt.set(
        THREE.MathUtils.lerp(this.diveStartLookAt.x, targetLookX, eased),
        THREE.MathUtils.lerp(this.diveStartLookAt.y, targetLookY, eased),
        THREE.MathUtils.lerp(this.diveStartLookAt.z, targetLookZ, eased)
      );
      const swoopFov = THREE.MathUtils.lerp(this.diveStartFov, targetGameplayFov, eased);
      this.applyCameraFov(camera, swoopFov, 20, dt);

      if (rawProgress >= 1.0) {
        this.diveTransitionActive = false;
      }
    } else if (this.rideTransitionProgress < 1.0) {
      const sCurve = cubicEaseInOut(this.rideTransitionProgress);
      this.currentPos.set(
        THREE.MathUtils.lerp(this.rideBlendStartPos.x, targetCamX, sCurve),
        THREE.MathUtils.lerp(this.rideBlendStartPos.y, targetCamY, sCurve),
        THREE.MathUtils.lerp(this.rideBlendStartPos.z, targetCamZ, sCurve)
      );
      this.currentLookAt.set(
        THREE.MathUtils.lerp(this.rideBlendStartLookAt.x, targetLookX, sCurve),
        THREE.MathUtils.lerp(this.rideBlendStartLookAt.y, targetLookY, sCurve),
        THREE.MathUtils.lerp(this.rideBlendStartLookAt.z, targetLookZ, sCurve)
      );
      this.applyCameraFov(camera, targetGameplayFov, 10, dt);
    } else if (this.stallTransitionProgress < 1.0) {
      const sCurve = cubicEaseInOut(this.stallTransitionProgress);
      this.currentPos.set(
        THREE.MathUtils.lerp(this.stallBlendStartPos.x, targetCamX, sCurve),
        THREE.MathUtils.lerp(this.stallBlendStartPos.y, targetCamY, sCurve),
        THREE.MathUtils.lerp(this.stallBlendStartPos.z, targetCamZ, sCurve)
      );
      this.currentLookAt.set(
        THREE.MathUtils.lerp(this.stallBlendStartLookAt.x, targetLookX, sCurve),
        THREE.MathUtils.lerp(this.stallBlendStartLookAt.y, targetLookY, sCurve),
        THREE.MathUtils.lerp(this.stallBlendStartLookAt.z, targetLookZ, sCurve)
      );
      this.applyCameraFov(camera, targetGameplayFov, 10, dt);
    } else {
      // Responsive, jitter-free positional follow
      this.currentPos.x = THREE.MathUtils.damp(this.currentPos.x, targetCamX, 18, dt);
      this.currentPos.y = THREE.MathUtils.damp(this.currentPos.y, targetCamY, 16, dt);
      this.currentPos.z = THREE.MathUtils.damp(this.currentPos.z, targetCamZ, 18, dt);
      this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, targetLookX, 22, dt);
      this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, targetLookY, 20, dt);
      this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, targetLookZ, 22, dt);
      this.applyCameraFov(camera, targetGameplayFov, 9, dt);
    }

    // Subtle ±1.8° cornering roll tilt when turning fast + Perlin breathing roll
    let yawDiff = input.playerYaw - this.prevPlayerYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.prevPlayerYaw = input.playerYaw;
    const rawYawRate = Math.max(-6.0, Math.min(6.0, yawDiff / dt));
    this.smoothedYawRate = THREE.MathUtils.damp(this.smoothedYawRate, rawYawRate, 10, dt);

    const targetCornerRoll = computeOrbitalCorneringRoll({
      strafeInputX: input.strafeInputX,
      yawRateRadPerSec: this.smoothedYawRate,
      moveSpeed,
    });
    const targetTotalRoll =
      targetCornerRoll + input.shakeStep.rollRad + gameplayBreathing.rollRad;
    this.currentRollRad = THREE.MathUtils.damp(
      this.currentRollRad,
      targetTotalRoll,
      10,
      dt
    );

    camera.up.set(0, 1, 0);
    camera.position.copy(this.currentPos);
    camera.lookAt(this.currentLookAt);
    if (Math.abs(this.currentRollRad) > 0.00005) {
      camera.rotateZ(this.currentRollRad);
    }
  }
}
