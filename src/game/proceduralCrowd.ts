import * as THREE from 'three';
import {
  stepProceduralCrowdVisitor,
  computeCrowdMemberPose,
  type CrowdBehaviorState,
  type CrowdVisitorState,
  type FestivalWorldId,
} from './rules';

export const MAX_PROCEDURAL_CROWD = 36;

const KURTA_PALETTE = [
  0xd94662, // Festive Rani Crimson
  0xd97706, // Marigold Saffron
  0x0e8aa8, // Peacock Teal
  0x158055, // Emerald Silk
  0x6d3fc9, // Royal Jamuni
  0xc84b18, // Sindoor Terracotta
  0x2563eb, // Neel Azure
  0xa21caf, // Gulabi Magenta
];

const PAGDI_PALETTE = [
  0xf59e0b, // Sunlit Marigold
  0xe11d48, // Bandhani Rose
  0x06b6d4, // Peacock Turquoise
  0x84cc16, // Mehendi Lime
  0xf97316, // Kesariya Orange
  0xa855f7, // Royal Orchid
];

const DHOTI_PALETTE = [
  0xe6dcc8, // Warm Raw Silk
  0xf2e4c6, // Cream Khadi
  0xd9caa8, // Sand Muslin
  0xebd8b0, // Ivory Gold
];

const SKIN_PALETTE = [
  0xc88a55,
  0xd69b67,
  0xb57543,
  0x9e6238,
  0xdba577,
];

export interface CrowdUpdateInput {
  dt: number;
  elapsedSec: number;
  activeCount: number;
  activeWorld: FestivalWorldId;
  playerX: number;
  playerZ: number;
  playerSpeed: number;
  obstacles: { x: number; z: number; radius: number }[];
  isTitlePreview?: boolean;
}

export class ProceduralCrowdSystem {
  private readonly rootGroup = new THREE.Group();
  private readonly visitors: CrowdVisitorState[] = [];
  private activeCount = 28;
  private lastWorld: FestivalWorldId = 'holi_braj';

  private readonly kurtaMesh: THREE.InstancedMesh;
  private readonly dhotiMesh: THREE.InstancedMesh;
  private readonly headMesh: THREE.InstancedMesh;
  private readonly pagdiMesh: THREE.InstancedMesh;
  private readonly leftArmMesh: THREE.InstancedMesh;
  private readonly rightArmMesh: THREE.InstancedMesh;
  private readonly dupattaMesh: THREE.InstancedMesh;
  private readonly allMeshes: THREE.InstancedMesh[];

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  // Reusable scratch transforms (zero per-frame GC allocation)
  private readonly _basePos = new THREE.Vector3();
  private readonly _baseQuat = new THREE.Quaternion();
  private readonly _baseEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _baseScale = new THREE.Vector3(1, 1, 1);
  private readonly _rootMat = new THREE.Matrix4();

  private readonly _localPos = new THREE.Vector3();
  private readonly _localQuat = new THREE.Quaternion();
  private readonly _localEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _localScale = new THREE.Vector3(1, 1, 1);
  private readonly _localMat = new THREE.Matrix4();
  private readonly _finalMat = new THREE.Matrix4();
  private readonly _scratchColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.rootGroup.name = 'ProceduralCrowdSystem';

