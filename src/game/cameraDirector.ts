import * as THREE from 'three';
import {
  MELA_STALLS,
  computeRideCabinCameraPose,
  cubicEaseInOut,
  computeHandheldBreathing,
  computeTargetGameplayFov,
  computeCorneringDutchRoll,
  computeSpringArmDesiredPose,
  resolveWhiskerCollisionDistance,
  stepScreenShake,
  type FestivalWorldId,
} from './rules';
import type {
  RideId,
  MiniGameStallId,
  CameraPerspectiveMode,
} from '../store/useMelaStore';

export type ScreenShakeStepResult = ReturnType<typeof stepScreenShake>;

/**
 * World-specific closed 3D Catmull-Rom Spline Rig (`camCurve` & `targetCurve`):
 * - Shot A (The Grand Reveal): Glides right through the illuminated Torana Entrance Arch / Courtyard Arch at eye level (y: 3.5),
 *   looking toward the central Rangoli and Temple Shikhara.
 * - Shot B (Low-Angle Hero Sweep): Skims low (y: 2.2) across the courtyard / reflective Diwali river / Holi marble floor while
 *   tilting upward (lookAt.y = 9.0) so the Temple and Haveli arches look monumental.
 * - Shot C (Rising Crane Vista): Ascends smoothly (y: 14.0) near the Carnival Ride Plaza / Vista to frame the entire rotating
 *   Aakash Jhula (Giant Wheel) inside the right two-thirds of the screen (never clipping off the right screen edge).
 */
interface WorldDroneSplineRig {
  camCurve: THREE.CatmullRomCurve3;
  targetCurve: THREE.CatmullRomCurve3;
  cycleDurationSec: number;
}

