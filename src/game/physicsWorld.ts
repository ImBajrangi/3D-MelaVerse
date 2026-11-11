import RAPIER from '@dimforge/rapier3d-compat';
import { MELA_RIDES, MELA_STALLS } from './rules';

export interface StaticObstacleCollider {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface CharacterPhysicsStepInput {
  currentX: number;
  currentY: number;
  currentZ: number;
  velocityY: number;
  desiredDeltaX: number;
  desiredDeltaZ: number;
  jumpRequested: boolean;
  dt: number;
  arenaRadius: number;
}

export interface CharacterPhysicsStepResult {
  x: number;
  y: number;
  z: number;
  velocityY: number;
  isGrounded: boolean;
}

/**
 * Physics-Driven Player Controller & World Collision Boundary System
 * Powered by @dimforge/rapier3d-compat (Capsule Collider + KinematicCharacterController)
 * with an instant synchronous fallback solver while WASM initializes.
 */
export class MelaPhysicsWorld {
  private world: RAPIER.World | null = null;
  private characterController: RAPIER.KinematicCharacterController | null = null;
  private playerBody: RAPIER.RigidBody | null = null;
  private playerCollider: RAPIER.Collider | null = null;
  private ready = false;
  private disposed = false;

  public readonly obstacles: StaticObstacleCollider[] = [];

  constructor() {
    this.buildStaticObstacleList();
    void this.initRapier();
  }

  private buildStaticObstacleList(): void {
    // 1. Mela Rides collision footprints
    for (const ride of MELA_RIDES) {
      this.obstacles.push({
        id: `ride_${ride.id}`,
        x: ride.x,
        z: ride.z,
        radius: ride.id === 'giant_wheel' ? 4.8 : 4.2,
      });
    }

    // 2. Mini-Game & Prize Stalls collision footprints
    for (const stall of MELA_STALLS) {
      this.obstacles.push({
        id: `stall_${stall.id}`,
        x: stall.x,
        z: stall.z,
        radius: 3.4,
      });
    }

    // 3. Corner Bazaar Pavilions
    const bazaarCorners = [
      { id: 'bazaar_nw', x: -24, z: -24, radius: 3.6 },
      { id: 'bazaar_ne', x: 24, z: -24, radius: 3.6 },
      { id: 'bazaar_sw', x: -24, z: 24, radius: 3.6 },
      { id: 'bazaar_se', x: 24, z: 24, radius: 3.6 },
    ];
    for (const b of bazaarCorners) {
      this.obstacles.push(b);
    }
  }

  private async initRapier(): Promise<void> {
    try {
      await RAPIER.init();
      if (this.disposed) return;

      const world = new RAPIER.World({ x: 0.0, y: -22.0, z: 0.0 });

      // Ground plane collider
      const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(85, 0.5, 85).setTranslation(0, -0.5, 0),
        groundBody
      );

      // Outer Mela perimeter fence segments (16 octagonal/circular boundary walls at radius 58m)
      const wallSegments = 16;
      const arenaRadius = 58.0;
      for (let i = 0; i < wallSegments; i++) {
        const angle = (i / wallSegments) * Math.PI * 2;
        const wx = Math.cos(angle) * arenaRadius;
        const wz = Math.sin(angle) * arenaRadius;
        const wallBody = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(wx, 2.5, wz)
            .setRotation({
              x: 0,
              y: Math.sin(-angle * 0.5),
              z: 0,
              w: Math.cos(-angle * 0.5),
            })
        );
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(1.0, 3.0, 12.2),
          wallBody
        );
      }