    // 1. Tapered Dhoti / Ghagra lower garment (feet flush at y = 0)
    const dhotiGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.72, 10);
    dhotiGeo.translate(0, 0.36, 0);

    // 2. Flared Angarkha / Kurta torso tunic (y: 0.56 -> 1.38)
    const kurtaPoints = [
      new THREE.Vector2(0.0, 0.56),
      new THREE.Vector2(0.29, 0.58),
      new THREE.Vector2(0.24, 0.84),
      new THREE.Vector2(0.20, 1.02),
      new THREE.Vector2(0.24, 1.24),
      new THREE.Vector2(0.15, 1.38),
      new THREE.Vector2(0.0, 1.40),
    ];
    const kurtaGeo = new THREE.LatheGeometry(kurtaPoints, 12);

    // 3. Sculpted Head (centered at y = 1.55)
    const headGeo = new THREE.SphereGeometry(0.175, 12, 10);
    headGeo.translate(0, 1.55, 0);

    // 4. Layered Royal Pagdi Turban + Kalgi Plume (y: 1.62 -> 1.98)
    const pagdiPoints = [
      new THREE.Vector2(0.0, 1.64),
      new THREE.Vector2(0.22, 1.66),
      new THREE.Vector2(0.24, 1.74),
      new THREE.Vector2(0.20, 1.82),
      new THREE.Vector2(0.12, 1.87),
      new THREE.Vector2(0.05, 1.98),
      new THREE.Vector2(0.0, 1.98),
    ];
    const pagdiGeo = new THREE.LatheGeometry(pagdiPoints, 12);

    // 5. Left & Right Articulated Arms (local origin at shoulder joint, extends downward -0.44m)
    const armGeo = new THREE.CapsuleGeometry(0.054, 0.34, 4, 8);
    armGeo.translate(0, -0.20, 0);

    // 6. Curved Silk Dupatta Shoulder Drape (wraps smoothly across upper back instead of a flat slab)
    const dupattaGeo = new THREE.CylinderGeometry(
      0.20,
      0.23,
      0.54,
      8,
      1,
      false,
      Math.PI * 0.72,
      Math.PI * 0.56
    );
    dupattaGeo.translate(0, -0.24, 0.09);

    this.geometries.push(dhotiGeo, kurtaGeo, headGeo, pagdiGeo, armGeo, dupattaGeo);

    const kurtaMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.04,
    });
    const dhotiMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.02,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.56,
      metalness: 0.04,
    });
    const pagdiMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.52,
      metalness: 0.1,
    });
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.76,
      metalness: 0.04,
    });
    const dupattaMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.14,
    });

    this.materials.push(kurtaMat, dhotiMat, headMat, pagdiMat, armMat, dupattaMat);

    this.kurtaMesh = new THREE.InstancedMesh(kurtaGeo, kurtaMat, MAX_PROCEDURAL_CROWD);
    this.dhotiMesh = new THREE.InstancedMesh(dhotiGeo, dhotiMat, MAX_PROCEDURAL_CROWD);
    this.headMesh = new THREE.InstancedMesh(headGeo, headMat, MAX_PROCEDURAL_CROWD);
    this.pagdiMesh = new THREE.InstancedMesh(pagdiGeo, pagdiMat, MAX_PROCEDURAL_CROWD);
    this.leftArmMesh = new THREE.InstancedMesh(armGeo, armMat, MAX_PROCEDURAL_CROWD);
    this.rightArmMesh = new THREE.InstancedMesh(armGeo, armMat, MAX_PROCEDURAL_CROWD);
    this.dupattaMesh = new THREE.InstancedMesh(dupattaGeo, dupattaMat, MAX_PROCEDURAL_CROWD);

    this.allMeshes = [
      this.kurtaMesh,
      this.dhotiMesh,
      this.headMesh,
      this.pagdiMesh,
      this.leftArmMesh,
      this.rightArmMesh,
      this.dupattaMesh,
    ];

    for (const mesh of this.allMeshes) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.rootGroup.add(mesh);
    }

    // Spawn 36 festive revelers along the open courtyard promenade ring
    for (let i = 0; i < MAX_PROCEDURAL_CROWD; i++) {
      const angle = (i / MAX_PROCEDURAL_CROWD) * Math.PI * 2;
      const radius = 11.5 + (i % 6) * 3.4;
      const vx = Math.cos(angle) * radius;
      const vz = Math.sin(angle) * radius;
      const nextAngle = angle + 0.55;

      this.visitors.push({
        id: i + 1,
        x: vx,
        z: vz,
        vx: 0,
        vz: 0,
        targetX: Math.cos(nextAngle) * radius,
        targetZ: Math.sin(nextAngle) * radius,
        speed: 1.55 + (i % 4) * 0.25,
        stridePhase: i * 0.72,
        paletteIndex: i % KURTA_PALETTE.length,
        behaviorState: i % 5 === 0 ? 'idle_chat' : 'strolling',
        behaviorTimer: i % 5 === 0 ? 1.8 + (i % 3) * 0.7 : 0,
        emotePhase: i * 0.61,
        reactionCooldown: 1.5 + (i % 4) * 0.8,
        facingYaw: nextAngle + Math.PI * 0.5,
        scaleFactor: 0.92 + (i % 5) * 0.04,
      });

      const kurtaHex = KURTA_PALETTE[i % KURTA_PALETTE.length];
      const pagdiHex = PAGDI_PALETTE[(i * 3 + 1) % PAGDI_PALETTE.length];
      const dhotiHex = DHOTI_PALETTE[i % DHOTI_PALETTE.length];
      const skinHex = SKIN_PALETTE[(i * 2) % SKIN_PALETTE.length];

      this._scratchColor.setHex(kurtaHex);
      this.kurtaMesh.setColorAt(i, this._scratchColor);
      this.leftArmMesh.setColorAt(i, this._scratchColor);
      this.rightArmMesh.setColorAt(i, this._scratchColor);

      this._scratchColor.setHex(dhotiHex);
      this.dhotiMesh.setColorAt(i, this._scratchColor);

      this._scratchColor.setHex(skinHex);
      this.headMesh.setColorAt(i, this._scratchColor);

      this._scratchColor.setHex(pagdiHex);
      this.pagdiMesh.setColorAt(i, this._scratchColor);
      this.dupattaMesh.setColorAt(i, this._scratchColor);
    }

    for (const mesh of this.allMeshes) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    scene.add(this.rootGroup);
  }

  public setVisible(visible: boolean): void {
    this.rootGroup.visible = visible;
  }

  /**
   * Triggers a synchronized celebratory emote wave across revelers within `radius`
   * when the player launches fireworks, lights diyas, stamps rangolis, activates lotus shield, or scores a joy burst.
   */
  public triggerCelebration(
    originX: number,
    originZ: number,
    radius = 22.0,
    preferredEmote: Extract<
      CrowdBehaviorState,
      'celebrate_cheer' | 'celebrate_dance' | 'celebrate_namaste'
    > = 'celebrate_cheer'
  ): number {
    let affected = 0;
    for (let i = 0; i < this.activeCount; i++) {
      const v = this.visitors[i];
      const dist = Math.hypot(v.x - originX, v.z - originZ);
      if (dist <= radius) {
        const emote: CrowdBehaviorState =
          preferredEmote === 'celebrate_cheer' && i % 2 === 1
            ? 'celebrate_dance'
            : preferredEmote;
        this.visitors[i] = {
          ...v,
          behaviorState: emote,
          behaviorTimer: 3.2 + (i % 4) * 0.45,
          reactionCooldown: 7.5,
          facingYaw: Math.atan2(originX - v.x, originZ - v.z),
        };
        affected++;
      }
    }
    return affected;
  }

  public update(input: CrowdUpdateInput): void {
    const count = Math.max(8, Math.min(MAX_PROCEDURAL_CROWD, input.activeCount));
    this.activeCount = count;

    if (input.activeWorld !== this.lastWorld) {
      this.lastWorld = input.activeWorld;
      for (let i = 0; i < MAX_PROCEDURAL_CROWD; i++) {
        if (input.activeWorld === 'diwali_ghat') {
          const laneX = -25 + ((i * 7.3) % 50);
          const laneZ = -15.6 + (i % 5) * 1.05;
          this.visitors[i] = {
            ...this.visitors[i],
            x: laneX,
            z: laneZ,
            targetX: -laneX * 0.65,
            targetZ: -13.2 + ((i + 2) % 4) * 0.85,
          };
        } else {
          const angle = (i / MAX_PROCEDURAL_CROWD) * Math.PI * 2;
          const r = 11.5 + (i % 6) * 3.4;
          this.visitors[i] = {
            ...this.visitors[i],
            x: Math.cos(angle) * r,
            z: Math.sin(angle) * r,
            targetX: Math.cos(angle + 0.55) * r,
            targetZ: Math.sin(angle + 0.55) * r,
          };
        }
      }
    }

    // Build static courtyard landmark colliders so revelers steer gracefully around fountains, temple & vats
    const courtyardObstacles = [
      ...input.obstacles,
      { x: 0, z: -19, radius: 6.5 }, // Central Nagara Temple Sanctum
      { x: -14.5, z: -6.5, radius: 2.8 }, // West Brass Fountain
      { x: 14.5, z: -6.5, radius: 2.8 }, // East Brass Fountain
      { x: 0, z: 16.5, radius: 2.8 }, // South Brass Fountain
      { x: -18.5, z: -9.5, radius: 2.4 },
      { x: 18.5, z: -9.5, radius: 2.4 },
      { x: -18.5, z: 8.5, radius: 2.4 },
      { x: 18.5, z: 8.5, radius: 2.4 },
    ];
    if (input.activeWorld === 'holi_braj') {
      courtyardObstacles.push(
        { x: -10.5, z: -4.5, radius: 2.2 },
        { x: 10.5, z: -4.5, radius: 2.2 },
        { x: -10.5, z: 4.5, radius: 2.2 },
        { x: 10.5, z: 4.5, radius: 2.2 }
      );
    }

    // In title preview keep crowd strolling peacefully without locking onto parked spawn
    const effectivePlayerX = input.isTitlePreview ? 999 : input.playerX;
    const effectivePlayerZ = input.isTitlePreview ? 999 : input.playerZ;

    for (let i = 0; i < count; i++) {
      const nextState = stepProceduralCrowdVisitor(
        this.visitors[i],
        courtyardObstacles,
        {
          playerX: effectivePlayerX,
          playerZ: effectivePlayerZ,
          playerSpeed: input.playerSpeed,
          activeWorld: input.activeWorld,
        },
        input.dt
      );
      this.visitors[i] = nextState;

      const pose = computeCrowdMemberPose(nextState, input.elapsedSec);

      // Root character transform at (x, pelvisY, z) facing yaw
      this._basePos.set(nextState.x, pose.pelvisY, nextState.z);
      this._baseEuler.set(pose.torsoPitch, pose.yaw, pose.torsoRoll);
      this._baseQuat.setFromEuler(this._baseEuler);
      this._baseScale.setScalar(pose.scale);
      this._rootMat.compose(this._basePos, this._baseQuat, this._baseScale);

      // Kurta & Dhoti share main body transform
      this.kurtaMesh.setMatrixAt(i, this._rootMat);
      this.dhotiMesh.setMatrixAt(i, this._rootMat);

      // Head & Pagdi share subtle head glance offset
      if (Math.abs(pose.headYaw) > 0.002 || Math.abs(pose.headPitch) > 0.002) {
        this._localPos.set(0, 0, 0);
        this._localEuler.set(pose.headPitch, pose.headYaw, 0);
        this._localQuat.setFromEuler(this._localEuler);
        this._localScale.set(1, 1, 1);
        this._localMat.compose(this._localPos, this._localQuat, this._localScale);
        this._finalMat.multiplyMatrices(this._rootMat, this._localMat);
        this.headMesh.setMatrixAt(i, this._finalMat);
        this.pagdiMesh.setMatrixAt(i, this._finalMat);
      } else {
        this.headMesh.setMatrixAt(i, this._rootMat);
        this.pagdiMesh.setMatrixAt(i, this._rootMat);
      }

      // Left Arm pivoted at shoulder (-0.25, 1.30, 0)
      this._localPos.set(-0.25, 1.30, 0);
      this._localEuler.set(pose.leftArmX, 0, pose.leftArmZ);
      this._localQuat.setFromEuler(this._localEuler);
      this._localScale.set(1, 1, 1);
      this._localMat.compose(this._localPos, this._localQuat, this._localScale);
      this._finalMat.multiplyMatrices(this._rootMat, this._localMat);
      this.leftArmMesh.setMatrixAt(i, this._finalMat);

      // Right Arm pivoted at shoulder (+0.25, 1.30, 0)
      this._localPos.set(0.25, 1.30, 0);
      this._localEuler.set(pose.rightArmX, 0, pose.rightArmZ);
      this._localQuat.setFromEuler(this._localEuler);
      this._localMat.compose(this._localPos, this._localQuat, this._localScale);
      this._finalMat.multiplyMatrices(this._rootMat, this._localMat);
      this.rightArmMesh.setMatrixAt(i, this._finalMat);

      // Dupatta flowing drape behind shoulder (0, 1.32, -0.10)
      this._localPos.set(0, 1.32, -0.10);
      this._localEuler.set(pose.dupattaTiltX, 0, 0);
      this._localQuat.setFromEuler(this._localEuler);
      this._localMat.compose(this._localPos, this._localQuat, this._localScale);
      this._finalMat.multiplyMatrices(this._rootMat, this._localMat);
      this.dupattaMesh.setMatrixAt(i, this._finalMat);
    }

    for (const mesh of this.allMeshes) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public getRadarPositions(limit = 18): { x: number; z: number }[] {
    const n = Math.min(limit, this.activeCount);
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      out.push({ x: this.visitors[i].x, z: this.visitors[i].z });
    }
    return out;
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.rootGroup.removeFromParent();
  }
}