function buildWorldDroneSplines(): Record<FestivalWorldId, WorldDroneSplineRig> {
  // 1. WORLD 01: HOLI — BRAJ (Sunlit Haveli Chowk, Marigold Toran Arches, Haudi Vats & Nagara Shikhara)
  const holiCamCurve = new THREE.CatmullRomCurve3(
    [
      // Shot A: Gliding through the South-Center Marigold Toran Archway at eye level (y = 3.5)
      new THREE.Vector3(0.0, 3.5, 14.5),
      new THREE.Vector3(0.0, 3.5, -2.5),
      // Shot B: Low-Angle Hero Sweep skimming low (y = 2.2) across the Gulal-splattered courtyard tilting up at y = 9.0
      new THREE.Vector3(-9.5, 2.2, -5.5),
      new THREE.Vector3(8.5, 2.2, -4.5),
      // Shot C: Rising Crane Vista ascending smoothly to y = 14.0 overlooking the entire Braj Haveli Chowk & Shikhara
      new THREE.Vector3(16.5, 14.0, 13.5),
      new THREE.Vector3(-12.5, 11.5, 15.5),
    ],
    true,
    'catmullrom',
    0.5
  );

  const holiTargetCurve = new THREE.CatmullRomCurve3(
    [
      // Shot A LookAt: Central Rangoli & Temple Sanctum
      new THREE.Vector3(0.0, 5.2, -16.0),
      new THREE.Vector3(0.0, 6.8, -19.0),
      // Shot B LookAt: Monumental upward tilt (lookAt.y = 9.0) toward the carved Nagara Shikhara & Dhwaja flag
      new THREE.Vector3(0.0, 9.0, -19.0),
      new THREE.Vector3(-2.0, 9.0, -18.5),
      // Shot C LookAt: Framing the entire courtyard & temple spire from the crane vista
      new THREE.Vector3(0.0, 5.5, -10.5),
      new THREE.Vector3(0.0, 4.8, -12.0),
    ],
    true,
    'catmullrom',
    0.5
  );

  // 2. WORLD 02: DIWALI — GHAT (Sacred Riverfront, 300 Floating Diyas, 14-Step Stone Ghat & 3 Nagara Spires)
  const diwaliCamCurve = new THREE.CatmullRomCurve3(
    [
      // Shot A: Gliding along the illuminated Ghat Chhatri promenade at eye level (y = 3.5)
      new THREE.Vector3(-14.0, 3.5, 6.5),
      new THREE.Vector3(0.0, 3.5, 5.2),
      // Shot B: Low-Angle Hero Sweep skimming low (y = 2.2) over the reflective mirror river & Banarasi boats tilting up at y = 9.0
      new THREE.Vector3(8.5, 2.2, 16.5),
      new THREE.Vector3(-6.5, 2.2, 18.0),
      // Shot C: Rising Crane Vista ascending smoothly to y = 14.0 framing the 3 glowing Temple Shikharas & river diyas
      new THREE.Vector3(18.5, 14.0, 24.0),
      new THREE.Vector3(-16.0, 11.0, 18.5),
    ],
    true,
    'catmullrom',
    0.5
  );

  const diwaliTargetCurve = new THREE.CatmullRomCurve3(
    [
      // Shot A LookAt: Across the 1,200 Ghat Diyas toward the central Sanctum
      new THREE.Vector3(0.0, 5.0, -16.0),
      new THREE.Vector3(0.0, 6.4, -19.0),
      // Shot B LookAt: Monumental upward tilt (lookAt.y = 9.0) at the 3 golden Nagara Shikharas
      new THREE.Vector3(0.0, 9.0, -19.0),
      new THREE.Vector3(2.5, 9.0, -18.5),
      // Shot C LookAt: Wide crane framing of the entire riverfront Ghat & Temple skyline
      new THREE.Vector3(0.0, 5.2, -8.0),
      new THREE.Vector3(0.0, 4.5, -12.0),
    ],
    true,
    'catmullrom',
    0.5
  );

  // 3. WORLD 03: MELA CENTRAL HUB (Torana Entrance Arch, Nagara Temple & Aakash Jhula Giant Wheel at x: 38, z: -25)
  const melaCamCurve = new THREE.CatmullRomCurve3(
    [
      // Shot A (The Grand Reveal): Glides right through the illuminated Torana Entrance Arch (at x: 16, z: -4.5) at eye level (y = 3.5)
      new THREE.Vector3(21.5, 3.5, 2.5),
      new THREE.Vector3(11.5, 3.5, -6.5),
      // Shot B (Low-Angle Hero Sweep): Skims low (y = 2.2) across the wet cobblestone plaza while tilting upward (lookAt.y = 9.0)
      new THREE.Vector3(-4.5, 2.2, 4.5),
      new THREE.Vector3(-11.5, 2.2, -3.5),
      // Shot C (Rising Crane Vista): Ascends smoothly (y = 14.0) near the Carnival Ride Plaza to frame the entire rotating Giant Wheel inside the right two-thirds of the screen
      new THREE.Vector3(6.5, 14.0, 14.5),
      new THREE.Vector3(18.5, 14.0, 16.5),
    ],
    true,
    'catmullrom',
    0.5
  );

  const melaTargetCurve = new THREE.CatmullRomCurve3(
    [
      // Shot A LookAt: Through the Torana Arch toward the Central Rangoli & Temple Shikhara
      new THREE.Vector3(0.0, 4.8, -14.0),
      new THREE.Vector3(0.0, 6.5, -18.5),
      // Shot B LookAt: Monumental upward tilt (lookAt.y = 9.0) at the Temple Shikhara & Bazaar arches
      new THREE.Vector3(0.0, 9.0, -19.0),
      new THREE.Vector3(8.0, 9.0, -21.0),
      // Shot C LookAt: Aimed at (22, 11.5, -22) so the Temple sits on the left and the Giant Wheel (x = 38, z = -25) sits cleanly inside the right two-thirds of the viewport without clipping!
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
}

export class MelaCameraDirector {
  private readonly splines = buildWorldDroneSplines();
  private readonly raycaster = new THREE.Raycaster();

  private readonly currentPos = new THREE.Vector3(14, 3.5, 14);
  private readonly currentLookAt = new THREE.Vector3(0, 6.2, -16);
  private currentFov = 40;
  private currentRollRad = 0;
  private smoothedWhiskerDist = 5.2;

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

  // Reusable scratch vectors (zero per-frame GC allocation)
  private readonly _splinePos = new THREE.Vector3();
  private readonly _splineLook = new THREE.Vector3();
  private readonly _anchorOrigin = new THREE.Vector3();
  private readonly _rayDir = new THREE.Vector3();
  private readonly _desiredPos = new THREE.Vector3();
  private readonly _desiredLook = new THREE.Vector3();

  public triggerFireGulalRecoil(): void {
    this.fireRecoilTimerSec = 0.08; // 80ms FOV dip (-1.5°)
  }

  public triggerFireworkSkyLook(): void {
    this.fireworkLookUpTimerSec = 1.8; // 1.8s upward sky-tracking (+6.0m lookAt.y)
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

    // Detect transition from Preview Mode (isPlaying === false) -> Gameplay Mode (isPlaying === true)
    if (input.isPlaying && !this.wasPlaying) {
      this.diveTransitionActive = true;
      this.diveTransitionElapsedSec = 0;
      this.diveStartPos.copy(this.currentPos);
      this.diveStartLookAt.copy(this.currentLookAt);
      this.diveStartFov = this.currentFov;
    } else if (!input.isPlaying && this.wasPlaying) {
      this.diveTransitionActive = false;
      this.diveTransitionElapsedSec = 0;
    }
    this.wasPlaying = input.isPlaying;

    // Detect entering/exiting Gondola Ride for 0.8s S-curve transition
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

    // Detect entering/exiting Stall Modal for 0.8s S-curve transition
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

      const breathing = computeHandheldBreathing(input.elapsedSec);
      this._splinePos.y += breathing.verticalOffsetM;
      this._splinePos.x += breathing.horizontalOffsetM;

      if (!this.initializedPreviewPose) {
        this.initializedPreviewPose = true;
        this.currentPos.copy(this._splinePos);
        this.currentLookAt.copy(this._splineLook);
      } else {
        // Smoothly damp toward the spline trajectory so switching worlds in preview mode glides seamlessly
        this.currentPos.x = THREE.MathUtils.damp(
          this.currentPos.x,
          this._splinePos.x,
          5.5,
          dt
        );
        this.currentPos.y = THREE.MathUtils.damp(
          this.currentPos.y,
          this._splinePos.y,
          5.5,
          dt
        );
        this.currentPos.z = THREE.MathUtils.damp(
          this.currentPos.z,
          this._splinePos.z,
          5.5,
          dt
        );

        this.currentLookAt.x = THREE.MathUtils.damp(
          this.currentLookAt.x,
          this._splineLook.x,
          7.5,
          dt
        );
        this.currentLookAt.y = THREE.MathUtils.damp(
          this.currentLookAt.y,
          this._splineLook.y,
          7.5,
          dt
        );
        this.currentLookAt.z = THREE.MathUtils.damp(
          this.currentLookAt.z,
          this._splineLook.z,
          7.5,
          dt
        );
      }

      // Base preview FOV = 40 (35mm cinema prime lens look)
      this.currentFov = THREE.MathUtils.damp(this.currentFov, 40.0, 8.0, dt);
      if (Math.abs(camera.fov - this.currentFov) > 0.02) {
        camera.fov = this.currentFov;
        camera.updateProjectionMatrix();
      }

      camera.up.set(0, 1, 0);
      camera.position.copy(this.currentPos);
      camera.lookAt(this.currentLookAt);
      camera.rotateZ(breathing.rollRad);
      return;
    }

    // =========================================================================
    // STATE 2: MOUNTED RIDE GONDOLA CAMERA (with 0.8s S-curve entry & pendulum sway)
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

      this.currentPos.lerpVectors(this.rideBlendStartPos, this._desiredPos, sCurve);
      this.currentLookAt.lerpVectors(
        this.rideBlendStartLookAt,
        this._desiredLook,
        sCurve
      );

      this.currentFov = THREE.MathUtils.damp(this.currentFov, 48.0, 8.0, dt);
      if (Math.abs(camera.fov - this.currentFov) > 0.02) {
        camera.fov = this.currentFov;
        camera.updateProjectionMatrix();
      }

      camera.up.set(0, 1, 0);
      camera.position.copy(this.currentPos);
      camera.lookAt(this.currentLookAt);

      // Gentle pendulum camera sway inside the moving Gondola
      const gondolaPendulumSway =
        cabinPose.swingAngleRad !== 0
          ? cabinPose.swingAngleRad * 0.22
          : Math.sin(input.elapsedSec * 1.65) * 0.018;
      camera.rotateZ(gondolaPendulumSway);
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

      this.currentPos.set(eyeX, eyeY, eyeZ);
      this.currentLookAt.set(
        eyeX + Math.sin(input.playerYaw) * 10,
        eyeY - 0.35 + (this.fireworkLookUpTimerSec > 0 ? 3.5 : 0),
        eyeZ + Math.cos(input.playerYaw) * 10
      );

      camera.up.set(0, 1, 0);
      camera.position.copy(this.currentPos);
      camera.lookAt(this.currentLookAt);
      if (input.shakeStep.rollRad !== 0) {
        camera.rotateZ(input.shakeStep.rollRad * 0.6);
      }
      return;
    }

    // =========================================================================
    // STATE 4: AAA OVER-THE-SHOULDER SPRING-ARM GAMEPLAY CAMERA
    // =========================================================================
    const moveSpeed = Math.hypot(input.velocityX, input.velocityZ);

    // 4A. Compute Spring-Arm Desired Pose (Rule-of-Thirds offset, Velocity Look-Ahead, Monument Vista Framing, Shield Orbit, Firework Sky Tilt)
    const desiredPose = computeSpringArmDesiredPose({
      playerX: input.playerX,
      playerY: input.playerY,
      playerZ: input.playerZ,
      velocityX: input.velocityX,
      velocityZ: input.velocityZ,
      activeWorld: input.activeWorld,
      shieldActive: input.shieldActive,
      fireworkLookUpTimerSec: this.fireworkLookUpTimerSec,
      elapsedSec: input.elapsedSec,
    });

    // If a Stall Modal is open, smoothly frame the stall counter over 0.8s S-curve
    if (input.activeStallModal) {
      const stallSpec = MELA_STALLS.find((s) => s.id === input.activeStallModal);
      if (stallSpec) {
        const sCurve = cubicEaseInOut(this.stallTransitionProgress);
        this._desiredPos.set(stallSpec.x + 1.2, 2.05, stallSpec.z + 3.4);
        this._desiredLook.set(stallSpec.x, 1.75, stallSpec.z - 0.5);
        this.currentPos.lerpVectors(this.stallBlendStartPos, this._desiredPos, sCurve);
        this.currentLookAt.lerpVectors(
          this.stallBlendStartLookAt,
          this._desiredLook,
          sCurve
        );
        this.currentFov = THREE.MathUtils.damp(this.currentFov, 42.0, 8.0, dt);
        if (Math.abs(camera.fov - this.currentFov) > 0.02) {
          camera.fov = this.currentFov;
          camera.updateProjectionMatrix();
        }
        camera.up.set(0, 1, 0);
        camera.position.copy(this.currentPos);
        camera.lookAt(this.currentLookAt);
        return;
      }
    }

    // 4B. Anti-Clip Camera Collision Whiskers (THREE.Raycaster from playerPos + (0, 1.6, 0) toward desired camera pos)
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
      // Throttle raycast to every 3rd frame to maintain locked 60 FPS
      this.whiskerFrameCounter = (this.whiskerFrameCounter + 1) % 3;
      if (this.whiskerFrameCounter === 0) {
        this.raycaster.set(this._anchorOrigin, this._rayDir);
        this.raycaster.near = 0.4;
        this.raycaster.far = fullRayLen;
        const hits = this.raycaster.intersectObjects(input.colliderMeshes, true);
        const solidArchHit = hits.find(
          (h) =>
            h.point.y > 0.45 &&
            (h.object as THREE.Mesh).isMesh &&
            h.object.visible
        );
        this.lastCachedHitDist = solidArchHit ? solidArchHit.distance : null;
      }
      const safeDist = resolveWhiskerCollisionDistance(
        fullRayLen,
        this.lastCachedHitDist
      );
      this.smoothedWhiskerDist = THREE.MathUtils.damp(
        this.smoothedWhiskerDist,
        safeDist,
        18.0,
        dt
      );
      this._desiredPos
        .copy(this._anchorOrigin)
        .addScaledVector(this._rayDir, this.smoothedWhiskerDist);
    } else {
      this.smoothedWhiskerDist = THREE.MathUtils.damp(
        this.smoothedWhiskerDist,
        fullRayLen,
        10.0,
        dt
      );
    }

    // Add directional recoil / impact shake offsets
    const targetCamX = this._desiredPos.x + input.shakeStep.offsetX * 0.55;
    const targetCamY = this._desiredPos.y + input.shakeStep.offsetY * 0.55;
    const targetCamZ = this._desiredPos.z + input.shakeStep.offsetZ * 0.55;

    const targetLookX = desiredPose.desiredLookAtX + input.shakeStep.offsetX * 0.6;
    const targetLookY = desiredPose.desiredLookAtY + input.shakeStep.offsetY * 0.6;
    const targetLookZ = desiredPose.desiredLookAtZ + input.shakeStep.offsetZ * 0.4;

    // 4C. Dual-Rate Exponential Damping:
    // - Camera Position: lambda = 7.5 (weighty spring-arm lag)
    // - LookAt Target: lambda = 14.0 (responsive velocity look-ahead)
    if (this.diveTransitionActive) {
      this.diveTransitionElapsedSec += dt;
      const rawProgress = Math.min(
        1.0,
        this.diveTransitionElapsedSec / this.diveDurationSec
      );
      const eased = cubicEaseInOut(rawProgress);

      // Subtle spring settle right as transition finishes (0.82 -> 1.0)
      const springSettle =
        rawProgress > 0.75
          ? Math.sin(((rawProgress - 0.75) / 0.25) * Math.PI) * -0.14
          : 0;

      this.currentPos.x = THREE.MathUtils.lerp(
        this.diveStartPos.x,
        targetCamX,
        eased
      );
      this.currentPos.y =
        THREE.MathUtils.lerp(this.diveStartPos.y, targetCamY, eased) +
        springSettle;
      this.currentPos.z = THREE.MathUtils.lerp(
        this.diveStartPos.z,
        targetCamZ,
        eased
      );

      this.currentLookAt.x = THREE.MathUtils.lerp(
        this.diveStartLookAt.x,
        targetLookX,
        eased
      );
      this.currentLookAt.y = THREE.MathUtils.lerp(
        this.diveStartLookAt.y,
        targetLookY,
        eased
      );
      this.currentLookAt.z = THREE.MathUtils.lerp(
        this.diveStartLookAt.z,
        targetLookZ,
        eased
      );

      const targetFovAfterDive = computeTargetGameplayFov({
        moveSpeed,
        isSprintingOrDashing: input.isSprintingOrDashing,
        fireRecoilTimerSec: this.fireRecoilTimerSec,
      });
      this.currentFov = THREE.MathUtils.lerp(
        this.diveStartFov,
        targetFovAfterDive,
        eased
      );

      if (rawProgress >= 1.0) {
        this.diveTransitionActive = false;
      }
    } else {
      this.currentPos.x = THREE.MathUtils.damp(
        this.currentPos.x,
        targetCamX,
        7.5,
        dt
      );
      this.currentPos.y = THREE.MathUtils.damp(
        this.currentPos.y,
        targetCamY,
        7.5,
        dt
      );
      this.currentPos.z = THREE.MathUtils.damp(
        this.currentPos.z,
        targetCamZ,
        7.5,
        dt
      );

      this.currentLookAt.x = THREE.MathUtils.damp(
        this.currentLookAt.x,
        targetLookX,
        14.0,
        dt
      );
      this.currentLookAt.y = THREE.MathUtils.damp(
        this.currentLookAt.y,
        targetLookY,
        14.0,
        dt
      );
      this.currentLookAt.z = THREE.MathUtils.damp(
        this.currentLookAt.z,
        targetLookZ,
        14.0,
        dt
      );

      // 4D. Dynamic Speed FOV (43° Idle, 46° Walk, 58° Sprint/Dash, -1.5° Recoil Dip)
      const targetGameplayFov = computeTargetGameplayFov({
        moveSpeed,
        isSprintingOrDashing: input.isSprintingOrDashing,
        fireRecoilTimerSec: this.fireRecoilTimerSec,
      });
      this.currentFov = THREE.MathUtils.damp(
        this.currentFov,
        targetGameplayFov,
        9.5,
        dt
      );
    }

    if (Math.abs(camera.fov - this.currentFov) > 0.02) {
      camera.fov = this.currentFov;
      camera.updateProjectionMatrix();
    }

    // 4E. Cornering Dutch Roll (±2.5° / ±0.043 rad into strafes and rapid turns)
    let yawDiff = input.playerYaw - this.prevPlayerYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.prevPlayerYaw = input.playerYaw;
    const yawRate = yawDiff / dt;

    const targetDutchRoll = computeCorneringDutchRoll({
      strafeInputX: input.strafeInputX,
      yawRateRadPerSec: yawRate,
      moveSpeed,
    });
    this.currentRollRad = THREE.MathUtils.damp(
      this.currentRollRad,
      targetDutchRoll + input.shakeStep.rollRad,
      10.0,
      dt
    );

    camera.up.set(0, 1, 0);
    camera.position.copy(this.currentPos);
    camera.lookAt(this.currentLookAt);
    if (Math.abs(this.currentRollRad) > 0.0001) {
      camera.rotateZ(this.currentRollRad);
    }
  }
}