      // Fixed cylindrical colliders for all Rides, Stalls, and Corner Pavilions
      for (const obs of this.obstacles) {
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(obs.x, 2.0, obs.z)
        );
        world.createCollider(
          RAPIER.ColliderDesc.cylinder(2.0, obs.radius),
          body
        );
      }

      // Player Capsule Collider (halfHeight = 0.55m, radius = 0.45m -> center at y = 1.0m)
      const playerBodyDesc =
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.0, 12);
      const playerBody = world.createRigidBody(playerBodyDesc);
      const playerCollider = world.createCollider(
        RAPIER.ColliderDesc.capsule(0.55, 0.45),
        playerBody
      );

      const controller = world.createCharacterController(0.04);
      controller.enableAutostep(0.35, 0.2, true);
      controller.enableSnapToGround(0.3);

      this.world = world;
      this.playerBody = playerBody;
      this.playerCollider = playerCollider;
      this.characterController = controller;
      this.ready = true;
    } catch {
      // Fallback solver continues seamlessly if WebAssembly cannot initialize
      this.ready = false;
    }
  }

  public isRapierReady(): boolean {
    return this.ready;
  }

  public teleportPlayer(x: number, y: number, z: number): void {
    if (this.playerBody && this.ready) {
      this.playerBody.setNextKinematicTranslation({ x, y: y + 1.0, z });
      this.world?.step();
    }
  }

  public stepCharacter(input: CharacterPhysicsStepInput): CharacterPhysicsStepResult {
    const gravity = -24.0;
    let nextVy = input.velocityY;
    let currentY = input.currentY;

    if (input.jumpRequested && currentY <= 0.06) {
      nextVy = 8.6;
    } else {
      nextVy += gravity * input.dt;
    }

    const desiredDeltaY = nextVy * input.dt;

    if (
      this.ready &&
      this.world &&
      this.characterController &&
      this.playerCollider &&
      this.playerBody
    ) {
      this.playerBody.setNextKinematicTranslation({
        x: input.currentX,
        y: currentY + 1.0,
        z: input.currentZ,
      });

      this.characterController.computeColliderMovement(
        this.playerCollider,
        {
          x: input.desiredDeltaX,
          y: desiredDeltaY,
          z: input.desiredDeltaZ,
        }
      );

      const corrected = this.characterController.computedMovement();
      const grounded = this.characterController.computedGrounded() || currentY + corrected.y <= 0.01;

      let nextX = input.currentX + corrected.x;
      let nextY = Math.max(0, currentY + corrected.y);
      let nextZ = input.currentZ + corrected.z;

      // Clamp to outer Mela wall radius as safety net
      const radial = Math.hypot(nextX, nextZ);
      if (radial > input.arenaRadius) {
        nextX = (nextX / radial) * input.arenaRadius;
        nextZ = (nextZ / radial) * input.arenaRadius;
      }

      if (nextY <= 0.01 && nextVy < 0) {
        nextY = 0;
        nextVy = 0;
      }

      this.playerBody.setNextKinematicTranslation({
        x: nextX,
        y: nextY + 1.0,
        z: nextZ,
      });
      this.world.step();

      return {
        x: nextX,
        y: nextY,
        z: nextZ,
        velocityY: nextVy,
        isGrounded: grounded,
      };
    }

    // Immediate deterministic fallback solver (active on frame 0 before WASM resolves)
    let nextX = input.currentX + input.desiredDeltaX;
    let nextZ = input.currentZ + input.desiredDeltaZ;
    let nextY = currentY + desiredDeltaY;
    let isGrounded = false;

    if (nextY <= 0) {
      nextY = 0;
      nextVy = 0;
      isGrounded = true;
    }

    // Push out of static ride/stall obstacles
    const playerRadius = 0.55;
    for (const obs of this.obstacles) {
      const dx = nextX - obs.x;
      const dz = nextZ - obs.z;
      const dist = Math.hypot(dx, dz);
      const minSep = obs.radius + playerRadius;
      if (dist > 0.0001 && dist < minSep) {
        nextX = obs.x + (dx / dist) * minSep;
        nextZ = obs.z + (dz / dist) * minSep;
      }
    }

    const radial = Math.hypot(nextX, nextZ);
    if (radial > input.arenaRadius) {
      nextX = (nextX / radial) * input.arenaRadius;
      nextZ = (nextZ / radial) * input.arenaRadius;
    }

    return {
      x: nextX,
      y: nextY,
      z: nextZ,
      velocityY: nextVy,
      isGrounded,
    };
  }

  public dispose(): void {
    this.disposed = true;
    try {
      if (this.characterController && this.world) {
        this.world.removeCharacterController(this.characterController);
      }
      this.world?.free();
    } catch {
      // Ignore cleanup errors
    }
    this.world = null;
    this.characterController = null;
    this.playerBody = null;
    this.playerCollider = null;
    this.ready = false;
  }
}
