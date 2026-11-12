import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  clampDelta,
  calculateSplashScore,
  evaluateRoundOutcome,
  stepChallengerAI,
  findBestAutoAimTarget,
  stepHomingProjectile,
  computeSoftMagnetReticle,
  evaluateAdaptiveDifficulty,
  createInitialScreenShakeState,
  triggerScreenShake,
  stepScreenShake,
  createInitialKarmaState,
  recordKarmaAction,
  stepKarmaState,
  MELA_RIDES,
  MELA_STALLS,
  stepCrowdVisitorAI,
  DIVINE_BLESSINGS,
  GULAL_WEAPONS,
  ARSENAL_MODES,
  createInitialDayNightState,
  stepDayNightCycle,
  createInitialInteractiveParticles,
  stepInteractiveAtmosphereParticles,
  MELA_JUMP_PAD_PLATFORMS,
  evaluateWorldPhysicsModifiers,
  type GameState,
  type FestivalWorldId,
  type GulalColorId,
  type ArsenalModeId,
  type ChallengerState,
  type ChallengerArchetype,
  type MagnetTargetCandidate,
  type AdaptiveDifficultyProfile,
  type ScreenShakeState,
  type KarmaState,
  type KarmaActionType,
  type CrowdVisitorState,
  type DayNightCycleState,
  type DayNightAtmosphereProfile,
  type DayNightCycleMode,
  type InteractiveAtmosphereParticle,
} from './rules';
import {
  COURT_NPCS,
  LOTUS_SHIELD_SKINS,
  RANGOLI_PIGMENTS,
  type CharacterAttirePreset,
  type NpcCharacter,
} from './worldData';
import { melaverseAudio } from './audio';
import {
  loadMelaAssetsWithManager,
  type AssetLoadProgress,
  type LoadedMelaAssets,
} from './assetLoader';
import { MelaPhysicsWorld } from './physicsWorld';
import {
  buildMelaRidesAndStalls,
  type MelaRidesAndStallsRig,
} from './melaRides';
import { createPBRMaterial } from './pbrMaterials';
import { MelaCameraDirector } from './cameraDirector';
import {
  GRAPHICS_PRESETS,
  type GraphicsQualityPreset,
  type CameraPerspectiveMode,
  type RideId,
  type MiniGameStallId,
  type LotusShieldSkinId,
} from '../store/useMelaStore';

export interface HudSnapshot {
  spiritPips: number;
  maxSpiritPips: number;
  spiritTrail: number;
  score: number;
  bestScore: number;
  combo: number;
  comboStreak: number;
  comboTimerRatio: number;
  revelersSplashed: number;
  targetRevelers: number;
  diyasLit: number;
  targetDiyas: number;
  selectedGulal: GulalColorId;
  selectedArsenal: ArsenalModeId;
  gulalTankPct: number;
  cooldownPct: number;
  dashCooldownPct: number;
  shieldCooldownPct: number;
  shieldActive: boolean;
  floatingCallout: {
    id: number;
    text: string;
    colorHex: string;
  } | null;
  nearbyPrompt: {
    type: 'npc' | 'diya' | 'portal' | 'ride' | 'stall';
    label: string;
    targetId: string;
    costCoins?: number;
    rideId?: RideId;
    stallId?: MiniGameStallId;
  } | null;
  activeWave: number;
  activeBlessing: string | null;
  objectiveHint: string;
  magnetLockInfo: {
    label: string;
    kind: 'reveler' | 'diya';
    weaknessColor?: GulalColorId;
    magnetStrength: number;
    screenX: number;
    screenY: number;
  } | null;
  adaptiveDifficulty: AdaptiveDifficultyProfile;
  karma: KarmaState;
  dayNight: DayNightAtmosphereProfile;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  fps: number;
  crowdPositions: { x: number; z: number }[];
}

interface MelaverseCanvasProps {
  gameState: GameState;
  activeWorld: FestivalWorldId;
  selectedGulal: GulalColorId;
  selectedArsenal: ArsenalModeId;
  attire: CharacterAttirePreset;
  equippedTrailColorHex: string;
  equippedShieldSkin: LotusShieldSkinId;
  rangoliGrid: number[][];
  resetCounter: number;
  fireworksCount: number;
  shieldTriggerCount: number;
  fireTriggerCount: number;
  dashTriggerCount: number;
  rhythmDiyaTriggerCount: number;
  stampRangoliTriggerCount: number;
  karmaOfferingCount: number;
  graphicsPreset: GraphicsQualityPreset;
  cameraMode: CameraPerspectiveMode;
  mountedRide: RideId | null;
  activeStallModal?: MiniGameStallId | null;
  foodBoostMultiplier: number;
  mobileMoveVec: { dx: number; dz: number; sprinting: boolean };
  mobileLookDeltaYaw: number;
  jumpTriggerCount: number;
  interactTriggerCount: number;
  dayNightMode: DayNightCycleMode;
  onChangeDayNightMode: (mode: DayNightCycleMode) => void;
  onAssetLoadProgress: (progress: AssetLoadProgress) => void;
  onSelectWorld: (world: FestivalWorldId) => void;
  onBoardRide: (rideId: RideId, costCoins: number) => void;
  onExitRide: () => void;
  onOpenStallModal: (stallId: MiniGameStallId) => void;
  onSelectGulal: (color: GulalColorId) => void;
  onSelectArsenal: (mode: ArsenalModeId) => void;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onRewardEarned: (coinsDelta: number, xpDelta: number, stamp?: string) => void;
  onOpenNpcDialogue: (npc: NpcCharacter) => void;
  onOpenWorldAtlas: () => void;
  onRoundEnd: (
    outcome: 'victory' | 'defeat',
    finalStats: {
      score: number;
      revelersSplashed: number;
      diyasLit: number;
      clearTimeSec: number;
    }
  ) => void;
  onTogglePause: () => void;
}

// Pre-allocated module-scope scratch objects (Zero GC in render loop)
const _dummyObj = new THREE.Object3D();
const _dummyColor = new THREE.Color();
const _raycaster = new THREE.Raycaster();
const _ndcVec2 = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8);
const _planeHitVec3 = new THREE.Vector3();
const _beamStartVec3 = new THREE.Vector3();
const _beamEndVec3 = new THREE.Vector3();
const _beamMidVec3 = new THREE.Vector3();
const _projScreenVec3 = new THREE.Vector3();

function createSandstoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep Royal Slate & Warm Basalt Cobblestone (#1e1b24 base with #2d2633 stone tiles and #3d3142 mortar lines)
  ctx.fillStyle = '#1e1b24';
  ctx.fillRect(0, 0, size, size);

  const rows = 16;
  const cols = 8;
  const blockH = size / rows;
  const blockW = size / cols;

  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (blockW * 0.5);
    for (let col = -1; col <= cols; col++) {
      const x = col * blockW + offset;
      const y = row * blockH;
      const v = Math.round(
        (Math.sin(row * 3.7 + col * 2.3) * 0.5 + 0.5) * 8 - 4
      );
      ctx.fillStyle = `rgb(${45 + v}, ${38 + v}, ${51 + v})`;
      ctx.fillRect(x + 3, y + 3, blockW - 6, blockH - 6);

      ctx.strokeStyle = '#3d3142';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, blockW - 4, blockH - 4);

      ctx.fillStyle = 'rgba(255, 236, 209, 0.03)';
      ctx.fillRect(x + 5, y + 5, blockW - 10, 3);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function drawRangoliMandalaToCanvas(
  canvas: HTMLCanvasElement,
  grid: number[][]
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  // Sample palette colors from the 9x9 rangoliGrid so custom user strokes dynamically tint the Mandala rings
  const sampleHex = (r: number, c: number, fallback: string) => {
    const val = grid[r]?.[c] ?? 0;
    if (val > 0 && RANGOLI_PIGMENTS[val]) {
      return RANGOLI_PIGMENTS[val].hex;
    }
    return fallback;
  };
  const primaryColor = sampleHex(4, 4, '#F59E0B');
  const innerPetalColor = sampleHex(3, 4, '#E11D48');
  const midPetalColor = sampleHex(2, 4, '#F97316');
  const outerPetalColor = sampleHex(1, 4, '#EC4899');
  const starAccentColor = sampleHex(2, 2, '#FACC15');
  const tealAccentColor = sampleHex(0, 4, '#14B8A6');

  // 1. Deep Terracotta-Plum Sacred Mandala Base Disc
  const baseGrad = ctx.createRadialGradient(cx, cy, w * 0.03, cx, cy, w * 0.485);
  baseGrad.addColorStop(0, '#361928');
  baseGrad.addColorStop(0.58, '#281320');
  baseGrad.addColorStop(0.92, '#1d1019');
  baseGrad.addColorStop(1, 'rgba(29, 16, 25, 0)');
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.485, 0, Math.PI * 2);
  ctx.fill();

  // 2. Outer Scalloped 24-Petal Kolam Border Ring
  const outerPetals = 24;
  for (let i = 0; i < outerPetals; i++) {
    const angle = (i / outerPetals) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.38);
    ctx.quadraticCurveTo(w * 0.045, -w * 0.435, 0, -w * 0.472);
    ctx.quadraticCurveTo(-w * 0.045, -w * 0.435, 0, -w * 0.38);
    ctx.fillStyle = i % 2 === 0 ? outerPetalColor : starAccentColor;
    ctx.fill();
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // 3. Concentric Chalk-White & Turmeric Geometric Border Rings
  const ringRadii = [0.475, 0.382, 0.295, 0.205, 0.115];
  ringRadii.forEach((rRatio, idx) => {
    ctx.strokeStyle = idx % 2 === 0 ? '#FFFBEB' : '#FDE68A';
    ctx.lineWidth = idx === 0 ? 3.5 : 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, w * rRatio, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 4. Mid-Ring 16-Pointed Geometric Star & Lotus Petals
  const midPetals = 16;
  for (let i = 0; i < midPetals; i++) {
    const angle = (i / midPetals) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.205);
    ctx.quadraticCurveTo(w * 0.052, -w * 0.295, 0, -w * 0.375);
    ctx.quadraticCurveTo(-w * 0.052, -w * 0.295, 0, -w * 0.205);
    ctx.fillStyle =
      i % 3 === 0
        ? midPetalColor
        : i % 3 === 1
        ? innerPetalColor
        : tealAccentColor;
    ctx.fill();
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Fine inner kolam spine line inside each lotus petal
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.225);
    ctx.lineTo(0, -w * 0.345);
    ctx.stroke();
    ctx.restore();
  }

  // 5. Inner 12-Petal Sacred Padma (Lotus) Ring
  const innerPetals = 12;
  for (let i = 0; i < innerPetals; i++) {
    const angle = (i / innerPetals) * Math.PI * 2 + Math.PI / innerPetals;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.115);
    ctx.quadraticCurveTo(w * 0.048, -w * 0.165, 0, -w * 0.202);
    ctx.quadraticCurveTo(-w * 0.048, -w * 0.165, 0, -w * 0.115);
    ctx.fillStyle = i % 2 === 0 ? innerPetalColor : starAccentColor;
    ctx.fill();
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }

  // 6. Central 8-Pointed Suryamukhi Star Chakra
  const centerPoints = 8;
  for (let i = 0; i < centerPoints; i++) {
    const angle = (i / centerPoints) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.025);
    ctx.lineTo(w * 0.028, -w * 0.068);
    ctx.lineTo(0, -w * 0.112);
    ctx.lineTo(-w * 0.028, -w * 0.068);
    ctx.closePath();
    ctx.fillStyle = primaryColor;
    ctx.fill();
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Crisp Rice-Flour Bindu Center
  ctx.fillStyle = '#FFFBEB';
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.022, 0, Math.PI * 2);
  ctx.fill();
}

// Helper to build a cusped Mughal/Rajput scalloped Mehrab arch via THREE.Shape + THREE.ExtrudeGeometry
function createMehrabArchGeometry(
  spanWidth: number,
  archHeight: number,
  depth: number,
  cusps = 7
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const halfW = spanWidth * 0.5;
  shape.moveTo(-halfW, archHeight);
  shape.lineTo(halfW, archHeight);
  shape.lineTo(halfW, 0);

  // Scalloped Rajput/Mughal Mehrab cusps along the inner arch curve
  const innerSpan = spanWidth * 0.84;
  const innerHalf = innerSpan * 0.5;
  shape.lineTo(innerHalf, 0);

  for (let i = 0; i < cusps; i++) {
    const t0 = i / cusps;
    const t1 = (i + 1) / cusps;
    const tMid = (t0 + t1) * 0.5;

    const a1 = t1 * Math.PI;
    const aMid = tMid * Math.PI;

    const x1 = Math.cos(a1) * innerHalf;
    const y1 = Math.sin(a1) * (archHeight * 0.68);
    const xCtrl = Math.cos(aMid) * (innerHalf + 0.22);
    const yCtrl = Math.sin(aMid) * (archHeight * 0.68 + 0.24);

    shape.quadraticCurveTo(xCtrl, yCtrl, x1, y1);
  }

  shape.lineTo(-halfW, 0);
  shape.lineTo(-halfW, archHeight);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

// Helper to build an articulated, stylized 3D Hero & Festival Character:
// - Distinct head with dark hair nape + layered Royal Pagdi (turban) + swaying Kalgi feather & jewel brooch
// - Layered Angarkha/Kurta tunic with flared 12-pleat hem + contrasting royal brocade Bandi waistcoat & gold Zari trim
// - Articulated swinging left/right arms holding an ornate brass Pichkari water-cannon in the right hand
// - Articulated walking legs with dhoti pleats & curled Mojari/Jutti footwear
// - Fluttering silk Dupatta scarf (multi-segment vertex-animated cloth mesh) that trails dynamically when moving or dashing
function buildCompositeCharacterMesh(opts: {
  kurtaColor: number;
  dhotiColor: number;
  pagdiColor: number;
  skinColor: number;
  hasPichkari?: boolean;
  hasMatki?: boolean;
  hasDhol?: boolean;
}): {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  dupattaMesh: THREE.Mesh;
  kalgiGroup: THREE.Group;
  kurtaMat: THREE.MeshStandardMaterial;
  dhotiMat: THREE.MeshStandardMaterial;
  pagdiMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshStandardMaterial;
} {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // 1. Soft dark contact shadow disc directly under feet (y = 0.015)
  const shadowGeo = new THREE.CircleGeometry(0.72, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x050308,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Stylized PBR Materials (clamped albedo & roughness >= 0.72 so kurta/turban NEVER blow out under daytime sun)
  const tonedKurtaColor = new THREE.Color(opts.kurtaColor).lerp(
    new THREE.Color(0xb45309),
    0.28
  );
  const kurtaMat = new THREE.MeshStandardMaterial({
    color: tonedKurtaColor,
    roughness: 0.78,
    metalness: 0.08,
    emissiveIntensity: 0,
  });

  // Contrasting Royal Crimson/Plum Brocade Bandi Waistcoat (breaks up silhouette from behind)
  const waistcoatMat = new THREE.MeshStandardMaterial({
    color: 0x6b1d2f,
    roughness: 0.74,
    metalness: 0.14,
    emissiveIntensity: 0,
  });

  const warmLowerLimbColor = new THREE.Color(opts.dhotiColor).lerp(
    new THREE.Color(0x6d371a),
    0.72
  );
  const dhotiMat = new THREE.MeshStandardMaterial({
    color: warmLowerLimbColor,
    roughness: 0.8,
    metalness: 0.04,
    emissiveIntensity: 0,
  });
  const juttiLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x2e150b,
    roughness: 0.74,
    metalness: 0.18,
    emissiveIntensity: 0,
  });
  const pagdiMat = new THREE.MeshStandardMaterial({
    color: opts.pagdiColor,
    roughness: 0.65,
    metalness: 0.15,
    emissiveIntensity: 0,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: opts.skinColor,
    roughness: 0.68,
    metalness: 0.04,
    emissiveIntensity: 0,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd99b26,
    roughness: 0.32,
    metalness: 0.82,
    emissiveIntensity: 0,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x1c1311,
    roughness: 0.85,
    metalness: 0.04,
  });

  // 2. Articulated Tapered Legs + Dhoti Folds + Curled Mojari/Jutti Footwear
  const legLathePoints = [
    new THREE.Vector2(0.0, -0.28),
    new THREE.Vector2(0.09, -0.28),
    new THREE.Vector2(0.115, -0.05),
    new THREE.Vector2(0.155, 0.28),
    new THREE.Vector2(0.0, 0.28),
  ];
  const legGeo = new THREE.LatheGeometry(legLathePoints, 12);
  const juttiShoeGeo = new THREE.CapsuleGeometry(0.078, 0.17, 4, 8);
  juttiShoeGeo.rotateX(Math.PI / 2);
  const juttiTrimGeo = new THREE.ConeGeometry(0.055, 0.12, 8);

  const buildLegWithJutti = (xOffset: number) => {
    const legMesh = new THREE.Mesh(legGeo, dhotiMat);
    legMesh.position.set(xOffset, 0.39, 0);
    legMesh.castShadow = true;

    const ankleCuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.092, 0.016, 6, 12).rotateX(Math.PI / 2),
      brassMat
    );
    ankleCuff.position.set(0, -0.22, 0);
    legMesh.add(ankleCuff);

    const juttiShoe = new THREE.Mesh(juttiShoeGeo, juttiLeatherMat);
    juttiShoe.position.set(0, -0.31, 0.06);
    juttiShoe.castShadow = true;
    legMesh.add(juttiShoe);

    const juttiCurl = new THREE.Mesh(juttiTrimGeo, brassMat);
    juttiCurl.position.set(0, -0.27, 0.21);
    juttiCurl.rotation.x = -Math.PI * 0.25;
    legMesh.add(juttiCurl);

    return legMesh;
  };

  const leftLeg = buildLegWithJutti(-0.17);
  bodyGroup.add(leftLeg);

  const rightLeg = buildLegWithJutti(0.17);
  bodyGroup.add(rightLeg);

  // 3. Layered Angarkha/Kurta Tunic with Flared Hem + Contrasting Royal Bandi Waistcoat
  const kurtaLathePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.46, 0.0),
    new THREE.Vector2(0.42, 0.16),
    new THREE.Vector2(0.31, 0.42),
    new THREE.Vector2(0.25, 0.58),
    new THREE.Vector2(0.32, 0.86),
    new THREE.Vector2(0.22, 0.96),
    new THREE.Vector2(0.0, 0.96),
  ];
  const torsoGeo = new THREE.LatheGeometry(kurtaLathePoints, 18);
  const torsoMesh = new THREE.Mesh(torsoGeo, kurtaMat);
  torsoMesh.position.set(0, 0.56, 0);
  torsoMesh.castShadow = true;
  bodyGroup.add(torsoMesh);

  // 12 Sculpted Angarkha Skirt Pleat Ridges around the flared hem
  const pleatGeo = new THREE.ConeGeometry(0.065, 0.42, 5);
  for (let p = 0; p < 12; p++) {
    const angle = (p / 12) * Math.PI * 2;
    const pleat = new THREE.Mesh(
      pleatGeo,
      p % 2 === 0 ? kurtaMat : waistcoatMat
    );
    pleat.position.set(Math.cos(angle) * 0.37, 0.75, Math.sin(angle) * 0.37);
    pleat.rotation.z = -Math.cos(angle) * 0.24;
    pleat.rotation.x = Math.sin(angle) * 0.24;
    bodyGroup.add(pleat);
  }

  // Contrasting Royal Brocade Bandi Jacket / Waistcoat on Upper Torso
  const bandiGeo = new THREE.CylinderGeometry(0.285, 0.275, 0.46, 16);
  const bandiMesh = new THREE.Mesh(bandiGeo, waistcoatMat);
  bandiMesh.position.set(0, 1.28, 0);
  bandiMesh.castShadow = true;
  bodyGroup.add(bandiMesh);

  // Mandarin Collar & Shoulder Epaulets
  const collarGeo = new THREE.TorusGeometry(0.165, 0.028, 8, 18);
  collarGeo.rotateX(Math.PI / 2);
  const collarMesh = new THREE.Mesh(collarGeo, brassMat);
  collarMesh.position.set(0, 1.52, 0);
  bodyGroup.add(collarMesh);

  [-0.31, 0.31].forEach((sx) => {
    const epaulet = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.045, 0.22),
      brassMat
    );
    epaulet.position.set(sx, 1.47, 0);
    epaulet.rotation.z = sx < 0 ? 0.18 : -0.18;
    bodyGroup.add(epaulet);
  });

  // Gold Zari Waist Cummerbund (Kamarbandh) & Hem Border
  const hemTrimGeo = new THREE.TorusGeometry(0.45, 0.028, 8, 24);
  hemTrimGeo.rotateX(Math.PI / 2);
  const hemTrimMesh = new THREE.Mesh(hemTrimGeo, brassMat);
  hemTrimMesh.position.set(0, 0.58, 0);
  bodyGroup.add(hemTrimMesh);

  const waistBandGeo = new THREE.TorusGeometry(0.275, 0.036, 8, 20);
  waistBandGeo.rotateX(Math.PI / 2);
  const waistBandMesh = new THREE.Mesh(waistBandGeo, pagdiMat);
  waistBandMesh.position.set(0, 1.06, 0);
  bodyGroup.add(waistBandMesh);

  // 4. Festive Zari Stole Across Chest + Dynamic Fluttering Silk Dupatta Scarf Trailing Behind
  const sashGeo = new THREE.TorusGeometry(0.305, 0.048, 8, 20);
  const sashMesh = new THREE.Mesh(sashGeo, pagdiMat);
  sashMesh.position.set(0, 1.24, 0);
  sashMesh.rotation.set(Math.PI * 0.38, 0.25, 0);
  bodyGroup.add(sashMesh);

  // Multi-segment trailing Silk Dupatta Scarf (PlaneGeometry 4x12 with vertex animation)
  const dupattaGeo = new THREE.PlaneGeometry(0.64, 1.38, 4, 12);
  const posAttr = dupattaGeo.attributes.position as THREE.BufferAttribute;
  const baseDupattaY = new Float32Array(posAttr.count);
  const baseDupattaX = new Float32Array(posAttr.count);
  for (let i = 0; i < posAttr.count; i++) {
    // Shift origin to top edge (y = 0 at shoulders, extending down to y = -1.38)
    const yShifted = posAttr.getY(i) - 0.69;
    posAttr.setY(i, yShifted);
    baseDupattaY[i] = yShifted;
    baseDupattaX[i] = posAttr.getX(i);
  }
  dupattaGeo.userData = { baseDupattaY, baseDupattaX };
  dupattaGeo.computeVertexNormals();

  const dupattaMat = new THREE.MeshStandardMaterial({
    color: opts.pagdiColor,
    roughness: 0.55,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });
  const dupattaMesh = new THREE.Mesh(dupattaGeo, dupattaMat);
  dupattaMesh.position.set(0, 1.46, -0.24);
  dupattaMesh.rotation.x = 0.22;
  dupattaMesh.castShadow = true;
  bodyGroup.add(dupattaMesh);

  // Gold Zari border strip at the bottom of the Dupatta
  const dupattaBorder = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.06, 0.015),
    brassMat
  );
  dupattaBorder.position.set(0, -1.34, 0);
  dupattaMesh.add(dupattaBorder);

  // 5. Articulated Swinging Arms with Gold Cuffs & Handheld Brass Pichkari
  const armGeo = new THREE.CapsuleGeometry(0.082, 0.44, 6, 12);
  const cuffGeo = new THREE.TorusGeometry(0.084, 0.02, 6, 12);
  cuffGeo.rotateX(Math.PI / 2);

  const leftArm = new THREE.Mesh(armGeo, kurtaMat);
  leftArm.position.set(-0.38, 1.18, 0);
  leftArm.castShadow = true;
  const leftCuff = new THREE.Mesh(cuffGeo, brassMat);
  leftCuff.position.set(0, -0.2, 0);
  leftArm.add(leftCuff);
  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 10),
    skinMat
  );
  leftHand.position.set(0, -0.28, 0);
  leftArm.add(leftHand);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, kurtaMat);
  rightArm.position.set(0.38, 1.18, 0.08);
  rightArm.rotation.x = -0.5;
  rightArm.castShadow = true;
  const rightCuff = new THREE.Mesh(cuffGeo, brassMat);
  rightCuff.position.set(0, -0.2, 0);
  rightArm.add(rightCuff);
  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 10),
    skinMat
  );
  rightHand.position.set(0, -0.28, 0);
  rightArm.add(rightHand);
  bodyGroup.add(rightArm);

  // 6. Proportioned Head with Dark Hair Nape, Ears & Layered Royal Pagdi (Turban) + Swaying Kalgi Feather
  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10),
    skinMat
  );
  neckMesh.position.set(0, 1.56, 0);
  bodyGroup.add(neckMesh);

  const headGeo = new THREE.SphereGeometry(0.23, 18, 16);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 1.76, 0);
  headMesh.castShadow = true;
  bodyGroup.add(headMesh);

  // Sculpted Dark Hair Nape under the Pagdi so the back of the head looks like a real character
  const hairBackGeo = new THREE.SphereGeometry(
    0.225,
    14,
    12,
    0,
    Math.PI * 2,
    Math.PI * 0.35,
    Math.PI * 0.45
  );
  const hairBackMesh = new THREE.Mesh(hairBackGeo, hairMat);
  hairBackMesh.position.set(0, 1.74, -0.03);
  bodyGroup.add(hairBackMesh);

  // Multi-Tiered Royal Pagdi (Turban) with Crossed Pleat Bands, Trailing Tail (Shamla) & Kalgi Plume
  const pagdiBaseGeo = new THREE.TorusGeometry(0.21, 0.088, 12, 24);
  pagdiBaseGeo.rotateX(Math.PI / 2);
  const pagdiMesh = new THREE.Mesh(pagdiBaseGeo, pagdiMat);
  pagdiMesh.position.set(0, 1.9, 0);
  pagdiMesh.rotation.z = 0.08;
  pagdiMesh.castShadow = true;
  bodyGroup.add(pagdiMesh);

  const pagdiUpperTier = new THREE.Mesh(
    new THREE.TorusGeometry(0.175, 0.068, 10, 20).rotateX(Math.PI / 2),
    pagdiMat
  );
  pagdiUpperTier.position.set(0, 1.98, -0.02);
  pagdiUpperTier.rotation.z = -0.1;
  bodyGroup.add(pagdiUpperTier);

  const pagdiCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 10),
    pagdiMat
  );
  pagdiCrown.position.set(0, 1.96, 0);
  bodyGroup.add(pagdiCrown);

  // Gold Zari Pagdi Band
  const pagdiGoldBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.022, 8, 22).rotateX(Math.PI / 2),
    brassMat
  );
  pagdiGoldBand.position.set(0, 1.88, 0.01);
  pagdiGoldBand.rotation.x = 0.18;
  bodyGroup.add(pagdiGoldBand);

  // Pagdi Back Pleated Tail (Shamla) visible to the third-person camera
  const shamlaTail = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.34, 8),
    pagdiMat
  );
  shamlaTail.position.set(0.06, 1.72, -0.25);
  shamlaTail.rotation.x = -0.35;
  shamlaTail.rotation.z = -0.15;
  bodyGroup.add(shamlaTail);

  // Kalgi Jewel Brooch & Swaying Peacock/Gold Feather Crest
  const kalgiGroup = new THREE.Group();
  kalgiGroup.position.set(0, 2.02, 0.14);
  bodyGroup.add(kalgiGroup);

  const kalgiBrooch = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.055, 1),
    brassMat
  );
  kalgiGroup.add(kalgiBrooch);

  const kalgiFan = new THREE.Mesh(
    new THREE.ConeGeometry(0.095, 0.28, 10),
    brassMat
  );
  kalgiFan.position.set(0, 0.14, -0.02);
  kalgiFan.rotation.x = -0.28;
  kalgiGroup.add(kalgiFan);

  const kalgiPlume = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.22, 8),
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.4,
      metalness: 0.35,
    })
  );
  kalgiPlume.position.set(0.02, 0.22, -0.05);
  kalgiPlume.rotation.x = -0.42;
  kalgiGroup.add(kalgiPlume);

  // 8. Articulated Props: Ornate Brass Pichkari Water-Cannon Mounted Directly on Right Hand
  if (opts.hasPichkari) {
    const pichkariGroup = new THREE.Group();
    const tankGeo = new THREE.CylinderGeometry(0.058, 0.064, 0.42, 12);
    tankGeo.rotateX(Math.PI / 2);
    const tankMesh = new THREE.Mesh(tankGeo, brassMat);

    const barrelGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.72, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, brassMat);
    barrel.position.z = 0.22;

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.062, 0.014, 8, 14),
      pagdiMat
    );
    ring1.position.z = 0.08;
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.012, 8, 14),
      pagdiMat
    );
    ring2.position.z = 0.36;

    const pumpHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.012, 6, 12),
      brassMat
    );
    pumpHandle.position.z = -0.26;

    const nozzleGeo = new THREE.ConeGeometry(0.075, 0.16, 12);
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzle = new THREE.Mesh(nozzleGeo, pagdiMat);
    nozzle.position.z = 0.62;

    pichkariGroup.add(tankMesh, barrel, ring1, ring2, pumpHandle, nozzle);
    pichkariGroup.position.set(0.02, -0.26, 0.22);
    pichkariGroup.rotation.x = 0.45;
    rightArm.add(pichkariGroup);
  }

  if (opts.hasMatki) {
    const matkiPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.14, 0.02),
      new THREE.Vector2(0.24, 0.16),
      new THREE.Vector2(0.19, 0.3),
      new THREE.Vector2(0.11, 0.36),
      new THREE.Vector2(0.15, 0.4),
      new THREE.Vector2(0, 0.4),
    ];
    const matkiGeo = new THREE.LatheGeometry(matkiPoints, 14);
    const matkiMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.52,
      metalness: 0.22,
    });
    const matki = new THREE.Mesh(matkiGeo, matkiMat);
    matki.position.set(0.36, 1.08, 0.28);
    bodyGroup.add(matki);
  }

  if (opts.hasDhol) {
    const dholGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.58, 16);
    dholGeo.rotateZ(Math.PI / 2);
    const dholMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.55,
      metalness: 0.2,
    });
    const dhol = new THREE.Mesh(dholGeo, dholMat);
    dhol.position.set(0, 1.02, 0.35);
    bodyGroup.add(dhol);
  }

  return {
    root,
    bodyGroup,
    headMesh,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    dupattaMesh,
    kalgiGroup,
    kurtaMat,
    dhotiMat,
    pagdiMat,
    skinMat,
  };
}

export const MelaverseCanvas: React.FC<MelaverseCanvasProps> = (props) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const rangoliCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rangoliTextureRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (rangoliCanvasRef.current && rangoliTextureRef.current) {
      drawRangoliMandalaToCanvas(rangoliCanvasRef.current, props.rangoliGrid);
      rangoliTextureRef.current.needsUpdate = true;
    }
  }, [props.rangoliGrid]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software-WebGL Detection from UNMASKED_RENDERER_WEBGL
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const initialPresetCfg = GRAPHICS_PRESETS[propsRef.current.graphicsPreset];
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setPixelRatio(
      isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio, 2, initialPresetCfg.maxPixelRatio)
    );
    renderer.shadowMap.enabled = !isSoftwareGl && initialPresetCfg.shadowsEnabled;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initialRect = container.getBoundingClientRect();
    const initW = Math.max(1, initialRect.width || window.innerWidth);
    const initH = Math.max(1, initialRect.height || window.innerHeight);
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('data-testid', 'melaverse-canvas');
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene, Dynamic Time-of-Day Skybox, Crystal-Clear Linear Fog (0% fog within 65 units) & Camera
    const scene = new THREE.Scene();
    const isInitialHoli = propsRef.current.activeWorld === 'holi_braj';
    scene.background = new THREE.Color(isInitialHoli ? '#f4c29f' : '#080512');
    scene.fog = new THREE.Fog(
      isInitialHoli ? '#f4c29f' : '#0c0a20',
      65,
      190
    );

    // Custom Multi-Stop Sky Dome (Day: cheerful cerulean zenith #2b82d9 -> mid-sky #7cc2f5 -> warm pastel peach/gold horizon #f7d4b2, clamped < 0.82 luminance)
    const skyDomeGeo = new THREE.SphereGeometry(165, 32, 24);
    const skyPosAttr = skyDomeGeo.attributes.position;
    const skyColors = new Float32Array(skyPosAttr.count * 3);
    const zenithColor = new THREE.Color(isInitialHoli ? 0x2b82d9 : 0x050414);
    const midSkyColor = new THREE.Color(isInitialHoli ? 0x7cc2f5 : 0x0d0922);
    const horizonColor = new THREE.Color(isInitialHoli ? 0xf7d4b2 : 0x1b1236);
    const tempSkyColor = new THREE.Color();

    const computeSkyVertexColor = (py: number) => {
      // Normalize over the visible camera elevation band so cerulean upper sky and mid-sky dominate above the trees,
      // and clamp lower-sky luminance (< 0.78) so the horizon behind the right-side trees never blows out to white
      const normY = Math.max(0, Math.min(1, py / 44));
      if (normY < 0.22) {
        tempSkyColor.copy(horizonColor).lerp(midSkyColor, normY / 0.22);
      } else {
        tempSkyColor
          .copy(midSkyColor)
          .lerp(zenithColor, (normY - 0.22) / 0.78);
      }
      const lum =
        0.2126 * tempSkyColor.r +
        0.7152 * tempSkyColor.g +
        0.0722 * tempSkyColor.b;
      if (lum > 0.78) {
        tempSkyColor.multiplyScalar(0.78 / lum);
      }
    };

    for (let i = 0; i < skyPosAttr.count; i++) {
      computeSkyVertexColor(skyPosAttr.getY(i));
      skyColors[i * 3] = tempSkyColor.r;
      skyColors[i * 3 + 1] = tempSkyColor.g;
      skyColors[i * 3 + 2] = tempSkyColor.b;
    }
    const skyColorAttr = new THREE.BufferAttribute(skyColors, 3);
    skyDomeGeo.setAttribute('color', skyColorAttr);
    const skyDomeMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const skyDomeMesh = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    scene.add(skyDomeMesh);

    const updateSkyDomeColors = (
      nextZenithHex: number,
      nextMidHex: number,
      nextHorizonHex: number
    ) => {
      zenithColor.setHex(nextZenithHex);
      midSkyColor.setHex(nextMidHex);
      horizonColor.setHex(nextHorizonHex);
      for (let i = 0; i < skyPosAttr.count; i++) {
        computeSkyVertexColor(skyPosAttr.getY(i));
        skyColors[i * 3] = tempSkyColor.r;
        skyColors[i * 3 + 1] = tempSkyColor.g;
        skyColors[i * 3 + 2] = tempSkyColor.b;
      }
      skyColorAttr.needsUpdate = true;
    };

    // 3D Celestial Surya (Sun) & Chandra (Moon) Orbs orbiting across the Sky Dome
    const celestialSunGroup = new THREE.Group();
    const sunCoreGeo = new THREE.SphereGeometry(3.2, 20, 20);
    const sunCoreMat = new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
      fog: false,
    });
    const sunHaloGeo = new THREE.RingGeometry(3.5, 5.4, 24);
    const sunHaloMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    const sunHaloMesh = new THREE.Mesh(sunHaloGeo, sunHaloMat);
    celestialSunGroup.add(new THREE.Mesh(sunCoreGeo, sunCoreMat), sunHaloMesh);
    scene.add(celestialSunGroup);

    const celestialMoonGroup = new THREE.Group();
    const moonCoreGeo = new THREE.SphereGeometry(2.5, 20, 20);
    const moonCoreMat = new THREE.MeshBasicMaterial({
      color: 0xe0e7ff,
      fog: false,
    });
    const moonHaloGeo = new THREE.RingGeometry(2.8, 4.3, 24);
    const moonHaloMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    const moonHaloMesh = new THREE.Mesh(moonHaloGeo, moonHaloMat);
    celestialMoonGroup.add(
      new THREE.Mesh(moonCoreGeo, moonCoreMat),
      moonHaloMesh
    );
    scene.add(celestialMoonGroup);

    // 320 Crisp Tiny Stars across the Upper Indigo-Velvet Sky Dome
    const STAR_COUNT = 320;
    const starGeo = new THREE.OctahedronGeometry(0.19, 0);
    const starMat = new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
      fog: false,
    });
    const starInstanced = new THREE.InstancedMesh(starGeo, starMat, STAR_COUNT);
    starInstanced.frustumCulled = false;
    const starBasePositions: { x: number; y: number; z: number; phase: number; baseScale: number }[] = [];
    for (let s = 0; s < STAR_COUNT; s++) {
      const theta = (s * 2.39996) % (Math.PI * 2);
      const u = 0.22 + ((s * 97) % 78) / 100;
      const phi = Math.acos(u);
      const r = 148;
      const sx = r * Math.sin(phi) * Math.cos(theta);
      const sy = r * Math.cos(phi);
      const sz = r * Math.sin(phi) * Math.sin(theta);
      const bScale = 0.45 + (s % 4) * 0.16;
      starBasePositions.push({ x: sx, y: sy, z: sz, phase: s * 0.73, baseScale: bScale });
      _dummyObj.position.set(sx, sy, sz);
      _dummyObj.scale.setScalar(bScale);
      _dummyObj.updateMatrix();
      starInstanced.setMatrixAt(s, _dummyObj.matrix);
      _dummyColor.setHex(
        s % 4 === 0 ? 0xfde68a : s % 5 === 0 ? 0xbae6fd : 0xfffbeb
      );
      starInstanced.setColorAt(s, _dummyColor);
    }
    starInstanced.instanceMatrix.needsUpdate = true;
    if (starInstanced.instanceColor) {
      starInstanced.instanceColor.needsUpdate = true;
    }
    scene.add(starInstanced);

    // 60 Warm Glowing Akash Kandil (Sky Lanterns) rising slowly at varied depths in the deep twilight sky dome
    const SKY_LANTERN_COUNT = 60;
    const skyLanternPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0.04),
      new THREE.Vector2(0.32, 0.36),
      new THREE.Vector2(0.28, 0.68),
      new THREE.Vector2(0, 0.74),
    ];
    const skyLanternGeo = new THREE.LatheGeometry(skyLanternPoints, 10);
    const skyLanternMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.85,
      roughness: 0.28,
      fog: false,
    });
    const skyLanternInstanced = new THREE.InstancedMesh(
      skyLanternGeo,
      skyLanternMat,
      SKY_LANTERN_COUNT
    );
    skyLanternInstanced.frustumCulled = false;
    const skyLanternStates = Array.from({ length: SKY_LANTERN_COUNT }, (_, idx) => {
      const angle = (idx / SKY_LANTERN_COUNT) * Math.PI * 2 + (idx % 5) * 0.24;
      const dist = 32 + (idx % 8) * 9.5;
      return {
        baseX: Math.cos(angle) * dist,
        y: 26.0 + ((idx * 9) % 34),
        baseZ: Math.sin(angle) * dist - 14,
        riseSpeed: 0.38 + (idx % 5) * 0.11,
        phase: idx * 1.15,
      };
    });
    scene.add(skyLanternInstanced);

    // Internal PBR Environment Map via THREE.PMREMGenerator + RoomEnvironment (environmentIntensity = 0.45)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.2, 340);
    camera.position.set(14, 4.8, 16);
    camera.lookAt(0, 7.0, -14);

    const maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());

    // 2B. Post-Processing Pipeline with 4x MSAA RenderTarget & Restrained UnrealBloomPass (threshold 0.92, strength 0.28, radius 0.35)
    const activePixelRatio = isSoftwareGl
      ? 1
      : Math.min(window.devicePixelRatio, 2, initialPresetCfg.maxPixelRatio);
    const msaaRenderTarget = new THREE.WebGLRenderTarget(
      initW * activePixelRatio,
      initH * activePixelRatio,
      {
        samples: isSoftwareGl ? 0 : 4,
        type: THREE.HalfFloatType,
      }
    );
    const composer = new EffectComposer(renderer, msaaRenderTarget);
    composer.setPixelRatio(activePixelRatio);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        Math.max(1, Math.floor(initW * 0.5)),
        Math.max(1, Math.floor(initH * 0.5))
      ),
      0.08,
      0.32,
      0.96
    );
    bloomPass.threshold = 0.96;
    bloomPass.strength = initialPresetCfg.bloomEnabled ? 0.08 : 0;
    bloomPass.radius = 0.32;
    bloomPass.enabled = !isSoftwareGl && initialPresetCfg.bloomEnabled;
    composer.addPass(bloomPass);

    let lastAppliedGraphicsPreset: GraphicsQualityPreset =
      propsRef.current.graphicsPreset;

    const applyGraphicsPresetToPipeline = (preset: GraphicsQualityPreset) => {
      const cfg = GRAPHICS_PRESETS[preset];
      const nextRatio = isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio, 2, cfg.maxPixelRatio);
      renderer.setPixelRatio(nextRatio);
      composer.setPixelRatio(nextRatio);
      renderer.shadowMap.enabled = !isSoftwareGl && cfg.shadowsEnabled;
      if (!isSoftwareGl && keyLight.shadow.mapSize.width !== cfg.shadowMapSize) {
        keyLight.shadow.mapSize.width = cfg.shadowMapSize;
        keyLight.shadow.mapSize.height = cfg.shadowMapSize;
        keyLight.shadow.map?.dispose();
        keyLight.shadow.map = null;
      }
      bloomPass.enabled = !isSoftwareGl && cfg.bloomEnabled;
      bloomPass.radius = cfg.bloomRadius;
    };

    // 3. Cinematic Lighting & Shadows Pipeline (AT MOST ONE Shadow-Casting DirectionalLight + Optimized PointLights):
    const ambientFillLight = new THREE.AmbientLight(0xffe4e6, 0.45);
    scene.add(ambientFillLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0xd97706, 0.45);
    hemiLight.position.set(0, 45, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d0, 2.0);
    keyLight.position.set(24, 38, 22);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = initialPresetCfg.shadowMapSize;
      keyLight.shadow.mapSize.height = initialPresetCfg.shadowMapSize;
      const d = 48;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 130;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    // Warm Golden Rim Directional Accent (non-shadow-casting) to sculpt sandstone carvings & gold Kalash
    const warmRimLight = new THREE.DirectionalLight(0xffa94d, 0.68);
    warmRimLight.position.set(-28, 24, 18);
    scene.add(warmRimLight);

    // Keep only 2 non-shadow-casting PointLights (disabled during Day via pointLightIntensityScale = 0)
    const templeSanctumPointLight = new THREE.PointLight(0xff9436, 2.4, 36, 1.8);
    templeSanctumPointLight.position.set(0, 5.8, -19.0);
    scene.add(templeSanctumPointLight);

    const rangoliPlazaPointLight = new THREE.PointLight(0xff9436, 1.8, 36, 1.8);
    rangoliPlazaPointLight.position.set(0, 3.0, 0);
    scene.add(rangoliPlazaPointLight);

    // 3A. Atmospheric GPU Particle System (`THREE.Points` with Custom Vertex/Fragment Shaders — 1,550+ Particles)
    // (1) 800 Floating Golden Fireflies / Diya Embers drifting gently across the plaza
    const FIREFLY_COUNT = 800;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPositions = new Float32Array(FIREFLY_COUNT * 3);
    const fireflyPhases = new Float32Array(FIREFLY_COUNT);
    const fireflyScales = new Float32Array(FIREFLY_COUNT);
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const r = 4.0 + Math.sqrt(i / FIREFLY_COUNT) * 54.0;
      const theta = i * 2.39996;
      fireflyPositions[i * 3] = Math.cos(theta) * r;
      fireflyPositions[i * 3 + 1] = 0.35 + ((i * 37) % 100) * 0.11;
      fireflyPositions[i * 3 + 2] = Math.sin(theta) * r - 8.0;
      fireflyPhases[i] = (i * 0.83) % (Math.PI * 2);
      fireflyScales[i] = 0.65 + (i % 5) * 0.25;
    }
    fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
    fireflyGeo.setAttribute('aPhase', new THREE.BufferAttribute(fireflyPhases, 1));
    fireflyGeo.setAttribute('aScale', new THREE.BufferAttribute(fireflyScales, 1));

    const fireflyShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: activePixelRatio },
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aScale;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 pos = position;
          pos.x += sin(uTime * 0.7 + aPhase) * 0.85;
          pos.y += mod(uTime * 0.45 + aPhase * 1.5, 8.5) * 0.35;
          pos.z += cos(uTime * 0.65 + aPhase) * 0.85;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = min(12.0, (11.0 * aScale * uPixelRatio) / max(4.5, -mvPosition.z));
          vAlpha = 0.45 + 0.55 * sin(uTime * 2.8 + aPhase * 3.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float glow = smoothstep(0.5, 0.05, dist);
          vec3 emberColor = mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.95, 0.65), glow);
          gl_FragColor = vec4(emberColor, glow * vAlpha * 0.88);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const fireflyPoints = new THREE.Points(fireflyGeo, fireflyShaderMat);
    fireflyPoints.frustumCulled = false;
    scene.add(fireflyPoints);

    // (2) 750 Swirling Airborne Gulal Mist Motes in World 01: Holi — Braj (with 15-unit Camera Exclusion Zone)
    const HOLI_MIST_COUNT = 750;
    const holiMistGeo = new THREE.BufferGeometry();
    const holiMistPos = new Float32Array(HOLI_MIST_COUNT * 3);
    const holiMistColor = new Float32Array(HOLI_MIST_COUNT * 3);
    const holiMistPhase = new Float32Array(HOLI_MIST_COUNT);
    const mistPalette = [
      new THREE.Color(0xf43f5e), // Pink Gulabi
      new THREE.Color(0x06b6d4), // Turquoise Neel
      new THREE.Color(0xf59e0b), // Saffron Kesari
      new THREE.Color(0xa855f7), // Royal Abir
    ];
    for (let i = 0; i < HOLI_MIST_COUNT; i++) {
      const r = 3.0 + ((i * 53) % 34);
      const a = i * 2.39996;
      holiMistPos[i * 3] = Math.cos(a) * r;
      holiMistPos[i * 3 + 1] = 0.6 + ((i * 19) % 90) * 0.09;
      holiMistPos[i * 3 + 2] = Math.sin(a) * r - 6.0;
      const col = mistPalette[i % mistPalette.length];
      holiMistColor[i * 3] = col.r;
      holiMistColor[i * 3 + 1] = col.g;
      holiMistColor[i * 3 + 2] = col.b;
      holiMistPhase[i] = i * 0.61;
    }
    holiMistGeo.setAttribute('position', new THREE.BufferAttribute(holiMistPos, 3));
    holiMistGeo.setAttribute('color', new THREE.BufferAttribute(holiMistColor, 3));
    holiMistGeo.setAttribute('aPhase', new THREE.BufferAttribute(holiMistPhase, 1));

    const holiMistShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: activePixelRatio },
      },
      vertexShader: `
        attribute float aPhase;
        attribute vec3 color;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vec3 pos = position;
          pos.x += sin(uTime * 0.85 + aPhase) * 1.1;
          pos.y += sin(uTime * 0.6 + aPhase * 0.7) * 0.35;
          pos.z += cos(uTime * 0.8 + aPhase) * 1.1;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float camDist = -mvPosition.z;
          // Strict 15-unit Camera Exclusion Zone so zero mist particles drift across the camera lens
          float camFade = smoothstep(15.0, 21.0, camDist);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = min(6.5, (14.0 * uPixelRatio) / max(6.0, camDist));
          vAlpha = (0.12 + 0.06 * sin(uTime * 1.7 + aPhase)) * camFade;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          if (vAlpha <= 0.01) discard;
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float soft = smoothstep(0.5, 0.0, dist);
          gl_FragColor = vec4(vColor, soft * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const holiMistPoints = new THREE.Points(holiMistGeo, holiMistShaderMat);
    holiMistPoints.frustumCulled = false;
    scene.add(holiMistPoints);

    // (3) Player-Responsive Atmospheric Particle System ('Holi Petal Swirls' & 'Diya Flickers')
    const INTERACTIVE_SWIRL_COUNT = 64;
    let interactiveParticles: InteractiveAtmosphereParticle[] =
      createInitialInteractiveParticles(INTERACTIVE_SWIRL_COUNT);
    let prevPlayerXForSwirl = 0;
    let prevPlayerZForSwirl = 0;
    const interactiveSwirlGeo = new THREE.CircleGeometry(0.11, 5);
    const interactiveSwirlMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    const interactiveSwirlInstanced = new THREE.InstancedMesh(
      interactiveSwirlGeo,
      interactiveSwirlMat,
      INTERACTIVE_SWIRL_COUNT
    );
    interactiveSwirlInstanced.frustumCulled = false;
    scene.add(interactiveSwirlInstanced);

    // 3B. Physics-Driven Character Controller (@dimforge/rapier3d-compat Capsule + Ride/Stall Colliders)
    const melaPhysics = new MelaPhysicsWorld();

    // Dedicated World Level Groups (Strictly Isolated per World!)
    const holiWorldGroup = new THREE.Group();
    scene.add(holiWorldGroup);

    const diwaliGhatGroup = new THREE.Group();
    scene.add(diwaliGhatGroup);

    const melaHubGroup = new THREE.Group();
    scene.add(melaHubGroup);

    // 3C. Asset Loader (THREE.LoadingManager + GLTF/Draco + Procedural Mela Rides & Stalls)
    //     CRITICAL: Added strictly to `melaHubGroup` so Giant Wheel NEVER renders in Holi Braj or Diwali Ghat!
    let loadedMelaAssets: LoadedMelaAssets | null = null;
    let melaRidesRig: MelaRidesAndStallsRig | null = null;
    void loadMelaAssetsWithManager(renderer, (prog) => {
      propsRef.current.onAssetLoadProgress(prog);
    }).then((assets) => {
      if (isUnmounted) {
        assets.dispose();
        return;
      }
      loadedMelaAssets = assets;
      melaRidesRig = buildMelaRidesAndStalls(
        assets.canopyStripeTex,
        assets.woodGrainTex
      );
      melaHubGroup.add(melaRidesRig.rootGroup);
    });

    // 3D. Autonomous AI Crowd Visitors State (Radar positions; primitive capsule meshes strictly hidden)
    const MAX_CROWD_VISITORS = 36;
    const crowdVisitors: CrowdVisitorState[] = [];
    const crowdBodyGeo = new THREE.CapsuleGeometry(0.24, 0.62, 6, 10);
    const crowdBodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.08,
    });
    const crowdHeadGeo = new THREE.SphereGeometry(0.19, 10, 10);
    const crowdHeadMat = new THREE.MeshStandardMaterial({
      color: 0xe0ac69,
      roughness: 0.55,
      metalness: 0.05,
    });
    const crowdJoyGaugeGeo = new THREE.BoxGeometry(0.56, 0.08, 0.08);
    const crowdJoyGaugeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const crowdBodyInstanced = new THREE.InstancedMesh(
      crowdBodyGeo,
      crowdBodyMat,
      MAX_CROWD_VISITORS
    );
    const crowdHeadInstanced = new THREE.InstancedMesh(
      crowdHeadGeo,
      crowdHeadMat,
      MAX_CROWD_VISITORS
    );
    const crowdJoyInstanced = new THREE.InstancedMesh(
      crowdJoyGaugeGeo,
      crowdJoyGaugeMat,
      MAX_CROWD_VISITORS
    );
    crowdBodyInstanced.visible = false;
    crowdHeadInstanced.visible = false;
    crowdJoyInstanced.visible = false;

    const visitorPalette = [
      0xf43f5e, 0xf59e0b, 0x38bdf8, 0xa855f7, 0x10b981, 0xfb923c,
    ];
    for (let i = 0; i < MAX_CROWD_VISITORS; i++) {
      const angle = (i / MAX_CROWD_VISITORS) * Math.PI * 2;
      const r = 13.5 + (i % 5) * 3.1;
      const vx = Math.cos(angle) * r;
      const vz = Math.sin(angle) * r;
      const nextAngle = angle + 0.6;
      crowdVisitors.push({
        id: i + 1,
        x: vx,
        z: vz,
        vx: 0,
        vz: 0,
        targetX: Math.cos(nextAngle) * r,
        targetZ: Math.sin(nextAngle) * r,
        speed: 1.65 + (i % 4) * 0.28,
        stridePhase: i * 0.7,
        paletteIndex: i % visitorPalette.length,
      });
    }

    // 4. Procedural 1024x1024 PBR Materials (`royalCobblestone`, `wetMarbleGulal`, `carvedSandstone`, `ornateSilk`)
    const cobblestonePBRBundle = createPBRMaterial('royalCobblestone', {
      anisotropy: maxAnisotropy,
      repeatX: 26,
      repeatY: 26,
    });
    const wetMarbleGulalBundle = createPBRMaterial('wetMarbleGulal', {
      anisotropy: maxAnisotropy,
      repeatX: 24,
      repeatY: 24,
    });
    const outerCobblestonePBRBundle = createPBRMaterial('royalCobblestone', {
      anisotropy: maxAnisotropy,
      repeatX: 64,
      repeatY: 64,
      tintHex: 0x3a3542,
    });
    const carvedSandstonePBRBundle = createPBRMaterial('carvedSandstone', {
      anisotropy: maxAnisotropy,
      repeatX: 4,
      repeatY: 4,
      tintHex: 0xb8865c,
    });
    const deepSandstonePBRBundle = createPBRMaterial('carvedSandstone', {
      anisotropy: maxAnisotropy,
      repeatX: 3,
      repeatY: 3,
      tintHex: 0x9e6b43,
    });
    const ivorySandstonePBRBundle = createPBRMaterial('carvedSandstone', {
      anisotropy: maxAnisotropy,
      repeatX: 2,
      repeatY: 2,
      tintHex: 0xb8865c,
    });
    const silkCrimsonBundle = createPBRMaterial('ornateSilk', {
      anisotropy: maxAnisotropy,
      silkVariant: 'crimson',
    });
    const silkSaffronBundle = createPBRMaterial('ornateSilk', {
      anisotropy: maxAnisotropy,
      silkVariant: 'saffron',
    });
    const silkEmeraldBundle = createPBRMaterial('ornateSilk', {
      anisotropy: maxAnisotropy,
      silkVariant: 'emerald',
    });

    const sandstoneCarvedMat = carvedSandstonePBRBundle.material;
    const sandstoneDeepMat = deepSandstonePBRBundle.material;
    const whiteMarbleMat = ivorySandstonePBRBundle.material;
    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd99b26,
      roughness: 0.28,
      metalness: 0.85,
      bumpMap: carvedSandstonePBRBundle.material.bumpMap,
      bumpScale: 0.015,
      emissive: 0xffb703,
      emissiveIntensity: 0.22,
    });

    // Ground Floor (Dynamically switches material & visibility per world!)
    const outerTerrainGeo = new THREE.PlaneGeometry(260, 260);
    outerTerrainGeo.rotateX(-Math.PI / 2);
    const outerTerrain = new THREE.Mesh(
      outerTerrainGeo,
      outerCobblestonePBRBundle.material
    );
    outerTerrain.position.y = -0.03;
    outerTerrain.receiveShadow = true;
    scene.add(outerTerrain);

    const courtyardGeo = new THREE.CircleGeometry(64.0, 72);
    courtyardGeo.rotateX(-Math.PI / 2);
    const courtyardFloor = new THREE.Mesh(
      courtyardGeo,
      wetMarbleGulalBundle.material
    );
    courtyardFloor.position.y = 0;
    courtyardFloor.receiveShadow = true;
    scene.add(courtyardFloor);

    // Layer 2 (Non-Repeating World-Space Gulal Splatter Canvas):
    // Single 2048x2048 canvas texture with repeat.set(1, 1) mapped across the entire Holi courtyard plaza (y = 0.02, transparent: true)
    // with 180 organic, multi-sized overlapping watercolor/powder splashes & splatter droplets in #ff1e7a, #ffaa00, #00d2ff, and #9b30ff
    const holiWorldSplatterCanvas = document.createElement('canvas');
    holiWorldSplatterCanvas.width = 2048;
    holiWorldSplatterCanvas.height = 2048;
    const hwsCtx = holiWorldSplatterCanvas.getContext('2d')!;
    hwsCtx.clearRect(0, 0, 2048, 2048);

    const worldSplatterColors = [
      { hex: '#ff0a6c', rgb: '255, 10, 108' }, // Saturated Rani Magenta
      { hex: '#ff9d00', rgb: '255, 157, 0' },  // Saturated Turmeric Gold
      { hex: '#00b8ff', rgb: '0, 184, 255' },  // Saturated Peacock Cyan
      { hex: '#8c1aff', rgb: '140, 26, 255' }, // Saturated Braj Violet
    ];
    let splatterSeed = 918273;
    const nextSplatterRand = () => {
      splatterSeed = (splatterSeed * 1664525 + 1013904223) >>> 0;
      return splatterSeed / 0xffffffff;
    };

    for (let s = 0; s < 180; s++) {
      // Distribute organically in polar coordinates across the courtyard (avoiding exact uniformity)
      const angle = nextSplatterRand() * Math.PI * 2;
      const radialDist = (0.09 + Math.pow(nextSplatterRand(), 0.78) * 0.84) * 940;
      const cx = 1024 + Math.cos(angle) * radialDist;
      const cy = 1024 + Math.sin(angle) * radialDist;
      const baseRadius = 26 + Math.pow(nextSplatterRand(), 1.25) * 96;
      const cSpec = worldSplatterColors[s % worldSplatterColors.length];
      const peakAlpha = '0.85';
      const midAlpha = '0.68';

      // Organic multi-lobed watercolor / powder splash body (saturated 0.85 alpha against Makrana marble)
      const grad = hwsCtx.createRadialGradient(
        cx,
        cy,
        baseRadius * 0.14,
        cx,
        cy,
        baseRadius
      );
      grad.addColorStop(0, `rgba(${cSpec.rgb}, ${peakAlpha})`);
      grad.addColorStop(0.58, `rgba(${cSpec.rgb}, ${midAlpha})`);
      grad.addColorStop(1, `rgba(${cSpec.rgb}, 0)`);

      hwsCtx.save();
      hwsCtx.translate(cx, cy);
      hwsCtx.rotate(nextSplatterRand() * Math.PI * 2);
      hwsCtx.scale(
        0.78 + nextSplatterRand() * 0.52,
        0.72 + nextSplatterRand() * 0.48
      );
      hwsCtx.fillStyle = grad;
      hwsCtx.beginPath();
      hwsCtx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      hwsCtx.fill();
      hwsCtx.restore();

      // Secondary radial splatter droplets around each main powder splash
      const dropletCount = 4 + Math.floor(nextSplatterRand() * 6);
      for (let d = 0; d < dropletCount; d++) {
        const dAng = nextSplatterRand() * Math.PI * 2;
        const dDist = baseRadius * (0.58 + nextSplatterRand() * 0.65);
        const dx = cx + Math.cos(dAng) * dDist;
        const dy = cy + Math.sin(dAng) * dDist;
        const dRad = 4.0 + nextSplatterRand() * 15.0;
        const dGrad = hwsCtx.createRadialGradient(dx, dy, 0.5, dx, dy, dRad);
        dGrad.addColorStop(0, `rgba(${cSpec.rgb}, ${peakAlpha})`);
        dGrad.addColorStop(1, `rgba(${cSpec.rgb}, 0)`);
        hwsCtx.fillStyle = dGrad;
        hwsCtx.beginPath();
        hwsCtx.arc(dx, dy, dRad, 0, Math.PI * 2);
        hwsCtx.fill();
      }
    }

    const holiWorldSplatterTex = new THREE.CanvasTexture(holiWorldSplatterCanvas);
    holiWorldSplatterTex.colorSpace = THREE.SRGBColorSpace;
    holiWorldSplatterTex.wrapS = THREE.ClampToEdgeWrapping;
    holiWorldSplatterTex.wrapT = THREE.ClampToEdgeWrapping;
    holiWorldSplatterTex.repeat.set(1, 1);
    holiWorldSplatterTex.anisotropy = maxAnisotropy;

    const holiWorldSplatterGeo = new THREE.PlaneGeometry(126, 126);
    holiWorldSplatterGeo.rotateX(-Math.PI / 2);
    const holiWorldSplatterMesh = new THREE.Mesh(
      holiWorldSplatterGeo,
      new THREE.MeshStandardMaterial({
        map: holiWorldSplatterTex,
        transparent: true,
        roughness: 0.42,
        metalness: 0.02,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    holiWorldSplatterMesh.position.y = 0.025;
    holiWorldSplatterMesh.receiveShadow = true;
    holiWorldGroup.add(holiWorldSplatterMesh);

    const parapetRingGeo = new THREE.TorusGeometry(63.2, 0.38, 10, 84);
    parapetRingGeo.rotateX(Math.PI / 2);
    const parapetMesh = new THREE.Mesh(parapetRingGeo, sandstoneCarvedMat);
    parapetMesh.position.y = 0.2;
    parapetMesh.receiveShadow = true;
    scene.add(parapetMesh);

    // Authentic High-Res (1024x1024) Floor Rangoli Mandala Mapped onto a Flat Circular Plane (y = 0.02)
    const rangoliBorderRingGeo = new THREE.RingGeometry(4.84, 5.14, 64);
    rangoliBorderRingGeo.rotateX(-Math.PI / 2);
    const rangoliBorderRing = new THREE.Mesh(
      rangoliBorderRingGeo,
      brassTrimMat
    );
    rangoliBorderRing.position.set(0, 0.015, 0);
    rangoliBorderRing.receiveShadow = true;
    scene.add(rangoliBorderRing);

    const rangoliCanvas = document.createElement('canvas');
    rangoliCanvas.width = 1024;
    rangoliCanvas.height = 1024;
    drawRangoliMandalaToCanvas(rangoliCanvas, propsRef.current.rangoliGrid);
    rangoliCanvasRef.current = rangoliCanvas;

    const rangoliTex = new THREE.CanvasTexture(rangoliCanvas);
    rangoliTex.colorSpace = THREE.SRGBColorSpace;
    rangoliTex.minFilter = THREE.LinearMipmapLinearFilter;
    rangoliTex.magFilter = THREE.LinearFilter;
    rangoliTex.generateMipmaps = true;
    rangoliTex.anisotropy = maxAnisotropy;
    rangoliTextureRef.current = rangoliTex;

    const rangoliPlaneGeo = new THREE.CircleGeometry(4.85, 64);
    rangoliPlaneGeo.rotateX(-Math.PI / 2);
    const rangoliPlaneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: rangoliTex,
      bumpMap: cobblestonePBRBundle.material.bumpMap,
      bumpScale: 0.015,
      transparent: true,
      roughness: 0.45,
      metalness: 0.08,
      emissive: 0x2a120a,
      emissiveIntensity: 0.14,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const rangoliDisc = new THREE.Mesh(rangoliPlaneGeo, rangoliPlaneMat);
    rangoliDisc.position.set(0, 0.02, 0);
    rangoliDisc.receiveShadow = true;
    scene.add(rangoliDisc);

    // =========================================================================
    // 5. GRAND BRAJ / NAGARA TEMPLE (Built with LatheGeometry & ExtrudeGeometry)
    // =========================================================================
    const mandirGroup = new THREE.Group();
    mandirGroup.position.set(0, 0, -21.5);
    scene.add(mandirGroup);

    // 5A. Raised Stepped Stone Jagati Platform with Carved Moldings
    const jagatiTiers = [
      { w: 19.6, h: 0.52, d: 13.4, y: 0.26 },
      { w: 17.8, h: 0.56, d: 11.8, y: 0.8 },
      { w: 16.2, h: 0.62, d: 10.4, y: 1.38 },
    ];
    jagatiTiers.forEach((tier, idx) => {
      const tierMesh = new THREE.Mesh(
        new THREE.BoxGeometry(tier.w, tier.h, tier.d),
        idx % 2 === 0 ? sandstoneDeepMat : sandstoneCarvedMat
      );
      tierMesh.position.y = tier.y;
      tierMesh.castShadow = true;
      tierMesh.receiveShadow = true;
      mandirGroup.add(tierMesh);
    });

    // Carved Grand Staircase & Glowing Brass Oil Lamps (Diyas) on Every Step Corner
    const stepDiyaBowlPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.16, 0),
      new THREE.Vector2(0.24, 0.09),
      new THREE.Vector2(0.19, 0.14),
      new THREE.Vector2(0, 0.05),
    ];
    const stepDiyaBowlGeo = new THREE.LatheGeometry(stepDiyaBowlPoints, 12);
    const stepDiyaFlameGeo = new THREE.ConeGeometry(0.065, 0.19, 8);
    const stepDiyaFlameMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    });

    for (let s = 0; s < 6; s++) {
      const stepW = 6.2 - s * 0.22;
      const stepY = 0.14 + s * 0.28;
      const stepZ = 7.4 - s * 0.46;
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(stepW, 0.28, 0.62),
        whiteMarbleMat
      );
      step.position.set(0, stepY, stepZ);
      step.castShadow = true;
      step.receiveShadow = true;
      mandirGroup.add(step);

      [-stepW * 0.5 + 0.32, stepW * 0.5 - 0.32].forEach((cornerX) => {
        const cornerDiya = new THREE.Mesh(stepDiyaBowlGeo, brassTrimMat);
        cornerDiya.position.set(cornerX, stepY + 0.14, stepZ + 0.12);
        mandirGroup.add(cornerDiya);

        const cornerFlame = new THREE.Mesh(stepDiyaFlameGeo, stepDiyaFlameMat);
        cornerFlame.position.set(cornerX, stepY + 0.31, stepZ + 0.12);
        mandirGroup.add(cornerFlame);
      });
    }

    // 5B. Fluted 12-Sided Mandap Pillars with Ornate Base/Capital Rings (THREE.LatheGeometry)
    const mandapPillarPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.56, 0.0),
      new THREE.Vector2(0.56, 0.32),
      new THREE.Vector2(0.44, 0.48),
      new THREE.Vector2(0.36, 0.68),
      new THREE.Vector2(0.38, 1.85),
      new THREE.Vector2(0.45, 2.02),
      new THREE.Vector2(0.34, 2.18),
      new THREE.Vector2(0.31, 3.85),
      new THREE.Vector2(0.44, 4.08),
      new THREE.Vector2(0.32, 4.22),
      new THREE.Vector2(0.58, 4.48),
      new THREE.Vector2(0.58, 4.65),
      new THREE.Vector2(0.0, 4.65),
    ];
    const mandapPillarGeo = new THREE.LatheGeometry(mandapPillarPoints, 12);
    const pillarRingGeo = new THREE.TorusGeometry(0.39, 0.055, 8, 16);
    pillarRingGeo.rotateX(Math.PI / 2);

    const frontPillarXs = [-6.6, -2.6, 2.6, 6.6];
    frontPillarXs.forEach((px) => {
      [4.2, 0.8, -2.6].forEach((pz) => {
        const pillar = new THREE.Mesh(mandapPillarGeo, whiteMarbleMat);
        pillar.position.set(px, 1.68, pz);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        mandirGroup.add(pillar);

        const brassRing = new THREE.Mesh(pillarRingGeo, brassTrimMat);
        brassRing.position.set(px, 3.72, pz);
        mandirGroup.add(brassRing);
      });
    });

    // 5C. Cusped Mughal/Rajput Scalloped Arches (Mehrab) via THREE.Shape + THREE.ExtrudeGeometry
    const centerMehrabGeo = createMehrabArchGeometry(4.85, 1.55, 0.42, 9);
    const sideMehrabGeo = createMehrabArchGeometry(3.65, 1.45, 0.38, 7);

    const centerFrontArch = new THREE.Mesh(centerMehrabGeo, sandstoneCarvedMat);
    centerFrontArch.position.set(0, 5.55, 4.2);
    centerFrontArch.castShadow = true;
    mandirGroup.add(centerFrontArch);

    [-4.6, 4.6].forEach((ax) => {
      const sideArch = new THREE.Mesh(sideMehrabGeo, sandstoneCarvedMat);
      sideArch.position.set(ax, 5.58, 4.2);
      sideArch.castShadow = true;
      mandirGroup.add(sideArch);
    });

    [-6.6, 6.6].forEach((sx) => {
      [2.5, -0.9].forEach((sz) => {
        const sideSpanArch = new THREE.Mesh(sideMehrabGeo, sandstoneCarvedMat);
        sideSpanArch.rotation.y = Math.PI / 2;
        sideSpanArch.position.set(sx, 5.58, sz);
        mandirGroup.add(sideSpanArch);
      });
    });

    // Hanging Marigold & Mango-Leaf Torans Draped Under the Mehrab Arches
    const marigoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.5,
      metalness: 0.08,
      emissive: 0xd97706,
      emissiveIntensity: 0.22,
    });
    const crimsonMarigoldMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.5,
      metalness: 0.08,
      emissive: 0x9f1239,
      emissiveIntensity: 0.2,
    });
    const toranBeadGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const archPairs = [
      [-6.5, -2.7],
      [-2.5, 2.5],
      [2.7, 6.5],
    ];
    archPairs.forEach(([xStart, xEnd], pairIdx) => {
      const segments = pairIdx === 1 ? 14 : 9;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const tx = THREE.MathUtils.lerp(xStart, xEnd, t);
        const sag = Math.sin(t * Math.PI) * (pairIdx === 1 ? 0.72 : 0.48);
        const bead = new THREE.Mesh(
          toranBeadGeo,
          i % 2 === 0 ? marigoldMat : crimsonMarigoldMat
        );
        bead.position.set(tx, 5.15 - sag, 4.35);
        mandirGroup.add(bead);
      }
    });

    // Carved Chhajja Eave Cornice & Garbhagriha Sanctum Chamber with Ratha Projections
    const chhajjaEave = new THREE.Mesh(
      new THREE.BoxGeometry(15.8, 0.46, 9.6),
      sandstoneDeepMat
    );
    chhajjaEave.position.set(0, 6.45, 0.8);
    chhajjaEave.castShadow = true;
    mandirGroup.add(chhajjaEave);

    const sanctumCore = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 4.9, 6.8),
      sandstoneCarvedMat
    );
    sanctumCore.position.set(0, 4.1, -1.2);
    sanctumCore.castShadow = true;
    sanctumCore.receiveShadow = true;
    mandirGroup.add(sanctumCore);

    // 2 Ornate Flanking Rajput Chhatri Pavilions on the Front Mandap Roof Corners
    const chhatriDomePoints = [
      new THREE.Vector2(0.0, 1.55),
      new THREE.Vector2(0.32, 1.48),
      new THREE.Vector2(0.85, 1.18),
      new THREE.Vector2(1.32, 0.62),
      new THREE.Vector2(1.42, 0.15),
      new THREE.Vector2(1.48, 0.0),
    ];
    const chhatriDomeGeo = new THREE.LatheGeometry(chhatriDomePoints, 20);
    const chhatriColGeo = new THREE.LatheGeometry(
      mandapPillarPoints.map((p) => new THREE.Vector2(p.x * 0.34, p.y * 0.36)),
      10
    );

    [-5.4, 5.4].forEach((cx) => {
      const chhatriGroup = new THREE.Group();
      chhatriGroup.position.set(cx, 6.68, 2.4);
      const chhatriBase = new THREE.Mesh(
        new THREE.CylinderGeometry(1.52, 1.65, 0.34, 8),
        sandstoneDeepMat
      );
      chhatriGroup.add(chhatriBase);

      for (let cp = 0; cp < 4; cp++) {
        const cAngle = (cp / 4) * Math.PI * 2 + Math.PI / 4;
        const col = new THREE.Mesh(chhatriColGeo, whiteMarbleMat);
        col.position.set(Math.cos(cAngle) * 1.02, 0.15, Math.sin(cAngle) * 1.02);
        chhatriGroup.add(col);
      }

      const chhatriDome = new THREE.Mesh(chhatriDomeGeo, whiteMarbleMat);
      chhatriDome.position.y = 1.75;
      chhatriDome.castShadow = true;
      chhatriGroup.add(chhatriDome);

      const chhatriFinial = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.62, 12),
        brassTrimMat
      );
      chhatriFinial.position.y = 3.55;
      chhatriGroup.add(chhatriFinial);
      mandirGroup.add(chhatriGroup);
    });

    // 5D. Sculpted Curved Parabolic Nagara Shikhara Spire (LatheGeometry + Ribbed Lata + Urushringas + Amalaka + Gold Kalash + Vertex-Waving Dhwaja)
    const shikharaHeight = 9.4;
    const shikharaBaseRadius = 4.35;
    const shikharaLathePoints: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
    const shikharaSteps = 36;
    for (let i = 0; i <= shikharaSteps; i++) {
      const t = i / shikharaSteps;
      const y = t * shikharaHeight;
      const parabolicR = shikharaBaseRadius * (1 - 0.72 * Math.pow(t, 1.38));
      const bhumiMod = Math.sin(t * Math.PI * 18) * 0.11;
      shikharaLathePoints.push(new THREE.Vector2(Math.max(0.85, parabolicR + bhumiMod), y));
    }
    shikharaLathePoints.push(new THREE.Vector2(0, shikharaHeight));

    const mainShikharaGeo = new THREE.LatheGeometry(shikharaLathePoints, 8);
    mainShikharaGeo.rotateY(Math.PI / 8);

    const lataRibPoints: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const y = t * (shikharaHeight - 0.3);
      const r = (shikharaBaseRadius + 0.25) * (1 - 0.74 * Math.pow(t, 1.38));
      lataRibPoints.push(new THREE.Vector2(r, y));
    }
    const lataRibGeo = new THREE.LatheGeometry(lataRibPoints, 4);

    const urushringaPoints = shikharaLathePoints.map(
      (pt) => new THREE.Vector2(pt.x * 0.38, pt.y * 0.56)
    );
    const urushringaGeo = new THREE.LatheGeometry(urushringaPoints, 8);
    urushringaGeo.rotateY(Math.PI / 8);

    const uruAmalakaGeo = new THREE.TorusGeometry(0.46, 0.13, 10, 18);
    uruAmalakaGeo.rotateX(Math.PI / 2);
    const uruKalashGeo = new THREE.ConeGeometry(0.24, 0.72, 12);

    const amalakaProfilePoints = [
      new THREE.Vector2(0.0, 9.15),
      new THREE.Vector2(1.25, 9.15),
      new THREE.Vector2(1.78, 9.38),
      new THREE.Vector2(1.86, 9.62),
      new THREE.Vector2(1.62, 9.88),
      new THREE.Vector2(1.15, 10.02),
      new THREE.Vector2(1.32, 10.18),
      new THREE.Vector2(0.95, 10.35),
      new THREE.Vector2(0.0, 10.35),
    ];
    const amalakaGeo = new THREE.LatheGeometry(amalakaProfilePoints, 24);
    const fluteRibGeo = new THREE.BoxGeometry(0.18, 0.56, 3.85);

    const kalashProfilePoints = [
      new THREE.Vector2(0.0, 10.32),
      new THREE.Vector2(0.62, 10.35),
      new THREE.Vector2(0.38, 10.58),
      new THREE.Vector2(0.78, 11.05),
      new THREE.Vector2(0.66, 11.48),
      new THREE.Vector2(0.28, 11.78),
      new THREE.Vector2(0.42, 11.92),
      new THREE.Vector2(0.18, 12.18),
      new THREE.Vector2(0.02, 12.85),
      new THREE.Vector2(0.0, 12.9),
    ];
    const kalashLatheGeo = new THREE.LatheGeometry(kalashProfilePoints, 24);

    // Helper to assemble a complete Nagara Shikhara Spire (used for the central temple AND the flanking riverside spires in Diwali Ghat!)
    const buildNagaraShikharaSpire = (scale = 1.0) => {
      const sGroup = new THREE.Group();
      sGroup.scale.setScalar(scale);

      const mainSpire = new THREE.Mesh(mainShikharaGeo, sandstoneCarvedMat);
      mainSpire.castShadow = true;
      mainSpire.receiveShadow = true;
      sGroup.add(mainSpire);

      const lataRibX = new THREE.Mesh(lataRibGeo, whiteMarbleMat);
      lataRibX.scale.set(1.04, 1.0, 0.34);
      sGroup.add(lataRibX);

      const lataRibZ = new THREE.Mesh(lataRibGeo, whiteMarbleMat);
      lataRibZ.scale.set(0.34, 1.0, 1.04);
      sGroup.add(lataRibZ);

      const urushringaPositions = [
        { x: -3.35, z: 0, s: 1.0 },
        { x: 3.35, z: 0, s: 1.0 },
        { x: 0, z: 3.35, s: 1.0 },
        { x: 0, z: -3.35, s: 1.0 },
        { x: -2.55, z: 2.55, s: 0.78 },
        { x: 2.55, z: 2.55, s: 0.78 },
        { x: -2.55, z: -2.55, s: 0.78 },
        { x: 2.55, z: -2.55, s: 0.78 },
      ];
      urushringaPositions.forEach((uSpec) => {
        const uruGroup = new THREE.Group();
        uruGroup.position.set(uSpec.x, 0, uSpec.z);
        uruGroup.scale.setScalar(uSpec.s);
        const spire = new THREE.Mesh(urushringaGeo, sandstoneDeepMat);
        spire.castShadow = true;
        uruGroup.add(spire);
        const miniAmalaka = new THREE.Mesh(uruAmalakaGeo, whiteMarbleMat);
        miniAmalaka.position.y = 5.32;
        uruGroup.add(miniAmalaka);
        const miniKalash = new THREE.Mesh(uruKalashGeo, brassTrimMat);
        miniKalash.position.y = 5.78;
        uruGroup.add(miniKalash);
        sGroup.add(uruGroup);
      });

      const amalakaCrown = new THREE.Mesh(amalakaGeo, whiteMarbleMat);
      amalakaCrown.castShadow = true;
      sGroup.add(amalakaCrown);

      for (let f = 0; f < 8; f++) {
        const flute = new THREE.Mesh(fluteRibGeo, sandstoneDeepMat);
        flute.position.y = 9.62;
        flute.rotation.y = (f / 8) * Math.PI;
        sGroup.add(flute);
      }

      const kalashFinialMesh = new THREE.Mesh(kalashLatheGeo, brassTrimMat);
      kalashFinialMesh.castShadow = true;
      sGroup.add(kalashFinialMesh);

      return sGroup;
    };

    const shikharaGroup = buildNagaraShikharaSpire(1.0);
    shikharaGroup.position.set(0, 6.68, -1.2);
    mandirGroup.add(shikharaGroup);

    // Vertex-Animated Waving Saffron Silk Dhwaja Flag at the Peak
    const dhwajaPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.065, 2.8, 10),
      brassTrimMat
    );
    dhwajaPole.position.set(0, 13.4, 0);
    shikharaGroup.add(dhwajaPole);

    const dhwajaPivot = new THREE.Group();
    dhwajaPivot.position.set(0, 14.1, 0);
    const dhwajaGeo = new THREE.PlaneGeometry(2.6, 1.15, 16, 6);
    const dhwajaPosAttr = dhwajaGeo.attributes.position;
    const dhwajaBaseY = new Float32Array(dhwajaPosAttr.count);
    const dhwajaBaseX = new Float32Array(dhwajaPosAttr.count);
    for (let v = 0; v < dhwajaPosAttr.count; v++) {
      const vx = dhwajaPosAttr.getX(v) + 1.3;
      const u = Math.max(0, Math.min(1, vx / 2.6));
      const vy = dhwajaPosAttr.getY(v) * (1 - u * 0.92);
      dhwajaPosAttr.setX(v, vx);
      dhwajaPosAttr.setY(v, vy);
      dhwajaBaseX[v] = vx;
      dhwajaBaseY[v] = vy;
    }
    dhwajaGeo.computeVertexNormals();

    const dhwajaFlagMesh = new THREE.Mesh(
      dhwajaGeo,
      silkSaffronBundle.material
    );
    dhwajaPivot.add(dhwajaFlagMesh);
    shikharaGroup.add(dhwajaPivot);

    // Warm Carved Inner Sanctum Doorway & Akhand Diya Flame
    const sanctumArchGeo = createMehrabArchGeometry(3.4, 3.8, 0.45, 7);
    const sanctumDoorFrame = new THREE.Mesh(sanctumArchGeo, sandstoneDeepMat);
    sanctumDoorFrame.position.set(0, 3.65, 2.25);
    mandirGroup.add(sanctumDoorFrame);

    const sanctumGlow = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.4, 0.25),
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        emissive: 0xb45309,
        emissiveIntensity: 0.28,
        roughness: 0.55,
      })
    );
    sanctumGlow.position.set(0, 3.4, 2.15);
    mandirGroup.add(sanctumGlow);

    const sanctumDiyaBowl = new THREE.Mesh(stepDiyaBowlGeo, brassTrimMat);
    sanctumDiyaBowl.scale.setScalar(1.8);
    sanctumDiyaBowl.position.set(0, 1.95, 2.65);
    mandirGroup.add(sanctumDiyaBowl);

    const sanctumDiyaFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.52, 10),
      stepDiyaFlameMat
    );
    sanctumDiyaFlame.position.set(0, 2.38, 2.65);
    mandirGroup.add(sanctumDiyaFlame);

    // =========================================================================
    // 6. ROYAL BAZAAR PAVILION BUILDER (Used in Mela Central Hub & Braj Chowk)
    // =========================================================================
    const pavilionPillarGeo = new THREE.LatheGeometry(
      mandapPillarPoints.map((p) => new THREE.Vector2(p.x * 0.42, p.y * 0.78)),
      12
    );
    const pavilionEaveArchGeo = createMehrabArchGeometry(4.6, 0.65, 0.14, 7);
    const pavilionDomePoints = [
      new THREE.Vector2(0.0, 1.45),
      new THREE.Vector2(0.45, 1.18),
      new THREE.Vector2(1.45, 0.68),
      new THREE.Vector2(2.65, 0.22),
      new THREE.Vector2(3.35, 0.0),
    ];
    const pavilionDomeGeo = new THREE.LatheGeometry(pavilionDomePoints, 4);

    const buildOpenCourtyardPavilion = (
      parentGroup: THREE.Group,
      x: number,
      z: number,
      rotY: number,
      silkMat: THREE.MeshStandardMaterial
    ) => {
      const pav = new THREE.Group();
      pav.position.set(x, 0, z);
      pav.rotation.y = rotY;

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(5.0, 0.2, 3.4),
        sandstoneDeepMat
      );
      plinth.position.y = 0.1;
      plinth.receiveShadow = true;
      pav.add(plinth);

      const corners = [
        [-2.15, -1.35],
        [2.15, -1.35],
        [-2.15, 1.35],
        [2.15, 1.35],
      ];
      corners.forEach(([cx, cz]) => {
        const col = new THREE.Mesh(pavilionPillarGeo, whiteMarbleMat);
        col.position.set(cx, 0.18, cz);
        col.castShadow = true;
        pav.add(col);
      });

      const frontArch = new THREE.Mesh(pavilionEaveArchGeo, sandstoneCarvedMat);
      frontArch.position.set(0, 3.42, 1.35);
      pav.add(frontArch);

      const counterBase = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.96, 1.05),
        sandstoneDeepMat
      );
      counterBase.position.set(0, 0.58, 0.65);
      counterBase.castShadow = true;
      pav.add(counterBase);

      const counterTop = new THREE.Mesh(
        new THREE.BoxGeometry(4.05, 0.12, 1.22),
        whiteMarbleMat
      );
      counterTop.position.set(0, 1.12, 0.65);
      pav.add(counterTop);

      for (let p = 0; p < 3; p++) {
        const pot = new THREE.Mesh(stepDiyaBowlGeo, brassTrimMat);
        pot.scale.setScalar(1.4 - p * 0.25);
        pot.position.set(-1.1 + p * 0.65, 1.2 + p * 0.08, 0.65);
        pav.add(pot);
      }

      const roofCone = new THREE.Mesh(pavilionDomeGeo, silkMat);
      roofCone.position.set(0, 3.72, 0);
      roofCone.rotation.y = Math.PI / 4;
      roofCone.scale.set(1.08, 1, 0.78);
      roofCone.castShadow = true;
      pav.add(roofCone);

      const finial = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.45, 10),
        brassTrimMat
      );
      finial.position.set(0, 5.25, 0);
      pav.add(finial);

      const lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, 0.24, 8),
        brassTrimMat
      );
      lantern.position.set(0, 3.22, 0.25);
      pav.add(lantern);

      parentGroup.add(pav);
    };

    // =========================================================================
    // 6B. ORNATE COURTYARD PLAZA INLAYS, CENTRAL BRASS FOUNTAINS, SHADED BAZAAR
    //     PAVILIONS & DECORATIVE MARIGOLD ARCHES (15–35 UNITS AHEAD OF PLAYER)
    //     Replaces the blank grey slab ahead of the stairs with rich architectural craft
    // =========================================================================
    const courtyardDecorGroup = new THREE.Group();
    scene.add(courtyardDecorGroup);

    const slateInlayMat = new THREE.MeshStandardMaterial({
      color: 0x3a3542,
      roughness: 0.8,
      metalness: 0.06,
      bumpMap: carvedSandstonePBRBundle.material.bumpMap,
      bumpScale: 0.02,
      emissiveIntensity: 0,
    });
    const sandstoneInlayMat = new THREE.MeshStandardMaterial({
      color: 0xb8865c,
      roughness: 0.8,
      metalness: 0.05,
      bumpMap: carvedSandstonePBRBundle.material.bumpMap,
      bumpScale: 0.025,
      emissiveIntensity: 0,
    });

    // Concentric Octagonal Sandstone & Slate Parikrama Walkways (Radii 11.5m, 18.5m, 26.5m)
    [
      { inner: 10.6, outer: 12.2, segs: 8, mat: slateInlayMat },
      { inner: 12.2, outer: 13.0, segs: 8, mat: sandstoneInlayMat },
      { inner: 17.5, outer: 19.2, segs: 16, mat: slateInlayMat },
      { inner: 19.2, outer: 20.0, segs: 16, mat: sandstoneInlayMat },
      { inner: 25.5, outer: 27.2, segs: 24, mat: slateInlayMat },
    ].forEach((ringSpec, rIdx) => {
      const rGeo = new THREE.RingGeometry(
        ringSpec.inner,
        ringSpec.outer,
        ringSpec.segs
      );
      rGeo.rotateX(-Math.PI / 2);
      const rMesh = new THREE.Mesh(rGeo, ringSpec.mat);
      rMesh.position.y = 0.012 + rIdx * 0.001;
      rMesh.receiveShadow = true;
      courtyardDecorGroup.add(rMesh);
    });

    // 8 Radial Patterned Sandstone & Slate Promenade Walkways Connecting Plaza to Temple & Pavilions
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      const runnerGroup = new THREE.Group();
      runnerGroup.rotation.y = angle;

      const slateRunner = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 16.5).rotateX(-Math.PI / 2),
        slateInlayMat
      );
      slateRunner.position.set(0, 0.014, 18.8);
      slateRunner.receiveShadow = true;
      runnerGroup.add(slateRunner);

      const sandstoneBorderL = new THREE.Mesh(
        new THREE.PlaneGeometry(0.32, 16.5).rotateX(-Math.PI / 2),
        sandstoneInlayMat
      );
      sandstoneBorderL.position.set(-1.26, 0.015, 18.8);
      runnerGroup.add(sandstoneBorderL);

      const sandstoneBorderR = new THREE.Mesh(
        new THREE.PlaneGeometry(0.32, 16.5).rotateX(-Math.PI / 2),
        sandstoneInlayMat
      );
      sandstoneBorderR.position.set(1.26, 0.015, 18.8);
      runnerGroup.add(sandstoneBorderR);

      courtyardDecorGroup.add(runnerGroup);
    }

    // Helper: Build Ornate Tiered Brass & Carved Sandstone Courtyard Fountain
    const buildCourtyardBrassFountain = (fx: number, fz: number) => {
      const fGroup = new THREE.Group();
      fGroup.position.set(fx, 0, fz);

      // Octagonal Carved Sandstone Basin
      const basinWall = new THREE.Mesh(
        new THREE.CylinderGeometry(2.35, 2.55, 0.58, 8),
        sandstoneInlayMat
      );
      basinWall.position.y = 0.29;
      basinWall.castShadow = true;
      basinWall.receiveShadow = true;
      fGroup.add(basinWall);

      const basinInner = new THREE.Mesh(
        new THREE.CylinderGeometry(2.05, 2.05, 0.6, 8),
        slateInlayMat
      );
      basinInner.position.y = 0.3;
      fGroup.add(basinInner);

      const waterDisc = new THREE.Mesh(
        new THREE.CircleGeometry(1.98, 16).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          roughness: 0.22,
          metalness: 0.35,
          transparent: true,
          opacity: 0.82,
        })
      );
      waterDisc.position.y = 0.61;
      fGroup.add(waterDisc);

      // Tiered Brass Urli Pedestal & Lotus Bowls
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.52, 1.55, 12),
        brassTrimMat
      );
      pedestal.position.y = 0.85;
      pedestal.castShadow = true;
      fGroup.add(pedestal);

      const lowerBowl = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 0.42, 0.36, 14),
        brassTrimMat
      );
      lowerBowl.position.y = 1.35;
      lowerBowl.castShadow = true;
      fGroup.add(lowerBowl);

      const upperBowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.24, 0.28, 12),
        brassTrimMat
      );
      upperBowl.position.y = 1.92;
      upperBowl.castShadow = true;
      fGroup.add(upperBowl);

      const lotusFinial = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.52, 10),
        brassTrimMat
      );
      lotusFinial.position.y = 2.32;
      fGroup.add(lotusFinial);

      courtyardDecorGroup.add(fGroup);
    };

    // Place 3 Ornate Brass & Sandstone Fountains Flanking the Plaza (16–20 units from player)
    buildCourtyardBrassFountain(-14.5, -6.5);
    buildCourtyardBrassFountain(14.5, -6.5);
    buildCourtyardBrassFountain(0.0, 16.5);

    // Place 4 Shaded Silk & Sandstone Bazaar Pavilions Around the Courtyard (18–24 units from player)
    buildOpenCourtyardPavilion(
      courtyardDecorGroup,
      -18.5,
      -9.5,
      Math.PI * 0.22,
      silkCrimsonBundle.material
    );
    buildOpenCourtyardPavilion(
      courtyardDecorGroup,
      18.5,
      -9.5,
      -Math.PI * 0.22,
      silkSaffronBundle.material
    );
    buildOpenCourtyardPavilion(
      courtyardDecorGroup,
      -18.5,
      8.5,
      Math.PI * 0.78,
      silkEmeraldBundle.material
    );
    buildOpenCourtyardPavilion(
      courtyardDecorGroup,
      18.5,
      8.5,
      -Math.PI * 0.78,
      silkCrimsonBundle.material
    );

    // Helper: Build Decorative Marigold Toran Archway Framing the Courtyard Walkways
    const marigoldSwagSaffronMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.72,
      metalness: 0.05,
      emissive: 0xd97706,
      emissiveIntensity: 0.16,
    });
    const marigoldSwagCrimsonMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.72,
      metalness: 0.05,
    });

    const buildMarigoldToranArch = (
      ax: number,
      az: number,
      rotY: number,
      spanWidth = 6.4
    ) => {
      const archGrp = new THREE.Group();
      archGrp.position.set(ax, 0, az);
      archGrp.rotation.y = rotY;
      const halfSpan = spanWidth * 0.5;

      [-halfSpan, halfSpan].forEach((px) => {
        const plinth = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.45, 0.68),
          slateInlayMat
        );
        plinth.position.set(px, 0.225, 0);
        archGrp.add(plinth);

        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.26, 4.4, 10),
          sandstoneInlayMat
        );
        col.position.set(px, 2.4, 0);
        col.castShadow = true;
        archGrp.add(col);

        const kalashTop = new THREE.Mesh(
          new THREE.ConeGeometry(0.24, 0.55, 10),
          brassTrimMat
        );
        kalashTop.position.set(px, 4.85, 0);
        archGrp.add(kalashTop);
      });

      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(spanWidth + 0.8, 0.34, 0.38),
        sandstoneInlayMat
      );
      beam.position.set(0, 4.45, 0);
      beam.castShadow = true;
      archGrp.add(beam);

      // Hanging Marigold Garland Swags Across the Archway
      const swagCount = 15;
      for (let i = 0; i < swagCount; i++) {
        const u = i / (swagCount - 1);
        const sx = (u - 0.5) * spanWidth;
        const sag = Math.sin(u * Math.PI * 3) * 0.38;
        const blossom = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 8),
          i % 2 === 0 ? marigoldSwagSaffronMat : marigoldSwagCrimsonMat
        );
        blossom.position.set(sx, 4.18 - sag, 0);
        archGrp.add(blossom);
      }

      courtyardDecorGroup.add(archGrp);
    };

    buildMarigoldToranArch(0, -6.8, 0, 7.2);
    buildMarigoldToranArch(-12.5, 3.5, Math.PI * 0.25, 5.6);
    buildMarigoldToranArch(12.5, 3.5, -Math.PI * 0.25, 5.6);

    // =========================================================================
    // 7. ILLUMINATED BANYAN & KADAMBA FESTIVAL TREES (Zero Vertical White Sticks!)
    //    - Warm Textured Brown Bark (#5c4028) + Spreading Boughs + Aerial Hanging Roots
    //    - Marigold Flower Garlands Wrapped Around Each Main Trunk
    //    - Multi-Layered Vibrant Sunlit Green Foliage Clusters (#2e6f40, #488e51, #6ab065)
    //    - Glowing Instanced Spherical Lantern Orbs Nestled Inside the Canopy
    // =========================================================================
    const treeCount = 24;
    const trunkLathePoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.86, 0.0),
      new THREE.Vector2(0.62, 0.65),
      new THREE.Vector2(0.48, 1.85),
      new THREE.Vector2(0.42, 3.2),
      new THREE.Vector2(0.58, 4.1),
      new THREE.Vector2(0.0, 4.25),
    ];
    const trunkGeo = new THREE.LatheGeometry(trunkLathePoints, 10);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4028,
      bumpMap: carvedSandstonePBRBundle.material.bumpMap,
      bumpScale: 0.055,
      roughness: 0.84,
      metalness: 0.04,
    });
    const banyanBranchGeo = new THREE.CylinderGeometry(0.11, 0.24, 3.1, 7);
    const aerialRootGeo = new THREE.CylinderGeometry(0.045, 0.07, 3.4, 6);
    const trunkGarlandGeo = new THREE.TorusGeometry(0.52, 0.09, 8, 18);
    trunkGarlandGeo.rotateX(Math.PI / 2);
    const trunkGarlandMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xd97706,
      emissiveIntensity: 0.18,
      roughness: 0.55,
    });

    const canopyClusterGeo = new THREE.DodecahedronGeometry(2.35, 2);
    const cPos = canopyClusterGeo.attributes.position;
    for (let v = 0; v < cPos.count; v++) {
      const vx = cPos.getX(v);
      const vy = cPos.getY(v);
      const vz = cPos.getZ(v);
      const ripple =
        1.0 +
        0.15 * Math.sin(vx * 2.2 + vz * 1.8) +
        0.1 * Math.cos(vy * 2.7);
      cPos.setXYZ(v, vx * ripple * 1.28, vy * ripple * 0.84, vz * ripple * 1.26);
    }
    canopyClusterGeo.computeVertexNormals();

    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      bumpMap: cobblestonePBRBundle.material.bumpMap,
      bumpScale: 0.045,
      roughness: 0.64,
      metalness: 0.04,
      emissive: 0x1d401e,
      emissiveIntensity: 0.08,
    });

    const CLUSTERS_PER_TREE = 5;
    const ROOTS_PER_TREE = 4;
    const GARLANDS_PER_TREE = 3;
    const instancedTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const instancedBanyanRoots = new THREE.InstancedMesh(
      banyanBranchGeo,
      trunkMat,
      treeCount * 3
    );
    const instancedAerialRoots = new THREE.InstancedMesh(
      aerialRootGeo,
      trunkMat,
      treeCount * ROOTS_PER_TREE
    );
    const instancedTrunkGarlands = new THREE.InstancedMesh(
      trunkGarlandGeo,
      trunkGarlandMat,
      treeCount * GARLANDS_PER_TREE
    );
    const instancedCanopies = new THREE.InstancedMesh(
      canopyClusterGeo,
      canopyMat,
      treeCount * CLUSTERS_PER_TREE
    );

    // Glowing Spherical Lantern Orbs Nestled Inside the Tree Canopies (NO vertical white sticks!)
    const ORBS_PER_TREE = 6;
    const canopyOrbGeo = new THREE.SphereGeometry(0.24, 12, 12);
    const fairyCurtainMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.25,
      roughness: 0.2,
    });
    const instancedTreeLanterns = new THREE.InstancedMesh(
      canopyOrbGeo,
      fairyCurtainMat,
      treeCount * ORBS_PER_TREE
    );

    // Multi-layered vibrant sunlit green foliage palette (#2e6f40, #488e51, #6ab065)
    const foliagePalette = [0x2e6f40, 0x488e51, 0x6ab065];
    const garlandPalette = [0xffaa00, 0xff5e00, 0xffc300];

    const scenicFramingTrees = [
      { x: -16.5, z: -26.5, scale: 1.18 },
      { x: 16.5, z: -26.5, scale: 1.22 },
      { x: -25.5, z: -16.5, scale: 1.12 },
      { x: 24.5, z: -26.5, scale: 1.15 },
      { x: -24.5, z: -31.5, scale: 1.14 },
      { x: 11.5, z: -31.5, scale: 1.16 },
    ];

    for (let i = 0; i < treeCount; i++) {
      let tx = 0;
      let tz = 0;
      let scale = 1.0;
      let angle = (i / treeCount) * Math.PI * 2;
      if (i < scenicFramingTrees.length) {
        tx = scenicFramingTrees[i].x;
        tz = scenicFramingTrees[i].z;
        scale = scenicFramingTrees[i].scale;
        angle = Math.atan2(tz, tx);
      } else {
        const ringIdx = i - scenicFramingTrees.length;
        const ringTotal = treeCount - scenicFramingTrees.length;
        angle = (ringIdx / ringTotal) * Math.PI * 1.4 - Math.PI * 1.2; // Northern & lateral grove arc
        const rad = 42 + (ringIdx % 3) * 4.0;
        tx = Math.cos(angle) * rad;
        tz = Math.sin(angle) * rad - 8.0;
        scale = 0.98 + ((i * 19) % 30) / 100;
      }

      _dummyObj.position.set(tx, 0, tz);
      _dummyObj.rotation.set(0.03, i * 0.7, -0.02);
      _dummyObj.scale.setScalar(scale);
      _dummyObj.updateMatrix();
      instancedTrunks.setMatrixAt(i, _dummyObj.matrix);

      // 3 Spreading Boughs
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const rAngle = angle + (rIdx - 1) * 0.95 + i * 0.4;
        _dummyObj.position.set(
          tx + Math.cos(rAngle) * 0.95 * scale,
          2.65 * scale,
          tz + Math.sin(rAngle) * 0.95 * scale
        );
        _dummyObj.rotation.set(
          Math.sin(rAngle) * 0.42,
          rAngle,
          -Math.cos(rAngle) * 0.42
        );
        _dummyObj.scale.setScalar(scale);
        _dummyObj.updateMatrix();
        instancedBanyanRoots.setMatrixAt(i * 3 + rIdx, _dummyObj.matrix);
      }

      // 4 Aerial Hanging Banyan Prop Roots descending from outer boughs
      for (let aIdx = 0; aIdx < ROOTS_PER_TREE; aIdx++) {
        const aAngle = (aIdx / ROOTS_PER_TREE) * Math.PI * 2 + i * 0.55;
        const aRad = (1.45 + (aIdx % 2) * 0.55) * scale;
        _dummyObj.position.set(
          tx + Math.cos(aAngle) * aRad,
          1.7 * scale,
          tz + Math.sin(aAngle) * aRad
        );
        _dummyObj.rotation.set(
          Math.sin(aAngle) * 0.06,
          aAngle,
          Math.cos(aAngle) * 0.06
        );
        _dummyObj.scale.setScalar(scale);
        _dummyObj.updateMatrix();
        instancedAerialRoots.setMatrixAt(i * ROOTS_PER_TREE + aIdx, _dummyObj.matrix);
      }

      // 3 Marigold Flower Garlands Wrapped Around Each Main Trunk
      for (let gIdx = 0; gIdx < GARLANDS_PER_TREE; gIdx++) {
        const gy = (1.05 + gIdx * 0.68) * scale;
        const gScale = (1.05 - gIdx * 0.08) * scale;
        _dummyObj.position.set(tx, gy, tz);
        _dummyObj.rotation.set(0.06 * (gIdx - 1), i * 0.5, -0.05 * (gIdx - 1));
        _dummyObj.scale.setScalar(gScale);
        _dummyObj.updateMatrix();
        instancedTrunkGarlands.setMatrixAt(
          i * GARLANDS_PER_TREE + gIdx,
          _dummyObj.matrix
        );
        _dummyColor.setHex(garlandPalette[(i + gIdx) % garlandPalette.length]);
        instancedTrunkGarlands.setColorAt(
          i * GARLANDS_PER_TREE + gIdx,
          _dummyColor
        );
      }

      // 5 Multi-Layered Sunlit Green Foliage Clusters per Crown
      const layerOffsets = [
        { ox: -1.15, oy: 4.05, oz: 0.75, sx: 1.08, sy: 0.92, sz: 1.08, cIdx: 0 },
        { ox: 1.15, oy: 4.25, oz: 0.65, sx: 1.04, sy: 0.95, sz: 1.04, cIdx: 1 },
        { ox: -0.75, oy: 4.55, oz: -0.95, sx: 1.06, sy: 0.94, sz: 1.06, cIdx: 1 },
        { ox: 0.95, oy: 4.75, oz: -0.85, sx: 1.0, sy: 0.92, sz: 1.0, cIdx: 2 },
        { ox: 0.0, oy: 5.55, oz: 0.0, sx: 0.96, sy: 0.96, sz: 0.96, cIdx: 2 },
      ];
      layerOffsets.forEach((lOff, lIdx) => {
        _dummyObj.position.set(
          tx + lOff.ox * scale,
          lOff.oy * scale,
          tz + lOff.oz * scale
        );
        _dummyObj.rotation.set(0.08 * lIdx, i * 1.3 + lIdx, -0.06 * lIdx);
        _dummyObj.scale.set(
          scale * lOff.sx,
          scale * lOff.sy,
          scale * lOff.sz
        );
        _dummyObj.updateMatrix();
        instancedCanopies.setMatrixAt(
          i * CLUSTERS_PER_TREE + lIdx,
          _dummyObj.matrix
        );
        _dummyColor.setHex(foliagePalette[lOff.cIdx % foliagePalette.length]);
        instancedCanopies.setColorAt(
          i * CLUSTERS_PER_TREE + lIdx,
          _dummyColor
        );
      });

      // 6 Glowing Spherical Lantern Orbs nestled organically inside the foliage crown
      for (let l = 0; l < ORBS_PER_TREE; l++) {
        const lAngle = (l / ORBS_PER_TREE) * Math.PI * 2 + i * 0.6;
        const lRad = (1.35 + (l % 2) * 0.85) * scale;
        _dummyObj.position.set(
          tx + Math.cos(lAngle) * lRad,
          (3.65 + (l % 3) * 0.52) * scale,
          tz + Math.sin(lAngle) * lRad
        );
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.setScalar((0.85 + (l % 2) * 0.25) * scale);
        _dummyObj.updateMatrix();
        instancedTreeLanterns.setMatrixAt(i * ORBS_PER_TREE + l, _dummyObj.matrix);
      }
    }
    instancedTrunks.instanceMatrix.needsUpdate = true;
    instancedBanyanRoots.instanceMatrix.needsUpdate = true;
    instancedAerialRoots.instanceMatrix.needsUpdate = true;
    instancedTrunkGarlands.instanceMatrix.needsUpdate = true;
    instancedCanopies.instanceMatrix.needsUpdate = true;
    instancedTreeLanterns.instanceMatrix.needsUpdate = true;
    if (instancedCanopies.instanceColor) {
      instancedCanopies.instanceColor.needsUpdate = true;
    }
    if (instancedTrunkGarlands.instanceColor) {
      instancedTrunkGarlands.instanceColor.needsUpdate = true;
    }
    instancedTrunks.computeBoundingSphere();
    instancedBanyanRoots.computeBoundingSphere();
    instancedAerialRoots.computeBoundingSphere();
    instancedTrunkGarlands.computeBoundingSphere();
    instancedCanopies.computeBoundingSphere();
    instancedTreeLanterns.computeBoundingSphere();
    scene.add(
      instancedTrunks,
      instancedBanyanRoots,
      instancedAerialRoots,
      instancedTrunkGarlands,
      instancedCanopies,
      instancedTreeLanterns
    );

    // =========================================================================
    // 7B. WORLD 01: HOLI — BRAJ (`holiWorldGroup` — Golden-Hour Sunlight + Enclosed Haveli Chowk)
    //     - 4-Sided Enclosed 2-Story Rajasthani/Vrindavan Sandstone Haveli Facades
    //       with Projecting Carved Chhajja Eaves, Recessed Dark Archway Corridors,
    //       Upper-Floor Jharokha Balconies with Bandhani Silk Drapes & Warm Brass Wall Lamps
    //     - 4 Brass Color Vats (Haudis) Spraying Volumetric Mist Sprays (128x128 softCloudTexture)
    //     - 40 Dynamic Soft-Edged Gulal Cloud Sprites Drifting Across the Courtyard
    // =========================================================================
    const haveliArchGeo = createMehrabArchGeometry(4.2, 2.2, 0.55, 7);
    const jharokhaArchGeo = createMehrabArchGeometry(2.4, 1.4, 0.45, 5);
    const chhajjaEaveGeo = new THREE.BoxGeometry(4.55, 0.18, 1.25);
    const corridorShadowGeo = new THREE.PlaneGeometry(3.85, 4.15);
    const jharokhaWindowShadowGeo = new THREE.PlaneGeometry(1.75, 1.85);
    const haveliRecessedShadowMat = new THREE.MeshStandardMaterial({
      color: 0x160c07,
      roughness: 0.96,
      metalness: 0.02,
    });
    const wallLampBracketGeo = new THREE.BoxGeometry(0.14, 0.14, 0.45);
    const wallLampFlameGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const silkMaterials = [
      silkCrimsonBundle.material,
      silkSaffronBundle.material,
      silkEmeraldBundle.material,
    ];

    const buildBrajHaveliWall = (
      wallX: number,
      wallZ: number,
      rotY: number,
      bayCount: number,
      hasCenterGateway = false
    ) => {
      const wallGroup = new THREE.Group();
      wallGroup.position.set(wallX, 0, wallZ);
      wallGroup.rotation.y = rotY;

      const bayWidth = 4.6;
      const totalWidth = bayCount * bayWidth;

      // Raised Haveli Sandstone Plinth
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(totalWidth + 1.6, 0.75, 3.6),
        sandstoneDeepMat
      );
      plinth.position.y = 0.375;
      plinth.receiveShadow = true;
      wallGroup.add(plinth);

      for (let b = 0; b < bayCount; b++) {
        const bx = (b - (bayCount - 1) * 0.5) * bayWidth;
        const isGatewayBay =
          hasCenterGateway && Math.abs(b - (bayCount - 1) * 0.5) < 0.8;

        // Ground-floor Fluted Sandstone Pillar
        const col = new THREE.Mesh(mandapPillarGeo, whiteMarbleMat);
        col.position.set(bx - bayWidth * 0.5, 0.75, 1.1);
        col.castShadow = true;
        wallGroup.add(col);

        // Warm Brass Wall Lamp Sconce on each Pier
        const lampBracket = new THREE.Mesh(wallLampBracketGeo, brassTrimMat);
        lampBracket.position.set(bx - bayWidth * 0.5, 3.25, 1.48);
        wallGroup.add(lampBracket);
        const lampBowl = new THREE.Mesh(stepDiyaBowlGeo, brassTrimMat);
        lampBowl.position.set(bx - bayWidth * 0.5, 3.32, 1.68);
        wallGroup.add(lampBowl);
        const lampFlame = new THREE.Mesh(wallLampFlameGeo, stepDiyaFlameMat);
        lampFlame.position.set(bx - bayWidth * 0.5, 3.45, 1.68);
        wallGroup.add(lampFlame);

        // Ground-floor Cusped Mehrab Arch
        const arch = new THREE.Mesh(haveliArchGeo, sandstoneCarvedMat);
        arch.position.set(bx, isGatewayBay ? 4.8 : 3.9, 1.1);
        arch.castShadow = true;
        wallGroup.add(arch);

        // Projecting Carved Stone Chhajja Eave (Sloped Overhang) above Ground-Floor Arcade
        const lowerChhajja = new THREE.Mesh(chhajjaEaveGeo, sandstoneDeepMat);
        lowerChhajja.position.set(bx, 5.25, 1.62);
        lowerChhajja.rotation.x = 0.28;
        lowerChhajja.castShadow = true;
        wallGroup.add(lowerChhajja);

        if (!isGatewayBay) {
          // Recessed Dark Archway Corridor Shadow Plane (creates deep architectural relief)
          const corridorShadow = new THREE.Mesh(
            corridorShadowGeo,
            haveliRecessedShadowMat
          );
          corridorShadow.position.set(bx, 2.82, 0.58);
          wallGroup.add(corridorShadow);

          // Ground-floor Recessed Haveli Backing Wall
          const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(bayWidth - 0.1, 4.8, 1.2),
            sandstoneDeepMat
          );
          backWall.position.set(bx, 3.1, -0.25);
          backWall.castShadow = true;
          backWall.receiveShadow = true;
          wallGroup.add(backWall);
        }

        // 2nd-Story Haveli Upper Arcade & Carved Jharokha Balcony
        const upperWall = new THREE.Mesh(
          new THREE.BoxGeometry(bayWidth, 4.2, 1.8),
          sandstoneCarvedMat
        );
        upperWall.position.set(bx, 7.6, 0.1);
        upperWall.castShadow = true;
        upperWall.receiveShadow = true;
        wallGroup.add(upperWall);

        // Recessed Dark Jharokha Window Opening
        const jharokhaShadow = new THREE.Mesh(
          jharokhaWindowShadowGeo,
          haveliRecessedShadowMat
        );
        jharokhaShadow.position.set(bx, 6.95, 1.18);
        wallGroup.add(jharokhaShadow);

        // Projecting Carved Jharokha Balcony Box, Scalloped Arch & Chhatri Canopy
        const jharokhaBase = new THREE.Mesh(
          new THREE.BoxGeometry(2.5, 0.42, 1.35),
          whiteMarbleMat
        );
        jharokhaBase.position.set(bx, 5.75, 1.35);
        jharokhaBase.castShadow = true;
        wallGroup.add(jharokhaBase);

        const jharokhaArch = new THREE.Mesh(jharokhaArchGeo, whiteMarbleMat);
        jharokhaArch.position.set(bx, 7.35, 1.65);
        jharokhaArch.castShadow = true;
        wallGroup.add(jharokhaArch);

        // Upper-Floor Projecting Chhajja Eave Overhang
        const upperChhajja = new THREE.Mesh(chhajjaEaveGeo, sandstoneDeepMat);
        upperChhajja.position.set(bx, 9.35, 1.48);
        upperChhajja.rotation.x = 0.26;
        upperChhajja.castShadow = true;
        wallGroup.add(upperChhajja);

        const jharokhaDome = new THREE.Mesh(chhatriDomeGeo, sandstoneDeepMat);
        jharokhaDome.scale.set(0.88, 0.65, 0.65);
        jharokhaDome.position.set(bx, 8.2, 1.45);
        wallGroup.add(jharokhaDome);

        // Colourful Bandhani Silk Drape Hanging from the Jharokha Balcony Railing
        const silkDrape = new THREE.Mesh(
          new THREE.PlaneGeometry(2.1, 1.45),
          silkMaterials[(b + Math.abs(Math.round(wallX))) % silkMaterials.length]
        );
        silkDrape.position.set(bx, 4.95, 1.98);
        wallGroup.add(silkDrape);
      }

      // Final end pillar + Continuous Rooftop Chhajja Cornice & Chhatri Cupolas
      const endCol = new THREE.Mesh(mandapPillarGeo, whiteMarbleMat);
      endCol.position.set(totalWidth * 0.5, 0.75, 1.1);
      wallGroup.add(endCol);

      const roofCornice = new THREE.Mesh(
        new THREE.BoxGeometry(totalWidth + 2.2, 0.55, 3.2),
        sandstoneDeepMat
      );
      roofCornice.position.set(0, 9.85, 0.4);
      wallGroup.add(roofCornice);

      [-totalWidth * 0.42, 0, totalWidth * 0.42].forEach((cx) => {
        const roofCupola = new THREE.Mesh(chhatriDomeGeo, whiteMarbleMat);
        roofCupola.position.set(cx, 10.1, 0.3);
        wallGroup.add(roofCupola);
        const finial = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.65, 10),
          brassTrimMat
        );
        finial.position.set(cx, 11.8, 0.3);
        wallGroup.add(finial);
      });

      holiWorldGroup.add(wallGroup);
    };

    // Enclose all 4 sides of the Braj Haveli Chowk (West, East, North Backdrop, and South Gateway)
    buildBrajHaveliWall(-30.0, -4.0, Math.PI / 2, 11, false);
    buildBrajHaveliWall(30.0, -4.0, -Math.PI / 2, 11, false);
    buildBrajHaveliWall(0.0, -35.5, 0, 12, false);
    buildBrajHaveliWall(0.0, 27.5, Math.PI, 12, true);

    // Soft Circular Cloud Texture on a 128x128 Canvas (smooth radial alpha gradient: rgba(255,255,255,0.85) center -> rgba(255,255,255,0) edge)
    const softCloudCanvas = document.createElement('canvas');
    softCloudCanvas.width = 128;
    softCloudCanvas.height = 128;
    const scCtx = softCloudCanvas.getContext('2d')!;
    const scGrad = scCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
    scGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    scGrad.addColorStop(0.42, 'rgba(255, 255, 255, 0.42)');
    scGrad.addColorStop(0.76, 'rgba(255, 255, 255, 0.12)');
    scGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    scCtx.fillStyle = scGrad;
    scCtx.fillRect(0, 0, 128, 128);
    const softCloudTexture = new THREE.CanvasTexture(softCloudCanvas);
    softCloudTexture.colorSpace = THREE.SRGBColorSpace;

    // 4 Brass Color Vats (Haudis) with Local Volumetric Mist & Water Spray Sprites (max scale <= 2.2, opacity <= 0.22)
    const colorVatConfigs = [
      { id: 'vat_gulabi', x: -9.6, z: -13.0, colorHex: 0xff1e7a, label: 'Gulabi Rose Haudi' },
      { id: 'vat_haldi', x: 9.6, z: -13.0, colorHex: 0xffaa00, label: 'Haldi Marigold Haudi' },
      { id: 'vat_neel', x: -11.5, z: -2.5, colorHex: 0x00d2ff, label: 'Neel Turquoise Haudi' },
      { id: 'vat_kesar', x: 11.5, z: -2.5, colorHex: 0xff1e7a, label: 'Kesar Pink Haudi' },
    ];
    const urliLathePoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.65, 0.0),
      new THREE.Vector2(0.48, 0.42),
      new THREE.Vector2(1.08, 0.82),
      new THREE.Vector2(1.22, 1.05),
      new THREE.Vector2(0.98, 1.12),
      new THREE.Vector2(0.0, 0.72),
    ];
    const vatOuterGeo = new THREE.LatheGeometry(urliLathePoints, 20);
    const vatLiquidGeo = new THREE.CircleGeometry(1.04, 24);
    vatLiquidGeo.rotateX(-Math.PI / 2);

    const colorVatNodes = colorVatConfigs.map((vCfg) => {
      const vatGroup = new THREE.Group();
      vatGroup.position.set(vCfg.x, 0, vCfg.z);
      const basin = new THREE.Mesh(vatOuterGeo, brassTrimMat);
      basin.castShadow = true;
      vatGroup.add(basin);

      const liquidPool = new THREE.Mesh(
        vatLiquidGeo,
        new THREE.MeshStandardMaterial({
          color: vCfg.colorHex,
          roughness: 0.18,
          metalness: 0.08,
          emissive: vCfg.colorHex,
          emissiveIntensity: 0.22,
        })
      );
      liquidPool.position.y = 0.98;
      vatGroup.add(liquidPool);

      // 18 Local Mist & Water Droplet Sprites per Haudi (max scale <= 2.2, opacity <= 0.22)
      const drops: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial }[] = [];
      for (let d = 0; d < 18; d++) {
        const dropMat = new THREE.SpriteMaterial({
          map: softCloudTexture,
          color: vCfg.colorHex,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(dropMat);
        vatGroup.add(sprite);
        drops.push({ sprite, mat: dropMat });
      }

      holiWorldGroup.add(vatGroup);
      return { ...vCfg, group: vatGroup, drops };
    });

    // 16 Small Local Gulal Mist Sprites Restricted Strictly to Local Emitter Zones Around Brass Haudi Vats & NPC Targets (max scale <= 2.2, opacity <= 0.22)
    const gulalCloudTex = softCloudTexture;
    const GULAL_CLOUD_COUNT = 16;
    const gulalCloudGeo = new THREE.PlaneGeometry(1.8, 1.35);
    const gulalCloudColors = [0xff1e7a, 0xffaa00, 0x00d2ff, 0x9b30ff];
    const localMistEmitterAnchors = [
      { x: -9.6, z: -13.0 },
      { x: 9.6, z: -13.0 },
      { x: -11.5, z: -2.5 },
      { x: 11.5, z: -2.5 },
      { x: -6.5, z: -8.5 },
      { x: 6.5, z: -8.5 },
      { x: -4.2, z: -14.2 },
      { x: 4.2, z: -14.2 },
    ];
    const holiGulalClouds: {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      baseX: number;
      baseY: number;
      baseZ: number;
      speed: number;
      phase: number;
    }[] = [];

    for (let c = 0; c < GULAL_CLOUD_COUNT; c++) {
      const cMat = new THREE.MeshBasicMaterial({
        map: gulalCloudTex,
        color: gulalCloudColors[c % gulalCloudColors.length],
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const cloudMesh = new THREE.Mesh(gulalCloudGeo, cMat);
      const anchor = localMistEmitterAnchors[c % localMistEmitterAnchors.length];
      const offsetAngle = (c * 1.57) % (Math.PI * 2);
      const bx = anchor.x + Math.cos(offsetAngle) * 1.1;
      const by = 1.45 + (c % 3) * 0.42;
      const bz = anchor.z + Math.sin(offsetAngle) * 1.1;
      cloudMesh.position.set(bx, by, bz);
      holiWorldGroup.add(cloudMesh);
      holiGulalClouds.push({
        mesh: cloudMesh,
        mat: cMat,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        speed: 0.55 + (c % 4) * 0.18,
        phase: c * 0.77,
      });
    }

    // Persistent Ground Gulal Splatter Decals (24 reusable floor splatter discs)
    const MAX_GULAL_DECALS = 24;
    const decalGeo = new THREE.CircleGeometry(1.15, 14);
    decalGeo.rotateX(-Math.PI / 2);
    let decalCursor = 0;
    const gulalDecalPool = Array.from({ length: MAX_GULAL_DECALS }, () => {
      const m = new THREE.Mesh(
        decalGeo,
        new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          roughness: 0.35,
          metalness: 0.08,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        })
      );
      m.position.y = 0.025;
      m.visible = false;
      scene.add(m);
      return m;
    });

    const stampGulalGroundDecal = (
      gx: number,
      gz: number,
      colorHex: number,
      scaleMult = 1
    ) => {
      const decal = gulalDecalPool[decalCursor];
      decalCursor = (decalCursor + 1) % MAX_GULAL_DECALS;
      decal.position.set(gx, 0.024 + (decalCursor % 5) * 0.001, gz);
      decal.rotation.y = Math.random() * Math.PI * 2;
      const s = (0.75 + Math.random() * 0.65) * scaleMult;
      decal.scale.set(s, 1, s);
      (decal.material as THREE.MeshStandardMaterial).color.setHex(colorHex);
      decal.visible = true;
    };

    // =========================================================================
    // 7C. WORLD 02: DIWALI — GHAT (`diwaliGhatGroup` — Varanasi/Yamuna Grand Stepped Riverfront + Real Mirror Water)
    //     - Upper Ghat Sandstone Terrace & Towering Riverside Fortress Walls, Chhatri Pavilions & 3 Nagara Temple Spires
    //     - 14-Step Stone Amphitheater Staircase (120 units wide, z = -15 down to z = 6)
    //     - 2,000 Instanced Glowing Diyas Lining Every Step in Golden Rows & Lotus/Swastika Formations
    //     - Horizon-Spanning River Plane (300 x 200 units, z = 6 to z = 200) with Custom GLSL Mirror-Water Shader (#060b18)
    //     - 300 Instanced Floating Clay Diyas Drifting Downstream + 4 Carved Wooden Banarasi Boats (Naukas)
    // =========================================================================

    // Upper Ghat Sandstone Promenade Platform (so the 3 Nagara Temple Spires sit atop the grand riverbank terrace)
    const ghatUpperTerrace = new THREE.Mesh(
      new THREE.BoxGeometry(140, 0.8, 25),
      sandstoneCarvedMat
    );
    ghatUpperTerrace.position.set(0, -0.4, -23.0);
    ghatUpperTerrace.receiveShadow = true;
    diwaliGhatGroup.add(ghatUpperTerrace);

    // 14-Step Stone Amphitheater Staircase Stretching 120 Units Wide Along the Riverbank (z = -10.2 down to z = -2.1)
    const GHAT_STEP_COUNT = 14;
    const GHAT_WIDTH = 120;
    for (let st = 0; st < GHAT_STEP_COUNT; st++) {
      const stepY = -0.04 - st * 0.085;
      const stepZ = -10.2 + st * 0.62;
      const ghatStep = new THREE.Mesh(
        new THREE.BoxGeometry(GHAT_WIDTH, 0.22, 0.72),
        st % 2 === 0 ? sandstoneCarvedMat : sandstoneDeepMat
      );
      ghatStep.position.set(0, stepY, stepZ);
      ghatStep.receiveShadow = true;
      diwaliGhatGroup.add(ghatStep);
    }

    // 4 Octagonal Stone Ghat Bastions (Burj) & Chhatri Aarti Pavilions Flanking the Steps
    [-34, -15, 15, 34].forEach((bx, bIdx) => {
      const bastion = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.6, 3.6, 8),
        sandstoneDeepMat
      );
      bastion.position.set(bx, -0.35, -3.8);
      diwaliGhatGroup.add(bastion);

      const chhatri = new THREE.Group();
      chhatri.position.set(bx, 1.45, -3.8);
      for (let cp = 0; cp < 4; cp++) {
        const ca = (cp / 4) * Math.PI * 2 + Math.PI / 4;
        const col = new THREE.Mesh(chhatriColGeo, whiteMarbleMat);
        col.scale.setScalar(1.35);
        col.position.set(Math.cos(ca) * 1.6, 0, Math.sin(ca) * 1.6);
        chhatri.add(col);
      }
      const dome = new THREE.Mesh(chhatriDomeGeo, whiteMarbleMat);
      dome.scale.setScalar(1.25);
      dome.position.y = 2.2;
      chhatri.add(dome);
      const finial = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.75, 10),
        brassTrimMat
      );
      finial.position.y = 4.35;
      chhatri.add(finial);
      const aartiLampBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 0.3, 8),
        brassTrimMat
      );
      aartiLampBody.position.y = 1.72;
      chhatri.add(aartiLampBody);
      const aartiFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.075, 0.22, 8),
        fairyCurtainMat
      );
      aartiFlame.position.y = 1.52;
      chhatri.add(aartiFlame);
      diwaliGhatGroup.add(chhatri);
    });

    // Towering Riverside Kashi Fortress Walls & 2 Flanking Illuminated Nagara Temple Spires (forming 3 Nagara Spires with the central temple!)
    const fortressWall = new THREE.Mesh(
      new THREE.BoxGeometry(126, 9.5, 3.2),
      sandstoneDeepMat
    );
    fortressWall.position.set(0, 4.5, -31.5);
    fortressWall.receiveShadow = true;
    diwaliGhatGroup.add(fortressWall);

    [
      { x: -24.0, z: -23.5, scale: 0.86 },
      { x: 24.0, z: -23.5, scale: 0.92 },
    ].forEach((spireCfg) => {
      const sideTemple = new THREE.Group();
      sideTemple.position.set(spireCfg.x, 0, spireCfg.z);
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(9.6, 5.8, 7.6),
        sandstoneCarvedMat
      );
      base.position.y = 2.9;
      sideTemple.add(base);

      const spire = buildNagaraShikharaSpire(spireCfg.scale);
      spire.position.y = 5.8;
      sideTemple.add(spire);
      diwaliGhatGroup.add(sideTemple);
    });

    // 2,000 Instanced Glowing Diyas Lining Every Step of the 14-Step Ghat Staircase
    const GHAT_STEP_DIYA_COUNT = 2000;
    const ghatDiyaBowlGeo = new THREE.CylinderGeometry(0.14, 0.09, 0.07, 8);
    const ghatDiyaBowlMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.75,
      metalness: 0.15,
    });
    const ghatDiyaFlameGeo = new THREE.ConeGeometry(0.065, 0.22, 6);
    const ghatDiyaFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
    });
    const instancedGhatStepBowls = new THREE.InstancedMesh(
      ghatDiyaBowlGeo,
      ghatDiyaBowlMat,
      GHAT_STEP_DIYA_COUNT
    );
    const instancedGhatStepFlames = new THREE.InstancedMesh(
      ghatDiyaFlameGeo,
      ghatDiyaFlameMat,
      GHAT_STEP_DIYA_COUNT
    );

    for (let i = 0; i < GHAT_STEP_DIYA_COUNT; i++) {
      const stepIdx = i % GHAT_STEP_COUNT;
      const rowPosIdx = Math.floor(i / GHAT_STEP_COUNT);
      const totalPerStep = Math.ceil(GHAT_STEP_DIYA_COUNT / GHAT_STEP_COUNT);
      const u = (rowPosIdx / totalPerStep) * 2 - 1; // [-1 .. 1]
      const dx = u * 54.0 + Math.sin(i * 1.7) * 0.12;
      const dy = -0.04 - stepIdx * 0.085 + 0.13;
      const dz = -10.2 + stepIdx * 0.62 + 0.18;

      _dummyObj.position.set(dx, dy, dz);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.setScalar(1.0);
      _dummyObj.updateMatrix();
      instancedGhatStepBowls.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(dx, dy + 0.12, dz);
      _dummyObj.updateMatrix();
      instancedGhatStepFlames.setMatrixAt(i, _dummyObj.matrix);
    }
    instancedGhatStepBowls.instanceMatrix.needsUpdate = true;
    instancedGhatStepFlames.instanceMatrix.needsUpdate = true;
    diwaliGhatGroup.add(instancedGhatStepBowls, instancedGhatStepFlames);

    // True Horizon-Spanning River Plane (300 x 200 units, from z = -2.0 to z = 198.0) with Custom GLSL Mirror-Water Shader
    const waterGeo = new THREE.PlaneGeometry(300, 200, 128, 96);
    waterGeo.rotateX(-Math.PI / 2);
    const diwaliWaterShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float wave = sin(pos.x * 0.35 + uTime * 2.0) * 0.06 + cos(pos.z * 0.45 + uTime * 1.6) * 0.05;
          pos.y += wave;
          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          // Deep dark Kashi indigo river water (#060b18)
          vec3 deepRiver = vec3(0.024, 0.043, 0.094);
          vec3 midnightBlue = vec3(0.045, 0.09, 0.21);

          // Anisotropic horizontal river wavelets (stretched along X, fine ripples along Z)
          float w1 = sin(vWorldPos.z * 11.5 - uTime * 3.2 + sin(vWorldPos.x * 1.4 + uTime) * 1.8);
          float w2 = sin(vWorldPos.z * 18.0 + uTime * 2.4 - cos(vWorldPos.x * 2.1 - uTime * 0.8) * 1.5);
          float w3 = cos(vWorldPos.x * 0.8 + vWorldPos.z * 7.5 - uTime * 1.9);
          float waveVal = clamp((w1 * 0.45 + w2 * 0.35 + w3 * 0.20) * 0.5 + 0.5, 0.0, 1.0);
          float glint = pow(waveVal, 3.8);

          // Real-time golden specular columns reflecting the 3 Nagara Temple Spires (x = -24, 0, 24) & Ghat Diyas
          float distFade = exp(-max(0.0, vWorldPos.z + 2.0) * 0.045);
          float colCenter = exp(-abs(vWorldPos.x + sin(vWorldPos.z * 3.5 + uTime * 2.0) * 0.45) * 0.26);
          float colWest = exp(-abs(vWorldPos.x + 24.0 + sin(vWorldPos.z * 3.2 - uTime * 1.8) * 0.4) * 0.30);
          float colEast = exp(-abs(vWorldPos.x - 24.0 + cos(vWorldPos.z * 3.2 + uTime * 1.8) * 0.4) * 0.30);
          float ghatBand = exp(-max(0.0, vWorldPos.z + 2.0) * 0.28);

          float specColumn = (colCenter * 1.1 + colWest * 0.85 + colEast * 0.85) * distFade;
          vec3 goldenReflection = vec3(1.0, 0.68, 0.18) * specColumn * (0.14 + 1.15 * glint);
          vec3 ghatDiyaShimmer = vec3(1.0, 0.48, 0.12) * ghatBand * (0.18 + 0.75 * glint);

          vec3 baseWater = mix(deepRiver, midnightBlue, waveVal * 0.42);
          vec3 finalColor = baseWater + goldenReflection + ghatDiyaShimmer;
          gl_FragColor = vec4(finalColor, 0.98);
        }
      `,
      transparent: false,
    });
    const diwaliWaterMesh = new THREE.Mesh(waterGeo, diwaliWaterShaderMat);
    diwaliWaterMesh.position.set(0, -1.12, 98.0);
    diwaliGhatGroup.add(diwaliWaterMesh);

    // 300 Instanced Floating Glowing Clay Diyas Drifting Downstream on the River Surface
    const RIVER_DIYA_COUNT = 300;
    const instancedRiverBowls = new THREE.InstancedMesh(
      ghatDiyaBowlGeo,
      ghatDiyaBowlMat,
      RIVER_DIYA_COUNT
    );
    const instancedRiverFlames = new THREE.InstancedMesh(
      ghatDiyaFlameGeo,
      ghatDiyaFlameMat,
      RIVER_DIYA_COUNT
    );
    const floatingRiverDiyaData = Array.from({ length: RIVER_DIYA_COUNT }, (_, idx) => {
      const bx = ((idx * 73) % 88) - 44;
      const bz = -1.2 + ((idx * 37) % 22);
      return {
        baseX: bx,
        baseZ: bz,
        driftSpeed: 0.45 + (idx % 5) * 0.14,
        phase: idx * 0.63,
      };
    });
    diwaliGhatGroup.add(instancedRiverBowls, instancedRiverFlames);

    // 4 Carved Wooden Banarasi Boats (Naukas) with Glowing Lantern Canopies Bobbing on the River
    const boatHullShape = new THREE.Shape();
    boatHullShape.moveTo(-3.4, 0);
    boatHullShape.quadraticCurveTo(0, 1.15, 3.4, 0);
    boatHullShape.quadraticCurveTo(0, -1.15, -3.4, 0);
    const boatHullGeo = new THREE.ExtrudeGeometry(boatHullShape, {
      depth: 0.55,
      bevelEnabled: true,
      bevelThickness: 0.18,
      bevelSize: 0.22,
      bevelSegments: 3,
    });
    boatHullGeo.rotateX(Math.PI / 2);
    const banarasiWoodMat = new THREE.MeshStandardMaterial({
      color: 0x4a2511,
      roughness: 0.65,
      metalness: 0.1,
    });

    const banarasiBoats: {
      group: THREE.Group;
      baseX: number;
      baseZ: number;
      rotY: number;
      phase: number;
    }[] = [];

    [
      { x: -8.5, z: 2.5, rotY: 0.16 },
      { x: -1.5, z: 6.2, rotY: -0.14 },
      { x: 5.5, z: 3.4, rotY: 0.22 },
      { x: 12.5, z: 7.8, rotY: -0.18 },
    ].forEach((bSpec, bIdx) => {
      const boatGroup = new THREE.Group();
      boatGroup.position.set(bSpec.x, -1.02, bSpec.z);
      boatGroup.rotation.y = bSpec.rotY;

      const hull = new THREE.Mesh(boatHullGeo, banarasiWoodMat);
      hull.position.y = 0.35;
      hull.castShadow = true;
      boatGroup.add(hull);

      // Carved Wooden Canopy Posts & Silk Baldachin Roof
      const canopyMat = silkMaterials[bIdx % silkMaterials.length];
      [-1.4, 1.4].forEach((px) => {
        [-0.55, 0.55].forEach((pz) => {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 1.65, 8),
            brassTrimMat
          );
          post.position.set(px, 1.15, pz);
          boatGroup.add(post);
        });
      });

      const canopyRoof = new THREE.Mesh(
        new THREE.BoxGeometry(3.1, 0.18, 1.35),
        canopyMat
      );
      canopyRoof.position.y = 1.98;
      boatGroup.add(canopyRoof);

      // Glowing Prow & Canopy Brass Lanterns
      const boatLanternGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8);
      [-2.8, 0, 2.8].forEach((lx, lIdx) => {
        const lantern = new THREE.Mesh(boatLanternGeo, fairyCurtainMat);
        lantern.position.set(lx, lIdx === 1 ? 1.78 : 0.86, 0);
        boatGroup.add(lantern);
      });

      diwaliGhatGroup.add(boatGroup);
      banarasiBoats.push({
        group: boatGroup,
        baseX: bSpec.x,
        baseZ: bSpec.z,
        rotY: bSpec.rotY,
        phase: bIdx * 1.4,
      });
    });

    // =========================================================================
    // 7D. WORLD 03: MELA CENTRAL HUB (`melaHubGroup` — Immersive Royal Carnival Plaza)
    //     - Grand Illuminated Mela Entrance Gate (Torana Gate)
    //     - Continuous Strings of Overhead Warm Festoon Bulbs Crisscrossing Above the Plaza
    //     - Tightly Packed Colourful Bazaar Tents Enclosing the Perimeter
    //     - 2 Glowing 3D World Portals (to Braj Holi & Diwali Ghat)
    // =========================================================================
    buildOpenCourtyardPavilion(
      melaHubGroup,
      -21.5,
      -7.5,
      Math.PI / 2.5,
      silkCrimsonBundle.material
    );
    buildOpenCourtyardPavilion(
      melaHubGroup,
      -21.5,
      7.5,
      Math.PI / 1.75,
      silkEmeraldBundle.material
    );
    buildOpenCourtyardPavilion(
      melaHubGroup,
      -18.5,
      18.5,
      Math.PI * 0.72,
      silkSaffronBundle.material
    );
    buildOpenCourtyardPavilion(
      melaHubGroup,
      19.5,
      16.5,
      -Math.PI * 0.72,
      silkCrimsonBundle.material
    );

    // Grand Illuminated Mela Entrance Gate (Torana Gate) Framing the Royal Carnival Plaza
    const toranaGateGroup = new THREE.Group();
    toranaGateGroup.position.set(16.0, 0, -4.5);
    toranaGateGroup.rotation.y = -0.38;

    [-4.8, 4.8].forEach((px) => {
      const gatePillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.82, 8.2, 12),
        sandstoneCarvedMat
      );
      gatePillar.position.set(px, 4.1, 0);
      gatePillar.castShadow = true;
      toranaGateGroup.add(gatePillar);

      const pillarRings = [1.5, 4.2, 6.8];
      pillarRings.forEach((ry) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.76, 0.09, 8, 18),
          brassTrimMat
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(px, ry, 0);
        toranaGateGroup.add(ring);
      });
    });

    const toranaBeamArch = new THREE.Mesh(
      createMehrabArchGeometry(10.4, 2.6, 0.85, 11),
      sandstoneCarvedMat
    );
    toranaBeamArch.position.set(0, 7.6, 0);
    toranaGateGroup.add(toranaBeamArch);

    // 3 Crown Chhatri Domes + Glowing Festoon Bulb Trim on Torana Gate
    [-3.8, 0, 3.8].forEach((cx, idx) => {
      const dome = new THREE.Mesh(chhatriDomeGeo, whiteMarbleMat);
      dome.scale.setScalar(idx === 1 ? 1.22 : 0.92);
      dome.position.set(cx, 8.85, 0);
      toranaGateGroup.add(dome);
      const kalash = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.75, 10),
        brassTrimMat
      );
      kalash.position.set(cx, idx === 1 ? 10.75 : 10.3, 0);
      toranaGateGroup.add(kalash);
    });

    for (let b = -10; b <= 10; b++) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        fairyCurtainMat
      );
      bulb.position.set(b * 0.48, 7.55 + Math.cos((b / 10) * Math.PI) * 0.35, 0.52);
      toranaGateGroup.add(bulb);
    }
    melaHubGroup.add(toranaGateGroup);

    // Emissive Carnival Lantern Accents in Mela Hub (zero fragment PointLight overhead!)
    const melaPortalsGroup = new THREE.Group();
    melaHubGroup.add(melaPortalsGroup);

    const portalSpecs: {
      id: FestivalWorldId;
      label: string;
      x: number;
      z: number;
      colorHex: number;
    }[] = [
      {
        id: 'holi_braj',
        label: 'Enter Portal to World 01: Holi — Braj',
        x: -26.0,
        z: -25.0,
        colorHex: 0xf43f5e,
      },
      {
        id: 'diwali_ghat',
        label: 'Enter Portal to World 02: Diwali — Ghat',
        x: -17.0,
        z: -28.0,
        colorHex: 0xf59e0b,
      },
    ];
    const portalArchGeo = new THREE.TorusGeometry(1.85, 0.16, 10, 28);
    const worldPortalNodes = portalSpecs.map((pSpec) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(pSpec.x, 1.9, pSpec.z);
      const arch = new THREE.Mesh(
        portalArchGeo,
        new THREE.MeshStandardMaterial({
          color: pSpec.colorHex,
          emissive: pSpec.colorHex,
          emissiveIntensity: 1.65,
          roughness: 0.25,
        })
      );
      pGroup.add(arch);
      melaPortalsGroup.add(pGroup);
      return { ...pSpec, group: pGroup, arch };
    });

    // 3 Springy Carnival Jump-Padding Platforms in Mela Central Hub (`MELA_JUMP_PAD_PLATFORMS`)
    const jumpPadBaseGeo = new THREE.CylinderGeometry(1.95, 2.2, 0.22, 24);
    const jumpPadRingGeo = new THREE.TorusGeometry(1.75, 0.1, 10, 28);
    jumpPadRingGeo.rotateX(Math.PI / 2);
    const melaJumpPadMeshes = MELA_JUMP_PAD_PLATFORMS.map((pad) => {
      const padGroup = new THREE.Group();
      padGroup.position.set(pad.x, 0.11, pad.z);
      const base = new THREE.Mesh(jumpPadBaseGeo, brassTrimMat);
      base.receiveShadow = true;
      padGroup.add(base);
      const ring = new THREE.Mesh(
        jumpPadRingGeo,
        new THREE.MeshStandardMaterial({
          color: pad.colorHex,
          emissive: pad.colorHex,
          emissiveIntensity: 1.15,
          roughness: 0.25,
        })
      );
      ring.position.y = 0.14;
      padGroup.add(ring);
      melaHubGroup.add(padGroup);
      return { spec: pad, group: padGroup, ring };
    });

    // Pool of 10 Interactive Stamped Floor Rangoli Decals ([G] key)
    const MAX_STAMPED_RANGOLIS = 10;
    const stampedRangoliGeo = new THREE.RingGeometry(0.45, 2.1, 16);
    stampedRangoliGeo.rotateX(-Math.PI / 2);
    let stampedRangoliCursor = 0;
    const stampedRangoliPool = Array.from({ length: MAX_STAMPED_RANGOLIS }, () => {
      const m = new THREE.Mesh(
        stampedRangoliGeo,
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: rangoliTex,
          transparent: true,
          roughness: 0.55,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.24,
          depthWrite: false,
        })
      );
      m.position.y = 0.032;
      m.visible = false;
      scene.add(m);
      return m;
    });

    const stampInteractiveFloorRangoli = (rx: number, rz: number) => {
      const mesh = stampedRangoliPool[stampedRangoliCursor];
      stampedRangoliCursor = (stampedRangoliCursor + 1) % MAX_STAMPED_RANGOLIS;
      mesh.position.set(rx, 0.032 + stampedRangoliCursor * 0.001, rz);
      mesh.rotation.y = elapsedTotal;
      mesh.visible = true;
      melaverseAudio.playSacredChime();
      spawnParticleBurst(rx, 0.5, rz, 0xfbbf24, 18, 5.5);
      spawnParticleBurst(rx, 0.65, rz, 0xf43f5e, 10, 4.5);
    };

    // 8. Decorative Sky Kites in Holi Braj (`holiWorldGroup` — no green sphere/kite clipping top-right!)
    const skyDecorGroup = new THREE.Group();
    holiWorldGroup.add(skyDecorGroup);

    const kiteMeshes: { mesh: THREE.Group; basePos: THREE.Vector3; phase: number }[] = [];
    const kiteColors = [0xff1e7a, 0xffaa00, 0x00d2ff, 0x9b30ff];
    for (let k = 0; k < 8; k++) {
      const kGroup = new THREE.Group();
      const diamondGeo = new THREE.OctahedronGeometry(0.78, 0);
      diamondGeo.scale(1, 1.25, 0.08);
      const kMat = new THREE.MeshStandardMaterial({
        color: kiteColors[k % kiteColors.length],
        emissive: kiteColors[k % kiteColors.length],
        emissiveIntensity: 0.16,
        roughness: 0.55,
      });
      const diamond = new THREE.Mesh(diamondGeo, kMat);
      const tailGeo = new THREE.ConeGeometry(0.24, 0.52, 4);
      const tail = new THREE.Mesh(tailGeo, brassTrimMat);
      tail.position.y = -0.95;
      kGroup.add(diamond, tail);

      const angle = (k / 8) * Math.PI * 1.4 - Math.PI * 1.2;
      const dist = 16 + (k % 3) * 4.5;
      const basePos = new THREE.Vector3(
        Math.cos(angle) * dist,
        12.5 + (k % 3) * 1.8,
        -16 + Math.sin(angle) * dist
      );
      kGroup.position.copy(basePos);
      skyDecorGroup.add(kGroup);
      kiteMeshes.push({ mesh: kGroup, basePos, phase: k * 0.9 });
    }

    // 9. Eight Small, Realistic Clay Diyas Evenly Spaced Along the Outer Perimeter Ring of the Floor Rangoli (No Mushroom Stools!)
    interface DiyaNode {
      id: string;
      x: number;
      z: number;
      lit: boolean;
      flameMesh: THREE.Mesh;
      haloMesh: THREE.Mesh;
      unlitRingMesh: THREE.Mesh;
    }
    const diyaNodes: DiyaNode[] = [];
    const RANGOLI_DIYA_COUNT = 8;
    const RANGOLI_DIYA_RADIUS = 4.95;
    const diyaCoords = Array.from({ length: RANGOLI_DIYA_COUNT }, (_, idx) => {
      const angle = (idx / RANGOLI_DIYA_COUNT) * Math.PI * 2;
      return {
        x: Math.cos(angle) * RANGOLI_DIYA_RADIUS,
        z: Math.sin(angle) * RANGOLI_DIYA_RADIUS,
      };
    });

    const clayDiyaMat = new THREE.MeshStandardMaterial({
      color: 0x9a4422,
      roughness: 0.82,
      metalness: 0.05,
    });
    const diyaBowlGeo = new THREE.CylinderGeometry(0.24, 0.15, 0.09, 14);
    const flameGeo = new THREE.ConeGeometry(0.085, 0.24, 8);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.95,
      roughness: 0.15,
    });
    const haloGeo = new THREE.SphereGeometry(0.18, 10, 10);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const unlitRingGeo = new THREE.RingGeometry(0.28, 0.36, 18);
    unlitRingGeo.rotateX(-Math.PI / 2);
    const unlitRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    diyaCoords.forEach((coord, idx) => {
      const dGroup = new THREE.Group();
      dGroup.position.set(coord.x, 0, coord.z);

      const bowl = new THREE.Mesh(diyaBowlGeo, clayDiyaMat);
      bowl.position.y = 0.045;
      bowl.castShadow = true;
      bowl.receiveShadow = true;
      dGroup.add(bowl);

      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 0.19;
      flame.visible = true; // Lit warm clay wick in preview; resetRoundState() sets unlit for active gameplay
      dGroup.add(flame);

      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = 0.19;
      halo.visible = true;
      dGroup.add(halo);

      const unlitRing = new THREE.Mesh(unlitRingGeo, unlitRingMat);
      unlitRing.position.y = 0.022;
      unlitRing.visible = false;
      dGroup.add(unlitRing);

      scene.add(dGroup);
      diyaNodes.push({
        id: `diya_${idx + 1}`,
        x: coord.x,
        z: coord.z,
        lit: false,
        flameMesh: flame,
        haloMesh: halo,
        unlitRingMesh: unlitRing,
      });
    });

    // 9B. Festival Blessing Nodes (Hidden from floor to eliminate stray glowing sphere clutter)
    interface BlessingNode {
      id: 'petal_aura' | 'gujiya_heal' | 'matki_burst';
      label: string;
      x: number;
      z: number;
      cooldown: number;
      group: THREE.Group;
    }

    const blessingConfigs: {
      id: BlessingNode['id'];
      label: string;
      x: number;
      z: number;
      color: number;
    }[] = [
      {
        id: 'petal_aura',
        label: 'Phoolon ki Holi Petal Aura (5s Speed & Splash Boost)',
        x: -13.5,
        z: -2.5,
        color: 0xf43f5e,
      },
      {
        id: 'gujiya_heal',
        label: 'Kesar Gujiya & Thandai (+Full Spirit & +120 Pts)',
        x: 13.5,
        z: -2.5,
        color: 0xfbbf24,
      },
      {
        id: 'matki_burst',
        label: 'Dahi-Handi Golden Matki (+180 Pts & Super Splash)',
        x: 0,
        z: -13.5,
        color: 0x38bdf8,
      },
    ];

    const blessingNodes: BlessingNode[] = blessingConfigs.map((cfg) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(cfg.x, 0.9, cfg.z);
      bGroup.visible = false;
      return {
        id: cfg.id,
        label: cfg.label,
        x: cfg.x,
        z: cfg.z,
        cooldown: 0,
        group: bGroup,
      };
    });

    // 10. Build 4 Cultural NPCs in the Courtyard
    const npcMeshes = COURT_NPCS.map((npc) => {
      const built = buildCompositeCharacterMesh({
        kurtaColor: npc.kurtaColor,
        dhotiColor: 0xb45309,
        pagdiColor: npc.pagdiColor,
        skinColor: 0xd99b72,
        hasDhol: npc.id === 'ustad_kabir',
        hasMatki: npc.id === 'halwai_mohan',
      });
      built.root.position.set(npc.x, 0, npc.z);
      built.root.lookAt(0, 0, 0);

      const ringGeo = new THREE.RingGeometry(0.72, 0.86, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.025;
      built.root.add(ring);

      scene.add(built.root);
      return { npc, built, ring };
    });

    // 11. Build Player Character + Translucent Pink/Gold Sacred Lotus Shield Dome ([Q/Right-Click])
    const initialAttire = propsRef.current.attire;
    const playerModel = buildCompositeCharacterMesh({
      kurtaColor: new THREE.Color(initialAttire.kurtaHex).getHex(),
      dhotiColor: new THREE.Color(initialAttire.dhotiHex).getHex(),
      pagdiColor: new THREE.Color(initialAttire.pagdiHex).getHex(),
      skinColor: new THREE.Color(initialAttire.skinHex).getHex(),
      hasPichkari: true,
    });
    playerModel.root.position.set(0, 0, 6.5);
    playerModel.root.rotation.y = Math.PI;
    scene.add(playerModel.root);

    // Translucent Pink/Gold Sacred Lotus Energy Dome around Player (3s duration, 6s cooldown)
    const shieldGroup = new THREE.Group();
    const shieldDomeGeo = new THREE.SphereGeometry(
      1.42,
      24,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.62
    );
    const shieldDomeMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.34,
      roughness: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shieldDome = new THREE.Mesh(shieldDomeGeo, shieldDomeMat);
    shieldDome.position.y = 0.85;
    shieldGroup.add(shieldDome);

    const shieldRimGeo = new THREE.TorusGeometry(1.38, 0.065, 10, 32);
    shieldRimGeo.rotateX(Math.PI / 2);
    const shieldRimMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfbbf24,
      emissiveIntensity: 1.75,
      roughness: 0.15,
    });
    const shieldRing = new THREE.Mesh(shieldRimGeo, shieldRimMat);
    shieldRing.position.y = 0.72;
    shieldGroup.add(shieldRing);

    // 8 Sculpted Sacred Lotus Petals around Shield Base
    const shieldPetalGeo = new THREE.ConeGeometry(0.36, 0.95, 5);
    for (let lp = 0; lp < 8; lp++) {
      const lpAngle = (lp / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(shieldPetalGeo, shieldDomeMat);
      petal.position.set(
        Math.cos(lpAngle) * 1.28,
        0.55,
        Math.sin(lpAngle) * 1.28
      );
      petal.rotation.y = -lpAngle;
      petal.rotation.z = -0.38;
      shieldGroup.add(petal);
    }
    shieldGroup.visible = false;
    playerModel.root.add(shieldGroup);

    // Interactive 3D Rhythm Timing Ring around Player for [R] Rhythm & Diyas
    const rhythmRingGeo = new THREE.RingGeometry(1.4, 1.65, 32);
    rhythmRingGeo.rotateX(-Math.PI / 2);
    const rhythmRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rhythmRingMesh = new THREE.Mesh(rhythmRingGeo, rhythmRingMat);
    rhythmRingMesh.position.y = 0.06;
    rhythmRingMesh.visible = false;
    playerModel.root.add(rhythmRingMesh);

    // Golden Objective Guiding Compass around player feet
    const compassGroup = new THREE.Group();
    compassGroup.position.set(0, 0.04, 6.5);
    const compassRingGeo = new THREE.RingGeometry(0.88, 1.02, 32);
    compassRingGeo.rotateX(-Math.PI / 2);
    const compassRingMat = new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const compassRing = new THREE.Mesh(compassRingGeo, compassRingMat);
    compassGroup.add(compassRing);

    const arrowGeo = new THREE.ConeGeometry(0.24, 0.55, 4);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const compassArrow = new THREE.Mesh(arrowGeo, arrowMat);
    compassArrow.position.set(0, 0.06, 1.35);
    compassGroup.add(compassArrow);
    scene.add(compassGroup);

    // 11B. Composite 4-Part 3D Target Lock-On Reticle Beacon + Pichkari Stream Jet
    const lockReticleGroup = new THREE.Group();
    lockReticleGroup.visible = false;

    const lockOuterRingGeo = new THREE.RingGeometry(0.95, 1.22, 28);
    lockOuterRingGeo.rotateX(-Math.PI / 2);
    const lockOuterRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const lockOuterRing = new THREE.Mesh(lockOuterRingGeo, lockOuterRingMat);
    lockOuterRing.position.y = 0.05;
    lockReticleGroup.add(lockOuterRing);

    const lockInnerRingGeo = new THREE.RingGeometry(0.52, 0.7, 6);
    lockInnerRingGeo.rotateX(-Math.PI / 2);
    const lockInnerRingMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const lockInnerRing = new THREE.Mesh(lockInnerRingGeo, lockInnerRingMat);
    lockInnerRing.position.y = 0.06;
    lockReticleGroup.add(lockInnerRing);

    const lockBeaconGeo = new THREE.OctahedronGeometry(0.28, 0);
    const lockBeaconMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const lockBeacon = new THREE.Mesh(lockBeaconGeo, lockBeaconMat);
    lockBeacon.position.y = 2.75;
    lockReticleGroup.add(lockBeacon);

    const lockChevronGeo = new THREE.ConeGeometry(0.18, 0.36, 4);
    lockChevronGeo.rotateX(Math.PI);
    const lockChevron = new THREE.Mesh(lockChevronGeo, arrowMat);
    lockChevron.position.y = 2.35;
    lockReticleGroup.add(lockChevron);
    scene.add(lockReticleGroup);

    // 3D Pichkari Volumetric Mist Plume (uses softCloudTexture, zero solid tubes!)
    const streamBeamGeo = new THREE.PlaneGeometry(1.15, 1);
    streamBeamGeo.rotateX(Math.PI / 2);
    const streamBeamMat = new THREE.MeshBasicMaterial({
      map: softCloudTexture,
      color: 0xff1e7a,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const streamBeamMesh = new THREE.Mesh(streamBeamGeo, streamBeamMat);
    streamBeamMesh.visible = false;
    scene.add(streamBeamMesh);

    // 3D Soft-Magnet Aim Tether Line on Courtyard Floor (connects Player to Magnetized Reticle)
    const magnetTetherGeo = new THREE.PlaneGeometry(0.14, 1);
    magnetTetherGeo.rotateX(-Math.PI / 2);
    const magnetTetherMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const magnetTetherMesh = new THREE.Mesh(magnetTetherGeo, magnetTetherMat);
    magnetTetherMesh.position.y = 0.055;
    magnetTetherMesh.visible = false;
    scene.add(magnetTetherMesh);

    // 12. Build Challenger Pool (5 Active Festival Challengers with 3D Overhead Health Bars & Weakness Gems)
    interface ChallengerRenderNode {
      state: ChallengerState;
      model: ReturnType<typeof buildCompositeCharacterMesh>;
      hpBarGroup: THREE.Group;
      hpFillMesh: THREE.Mesh;
      weaknessGemMat: THREE.MeshBasicMaterial;
      telegraphRing: THREE.Mesh;
      telegraphLane: THREE.Mesh;
      walkAccum: number;
    }

    const archetypes: ChallengerArchetype[] = [
      'sprinter',
      'lobber',
      'captain',
      'sprinter',
      'lobber',
    ];
    const weaknessCycle: GulalColorId[] = ['gulabi', 'haldi', 'neel'];

    const spawnChallengerState = (
      id: number,
      archetype: ChallengerArchetype,
      spawnIdx: number,
      waveNum = 1
    ): ChallengerState => {
      const angle = (spawnIdx / 5) * Math.PI * 1.5 - Math.PI * 0.75 - Math.PI / 2;
      const radius = 14 + (spawnIdx % 2) * 3.5;
      // Balanced tactile HP: takes 2 bursts (or 1 Weakness-matched / Neel shot) so combat feels active and satisfying
      const baseHp =
        archetype === 'captain' ? 95 : archetype === 'lobber' ? 68 : 62;
      const maxHp = baseHp + (waveNum - 1) * 12;
      return {
        id,
        archetype,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        vx: 0,
        vz: 0,
        hp: maxHp,
        maxHp,
        state: 'seek',
        stateTimer: 0,
        targetX: 0,
        targetZ: 0,
        orbitSign: id % 2 === 0 ? 1 : -1,
        hitFlashTimer: 0,
        koProgress: 0,
        weaknessColor: weaknessCycle[(id + waveNum) % weaknessCycle.length],
      };
    };

    const hpBgGeo = new THREE.PlaneGeometry(1.05, 0.14);
    const hpBgMat = new THREE.MeshBasicMaterial({
      color: 0x180b08,
      side: THREE.DoubleSide,
    });
    const hpFillGeo = new THREE.PlaneGeometry(0.98, 0.09);
    const gemGeo = new THREE.OctahedronGeometry(0.14, 0);

    const challengerNodes: ChallengerRenderNode[] = archetypes.map((arch, idx) => {
      const st = spawnChallengerState(idx + 1, arch, idx, 1);
      const archKurta =
        arch === 'sprinter'
          ? 0x06b6d4
          : arch === 'lobber'
          ? 0xf59e0b
          : 0xe11d48;
      const archPagdi =
        arch === 'sprinter'
          ? 0xf43f5e
          : arch === 'lobber'
          ? 0x10b981
          : 0xfbbf24;

      const model = buildCompositeCharacterMesh({
        kurtaColor: archKurta,
        dhotiColor: 0x9a3412,
        pagdiColor: archPagdi,
        skinColor: 0xc6865a,
        hasPichkari: arch === 'sprinter',
        hasMatki: arch === 'lobber',
        hasDhol: arch === 'captain',
      });
      model.root.position.set(st.x, 0, st.z);

      // 3D Floating Health Bar + Color Weakness Gem above Challenger head
      const hpBarGroup = new THREE.Group();
      hpBarGroup.position.set(0, 2.38, 0);
      const bgMesh = new THREE.Mesh(hpBgGeo, hpBgMat);
      hpBarGroup.add(bgMesh);

      const hpFillMat = new THREE.MeshBasicMaterial({
        color: GULAL_WEAPONS[st.weaknessColor].threeHex,
        side: THREE.DoubleSide,
      });
      const hpFillMesh = new THREE.Mesh(hpFillGeo, hpFillMat);
      hpFillMesh.position.z = 0.01;
      hpBarGroup.add(hpFillMesh);

      const weaknessGemMat = new THREE.MeshBasicMaterial({
        color: GULAL_WEAPONS[st.weaknessColor].threeHex,
      });
      const gemMesh = new THREE.Mesh(gemGeo, weaknessGemMat);
      gemMesh.position.set(-0.68, 0, 0);
      hpBarGroup.add(gemMesh);

      model.root.add(hpBarGroup);
      scene.add(model.root);

      const tRingGeo = new THREE.RingGeometry(0.45, 1.65, 24);
      tRingGeo.rotateX(-Math.PI / 2);
      const tRingMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.76,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const telegraphRing = new THREE.Mesh(tRingGeo, tRingMat);
      telegraphRing.position.y = 0.04;
      telegraphRing.visible = false;
      scene.add(telegraphRing);

      const tLaneGeo = new THREE.PlaneGeometry(1.15, 7.5);
      tLaneGeo.rotateX(-Math.PI / 2);
      const tLaneMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.58,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const telegraphLane = new THREE.Mesh(tLaneGeo, tLaneMat);
      telegraphLane.position.y = 0.035;
      telegraphLane.visible = false;
      scene.add(telegraphLane);

      return {
        state: st,
        model,
        hpBarGroup,
        hpFillMesh,
        weaknessGemMat,
        telegraphRing,
        telegraphLane,
        walkAccum: idx * 1.4,
      };
    });

    // 13. Zero-GC Pooled Particle Ring Buffer + Volumetric Gulal Mist Projectiles + 3D Enemy Lobbed Balloons
    const MAX_PARTICLES = 220;
    const particleGeo = new THREE.PlaneGeometry(0.85, 0.85);
    const particleMat = new THREE.MeshBasicMaterial({
      map: softCloudTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const particleInstanced = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      MAX_PARTICLES
    );
    particleInstanced.frustumCulled = false;
    scene.add(particleInstanced);

    const pActive = new Uint8Array(MAX_PARTICLES);
    const pX = new Float32Array(MAX_PARTICLES);
    const pY = new Float32Array(MAX_PARTICLES);
    const pZ = new Float32Array(MAX_PARTICLES);
    const pVx = new Float32Array(MAX_PARTICLES);
    const pVy = new Float32Array(MAX_PARTICLES);
    const pVz = new Float32Array(MAX_PARTICLES);
    const pLife = new Float32Array(MAX_PARTICLES);
    const pMaxLife = new Float32Array(MAX_PARTICLES);
    const pScale = new Float32Array(MAX_PARTICLES);
    let particleCursor = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      _dummyObj.position.set(0, -50, 0);
      _dummyObj.scale.setScalar(0.001);
      _dummyObj.updateMatrix();
      particleInstanced.setMatrixAt(i, _dummyObj.matrix);
      _dummyColor.setHex(0xff1e7a);
      particleInstanced.setColorAt(i, _dummyColor);
    }
    particleInstanced.instanceMatrix.needsUpdate = true;
    if (particleInstanced.instanceColor) {
      particleInstanced.instanceColor.needsUpdate = true;
    }

    const spawnParticleBurst = (
      bx: number,
      by: number,
      bz: number,
      colorHex: number,
      count: number,
      speedSpread = 6.5
    ) => {
      _dummyColor.setHex(colorHex);
      for (let c = 0; c < count; c++) {
        const idx = particleCursor;
        particleCursor = (particleCursor + 1) % MAX_PARTICLES;
        pActive[idx] = 1;
        pX[idx] = bx + (Math.random() - 0.5) * 0.4;
        pY[idx] = by + (Math.random() - 0.5) * 0.4;
        pZ[idx] = bz + (Math.random() - 0.5) * 0.4;
        const angle = Math.random() * Math.PI * 2;
        const spd = (0.35 + Math.random() * 0.65) * speedSpread;
        pVx[idx] = Math.cos(angle) * spd;
        pVy[idx] = 2.4 + Math.random() * 4.8;
        pVz[idx] = Math.sin(angle) * spd;
        pMaxLife[idx] = 0.5 + Math.random() * 0.4;
        pLife[idx] = pMaxLife[idx];
        pScale[idx] = 0.75 + Math.random() * 0.95;
        particleInstanced.setColorAt(idx, _dummyColor);
      }
      if (particleInstanced.instanceColor) {
        particleInstanced.instanceColor.needsUpdate = true;
      }
    };

    // Pooled Player Homing Gulal Mist Sprites (28 reusable softCloudTexture sprites — no solid sphere chains!)
    const MAX_PROJECTILES = 28;
    interface GulalProjectile {
      active: boolean;
      colorId: GulalColorId;
      x: number;
      y: number;
      z: number;
      vx: number;
      vz: number;
      life: number;
      maxLife: number;
      damage: number;
      mesh: THREE.Sprite;
      mat: THREE.SpriteMaterial;
    }
    const projectiles: GulalProjectile[] = Array.from(
      { length: MAX_PROJECTILES },
      () => {
        const mat = new THREE.SpriteMaterial({
          map: softCloudTexture,
          color: 0xff1e7a,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        });
        const m = new THREE.Sprite(mat);
        m.scale.setScalar(0.95);
        m.visible = false;
        scene.add(m);
        return {
          active: false,
          colorId: 'gulabi',
          x: 0,
          y: 1.15,
          z: 0,
          vx: 0,
          vz: 0,
          life: 0,
          maxLife: 0.6,
          damage: 35,
          mesh: m,
          mat,
        };
      }
    );

    // Pooled Challenger 3D Parabolic Lobbed Gulal Balloons (8 reusable meshes)
    interface LobbedBalloon {
      active: boolean;
      startX: number;
      startZ: number;
      targetX: number;
      targetZ: number;
      progress: number;
      duration: number;
      mesh: THREE.Mesh;
    }
    const balloonGeo = new THREE.SphereGeometry(0.34, 12, 10);
    const lobbedBalloons: LobbedBalloon[] = Array.from({ length: 8 }, () => {
      const m = new THREE.Mesh(
        balloonGeo,
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xd97706,
          emissiveIntensity: 0.4,
          roughness: 0.3,
        })
      );
      m.visible = false;
      scene.add(m);
      return {
        active: false,
        startX: 0,
        startZ: 0,
        targetX: 0,
        targetZ: 0,
        progress: 0,
        duration: 0.55,
        mesh: m,
      };
    });

    // 13B. 3D Martial Punch/Kick Crescent Slash Wave + 3D Bomb Shockwave Dome + Rockets + Thrown Balloons + Sutli Bombs
    const meleeSlashGeo = new THREE.RingGeometry(
      0.85,
      2.6,
      24,
      1,
      -Math.PI * 0.45,
      Math.PI * 0.9
    );
    meleeSlashGeo.rotateX(-Math.PI / 2);
    const meleeSlashMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const meleeSlashMesh = new THREE.Mesh(meleeSlashGeo, meleeSlashMat);
    meleeSlashMesh.visible = false;
    scene.add(meleeSlashMesh);

    const bombShockGeo = new THREE.SphereGeometry(1, 20, 14);
    const bombShockMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.65,
      wireframe: true,
      depthWrite: false,
    });
    const bombShockwaveMesh = new THREE.Mesh(bombShockGeo, bombShockMat);
    bombShockwaveMesh.visible = false;
    scene.add(bombShockwaveMesh);

    // Pooled Player Thrown Gubbara Balloons, Hawai Rockets & Sutli Bombs (12 reusable special ordnance nodes)
    interface SpecialOrdnance {
      active: boolean;
      kind: 'balloon' | 'rocket' | 'bomb';
      startX: number;
      startZ: number;
      targetX: number;
      targetZ: number;
      x: number;
      y: number;
      z: number;
      progress: number;
      duration: number;
      colorHex: number;
      group: THREE.Group;
    }

    const rocketConeGeo = new THREE.ConeGeometry(0.22, 0.55, 10);
    rocketConeGeo.rotateX(Math.PI / 2);
    const rocketTubeGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.65, 10);
    rocketTubeGeo.rotateX(Math.PI / 2);
    const bombBodyGeo = new THREE.DodecahedronGeometry(0.36, 1);

    const specialOrdnancePool: SpecialOrdnance[] = Array.from(
      { length: 12 },
      () => {
        const g = new THREE.Group();
        const nose = new THREE.Mesh(
          rocketConeGeo,
          new THREE.MeshBasicMaterial({ color: 0xf43f5e })
        );
        nose.position.z = 0.45;
        const tube = new THREE.Mesh(
          rocketTubeGeo,
          new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            metalness: 0.6,
            roughness: 0.3,
          })
        );
        const sphere = new THREE.Mesh(
          bombBodyGeo,
          new THREE.MeshStandardMaterial({
            color: 0x10b981,
            emissive: 0x059669,
            emissiveIntensity: 0.45,
            roughness: 0.35,
          })
        );
        g.add(nose, tube, sphere);
        g.visible = false;
        scene.add(g);
        return {
          active: false,
          kind: 'balloon',
          startX: 0,
          startZ: 0,
          targetX: 0,
          targetZ: 0,
          x: 0,
          y: 1.2,
          z: 0,
          progress: 0,
          duration: 0.32,
          colorHex: 0x38bdf8,
          group: g,
        };
      }
    );

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 14. Unified Input Hub (Player-Driven Firing, Hold-to-Fire, 3D Raycast Click & Parry Shield [Q] / Right-Click)
    const keysHeld = new Set<string>();
    const keysJustPressed = new Set<string>();
    let pointerJustClicked = false;
    let pointerIsDown = false;
    let rightClickParryJustPressed = false;
    let hasClickWorldTarget = false;
    let clickWorldX = 0;
    let clickWorldZ = 0;
    let hasCursorWorld = false;
    let cursorWorldX = 0;
    let cursorWorldZ = -2;
    let pendingArsenalKeyAttack: ArsenalModeId | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      const code = e.code;
      if (!keysHeld.has(code)) {
        keysJustPressed.add(code);
      }
      keysHeld.add(code);

      if (propsRef.current.gameState === 'playing') {
        if (code === 'Digit1') {
          propsRef.current.onSelectArsenal('pichkari');
          pendingArsenalKeyAttack = 'pichkari';
        } else if (code === 'Digit2' || code === 'KeyX') {
          propsRef.current.onSelectArsenal('punch_kick');
          pendingArsenalKeyAttack = 'punch_kick';
        } else if (code === 'Digit3') {
          propsRef.current.onSelectArsenal('balloon_throw');
          pendingArsenalKeyAttack = 'balloon_throw';
        } else if (code === 'Digit4') {
          propsRef.current.onSelectArsenal('hawai_rocket');
          pendingArsenalKeyAttack = 'hawai_rocket';
        } else if (code === 'Digit5') {
          propsRef.current.onSelectArsenal('sutli_bomb');
          pendingArsenalKeyAttack = 'sutli_bomb';
        }
      }
      if (code === 'KeyN') {
        const order: DayNightCycleMode[] = [
          'auto',
          'dawn',
          'day',
          'dusk',
          'night',
        ];
        const curIdx = order.indexOf(propsRef.current.dayNightMode);
        const nextMode = order[(curIdx + 1) % order.length];
        melaverseAudio.playUiClick();
        propsRef.current.onChangeDayNightMode(nextMode);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };

    const clearAllInputs = () => {
      keysHeld.clear();
      keysJustPressed.clear();
      pointerJustClicked = false;
      pointerIsDown = false;
      rightClickParryJustPressed = false;
      hasClickWorldTarget = false;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) clearAllInputs();
    };

    let rideLookYawOffset = 0;
    let rideLookPitchOffset = 0;
    let lastRidePointerX = 0;
    let lastRidePointerY = 0;

    const updateCursorWorldFromPointer = (e: PointerEvent, isClick: boolean) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      _ndcVec2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _ndcVec2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndcVec2, camera);
      const hit = _raycaster.ray.intersectPlane(_groundPlane, _planeHitVec3);
      if (hit) {
        hasCursorWorld = true;
        cursorWorldX = Math.max(-52, Math.min(52, _planeHitVec3.x));
        cursorWorldZ = Math.max(-52, Math.min(52, _planeHitVec3.z));
        if (isClick) {
          hasClickWorldTarget = true;
          clickWorldX = cursorWorldX;
          clickWorldZ = cursorWorldZ;
        }
      }
    };

    const handleCanvasPointerDown = (e: PointerEvent) => {
      if (propsRef.current.gameState !== 'playing') return;
      if (e.button === 0) {
        pointerJustClicked = true;
        pointerIsDown = true;
        lastRidePointerX = e.clientX;
        lastRidePointerY = e.clientY;
        updateCursorWorldFromPointer(e, true);
      } else if (e.button === 2) {
        rightClickParryJustPressed = true;
      }
    };

    const handleCanvasPointerMove = (e: PointerEvent) => {
      if (propsRef.current.gameState === 'playing') {
        if (propsRef.current.mountedRide) {
          const dx = e.clientX - lastRidePointerX;
          const dy = e.clientY - lastRidePointerY;
          if (pointerIsDown && Math.abs(dx) < 120 && Math.abs(dy) < 120) {
            rideLookYawOffset -= dx * 0.0065;
            rideLookPitchOffset = Math.max(
              -0.75,
              Math.min(0.75, rideLookPitchOffset - dy * 0.005)
            );
          }
          lastRidePointerX = e.clientX;
          lastRidePointerY = e.clientY;
        } else {
          updateCursorWorldFromPointer(e, pointerIsDown);
        }
      }
    };

    const handleWindowPointerUp = () => {
      pointerIsDown = false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (propsRef.current.gameState === 'playing') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('blur', clearAllInputs);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    renderer.domElement.addEventListener('pointerdown', handleCanvasPointerDown);
    renderer.domElement.addEventListener('pointermove', handleCanvasPointerMove);
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);

    let lastObservedW = Math.round(initW);
    let lastObservedH = Math.round(initH);
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, Math.round(entry.contentRect.width));
        const h = Math.max(1, Math.round(entry.contentRect.height));
        if (w === lastObservedW && h === lastObservedH) continue;
        lastObservedW = w;
        lastObservedH = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
        bloomPass.resolution.set(w, h);
        if (!isSoftwareGl && bloomPass.enabled) {
          composer.render();
        } else {
          renderer.render(scene, camera);
        }
      }
    });
    resizeObserver.observe(container);

    // 15. Simulation State Variables (Tactile 3-Wave Combat + 6 Unlit Diyas + Grand Mela Rides & Stalls)
    let playerX = 0;
    let playerY = 0;
    let playerZ = 6.5;
    let playerVy = 0;
    let playerYaw = Math.PI;
    let frameVelocityX = 0;
    let frameVelocityZ = 0;
    let frameStrafeInputX = 0;
    let frameBuoyancyYOffset = 0;
    let walkDistAccum = 0;
    let footstepAccum = 0;
    let scaleSquashX = 1;
    let scaleSquashY = 1;
    let armRecoilTimer = 0;
    let coyoteTimer = 0.1;
    let attackBufferTimer = 0;
    let dashBufferTimer = 0;
    let jumpBufferTimer = 0;
    let weaponCooldown = 0;
    let streamBeamTimer = 0;
    let dashCooldown = 0;
    let dashActiveTimer = 0;
    let dashDirX = 0;
    let dashDirZ = -1;

    // Water-Lotus Parry Shield State ([Q] or Right-Click)
    let shieldActiveTimer = 0;
    let shieldCooldown = 0;

    // Soft-Magnet Reticle, Martial Combo & Bomb Shockwave State
    let smoothReticleX = 0;
    let smoothReticleZ = 0;
    let magnetFirePulseTimer = 0;
    let autoStrideTimer = 0;
    let autoStrideX = 0;
    let autoStrideZ = 0;
    let meleeComboStep = 0;
    let meleeSlashTimer = 0;
    let spinKickTimer = 0;
    let bombShockwaveTimer = 0;

    const maxSpiritPips = 6;
    let spiritPips = 6;
    let spiritTrail = 6;
    let spiritRegenAccum = 0;
    let petalAuraTimer = 0;
    let petalPulseAccum = 0;
    let gulalTankPct = 100;
    let rhythmRingTimer = 0;

    // Floating Center-Screen Hit / Score Callout State
    let floatingCalloutCounter = 0;
    let floatingCallout: HudSnapshot['floatingCallout'] = null;
    let floatingCalloutTimer = 0;
    const emitFloatingCallout = (text: string, colorHex: string) => {
      floatingCalloutCounter += 1;
      floatingCallout = {
        id: floatingCalloutCounter,
        text,
        colorHex,
      };
      floatingCalloutTimer = 1.35;
      lastHudEmitTime = 0;
    };

    let score = 0;
    let bestScore = 1850;
    let combo = 1;
    let comboStreak = 0;
    let comboDecayTimer = 0;
    const comboMaxDecaySec = 6.0;
    const recentAttackOutcomes: boolean[] = [];
    let activeVolleyPendingTimer = 0;
    let activeVolleyScoredHit = false;
    const recordVolleyOutcome = (didHit: boolean) => {
      recentAttackOutcomes.push(didHit);
      if (recentAttackOutcomes.length > 10) {
        recentAttackOutcomes.shift();
      }
      lastHudEmitTime = 0;
    };
    let revelersSplashed = 0;
    const targetRevelers = 12; // 3 Waves of 4 Challengers
    const targetDiyas = 8; // All 8 Perimeter Clay Diyas around the Rangoli Mandala
    let lastWaveAnnounced = 1;
    let roundElapsedSec = 0;
    let roundEnded = false;

    let hitstopTimer = 0;
    let screenShakeState: ScreenShakeState = createInitialScreenShakeState();
    const cameraDirector = new MelaCameraDirector();
    let karmaState: KarmaState = createInitialKarmaState();
    const applyKarmaDeed = (action: KarmaActionType, customLabel?: string) => {
      const kRes = recordKarmaAction(karmaState, action, customLabel);
      karmaState = kRes.state;
      lastHudEmitTime = 0;
      if (kRes.triggeredNewBlessing && kRes.grantedBlessing) {
        melaverseAudio.playSacredChime();
        spawnParticleBurst(
          playerX,
          1.4,
          playerZ,
          kRes.grantedBlessing.threeHex,
          28,
          7.8
        );
        spiritPips = Math.min(maxSpiritPips, spiritPips + 1);
        emitFloatingCallout(
          `Divine Blessing: ${kRes.grantedBlessing.name}!`,
          kRes.grantedBlessing.accentHex
        );
      }
    };
    let lastResetCounter = propsRef.current.resetCounter;
    let lastFireworksCount = propsRef.current.fireworksCount;
    let lastShieldTriggerCount = propsRef.current.shieldTriggerCount;
    let lastFireTriggerCount = propsRef.current.fireTriggerCount;
    let lastDashTriggerCount = propsRef.current.dashTriggerCount;
    let lastRhythmDiyaTriggerCount = propsRef.current.rhythmDiyaTriggerCount;
    let lastStampRangoliTriggerCount = propsRef.current.stampRangoliTriggerCount;
    let lastKarmaOfferingCount = propsRef.current.karmaOfferingCount;
    let lastJumpTriggerCount = propsRef.current.jumpTriggerCount;
    let lastInteractTriggerCount = propsRef.current.interactTriggerCount;
    let lastActiveWorldForCycle: FestivalWorldId = propsRef.current.activeWorld;
    let dayNightState: DayNightCycleState = createInitialDayNightState(
      propsRef.current.activeWorld
    );
    let lastSkyColorKey = '';
    let smoothedFps = 60;
    let lastHudEmitTime = 0;
    let elapsedTotal = 0;
    let lastFrameTime = performance.now();

    const buildMagnetCandidates = (): MagnetTargetCandidate[] => {
      const list: MagnetTargetCandidate[] = [];
      for (const node of challengerNodes) {
        if (node.state.state !== 'ko') {
          const archLabel =
            node.state.archetype === 'captain'
              ? 'Dholak Captain'
              : node.state.archetype === 'lobber'
              ? 'Matki Lobber'
              : 'Braj Sprinter';
          list.push({
            id: `rev-${node.state.id}`,
            kind: 'reveler',
            label: archLabel,
            weaknessColor: node.state.weaknessColor,
            x: node.state.x,
            z: node.state.z,
            priorityWeight: 1.45,
          });
        }
      }
      for (const d of diyaNodes) {
        if (!d.lit) {
          list.push({
            id: d.id,
            kind: 'diya',
            label: 'Sacred Brass Diya',
            x: d.x,
            z: d.z,
            priorityWeight: 1.38,
          });
        }
      }
      return list;
    };

    const resetRoundState = () => {
      playerX = 0;
      playerY = 0;
      playerZ = 6.5;
      playerVy = 0;
      playerYaw = Math.PI;
      melaPhysics.teleportPlayer(0, 0, 6.5);
      spiritPips = maxSpiritPips;
      spiritTrail = maxSpiritPips;
      spiritRegenAccum = 0;
      petalAuraTimer = 0;
      gulalTankPct = 100;
      rhythmRingTimer = 0;
      rhythmRingMesh.visible = false;
      floatingCallout = null;
      floatingCalloutTimer = 0;
      shieldActiveTimer = 0;
      shieldCooldown = 0;
      shieldGroup.visible = false;
      streamBeamTimer = 0;
      streamBeamMesh.visible = false;
      magnetTetherMesh.visible = false;
      meleeSlashMesh.visible = false;
      bombShockwaveMesh.visible = false;
      smoothReticleX = 0;
      smoothReticleZ = -2;
      magnetFirePulseTimer = 0;
      autoStrideTimer = 0;
      meleeSlashTimer = 0;
      spinKickTimer = 0;
      bombShockwaveTimer = 0;
      specialOrdnancePool.forEach((o) => {
        o.active = false;
        o.group.visible = false;
      });
      score = 0;
      combo = 1;
      comboStreak = 0;
      comboDecayTimer = 0;
      recentAttackOutcomes.length = 0;
      activeVolleyPendingTimer = 0;
      activeVolleyScoredHit = false;
      revelersSplashed = 0;
      lastWaveAnnounced = 1;
      roundElapsedSec = 0;
      roundEnded = false;
      hitstopTimer = 0;
      screenShakeState = createInitialScreenShakeState();
      karmaState = createInitialKarmaState();
      clearAllInputs();

      // All 6 Diyas start unlit so the player genuinely lights them
      diyaNodes.forEach((d) => {
        d.lit = false;
        d.flameMesh.visible = false;
        d.haloMesh.visible = false;
        d.unlitRingMesh.visible = true;
      });

      blessingNodes.forEach((b) => {
        b.cooldown = 0;
        b.group.visible = true;
      });

      lobbedBalloons.forEach((lb) => {
        lb.active = false;
        lb.mesh.visible = false;
      });

      challengerNodes.forEach((node, idx) => {
        node.state = spawnChallengerState(idx + 1, archetypes[idx], idx, 1);
        node.model.root.position.set(node.state.x, 0, node.state.z);
        node.model.bodyGroup.rotation.set(0, 0, 0);
        node.hpFillMesh.scale.x = 1;
        node.hpFillMesh.position.x = 0;
        const wHex = GULAL_WEAPONS[node.state.weaknessColor].threeHex;
        (node.hpFillMesh.material as THREE.MeshBasicMaterial).color.setHex(wHex);
        node.weaknessGemMat.color.setHex(wHex);
        node.telegraphRing.visible = false;
        node.telegraphLane.visible = false;
      });
    };

    // Helper: Apply damage to a Challenger when hit by a Projectile or Shield Deflect
    const damageChallengerNode = (
      node: ChallengerRenderNode,
      weaponColorId: GulalColorId,
      damageAmount: number
    ) => {
      const st = node.state;
      if (st.state === 'ko') return;

      const matchedWeakness = weaponColorId === st.weaknessColor;
      const dmg = matchedWeakness ? damageAmount * 1.55 : damageAmount;
      st.hp = Math.max(0, st.hp - dmg);
      st.hitFlashTimer = 0.09;

      if (!activeVolleyScoredHit) {
        activeVolleyScoredHit = true;
        activeVolleyPendingTimer = 0;
        recordVolleyOutcome(true);
      }

      // Update 3D overhead health bar fill
      const ratio = Math.max(0.001, st.hp / st.maxHp);
      node.hpFillMesh.scale.x = ratio;
      node.hpFillMesh.position.x = -(1 - ratio) * 0.49;

      const weaponSpec = GULAL_WEAPONS[weaponColorId];
      const weaponHex = weaponSpec.threeHex;

      // Stamp persistent Gulal ground splatter decal under the splashed NPC
      stampGulalGroundDecal(st.x, st.z, weaponHex, matchedWeakness ? 1.5 : 1.15);

      if (st.hp <= 0) {
        st.state = 'ko';
        st.koProgress = 0;
        const pushDx = st.x - playerX;
        const pushDz = st.z - playerZ;
        const pushLen = Math.hypot(pushDx, pushDz) || 1;
        st.vx = (pushDx / pushLen) * 9.0;
        st.vz = (pushDz / pushLen) * 9.0;

        revelersSplashed += 1;
        comboStreak += 1;
        const reward = calculateSplashScore(140, combo, matchedWeakness);
        score += reward.pointsEarned;
        bestScore = Math.max(bestScore, score);
        combo = reward.nextCombo;
        comboDecayTimer = comboMaxDecaySec;
        propsRef.current.onRewardEarned(reward.coinsEarned, reward.xpEarned);

        emitFloatingCallout(
          `+${reward.pointsEarned} Joy Burst! (${combo}× Combo · +${reward.coinsEarned} Coins)`,
          weaponSpec.hex
        );

        // Check if advancing to Wave 2 or Wave 3
        const nextWave = Math.min(3, Math.floor(revelersSplashed / 4) + 1);
        if (nextWave > lastWaveAnnounced) {
          lastWaveAnnounced = nextWave;
          melaverseAudio.playWaveAdvance();
          spawnParticleBurst(0, 3.2, 0, 0xfbbf24, 28, 9.0);
        }

        hitstopTimer = 0.048;
        screenShakeState = triggerScreenShake(screenShakeState, {
          traumaDelta: 0.44,
          dirX: pushDx,
          dirZ: pushDz,
          verticalKick: 0.14,
          frequencyHz: 26,
        });
        melaverseAudio.playHeavySplash(true, matchedWeakness);
        spawnParticleBurst(st.x, 1.25, st.z, weaponHex, 26, 8.5);
      } else {
        comboStreak += 1;
        combo = Math.min(10, combo + 1);
        comboDecayTimer = comboMaxDecaySec;
        const pts = Math.round((matchedWeakness ? 35 : 25) * combo);
        score += pts;
        bestScore = Math.max(bestScore, score);
        emitFloatingCallout(
          matchedWeakness
            ? `+${pts} Crit Gulal Hit! (${combo}×)`
            : `+${pts} Gulal Hit!`,
          weaponSpec.hex
        );
        hitstopTimer = 0.022;
        screenShakeState = triggerScreenShake(screenShakeState, {
          traumaDelta: 0.25,
          dirX: st.x - playerX,
          dirZ: st.z - playerZ,
          verticalKick: 0.08,
          frequencyHz: 29,
        });
        melaverseAudio.playHeavySplash(false, matchedWeakness);
        spawnParticleBurst(st.x, 1.15, st.z, weaponHex, 12, 5.5);
      }
    };

    // Helper: Light an unlit Sacred Diya when hit by a Gulal Projectile, [R] Rhythm beat, or [E] interaction
    const igniteDiyaNode = (d: DiyaNode) => {
      if (d.lit) return;
      d.lit = true;
      if (!activeVolleyScoredHit) {
        activeVolleyScoredHit = true;
        activeVolleyPendingTimer = 0;
        recordVolleyOutcome(true);
      }
      d.flameMesh.visible = true;
      d.haloMesh.visible = true;
      d.unlitRingMesh.visible = false;
      melaverseAudio.playSacredChime();
      spawnParticleBurst(d.x, 1.55, d.z, 0xfbbf24, 24, 6.5);
      comboStreak += 1;
      combo = Math.min(10, combo + 1);
      comboDecayTimer = comboMaxDecaySec;
      score += 180 * combo;
      bestScore = Math.max(bestScore, score);
      lastHudEmitTime = 0;
      emitFloatingCallout('Perfect Diya Rhythm! +30 Coins', '#fde047');
      applyKarmaDeed('light_diya', '+55 Karma · Sacred Diya Lit');
      propsRef.current.onRewardEarned(30, 45, 'Sacred Deepotsav Diya Stamp');
    };

    // Activate Sacred Lotus Shield ([Q] or Right-Click): 3.0s duration, 6.0s cooldown, grants speed boost on block
    const activateWaterShield = () => {
      if (shieldCooldown > 0 || shieldActiveTimer > 0) return;
      const kBoost = stepKarmaState(karmaState, 0);
      shieldActiveTimer = 3.0 * kBoost.shieldDurationMultiplier;
      shieldCooldown = 6.0 * kBoost.shieldCooldownMultiplier;
      shieldGroup.visible = true;
      melaverseAudio.playShieldParry(false);
      const skinSpec =
        LOTUS_SHIELD_SKINS.find(
          (s) => s.id === propsRef.current.equippedShieldSkin
        ) ?? LOTUS_SHIELD_SKINS[0];
      const rimInt =
        parseInt(skinSpec.rimHex.replace('#', ''), 16) || 0xfde047;
      spawnParticleBurst(playerX, 1.0, playerZ, rimInt, 18, 6.2);
      emitFloatingCallout('Sacred Lotus Shield Active (3.0s)!', '#f472b6');

      // Push back & splash any Challenger right next to the player (scaled by Divine Shield Aegis)
      const effectiveRadius = 3.4 * kBoost.shieldRadiusMultiplier;
      for (const node of challengerNodes) {
        if (
          node.state.state !== 'ko' &&
          Math.hypot(node.state.x - playerX, node.state.z - playerZ) <=
            effectiveRadius
        ) {
          damageChallengerNode(node, 'neel', 35);
        }
      }
    };

    // Interactive Rhythm & Diyas Beat Ring ([R] key or HUD button)
    const triggerRhythmDiyaBeat = () => {
      rhythmRingTimer = 0.55;
      rhythmRingMesh.position.set(playerX, 0.09, playerZ);
      rhythmRingMesh.scale.setScalar(0.6);
      rhythmRingMesh.visible = true;
      melaverseAudio.playSacredChime();
      spawnParticleBurst(playerX, 1.15, playerZ, 0xfbbf24, 22, 6.8);

      // Find nearest unlit diya and ignite it on the beat
      let nearestUnlit: DiyaNode | null = null;
      let nearestDist = Infinity;
      for (const d of diyaNodes) {
        if (!d.lit) {
          const dist = Math.hypot(d.x - playerX, d.z - playerZ);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestUnlit = d;
          }
        }
      }

      if (nearestUnlit) {
        igniteDiyaNode(nearestUnlit);
      } else {
        // All 6 diyas lit: pulse floating river diyas along the Ghat & award Rhythm bonus coins!
        score += 120 * combo;
        bestScore = Math.max(bestScore, score);
        propsRef.current.onRewardEarned(
          35,
          50,
          'Deepotsav Ghat Rhythm Maestro Stamp'
        );
        applyKarmaDeed('light_diya', '+55 Karma · River Deepotsav Beat');
        emitFloatingCallout('Perfect Diya Rhythm! +35 Coins', '#fde047');
        for (const fd of floatingRiverDiyaData.slice(0, 8)) {
          spawnParticleBurst(
            fd.baseX,
            0.4,
            fd.baseZ,
            0xfbbf24,
            5,
            4.5
          );
        }
      }
    };

    // Helper: Apply AoE Splash / Blast at (cx, cz) with given radius & damage
    const triggerAoEBlast = (
      cx: number,
      cz: number,
      radius: number,
      damage: number,
      colorId: GulalColorId,
      particleHex: number,
      particleCount: number
    ) => {
      spawnParticleBurst(cx, 1.2, cz, particleHex, particleCount, 8.8);
      stampGulalGroundDecal(cx, cz, particleHex, Math.min(2.2, radius * 0.42));
      for (const d of diyaNodes) {
        if (!d.lit && Math.hypot(d.x - cx, d.z - cz) <= radius + 0.8) {
          igniteDiyaNode(d);
        }
      }
      for (const node of challengerNodes) {
        if (
          node.state.state !== 'ko' &&
          Math.hypot(node.state.x - cx, node.state.z - cz) <= radius
        ) {
          damageChallengerNode(node, colorId, damage);
        }
      }
    };

    // Player-Driven 5-Mode Festival Arsenal + Soft-Magnet Target Acquisition + Gulal Tank Management
    const fireGulalBurst = (overrideArsenal?: ArsenalModeId) => {
      const activeModeId = overrideArsenal ?? propsRef.current.selectedArsenal;
      if (activeModeId !== 'punch_kick' && gulalTankPct < 3) {
        emitFloatingCallout(
          'Gulal Tank Low! Refill at Courtyard Color Vats!',
          '#fbbf24'
        );
        gulalTankPct = Math.min(100, gulalTankPct + 18); // Emergency reserve splash so player is never stuck
      }

      if (activeVolleyPendingTimer > 0 && !activeVolleyScoredHit) {
        recordVolleyOutcome(false);
      }
      activeVolleyScoredHit = false;
      activeVolleyPendingTimer = 0.55;

      const modeSpec = ARSENAL_MODES[activeModeId];
      magnetFirePulseTimer = 0.38;
      const candidates = buildMagnetCandidates();

      const rawAimX = hasClickWorldTarget
        ? clickWorldX
        : hasCursorWorld
        ? cursorWorldX
        : playerX + Math.sin(playerYaw) * 6.5;
      const rawAimZ = hasClickWorldTarget
        ? clickWorldZ
        : hasCursorWorld
        ? cursorWorldZ
        : playerZ + Math.cos(playerYaw) * 6.5;
      hasClickWorldTarget = false;

      const magnetRes = computeSoftMagnetReticle({
        rawAimX,
        rawAimZ,
        playerX,
        playerZ,
        playerYaw,
        isFiring: true,
        candidates,
      });

      smoothReticleX =
        smoothReticleX + (magnetRes.reticleX - smoothReticleX) * 0.75;
      smoothReticleZ =
        smoothReticleZ + (magnetRes.reticleZ - smoothReticleZ) * 0.75;

      // Smart Auto-Color Match Assist
      let activeGulalId = propsRef.current.selectedGulal;
      if (
        magnetRes.lockedTarget?.kind === 'reveler' &&
        magnetRes.lockedTarget.weaknessColor
      ) {
        activeGulalId = magnetRes.lockedTarget.weaknessColor;
        if (activeGulalId !== propsRef.current.selectedGulal) {
          propsRef.current.onSelectGulal(activeGulalId);
        }
      }

      const gulalSpec = GULAL_WEAPONS[activeGulalId];
      weaponCooldown = modeSpec.cooldown;
      armRecoilTimer = 0.2;
      cameraDirector.triggerFireGulalRecoil();
      screenShakeState = triggerScreenShake(screenShakeState, {
        traumaDelta: 0.16,
        dirX: -Math.sin(playerYaw),
        dirZ: -Math.cos(playerYaw),
        verticalKick: 0.06,
        frequencyHz: 28,
      });

      if (activeModeId !== 'punch_kick') {
        gulalTankPct = Math.max(0, gulalTankPct - 3.5);
        lastHudEmitTime = 0;
      }

      playerYaw = magnetRes.aimYaw;
      playerModel.root.rotation.y = playerYaw;

      const targetX = magnetRes.lockedTarget
        ? magnetRes.lockedTarget.x
        : magnetRes.reticleX;
      const targetZ = magnetRes.lockedTarget
        ? magnetRes.lockedTarget.z
        : magnetRes.reticleZ;
      const distToTarget = Math.hypot(targetX - playerX, targetZ - playerZ);

      if (distToTarget > 8.5) {
        autoStrideX = targetX;
        autoStrideZ = targetZ;
        autoStrideTimer = 0.85;
      }

      // MODE 2: PUNCH & SPIN KICK (3-Stage Braj Kushti Martial Combo)
      if (activeModeId === 'punch_kick') {
        const isSpinKick = meleeComboStep === 2;
        meleeComboStep = (meleeComboStep + 1) % 3;
        melaverseAudio.playMeleePunchKick(isSpinKick);

        // Magnetic Martial Lunge Step toward locked target
        const lungeStep = Math.min(4.2, Math.max(1.5, distToTarget * 0.55));
        playerX += Math.sin(playerYaw) * lungeStep;
        playerZ += Math.cos(playerYaw) * lungeStep;
        if (isSpinKick) {
          playerVy = 4.6;
          spinKickTimer = 0.34;
        } else {
          scaleSquashX = 1.24;
          scaleSquashY = 0.82;
        }

        // Show 3D Martial Crescent Slash Wave
        meleeSlashMesh.position.set(
          playerX + Math.sin(playerYaw) * 1.1,
          0.95,
          playerZ + Math.cos(playerYaw) * 1.1
        );
        meleeSlashMesh.rotation.y = playerYaw;
        meleeSlashMat.color.setHex(isSpinKick ? 0xfbbf24 : 0xf43f5e);
        meleeSlashMesh.scale.setScalar(isSpinKick ? 1.35 : 1.0);
        meleeSlashMesh.visible = true;
        meleeSlashTimer = 0.2;

        // Hit all targets around player + locked target
        triggerAoEBlast(
          playerX + Math.sin(playerYaw) * 1.8,
          playerZ + Math.cos(playerYaw) * 1.8,
          modeSpec.blastRadius,
          isSpinKick ? modeSpec.damage * 1.35 : modeSpec.damage,
          activeGulalId,
          modeSpec.threeHex,
          20
        );
        if (magnetRes.lockedTarget && distToTarget <= 15) {
          triggerAoEBlast(
            targetX,
            targetZ,
            2.5,
            modeSpec.damage,
            activeGulalId,
            modeSpec.threeHex,
            14
          );
        }
        return;
      }

      // MODE 3: GUBBARA WATER-BALLOON THROW (3-Arc Parabolic Cluster)
      if (activeModeId === 'balloon_throw') {
        melaverseAudio.playBalloonThrow();
        scaleSquashX = 1.15;
        scaleSquashY = 0.86;
        const bColors = [0xf43f5e, 0xfbbf24, 0x38bdf8];
        for (let b = 0; b < 3; b++) {
          const slot = specialOrdnancePool.find((o) => !o.active);
          if (slot) {
            slot.active = true;
            slot.kind = 'balloon';
            slot.startX = playerX;
            slot.startZ = playerZ;
            slot.targetX = targetX + (b - 1) * 1.1;
            slot.targetZ = targetZ + (b - 1) * 0.6;
            slot.progress = 0;
            slot.duration = 0.26 + b * 0.04;
            slot.colorHex = bColors[b % bColors.length];
            slot.group.children[0].visible = false;
            slot.group.children[1].visible = false;
            slot.group.children[2].visible = true;
            (
              (slot.group.children[2] as THREE.Mesh)
                .material as THREE.MeshStandardMaterial
            ).color.setHex(slot.colorHex);
            slot.group.position.set(playerX, 1.3, playerZ);
            slot.group.visible = true;
          }
        }
        return;
      }

      // MODE 4: HAWAI ROCKET LAUNCHER (Fast Homing Sky-Rocket + Starburst Firework)
      if (activeModeId === 'hawai_rocket') {
        melaverseAudio.playRocketLaunch();
        scaleSquashX = 1.18;
        scaleSquashY = 0.84;
        const slot = specialOrdnancePool.find((o) => !o.active);
        if (slot) {
          slot.active = true;
          slot.kind = 'rocket';
          slot.startX = playerX + Math.sin(playerYaw) * 0.8;
          slot.startZ = playerZ + Math.cos(playerYaw) * 0.8;
          slot.targetX = targetX;
          slot.targetZ = targetZ;
          slot.progress = 0;
          slot.duration = 0.22;
          slot.colorHex = 0xa855f7;
          slot.group.children[0].visible = true;
          slot.group.children[1].visible = true;
          slot.group.children[2].visible = false;
          slot.group.position.set(slot.startX, 1.25, slot.startZ);
          slot.group.lookAt(targetX, 1.25, targetZ);
          slot.group.visible = true;
        }
        return;
      }

      // MODE 5: SUTLI COLOR BOMB (Spinning Bomb Throw + Mega Expanding 3D Shockwave Dome)
      if (activeModeId === 'sutli_bomb') {
        melaverseAudio.playBalloonThrow();
        scaleSquashX = 1.22;
        scaleSquashY = 0.8;
        screenShakeState = triggerScreenShake(screenShakeState, {
          traumaDelta: 0.22,
          dirX: targetX - playerX,
          dirZ: targetZ - playerZ,
          verticalKick: 0.09,
          frequencyHz: 24,
        });
        const slot = specialOrdnancePool.find((o) => !o.active);
        if (slot) {
          slot.active = true;
          slot.kind = 'bomb';
          slot.startX = playerX;
          slot.startZ = playerZ;
          slot.targetX = targetX;
          slot.targetZ = targetZ;
          slot.progress = 0;
          slot.duration = 0.28;
          slot.colorHex = 0x10b981;
          slot.group.children[0].visible = false;
          slot.group.children[1].visible = false;
          slot.group.children[2].visible = true;
          (
            (slot.group.children[2] as THREE.Mesh)
              .material as THREE.MeshStandardMaterial
          ).color.setHex(0x10b981);
          slot.group.position.set(playerX, 1.35, playerZ);
          slot.group.visible = true;
        }
        return;
      }

      // MODE 1 (DEFAULT): BRASS PICHKARI PRESSURIZED STREAM + HOMING GULAL ORBS
      melaverseAudio.playGulalThrow(gulalSpec.id);
      const jetLen = Math.max(3.6, Math.min(16.5, distToTarget));
      if (magnetRes.lockedTarget && distToTarget <= 17.5) {
        if (magnetRes.lockedTarget.kind === 'diya') {
          const targetDiya = diyaNodes.find(
            (d) => d.id === magnetRes.lockedTarget!.id
          );
          if (targetDiya && !targetDiya.lit) {
            igniteDiyaNode(targetDiya);
          }
        } else {
          const targetRev = challengerNodes.find(
            (n) => `rev-${n.state.id}` === magnetRes.lockedTarget!.id
          );
          if (targetRev && targetRev.state.state !== 'ko') {
            damageChallengerNode(targetRev, gulalSpec.id, 30);
          }
        }
      } else {
        // Stamp a colorful Gulal powder splatter at the reticle point on the courtyard floor
        stampGulalGroundDecal(targetX, targetZ, gulalSpec.threeHex, 0.95);
      }

      _beamStartVec3.set(
        playerX + Math.sin(playerYaw) * 0.75,
        playerY + 1.15,
        playerZ + Math.cos(playerYaw) * 0.75
      );
      _beamEndVec3.set(
        playerX + Math.sin(playerYaw) * (0.75 + jetLen),
        playerY + 1.15,
        playerZ + Math.cos(playerYaw) * (0.75 + jetLen)
      );
      _beamMidVec3.addVectors(_beamStartVec3, _beamEndVec3).multiplyScalar(0.5);
      streamBeamMesh.position.copy(_beamMidVec3);
      streamBeamMesh.scale.set(1, 1, jetLen);
      streamBeamMesh.lookAt(_beamEndVec3);
      streamBeamMat.color.setHex(gulalSpec.threeHex);
      streamBeamMesh.visible = true;
      streamBeamTimer = 0.12;

      scaleSquashX = 1.16;
      scaleSquashY = 0.86;

      const spreadStep = 0.12;
      const half = (gulalSpec.spreadCount - 1) * 0.5;
      for (let s = 0; s < gulalSpec.spreadCount; s++) {
        const angleOffset = (s - half) * spreadStep;
        const shotAngle = playerYaw + angleOffset;
        const dirX = Math.sin(shotAngle);
        const dirZ = Math.cos(shotAngle);

        const slot = projectiles.find((p) => !p.active);
        if (slot) {
          slot.active = true;
          slot.colorId = gulalSpec.id;
          slot.x = playerX + dirX * 0.85;
          slot.y = playerY + 1.15;
          slot.z = playerZ + dirZ * 0.85;
          slot.vx = dirX * gulalSpec.speed;
          slot.vz = dirZ * gulalSpec.speed;
          slot.life = gulalSpec.range / gulalSpec.speed;
          slot.maxLife = slot.life;
          slot.damage = gulalSpec.damage;
          slot.mat.color.setHex(gulalSpec.threeHex);
          slot.mat.opacity = 0.85;
          slot.mesh.scale.setScalar(0.85);
          slot.mesh.position.set(slot.x, slot.y, slot.z);
          slot.mesh.visible = true;
        }
      }

      spawnParticleBurst(
        playerX + Math.sin(playerYaw) * 0.9,
        playerY + 1.15,
        playerZ + Math.cos(playerYaw) * 0.9,
        gulalSpec.threeHex,
        7,
        4.8
      );
    };

    // Multi-Stage Grand Sky Fireworks Celebration ([F] key or HUD button: Golden Palm, Chakra & Rangoli Star bursts)
    const triggerGrandSkyFireworks = () => {
      melaverseAudio.playRocketLaunch();
      melaverseAudio.playVictoryFanfare();
      cameraDirector.triggerFireworkSkyLook();
      const fwColors = [0xfbbf24, 0xf43f5e, 0x38bdf8, 0xa855f7, 0x10b981];
      for (let b = 0; b < 5; b++) {
        const fx = playerX * 0.4 + (b - 2) * 5.2;
        const fy = 8.8 + (b % 2) * 3.0;
        const fz =
          propsRef.current.activeWorld === 'diwali_ghat'
            ? 14 + (b % 3) * 3.5
            : -11 - (b % 3) * 4;
        // Ascending whistling trail + multi-stage aerial burst
        spawnParticleBurst(fx, fy * 0.45, fz, 0xfde047, 8, 5.5);
        spawnParticleBurst(fx, fy, fz, fwColors[b % fwColors.length], 26, 10.2);
      }
      score += 75;
      bestScore = Math.max(bestScore, score);
      emitFloatingCallout('Multi-Stage Fireworks! +25 Coins', '#fde047');
      propsRef.current.onRewardEarned(
        25,
        35,
        'Grand Aakash Deepotsav Fireworks Stamp'
      );
    };

    let frameId = 0;
    let isUnmounted = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      gl.flush();
      const poll = () => {
        if (isUnmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 16);
        }
      };
      frameId = window.setTimeout(poll, 4);
    };

    const tick = () => {
      if (isUnmounted) return;
      const now = performance.now();
      const rawDt = Math.max(0.001, (now - lastFrameTime) / 1000);
      lastFrameTime = now;
      const dt = clampDelta(rawDt);
      elapsedTotal += dt;

      const currentProps = propsRef.current;

      // Apply Graphics Quality Preset changes dynamically
      if (currentProps.graphicsPreset !== lastAppliedGraphicsPreset) {
        lastAppliedGraphicsPreset = currentProps.graphicsPreset;
        applyGraphicsPresetToPipeline(currentProps.graphicsPreset);
      }

      if (currentProps.resetCounter !== lastResetCounter) {
        lastResetCounter = currentProps.resetCounter;
        resetRoundState();
      }

      if (currentProps.fireworksCount !== lastFireworksCount) {
        lastFireworksCount = currentProps.fireworksCount;
        triggerGrandSkyFireworks();
      }

      if (currentProps.shieldTriggerCount !== lastShieldTriggerCount) {
        lastShieldTriggerCount = currentProps.shieldTriggerCount;
        activateWaterShield();
      }

      if (currentProps.fireTriggerCount !== lastFireTriggerCount) {
        lastFireTriggerCount = currentProps.fireTriggerCount;
        attackBufferTimer = 0.15;
      }

      if (currentProps.dashTriggerCount !== lastDashTriggerCount) {
        lastDashTriggerCount = currentProps.dashTriggerCount;
        dashBufferTimer = 0.18;
      }

      if (currentProps.rhythmDiyaTriggerCount !== lastRhythmDiyaTriggerCount) {
        lastRhythmDiyaTriggerCount = currentProps.rhythmDiyaTriggerCount;
        triggerRhythmDiyaBeat();
      }

      if (currentProps.stampRangoliTriggerCount !== lastStampRangoliTriggerCount) {
        lastStampRangoliTriggerCount = currentProps.stampRangoliTriggerCount;
        stampInteractiveFloorRangoli(playerX, playerZ);
        melaverseAudio.playSacredChime();
        spawnParticleBurst(playerX, 0.35, playerZ, 0xf43f5e, 18, 6.0);
        emitFloatingCallout('Glowing Rangoli Stamped! +20 Coins', '#f472b6');
        currentProps.onRewardEarned(20, 30, 'Courtyard Rangoli Artist Stamp');
      }

      if (currentProps.karmaOfferingCount !== lastKarmaOfferingCount) {
        lastKarmaOfferingCount = currentProps.karmaOfferingCount;
        applyKarmaDeed('help_npc', '+100 Karma · Elder & Studio Blessing');
      }

      if (currentProps.jumpTriggerCount !== lastJumpTriggerCount) {
        lastJumpTriggerCount = currentProps.jumpTriggerCount;
        jumpBufferTimer = 0.18;
      }

      let interactJustTriggered = false;
      if (currentProps.interactTriggerCount !== lastInteractTriggerCount) {
        lastInteractTriggerCount = currentProps.interactTriggerCount;
        interactJustTriggered = true;
      }

      // Toggle world-specific 3D architecture & interactive props
      const isHoliWorld = currentProps.activeWorld === 'holi_braj';
      const isDiwaliWorld = currentProps.activeWorld === 'diwali_ghat';
      const isMelaWorld = currentProps.activeWorld === 'mela_central';

      holiWorldGroup.visible = isHoliWorld;
      holiMistPoints.visible = isHoliWorld;
      diwaliGhatGroup.visible = isDiwaliWorld;
      melaHubGroup.visible = isMelaWorld;

      // Dynamically switch ground floor visibility & PBR material per world:
      // - Holi Braj: Wet color-splattered white Makrana marble courtyard (`wetMarbleGulal`)
      // - Diwali Ghat: Hide flat circular courtyard so the 14-step stone Ghat staircase & 300x200 river span the horizon
      // - Mela Central Hub: Reflective wet-look dark basalt cobblestone (`royalCobblestone`, roughness 0.25)
      courtyardFloor.visible = !isDiwaliWorld;
      courtyardDecorGroup.visible = !isDiwaliWorld;
      outerTerrain.visible = !isDiwaliWorld;
      parapetMesh.visible = !isDiwaliWorld;
      rangoliDisc.visible = !isDiwaliWorld;
      rangoliBorderRing.visible = !isDiwaliWorld;
      const targetFloorMat = isHoliWorld
        ? wetMarbleGulalBundle.material
        : cobblestonePBRBundle.material;
      if (courtyardFloor.material !== targetFloorMat) {
        courtyardFloor.material = targetFloorMat;
      }

      worldPortalNodes.forEach((p) => {
        p.group.visible = isMelaWorld;
        p.arch.rotation.z = elapsedTotal * 1.4;
      });

      // Step GPU Particle Uniforms (800 Golden Fireflies + 750 Swirling Holi Gulal Mist Particles)
      fireflyShaderMat.uniforms.uTime.value = elapsedTotal;
      holiMistShaderMat.uniforms.uTime.value = elapsedTotal;

      // Animate World 02: Diwali — Ghat (300x200 GLSL Mirror-Water Shader, 300 Instanced Floating River Diyas & 4 Banarasi Boats)
      if (isDiwaliWorld) {
        diwaliWaterShaderMat.uniforms.uTime.value = elapsedTotal;
        for (let i = 0; i < RIVER_DIYA_COUNT; i++) {
          const fd = floatingRiverDiyaData[i];
          const rx =
            ((fd.baseX + elapsedTotal * fd.driftSpeed + 54) % 108) - 54;
          const rz = fd.baseZ + Math.cos(elapsedTotal * 0.55 + fd.phase) * 0.45;
          const ry =
            -1.06 +
            Math.sin(rx * 0.35 + elapsedTotal * 2.0) * 0.05 +
            Math.cos(rz * 0.45 + elapsedTotal * 1.6) * 0.04;

          _dummyObj.position.set(rx, ry, rz);
          _dummyObj.rotation.set(0, elapsedTotal * 0.3 + fd.phase, 0);
          _dummyObj.scale.setScalar(1.0);
          _dummyObj.updateMatrix();
          instancedRiverBowls.setMatrixAt(i, _dummyObj.matrix);

          const flicker = 0.88 + Math.sin(elapsedTotal * 14.0 + fd.phase) * 0.16;
          _dummyObj.position.set(rx, ry + 0.12, rz);
          _dummyObj.scale.set(1.0, flicker, 1.0);
          _dummyObj.updateMatrix();
          instancedRiverFlames.setMatrixAt(i, _dummyObj.matrix);
        }
        instancedRiverBowls.instanceMatrix.needsUpdate = true;
        instancedRiverFlames.instanceMatrix.needsUpdate = true;

        banarasiBoats.forEach((boat) => {
          boat.group.position.x =
            boat.baseX + Math.sin(elapsedTotal * 0.35 + boat.phase) * 1.35;
          boat.group.position.z =
            boat.baseZ + Math.cos(elapsedTotal * 0.28 + boat.phase) * 0.55;
          boat.group.position.y =
            -1.02 + Math.sin(elapsedTotal * 1.8 + boat.phase) * 0.06;
          boat.group.rotation.z =
            Math.sin(elapsedTotal * 1.5 + boat.phase) * 0.035;
          boat.group.rotation.x =
            Math.cos(elapsedTotal * 1.2 + boat.phase) * 0.025;
        });
      }

      // Animate World 01: Holi — Braj (Local Haudi Sprays & Local Mist with Strict 15-Unit Camera Exclusion Zone)
      if (isHoliWorld) {
        const camX = camera.position.x;
        const camY = camera.position.y;
        const camZ = camera.position.z;

        colorVatNodes.forEach((v, idx) => {
          v.group.rotation.y = elapsedTotal * 0.28 + idx;
          const vatDistToCam = Math.hypot(
            v.x - camX,
            1.2 - camY,
            v.z - camZ
          );
          const vatCamFade =
            vatDistToCam < 15.0
              ? 0
              : Math.min(1, (vatDistToCam - 15.0) / 4.0);

          v.drops.forEach((drop, dIdx) => {
            if (vatCamFade <= 0.01) {
              drop.sprite.visible = false;
              return;
            }
            drop.sprite.visible = true;
            const cycle = (elapsedTotal * 1.15 + dIdx / v.drops.length) % 1.0;
            const baseAngle = (dIdx / v.drops.length) * Math.PI * 2 + idx * 1.1;
            const turbX =
              Math.sin(elapsedTotal * 3.2 + dIdx * 1.7) * 0.18 * cycle;
            const turbZ =
              Math.cos(elapsedTotal * 2.9 + dIdx * 2.1) * 0.18 * cycle;
            const spread = cycle * 0.92;
            const archY = 1.02 + Math.sin(cycle * Math.PI) * 1.45 + cycle * 0.28;
            drop.sprite.position.set(
              Math.cos(baseAngle) * spread + turbX,
              archY,
              Math.sin(baseAngle) * spread + turbZ
            );
            // Max scale <= 2.2, opacity <= 0.22
            drop.sprite.scale.setScalar(0.55 + cycle * 1.25);
            drop.mat.opacity =
              Math.sin(cycle * Math.PI) * 0.2 * vatCamFade;
          });
        });

        holiGulalClouds.forEach((c) => {
          const cx =
            c.baseX + Math.sin(elapsedTotal * c.speed + c.phase) * 0.85;
          const cy =
            c.baseY + Math.cos(elapsedTotal * 0.7 + c.phase) * 0.25;
          const cz =
            c.baseZ + Math.cos(elapsedTotal * c.speed * 0.8 + c.phase) * 0.85;
          c.mesh.position.set(cx, cy, cz);
          const distToCam = Math.hypot(cx - camX, cy - camY, cz - camZ);
          // Strict 15-unit Camera Exclusion Zone + max scale <= 2.2 + opacity <= 0.22
          if (distToCam < 15.0) {
            c.mesh.visible = false;
            c.mat.opacity = 0;
          } else {
            c.mesh.visible = true;
            const fade = Math.min(1, (distToCam - 15.0) / 4.0);
            c.mat.opacity = 0.18 * fade;
            c.mesh.scale.setScalar(1.0 + Math.sin(elapsedTotal + c.phase) * 0.15);
            c.mesh.lookAt(camera.position);
          }
        });
      }

      // Animate Rhythm & Diyas timing ring
      if (rhythmRingTimer > 0) {
        rhythmRingTimer = Math.max(0, rhythmRingTimer - dt);
        const rProgress = 1 - rhythmRingTimer / 0.55;
        rhythmRingMesh.position.set(0, 0.08, 0);
        rhythmRingMesh.scale.setScalar(0.65 + rProgress * 3.8);
        rhythmRingMat.opacity = (1 - rProgress) * 0.85;
        if (rhythmRingTimer <= 0) {
          rhythmRingMesh.visible = false;
        }
      }

      if (floatingCalloutTimer > 0) {
        floatingCalloutTimer = Math.max(0, floatingCalloutTimer - dt);
        if (floatingCalloutTimer <= 0 && floatingCallout !== null) {
          floatingCallout = null;
        }
      }

      // Animate Grand Mela Rides (Giant Wheel, Carousel, Columbus Swinging Boat, 15 Moving Booth Balloons & Jump Pads)
      if (isMelaWorld) {
        melaRidesRig?.updateKinematics(elapsedTotal);
        melaJumpPadMeshes.forEach((jp, idx) => {
          const pulse = 1.0 + Math.sin(elapsedTotal * 4.5 + idx) * 0.08;
          jp.ring.scale.setScalar(pulse);
        });
      }

      // Step Autonomous AI Crowd Visitors along Mela walkways (for radar positions)
      const activeCrowdCount =
        GRAPHICS_PRESETS[currentProps.graphicsPreset].crowdCount;
      for (let i = 0; i < MAX_CROWD_VISITORS; i++) {
        if (i >= activeCrowdCount) continue;
        crowdVisitors[i] = stepCrowdVisitorAI(
          crowdVisitors[i],
          melaPhysics.obstacles,
          dt
        );
      }

      // Update Player 3D Attire (clamped warm tone so yellow/saffron kurta NEVER blows out under daytime sun) & Equipped Lotus Shield Skin
      playerModel.kurtaMat.color
        .set(currentProps.attire.kurtaHex)
        .lerp(new THREE.Color(0xb45309), 0.28);
      playerModel.dhotiMat.color
        .set(currentProps.attire.dhotiHex)
        .lerp(new THREE.Color(0x6d371a), 0.72);
      playerModel.pagdiMat.color.set(currentProps.attire.pagdiHex);
      (playerModel.dupattaMesh.material as THREE.MeshStandardMaterial).color.set(
        currentProps.attire.pagdiHex
      );
      playerModel.skinMat.color.set(currentProps.attire.skinHex);

      const activeShieldSkin =
        LOTUS_SHIELD_SKINS.find(
          (s) => s.id === currentProps.equippedShieldSkin
        ) ?? LOTUS_SHIELD_SKINS[0];
      shieldDomeMat.color.set(activeShieldSkin.domeHex);
      shieldDomeMat.emissive.set(activeShieldSkin.domeHex);
      shieldRimMat.color.set(activeShieldSkin.rimHex);
      shieldRimMat.emissive.set(activeShieldSkin.rimHex);

      const isMenuPreview = currentProps.gameState === 'title';

      // If the user switched worlds while in 'auto' mode, align the starting hour to the world's signature mood
      if (currentProps.activeWorld !== lastActiveWorldForCycle) {
        lastActiveWorldForCycle = currentProps.activeWorld;
        if (currentProps.dayNightMode === 'auto') {
          dayNightState = {
            ...dayNightState,
            timeOfDay:
              currentProps.activeWorld === 'holi_braj'
                ? 0.375
                : currentProps.activeWorld === 'diwali_ghat'
                ? 0.875
                : 0.82,
          };
        }
      }

      // Step Dynamic Day-Night Cycle & Zone-Atmosphere Adaptation
      const focalX = isMenuPreview
        ? currentProps.activeWorld === 'mela_central'
          ? 24
          : currentProps.activeWorld === 'diwali_ghat'
          ? 8
          : 0
        : playerX;
      const focalZ = isMenuPreview
        ? currentProps.activeWorld === 'diwali_ghat'
          ? 10
          : 0
        : playerZ;

      const dayNightStep = stepDayNightCycle(dayNightState, {
        dt,
        playerX: focalX,
        playerZ: focalZ,
        activeWorld: currentProps.activeWorld,
        isMountedOnRide: Boolean(currentProps.mountedRide),
        overrideMode: currentProps.dayNightMode,
      });
      dayNightState = dayNightStep.state;
      const atmosphere = dayNightStep.atmosphere;

      // Update Sky Dome Vertex Gradient when colors shift
      const nextSkyKey = `${atmosphere.zenithHex}-${atmosphere.midSkyHex}-${atmosphere.horizonHex}`;
      if (nextSkyKey !== lastSkyColorKey) {
        lastSkyColorKey = nextSkyKey;
        updateSkyDomeColors(
          atmosphere.zenithHex,
          atmosphere.midSkyHex,
          atmosphere.horizonHex
        );
      }

      // Apply Crystal-Clear Linear Fog (0% fog within 65 units of camera), Background, ToneMapping & Celestial Sun/Moon Orbs
      (scene.background as THREE.Color).setHex(atmosphere.fogHex);
      const sceneFog = scene.fog as THREE.Fog;
      sceneFog.color.setHex(atmosphere.fogHex);
      sceneFog.near = 65;
      sceneFog.far = 190;
      renderer.toneMappingExposure = atmosphere.toneMappingExposure;

      // Position 3D Surya (Sun) & Chandra (Moon) across the Sky Dome
      celestialSunGroup.position.set(
        atmosphere.sunPosition.x,
        atmosphere.sunPosition.y,
        atmosphere.sunPosition.z
      );
      celestialSunGroup.visible = atmosphere.phaseId !== 'night';
      sunHaloMat.color.setHex(atmosphere.sunColorHex);
      sunHaloMesh.lookAt(camera.position);

      celestialMoonGroup.position.set(
        atmosphere.moonPosition.x,
        atmosphere.moonPosition.y,
        atmosphere.moonPosition.z
      );
      celestialMoonGroup.visible = atmosphere.starVisibility > 0.12;
      moonHaloMesh.lookAt(camera.position);

      // Modulate Directional Key Light (Sun by day/dawn/dusk, Moon by night), Hemisphere Fill, Ambient & Warm Rim
      keyLight.color.setHex(atmosphere.sunColorHex);
      keyLight.intensity = atmosphere.sunIntensity;
      const activeCelestial =
        atmosphere.phaseId === 'night'
          ? atmosphere.moonPosition
          : atmosphere.sunPosition;
      keyLight.position.set(
        activeCelestial.x * 0.55,
        Math.max(18, activeCelestial.y * 0.85),
        activeCelestial.z * 0.65
      );

      hemiLight.color.setHex(atmosphere.hemiSkyHex);
      hemiLight.groundColor.setHex(atmosphere.hemiGroundHex);
      hemiLight.intensity = atmosphere.hemiIntensity;

      ambientFillLight.color.setHex(atmosphere.ambientHex);
      ambientFillLight.intensity = atmosphere.ambientIntensity;

      warmRimLight.color.setHex(atmosphere.rimLightHex);
      warmRimLight.intensity = atmosphere.rimIntensity;

      // Scale Courtyard & Sanctum PointLight Pools + Selective Bloom & Emissive Accents by Time of Day
      templeSanctumPointLight.intensity =
        2.4 * atmosphere.pointLightIntensityScale;
      rangoliPlazaPointLight.intensity =
        1.8 * atmosphere.pointLightIntensityScale;

      if (bloomPass.enabled) {
        bloomPass.strength = atmosphere.bloomStrength;
        bloomPass.threshold = atmosphere.bloomThreshold;
      }

      fairyCurtainMat.emissiveIntensity = 1.25 * atmosphere.emissiveScale;
      skyLanternMat.emissiveIntensity = 1.15 * atmosphere.emissiveScale;
      brassTrimMat.emissiveIntensity = 0.42 * atmosphere.emissiveScale;
      fireflyPoints.visible = atmosphere.fireflyActivity > 0.08;

      // Keep diamond kites ONLY in World 01: Holi — Braj
      skyDecorGroup.visible = isHoliWorld;

      // Vertex-animate the waving saffron silk Dhwaja flag at the peak of the Nagara Shikhara
      for (let v = 0; v < dhwajaPosAttr.count; v++) {
        const vx = dhwajaBaseX[v];
        const u = vx / 2.6;
        const waveZ =
          Math.sin(elapsedTotal * 7.5 - vx * 2.8) * 0.22 * u +
          Math.cos(elapsedTotal * 11.2 - vx * 4.1) * 0.06 * u;
        const waveY =
          dhwajaBaseY[v] + Math.sin(elapsedTotal * 5.4 - vx * 2.2) * 0.06 * u;
        dhwajaPosAttr.setY(v, waveY);
        dhwajaPosAttr.setZ(v, waveZ);
      }
      dhwajaPosAttr.needsUpdate = true;

      starInstanced.visible = atmosphere.starVisibility > 0.02;
      if (starInstanced.visible) {
        for (let s = 0; s < STAR_COUNT; s++) {
          const sb = starBasePositions[s];
          const twinkle =
            sb.baseScale *
            atmosphere.starVisibility *
            (0.72 + Math.sin(elapsedTotal * 2.6 + sb.phase) * 0.28);
          _dummyObj.position.set(sb.x, sb.y, sb.z);
          _dummyObj.scale.setScalar(twinkle);
          _dummyObj.updateMatrix();
          starInstanced.setMatrixAt(s, _dummyObj.matrix);
        }
        starInstanced.instanceMatrix.needsUpdate = true;
      }

      // Hide all floating Sky Lanterns in World 01: Holi — Braj and during Day/Dawn; visible ONLY outside Holi during Dusk and Night
      skyLanternInstanced.visible =
        !isHoliWorld &&
        (atmosphere.phaseId === 'dusk' || atmosphere.phaseId === 'night');
      if (skyLanternInstanced.visible) {
        for (let l = 0; l < SKY_LANTERN_COUNT; l++) {
          const ls = skyLanternStates[l];
          ls.y += ls.riseSpeed * dt;
          if (ls.y > 58) {
            ls.y = 26.0;
          }
          const lx = ls.baseX + Math.sin(elapsedTotal * 0.55 + ls.phase) * 1.45;
          const lz = ls.baseZ + Math.cos(elapsedTotal * 0.48 + ls.phase) * 1.45;
          _dummyObj.position.set(lx, ls.y, lz);
          _dummyObj.rotation.set(
            Math.sin(elapsedTotal * 1.4 + ls.phase) * 0.06,
            elapsedTotal * 0.35 + ls.phase,
            Math.cos(elapsedTotal * 1.2 + ls.phase) * 0.06
          );
          _dummyObj.scale.setScalar(1);
          _dummyObj.updateMatrix();
          skyLanternInstanced.setMatrixAt(l, _dummyObj.matrix);
        }
        skyLanternInstanced.instanceMatrix.needsUpdate = true;
      }

      if (skyDecorGroup.visible) {
        kiteMeshes.forEach((k) => {
          k.mesh.position.y =
            k.basePos.y + Math.sin(elapsedTotal * 1.8 + k.phase) * 0.65;
          k.mesh.rotation.z = Math.sin(elapsedTotal * 2.2 + k.phase) * 0.22;
        });
      }

      // Step Player-Responsive Atmospheric Particle System ('Holi Petal Swirls' & 'Diya Flickers')
      const playerVxForSwirl =
        dt > 0.0001 ? (playerX - prevPlayerXForSwirl) / dt : 0;
      const playerVzForSwirl =
        dt > 0.0001 ? (playerZ - prevPlayerZForSwirl) / dt : 0;
      prevPlayerXForSwirl = playerX;
      prevPlayerZForSwirl = playerZ;
      const playerSpeedForSwirl = isMenuPreview
        ? 2.2
        : Math.hypot(playerVxForSwirl, playerVzForSwirl);

      const swirlStep = stepInteractiveAtmosphereParticles(
        interactiveParticles,
        {
          dt,
          elapsedSec: elapsedTotal,
          playerX: isMenuPreview ? 0 : playerX,
          playerY: isMenuPreview ? 0.5 : playerY,
          playerZ: isMenuPreview ? -4 : playerZ,
          playerSpeed: playerSpeedForSwirl,
          activeWorld: currentProps.activeWorld,
          phaseId: atmosphere.phaseId,
        }
      );
      interactiveParticles = swirlStep.particles;
      const holiPetalColors = [0xff1e7a, 0xffaa00, 0x00d2ff, 0x9b30ff];
      const diyaFlickerColors = [0xffb703, 0xfb8500, 0xffe169, 0xff6d00];
      const activeSwirlPalette =
        swirlStep.kind === 'diya_flicker' ? diyaFlickerColors : holiPetalColors;

      for (let pIdx = 0; pIdx < interactiveParticles.length; pIdx++) {
        const pt = interactiveParticles[pIdx];
        const pCamDist = Math.hypot(
          pt.x - camera.position.x,
          pt.y - camera.position.y,
          pt.z - camera.position.z
        );
        // Respect camera exclusion near lens while swirling around player in courtyard
        const camScale =
          pCamDist < 12.0 ? 0 : pt.scale * (1.0 + pt.swirlEnergy * 0.45);
        _dummyObj.position.set(pt.x, pt.y, pt.z);
        _dummyObj.rotation.set(
          elapsedTotal * 2.4 + pt.phase,
          elapsedTotal * 1.9 + pt.phase,
          elapsedTotal * 1.5 + pt.phase
        );
        _dummyObj.scale.setScalar(camScale);
        _dummyObj.updateMatrix();
        interactiveSwirlInstanced.setMatrixAt(pIdx, _dummyObj.matrix);
        _dummyColor.setHex(
          activeSwirlPalette[pt.colorIndex % activeSwirlPalette.length]
        );
        interactiveSwirlInstanced.setColorAt(pIdx, _dummyColor);
      }
      interactiveSwirlInstanced.instanceMatrix.needsUpdate = true;
      if (interactiveSwirlInstanced.instanceColor) {
        interactiveSwirlInstanced.instanceColor.needsUpdate = true;
      }

      const adaptiveProfile = evaluateAdaptiveDifficulty(
        recentAttackOutcomes,
        spiritPips
      );

      // Animate Courtyard NPCs (Dancing, Dhol Drumming & Waving, scaled by adaptive reaction tempo)
      npcMeshes.forEach((n, idx) => {
        n.ring.visible = !isMenuPreview;
        const beat =
          elapsedTotal * 5.7 * adaptiveProfile.reactionFrequencyScale +
          idx * 1.3;
        n.built.bodyGroup.position.y = Math.abs(Math.sin(beat)) * 0.08;
        n.built.bodyGroup.rotation.z = Math.sin(beat * 0.5) * 0.06;
        if (n.npc.id === 'ustad_kabir') {
          n.built.leftArm.rotation.x = -0.6 + Math.sin(beat * 2) * 0.45;
          n.built.rightArm.rotation.x = -0.6 - Math.sin(beat * 2) * 0.45;
        } else {
          n.built.leftArm.rotation.z = 0.25 + Math.sin(beat) * 0.2;
          n.built.rightArm.rotation.x = -0.4 + Math.cos(beat) * 0.25;
        }
      });

      diyaNodes.forEach((d, idx) => {
        const showLitInPreview = isMenuPreview || d.lit;
        d.flameMesh.visible = showLitInPreview;
        d.haloMesh.visible = showLitInPreview;
        if (showLitInPreview) {
          d.unlitRingMesh.visible = false;
          const flicker = 0.9 + Math.sin(elapsedTotal * 14 + idx * 2.1) * 0.14;
          d.flameMesh.scale.set(1, flicker, 1);
          d.haloMesh.scale.setScalar(0.95 + flicker * 0.12);
        } else {
          d.unlitRingMesh.visible = !isMenuPreview;
          const pulse = 0.88 + Math.sin(elapsedTotal * 4 + idx) * 0.12;
          d.unlitRingMesh.scale.setScalar(pulse);
        }
      });

      if (streamBeamTimer > 0) {
        streamBeamTimer = Math.max(0, streamBeamTimer - dt);
        streamBeamMat.opacity = (streamBeamTimer / 0.11) * 0.78;
        if (streamBeamTimer <= 0) {
          streamBeamMesh.visible = false;
        }
      }

      if (meleeSlashTimer > 0) {
        meleeSlashTimer = Math.max(0, meleeSlashTimer - dt);
        meleeSlashMat.opacity = (meleeSlashTimer / 0.2) * 0.88;
        meleeSlashMesh.scale.addScalar(dt * 4.5);
        if (meleeSlashTimer <= 0) {
          meleeSlashMesh.visible = false;
        }
      }

      if (bombShockwaveTimer > 0) {
        bombShockwaveTimer = Math.max(0, bombShockwaveTimer - dt);
        const progress = 1 - bombShockwaveTimer / 0.36;
        bombShockwaveMesh.scale.setScalar(0.35 + progress * 4.4);
        bombShockMat.opacity = (1 - progress) * 0.82;
        if (bombShockwaveTimer <= 0) {
          bombShockwaveMesh.visible = false;
        }
      }

      blessingNodes.forEach((b) => {
        b.group.visible = false;
      });

      // Animate pooled particles
      let anyParticleUpdated = false;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (!pActive[i]) continue;
        anyParticleUpdated = true;
        pLife[i] -= dt;
        if (pLife[i] <= 0) {
          pActive[i] = 0;
          _dummyObj.position.set(0, -50, 0);
          _dummyObj.scale.setScalar(0.001);
          _dummyObj.updateMatrix();
          particleInstanced.setMatrixAt(i, _dummyObj.matrix);
          continue;
        }
        pVy[i] -= 7.6 * dt;
        pX[i] +=
          (pVx[i] + Math.sin(elapsedTotal * 4.2 + i) * 0.55) * dt;
        pY[i] = Math.max(0.05, pY[i] + pVy[i] * dt);
        pZ[i] +=
          (pVz[i] + Math.cos(elapsedTotal * 3.8 + i) * 0.55) * dt;
        const lifeRatio = pLife[i] / pMaxLife[i];
        _dummyObj.position.set(pX[i], pY[i], pZ[i]);
        // Expand scale over lifetime for volumetric powder mist
        _dummyObj.scale.setScalar(
          pScale[i] * (0.75 + (1 - lifeRatio) * 1.15) * lifeRatio * 1.65
        );
        _dummyObj.quaternion.copy(camera.quaternion);
        _dummyObj.updateMatrix();
        particleInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      if (anyParticleUpdated) {
        particleInstanced.instanceMatrix.needsUpdate = true;
      }

      // STATE 1: CINEMATIC LANDING MENU ORBITAL PREVIEW (`gameState === 'title'`)
      // Low heroic angle (`FOV: 42`, `y = 4.2..5.2`, looking upward at `y = 6.8..7.5`)
      // so the architecture towers majestically over the frame in each of the 3 distinct worlds!
      if (currentProps.gameState === 'title') {
        compassGroup.visible = false;
        lockReticleGroup.visible = false;
        magnetTetherMesh.visible = false;
        rhythmRingMesh.visible = false;
        playerModel.root.visible = true;

        // Hide Challenger overhead health bars & telegraph rings while in Menu Preview mode
        for (const node of challengerNodes) {
          node.hpBarGroup.visible = false;
          node.telegraphRing.visible = false;
          node.telegraphLane.visible = false;
        }

        cameraDirector.step(camera, {
          dt,
          elapsedSec: elapsedTotal,
          isPlaying: false,
          activeWorld: currentProps.activeWorld,
          cameraMode: currentProps.cameraMode,
          mountedRide: null,
          activeStallModal: null,
          playerX,
          playerY,
          playerZ,
          playerYaw,
          velocityX: 0,
          velocityZ: 0,
          strafeInputX: 0,
          isSprintingOrDashing: false,
          shieldActive: false,
          justFiredGulal: false,
          justLaunchedFirework: false,
          rideLookYawOffset: 0,
          rideLookPitchOffset: 0,
          shakeStep: {
            state: screenShakeState,
            offsetX: 0,
            offsetY: 0,
            offsetZ: 0,
            rollRad: 0,
          },
          colliderMeshes: [],
        });

        if (now - lastHudEmitTime >= 250) {
          lastHudEmitTime = now;
          currentProps.onHudUpdate({
            spiritPips,
            maxSpiritPips,
            spiritTrail,
            gulalTankPct: Math.round(gulalTankPct),
            score,
            bestScore,
            combo,
            comboStreak,
            comboTimerRatio: 0,
            revelersSplashed,
            targetRevelers,
            diyasLit: 0,
            targetDiyas,
            selectedGulal: currentProps.selectedGulal,
            selectedArsenal: currentProps.selectedArsenal,
            cooldownPct: 0,
            dashCooldownPct: 0,
            shieldCooldownPct: 0,
            shieldActive: false,
            nearbyPrompt: null,
            activeWave: 1,
            activeBlessing: null,
            objectiveHint:
              '[Space/LMB] Fire Gulal · [Q/RMB] Lotus Shield · [Shift] Dash · [R] Diyas',
            magnetLockInfo: null,
            floatingCallout: null,
            adaptiveDifficulty: adaptiveProfile,
            karma: karmaState,
            dayNight: atmosphere,
            playerX,
            playerZ,
            playerYaw,
            fps: Math.round(smoothedFps),
            crowdPositions: [],
          });
        }
      } else if (currentProps.gameState === 'playing' && !roundEnded) {
        roundElapsedSec += dt;

        // Exit ride if Escape pressed while mounted
        if (
          currentProps.mountedRide &&
          (keysJustPressed.has('Escape') || interactJustTriggered)
        ) {
          currentProps.onExitRide();
          interactJustTriggered = false;
        }

        // Step 3D spatial courtyard & carnival calliope rhythm ambiance
        melaverseAudio.stepAmbientCourtyardMusic(
          dt,
          playerX,
          playerZ,
          playerYaw
        );

        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        }
        spiritTrail = THREE.MathUtils.damp(spiritTrail, spiritPips, 4.5, dt);

        if (spiritPips > 0 && spiritPips < maxSpiritPips) {
          spiritRegenAccum += dt;
          if (spiritRegenAccum >= 12) {
            spiritRegenAccum = 0;
            spiritPips = Math.min(maxSpiritPips, spiritPips + 1);
          }
        }

        const simDt = hitstopTimer > 0 ? 0 : dt;

        // Passive Gulal Tank regeneration + Courtyard Color Vat Refill in Holi Braj
        gulalTankPct = Math.min(100, gulalTankPct + simDt * 3.8);
        if (currentProps.activeWorld === 'holi_braj' && gulalTankPct < 98) {
          for (const vat of colorVatNodes) {
            if (Math.hypot(playerX - vat.x, playerZ - vat.z) <= 3.6) {
              gulalTankPct = 100;
              melaverseAudio.playSacredChime();
              spawnParticleBurst(vat.x, 1.1, vat.z, vat.colorHex, 16, 5.5);
              emitFloatingCallout('Gulal Tank Refilled! 100%', '#38bdf8');
              break;
            }
          }
        }

        // Player-driven attack trigger (Space, J, or Left-Click / Hold)
        if (
          keysJustPressed.has('Space') ||
          keysJustPressed.has('KeyJ') ||
          keysHeld.has('Space') ||
          keysHeld.has('KeyJ') ||
          pointerJustClicked ||
          pointerIsDown
        ) {
          attackBufferTimer = 0.15;
        }
        if (keysJustPressed.has('ShiftLeft') || keysJustPressed.has('ShiftRight')) {
          dashBufferTimer = 0.15;
        }
        if (keysJustPressed.has('KeyQ') || rightClickParryJustPressed) {
          activateWaterShield();
        }

        attackBufferTimer = Math.max(0, attackBufferTimer - dt);
        dashBufferTimer = Math.max(0, dashBufferTimer - dt);
        jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);
        weaponCooldown = Math.max(0, weaponCooldown - simDt);
        dashCooldown = Math.max(0, dashCooldown - simDt);
        shieldCooldown = Math.max(0, shieldCooldown - simDt);

        const karmaStep = stepKarmaState(karmaState, simDt);
        karmaState = karmaStep.state;

        if (shieldActiveTimer > 0) {
          shieldActiveTimer = Math.max(0, shieldActiveTimer - simDt);
          shieldGroup.rotation.y = elapsedTotal * 4.2;
          const sPulse =
            (0.98 + Math.sin(elapsedTotal * 14) * 0.05) *
            karmaStep.shieldRadiusMultiplier;
          shieldGroup.scale.setScalar(sPulse);
          if (shieldActiveTimer <= 0) {
            shieldGroup.visible = false;
          }
        }

        if (simDt > 0) {
          magnetFirePulseTimer = Math.max(0, magnetFirePulseTimer - simDt);

          if (activeVolleyPendingTimer > 0) {
            activeVolleyPendingTimer = Math.max(
              0,
              activeVolleyPendingTimer - simDt
            );
            if (activeVolleyPendingTimer <= 0 && !activeVolleyScoredHit) {
              recordVolleyOutcome(false);
            }
          }

          if (comboDecayTimer > 0) {
            comboDecayTimer = Math.max(0, comboDecayTimer - simDt);
            if (comboDecayTimer <= 0) {
              combo = 1;
              comboStreak = 0;
              lastHudEmitTime = 0;
            }
          }

          // Mobile touch-drag camera look delta
          if (Math.abs(currentProps.mobileLookDeltaYaw) > 0.0001) {
            playerYaw += currentProps.mobileLookDeltaYaw;
          }

          let moveX = currentProps.mobileMoveVec.dx;
          let moveZ = currentProps.mobileMoveVec.dz;
          if (keysHeld.has('KeyW') || keysHeld.has('ArrowUp')) moveZ -= 1;
          if (keysHeld.has('KeyS') || keysHeld.has('ArrowDown')) moveZ += 1;
          if (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft')) moveX -= 1;
          if (keysHeld.has('KeyD') || keysHeld.has('ArrowRight')) moveX += 1;

          let moveLen = Math.hypot(moveX, moveZ);
          if (moveLen > 0.01 && !currentProps.mountedRide) {
            // Manual movement overrides any auto-stride
            autoStrideTimer = 0;
            moveX /= moveLen;
            moveZ /= moveLen;
            const targetYaw = Math.atan2(moveX, moveZ);
            let angleDiff = targetYaw - playerYaw;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            playerYaw += angleDiff * (1 - Math.exp(-14 * simDt));
          } else if (autoStrideTimer > 0 && !currentProps.mountedRide) {
            autoStrideTimer = Math.max(0, autoStrideTimer - simDt);
            const sDx = autoStrideX - playerX;
            const sDz = autoStrideZ - playerZ;
            const sDist = Math.hypot(sDx, sDz);
            if (sDist > 6.8) {
              moveX = sDx / sDist;
              moveZ = sDz / sDist;
              moveLen = 1;
            } else {
              autoStrideTimer = 0;
            }
          } else {
            moveX = 0;
            moveZ = 0;
            moveLen = 0;
          }

          const trailHexInt =
            parseInt(currentProps.equippedTrailColorHex.replace('#', ''), 16) ||
            0xf59e0b;

          if (dashBufferTimer > 0 && dashCooldown <= 0 && !currentProps.mountedRide) {
            dashBufferTimer = 0;
            dashCooldown = 0.95;
            dashActiveTimer = 0.26;
            dashDirX = moveLen > 0.01 ? moveX : Math.sin(playerYaw);
            dashDirZ = moveLen > 0.01 ? moveZ : Math.cos(playerYaw);
            playerVy = 4.2;
            scaleSquashX = 0.84;
            scaleSquashY = 1.2;
            melaverseAudio.playDashOrJump();
            spawnParticleBurst(playerX, 0.45, playerZ, trailHexInt, 14, 5.8);
          }

          // Evaluate World-Specific Gravity & Movement Physics Modifiers:
          // - World 01 (holi_braj): Slower movement in Holi mud around Haudi vats & wet color puddles
          // - World 02 (diwali_ghat): Boat-bobbing wave oscillation & river drift on the Diwali river
          // - World 03 (mela_central): Springy carnival jump-padding platforms
          const worldPhys = evaluateWorldPhysicsModifiers({
            activeWorld: currentProps.activeWorld,
            playerX,
            playerZ,
            playerY,
            elapsedSec: elapsedTotal,
          });

          const isSprinting =
            keysHeld.has('ShiftLeft') ||
            keysHeld.has('ShiftRight') ||
            currentProps.mobileMoveVec.sprinting;
          const speedBoost =
            (petalAuraTimer > 0 ? 1.25 : 1.0) *
            karmaStep.speedMultiplier *
            currentProps.foodBoostMultiplier *
            worldPhys.speedMultiplier *
            (isSprinting ? 1.28 : 1.0);
          const baseSpeed = 8.8 * speedBoost;
          let stepVx = moveX * baseSpeed + worldPhys.riverDriftVx;
          let stepVz = moveZ * baseSpeed;

          if (dashActiveTimer > 0) {
            dashActiveTimer = Math.max(0, dashActiveTimer - simDt);
            stepVx = dashDirX * 20.0 * karmaStep.speedMultiplier;
            stepVz = dashDirZ * 20.0 * karmaStep.speedMultiplier;
            // Marigold & Gulal petal trail during directional Dash
            spawnParticleBurst(playerX, 0.35, playerZ, trailHexInt, 2, 3.2);
          }

          frameVelocityX = stepVx;
          frameVelocityZ = stepVz;
          frameStrafeInputX = moveX;
          frameBuoyancyYOffset = worldPhys.buoyancyYOffset;

          // Trigger Mela Central Hub Jump-Padding Platform Launch
          if (
            worldPhys.activeJumpPad &&
            playerVy <= 1.2 &&
            !currentProps.mountedRide
          ) {
            playerVy = worldPhys.activeJumpPad.impulseY;
            scaleSquashX = 0.78;
            scaleSquashY = 1.32;
            melaverseAudio.playDashOrJump();
            spawnParticleBurst(
              playerX,
              0.35,
              playerZ,
              worldPhys.activeJumpPad.colorHex,
              18,
              6.5
            );
            emitFloatingCallout(
              `${worldPhys.activeJumpPad.label} Boost!`,
              '#fde047'
            );
          }

          const wantsJump = jumpBufferTimer > 0 && coyoteTimer > 0;
          if (wantsJump) {
            jumpBufferTimer = 0;
            melaverseAudio.playDashOrJump();
          }

          // Apply world-specific gravity modifier to vertical velocity
          if (playerY > 0.02) {
            playerVy += (1.0 - worldPhys.gravityScale) * 24.0 * simDt;
          }

          // Step Physics-Driven Character Controller (@dimforge/rapier3d-compat Capsule + Colliders)
          if (!currentProps.mountedRide) {
            rideLookYawOffset = 0;
            rideLookPitchOffset = 0;
            const physStep = melaPhysics.stepCharacter({
              currentX: playerX,
              currentY: playerY,
              currentZ: playerZ,
              velocityY: playerVy,
              desiredDeltaX: stepVx * simDt,
              desiredDeltaZ: stepVz * simDt,
              jumpRequested: wantsJump,
              dt: simDt,
              arenaRadius: 56.0,
            });
            playerX = physStep.x;
            playerY = physStep.y;
            playerZ = physStep.z;
            playerVy = physStep.velocityY;
            if (physStep.isGrounded) {
              coyoteTimer = 0.12;
            } else {
              coyoteTimer = Math.max(0, coyoteTimer - simDt);
            }
          } else {
            // Allow 360-degree look-around inside Giant Wheel gondola via keyboard/touch as well as mouse drag
            if (keysHeld.has('ArrowLeft') || keysHeld.has('KeyA')) {
              rideLookYawOffset += 1.45 * simDt;
            }
            if (keysHeld.has('ArrowRight') || keysHeld.has('KeyD')) {
              rideLookYawOffset -= 1.45 * simDt;
            }
            if (keysHeld.has('ArrowUp') || keysHeld.has('KeyW')) {
              rideLookPitchOffset = Math.min(0.75, rideLookPitchOffset + 1.1 * simDt);
            }
            if (keysHeld.has('ArrowDown') || keysHeld.has('KeyS')) {
              rideLookPitchOffset = Math.max(-0.75, rideLookPitchOffset - 1.1 * simDt);
            }
            if (Math.abs(currentProps.mobileLookDeltaYaw) > 0.0001) {
              rideLookYawOffset += currentProps.mobileLookDeltaYaw;
            }
          }

          const frameMoveDist = Math.hypot(stepVx * simDt, stepVz * simDt);
          walkDistAccum += frameMoveDist * 3.4;
          footstepAccum += frameMoveDist;
          if (footstepAccum >= 2.1 && playerY <= 0.05 && !currentProps.mountedRide) {
            footstepAccum = 0;
            melaverseAudio.playFootstep();
            if (worldPhys.inHoliMud) {
              spawnParticleBurst(playerX, 0.18, playerZ, 0xff1e7a, 4, 2.8);
            }
          }

          const swing =
            moveLen > 0.01 ? Math.sin(walkDistAccum) * 0.55 : 0;
          playerModel.leftLeg.rotation.x = swing;

          if (spinKickTimer > 0) {
            spinKickTimer = Math.max(0, spinKickTimer - simDt);
            const spinRatio = 1 - spinKickTimer / 0.34;
            playerModel.bodyGroup.rotation.y = spinRatio * Math.PI * 2;
            playerModel.rightLeg.rotation.x = -1.45;
          } else {
            playerModel.bodyGroup.rotation.y = 0;
            playerModel.rightLeg.rotation.x = -swing;
          }
          playerModel.leftArm.rotation.x = -swing * 0.7;

          if (armRecoilTimer > 0) {
            armRecoilTimer = Math.max(0, armRecoilTimer - simDt);
            playerModel.rightArm.rotation.x = -1.35;
          } else {
            playerModel.rightArm.rotation.x = -0.5 + swing * 0.35;
          }

          // Animate Fluttering Silk Dupatta Scarf & Kalgi Feather Plume based on movement & dash speed
          const moveSpeedFactor = Math.min(
            1.6,
            Math.hypot(stepVx, stepVz) / 8.0 + (dashActiveTimer > 0 ? 0.65 : 0)
          );
          playerModel.dupattaMesh.rotation.x =
            0.22 + moveSpeedFactor * 0.48 + Math.sin(elapsedTotal * 5.2) * 0.06;
          const dupGeo = playerModel.dupattaMesh.geometry;
          const dupPos = dupGeo.attributes.position as THREE.BufferAttribute;
          const baseDupY = dupGeo.userData.baseDupattaY as Float32Array;
          const baseDupX = dupGeo.userData.baseDupattaX as Float32Array;
          if (baseDupY && baseDupX) {
            for (let v = 0; v < dupPos.count; v++) {
              const distDown = Math.abs(baseDupY[v]) / 1.38;
              const waveZ =
                Math.sin(
                  elapsedTotal * (6.5 + moveSpeedFactor * 4.5) -
                    distDown * 4.2 +
                    baseDupX[v] * 2.5
                ) *
                (0.08 + moveSpeedFactor * 0.14) *
                distDown;
              dupPos.setZ(v, waveZ);
            }
            dupPos.needsUpdate = true;
          }
          playerModel.kalgiGroup.rotation.z =
            Math.sin(elapsedTotal * 4.8 + walkDistAccum) * 0.12;
          playerModel.kalgiGroup.rotation.x = -moveSpeedFactor * 0.18;

          scaleSquashX = THREE.MathUtils.damp(scaleSquashX, 1, 12, simDt);
          scaleSquashY = THREE.MathUtils.damp(scaleSquashY, 1, 12, simDt);
          playerModel.bodyGroup.scale.set(
            scaleSquashX,
            scaleSquashY,
            scaleSquashX
          );
          playerModel.root.position.set(
            playerX,
            playerY + worldPhys.buoyancyYOffset,
            playerZ
          );
          playerModel.root.rotation.y = playerYaw;
          playerModel.root.rotation.z = worldPhys.onDiwaliRiver
            ? Math.sin(elapsedTotal * 2.1 + playerX * 0.3) * 0.045
            : 0;

          // Update Golden Objective Compass Ring & Soft 'Magnet' Target Acquisition Reticle
          compassGroup.position.set(playerX, 0.045, playerZ);
          const magnetCandidates = buildMagnetCandidates();
          const rawAimX = hasCursorWorld
            ? cursorWorldX
            : playerX + Math.sin(playerYaw) * 6.5;
          const rawAimZ = hasCursorWorld
            ? cursorWorldZ
            : playerZ + Math.cos(playerYaw) * 6.5;

          const isActivelyFiring =
            magnetFirePulseTimer > 0 ||
            pointerIsDown ||
            keysHeld.has('Space') ||
            keysHeld.has('KeyJ');

          const magnetState = computeSoftMagnetReticle({
            rawAimX,
            rawAimZ,
            playerX,
            playerZ,
            playerYaw,
            isFiring: isActivelyFiring,
            candidates: magnetCandidates,
          });

          const dampFactor = isActivelyFiring ? 18 : 12;
          smoothReticleX = THREE.MathUtils.damp(
            smoothReticleX,
            magnetState.reticleX,
            dampFactor,
            simDt
          );
          smoothReticleZ = THREE.MathUtils.damp(
            smoothReticleZ,
            magnetState.reticleZ,
            dampFactor,
            simDt
          );

          compassGroup.rotation.y = magnetState.aimYaw;
          lockReticleGroup.visible = !currentProps.mountedRide;
          lockReticleGroup.position.set(smoothReticleX, 0, smoothReticleZ);
          lockOuterRing.rotation.z =
            elapsedTotal * (isActivelyFiring ? 4.5 : 2.2);
          lockInnerRing.rotation.z =
            -elapsedTotal * (isActivelyFiring ? 6.0 : 3.4);
          const lockPulse =
            1.0 -
            magnetState.magnetStrength * 0.16 +
            Math.sin(elapsedTotal * 8) * 0.05;
          lockOuterRing.scale.setScalar(lockPulse);
          lockBeacon.position.y =
            2.75 + Math.sin(elapsedTotal * 5.5) * 0.18;
          lockBeacon.rotation.y = elapsedTotal * 3.0;

          // Update 3D Magnetic Pull Tether Line between Player and Magnetized Reticle
          const tetherDx = smoothReticleX - playerX;
          const tetherDz = smoothReticleZ - playerZ;
          const tetherLen = Math.hypot(tetherDx, tetherDz);
          if (
            !currentProps.mountedRide &&
            tetherLen > 1.2 &&
            magnetState.magnetStrength > 0.05
          ) {
            magnetTetherMesh.visible = true;
            magnetTetherMesh.position.set(
              playerX + tetherDx * 0.5,
              0.055,
              playerZ + tetherDz * 0.5
            );
            magnetTetherMesh.scale.set(
              isActivelyFiring ? 1.45 : 1.0,
              1,
              tetherLen
            );
            magnetTetherMesh.rotation.y = Math.atan2(tetherDx, tetherDz);
            const tetherHex =
              magnetState.lockedTarget?.kind === 'reveler' &&
              magnetState.lockedTarget.weaknessColor
                ? GULAL_WEAPONS[magnetState.lockedTarget.weaknessColor].threeHex
                : 0xfbbf24;
            magnetTetherMat.color.setHex(tetherHex);
            magnetTetherMat.opacity = isActivelyFiring ? 0.68 : 0.36;
          } else {
            magnetTetherMesh.visible = false;
          }

          // Check Floating 3D Festival Blessing Pickups
          for (const b of blessingNodes) {
            if (
              b.cooldown <= 0 &&
              Math.hypot(playerX - b.x, playerZ - b.z) < 1.85
            ) {
              b.cooldown = 12.0;
              b.group.visible = false;
              melaverseAudio.playSacredChime();
              spawnParticleBurst(b.x, 1.1, b.z, 0xfbbf24, 20, 7.0);
              applyKarmaDeed('sacred_offering', '+50 Karma · Courtyard Offering');

              if (b.id === 'petal_aura') {
                petalAuraTimer = 5.5;
                score += 120;
                currentProps.onRewardEarned(25, 40);
                emitFloatingCallout('Petal Speed Aura Activated!', '#f472b6');
              } else if (b.id === 'gujiya_heal') {
                spiritPips = maxSpiritPips;
                gulalTankPct = 100;
                score += 120;
                currentProps.onRewardEarned(25, 40);
                emitFloatingCallout('Spirit & Gulal Restored! +25 Coins', '#fde047');
              } else if (b.id === 'matki_burst') {
                score += 160;
                currentProps.onRewardEarned(35, 50);
                emitFloatingCallout('Matki Color Burst! +35 Coins', '#38bdf8');
                // Damages nearest Challenger
                const targetCh = challengerNodes.find(
                  (n) => n.state.state !== 'ko'
                );
                if (targetCh) {
                  damageChallengerNode(targetCh, 'neel', 75);
                }
              }
            }
          }

          // Active Phoolon ki Holi Petal Aura Effect (Speed + Close-Range Petal Swirl)
          if (petalAuraTimer > 0) {
            petalAuraTimer = Math.max(0, petalAuraTimer - simDt);
            petalPulseAccum += simDt;
            if (petalPulseAccum >= 0.4) {
              petalPulseAccum = 0;
              spawnParticleBurst(playerX, 1.2, playerZ, 0xf43f5e, 5, 5.0);
              for (const node of challengerNodes) {
                if (
                  node.state.state !== 'ko' &&
                  Math.hypot(playerX - node.state.x, playerZ - node.state.z) < 3.4
                ) {
                  damageChallengerNode(node, 'gulabi', 25);
                }
              }
            }
          }

          // Trigger player-initiated Arsenal attack (including instant 1-5 / X keys)
          if (!currentProps.mountedRide) {
            if (pendingArsenalKeyAttack !== null && weaponCooldown <= 0) {
              const modeToFire = pendingArsenalKeyAttack;
              pendingArsenalKeyAttack = null;
              attackBufferTimer = 0;
              fireGulalBurst(modeToFire);
            } else if (attackBufferTimer > 0 && weaponCooldown <= 0) {
              attackBufferTimer = 0;
              fireGulalBurst();
            }
          }

          // Update Special Player Ordnance (Gubbara Balloons, Hawai Rockets, Sutli Bombs)
          for (const ord of specialOrdnancePool) {
            if (!ord.active) continue;
            ord.progress += simDt / ord.duration;

            if (ord.progress >= 1) {
              ord.active = false;
              ord.group.visible = false;

              if (ord.kind === 'balloon') {
                melaverseAudio.playHeavySplash(false, true);
                triggerAoEBlast(
                  ord.targetX,
                  ord.targetZ,
                  ARSENAL_MODES.balloon_throw.blastRadius,
                  ARSENAL_MODES.balloon_throw.damage,
                  currentProps.selectedGulal,
                  ord.colorHex,
                  20
                );
              } else if (ord.kind === 'rocket') {
                melaverseAudio.playBombExplosion();
                screenShakeState = triggerScreenShake(screenShakeState, {
                  traumaDelta: 0.42,
                  dirX: ord.targetX - playerX,
                  dirZ: ord.targetZ - playerZ,
                  verticalKick: 0.14,
                  frequencyHz: 22,
                });
                triggerAoEBlast(
                  ord.targetX,
                  ord.targetZ,
                  ARSENAL_MODES.hawai_rocket.blastRadius,
                  ARSENAL_MODES.hawai_rocket.damage,
                  currentProps.selectedGulal,
                  0xa855f7,
                  32
                );
                spawnParticleBurst(ord.targetX, 2.2, ord.targetZ, 0xfbbf24, 18, 9.5);
              } else if (ord.kind === 'bomb') {
                melaverseAudio.playBombExplosion();
                screenShakeState = triggerScreenShake(screenShakeState, {
                  traumaDelta: 0.72,
                  dirX: ord.targetX - playerX,
                  dirZ: ord.targetZ - playerZ,
                  verticalKick: 0.25,
                  frequencyHz: 18,
                });
                bombShockwaveMesh.position.set(ord.targetX, 0.25, ord.targetZ);
                bombShockwaveMesh.scale.setScalar(0.35);
                bombShockwaveMesh.visible = true;
                bombShockwaveTimer = 0.36;
                triggerAoEBlast(
                  ord.targetX,
                  ord.targetZ,
                  ARSENAL_MODES.sutli_bomb.blastRadius,
                  ARSENAL_MODES.sutli_bomb.damage,
                  currentProps.selectedGulal,
                  0x10b981,
                  40
                );
                spawnParticleBurst(ord.targetX, 1.5, ord.targetZ, 0xf43f5e, 24, 10.5);
              }
              continue;
            }

            const ox = THREE.MathUtils.lerp(ord.startX, ord.targetX, ord.progress);
            const oz = THREE.MathUtils.lerp(ord.startZ, ord.targetZ, ord.progress);
            if (ord.kind === 'rocket') {
              const oy = 1.25 + Math.sin(ord.progress * Math.PI) * 0.9;
              ord.group.position.set(ox, oy, oz);
              ord.group.lookAt(ord.targetX, 1.1, ord.targetZ);
              spawnParticleBurst(ox, oy, oz, 0xfbbf24, 2, 2.6);
            } else {
              const arcPeak = ord.kind === 'bomb' ? 3.2 : 3.8;
              const oy = 1.2 + Math.sin(ord.progress * Math.PI) * arcPeak;
              ord.group.position.set(ox, oy, oz);
              ord.group.rotation.x += simDt * 12;
              ord.group.rotation.z += simDt * 8;
              if (ord.kind === 'bomb') {
                spawnParticleBurst(ox, oy + 0.25, oz, 0xfbbf24, 1, 2.2);
              }
            }
          }

          // Update Homing Gulal Projectiles & Check Forgiving 1.85m Collisions
          const homingTargets: { x: number; z: number }[] = [];
          for (const node of challengerNodes) {
            if (node.state.state !== 'ko') {
              homingTargets.push({ x: node.state.x, z: node.state.z });
            }
          }
          for (const d of diyaNodes) {
            if (!d.lit) homingTargets.push({ x: d.x, z: d.z });
          }

          for (const proj of projectiles) {
            if (!proj.active) continue;
            proj.life -= simDt;
            if (proj.life <= 0) {
              proj.active = false;
              proj.mesh.visible = false;
              stampGulalGroundDecal(
                proj.x,
                proj.z,
                GULAL_WEAPONS[proj.colorId].threeHex,
                0.85
              );
              continue;
            }

            const spec = GULAL_WEAPONS[proj.colorId];
            const stepped = stepHomingProjectile(
              {
                x: proj.x,
                z: proj.z,
                vx: proj.vx,
                vz: proj.vz,
                speed: spec.speed,
              },
              homingTargets,
              simDt,
              14
            );
            proj.x = stepped.x;
            proj.z = stepped.z;
            proj.vx = stepped.vx;
            proj.vz = stepped.vz;
            const ageRatio = Math.max(
              0,
              Math.min(1, 1 - proj.life / Math.max(0.05, proj.maxLife))
            );
            const turbY = Math.sin(elapsedTotal * 6.5 + proj.x) * 0.14 * ageRatio;
            proj.mesh.position.set(proj.x, proj.y + turbY, proj.z);
            proj.mesh.scale.setScalar(0.85 + ageRatio * 1.45);
            proj.mat.opacity = (1 - ageRatio * 0.72) * 0.85;

            // Check collision with Unlit Sacred Diyas (1.85m forgiving radius)
            for (const d of diyaNodes) {
              if (!d.lit && Math.hypot(proj.x - d.x, proj.z - d.z) < 1.85) {
                proj.active = false;
                proj.mesh.visible = false;
                igniteDiyaNode(d);
                break;
              }
            }

            if (!proj.active) continue;

            // Check collision with Challenger Revelers (1.85m forgiving radius)
            for (const node of challengerNodes) {
              const st = node.state;
              if (st.state === 'ko') continue;
              if (Math.hypot(proj.x - st.x, proj.z - st.z) < 1.85) {
                proj.active = false;
                proj.mesh.visible = false;
                damageChallengerNode(node, proj.colorId, proj.damage);
                break;
              }
            }
          }

          // Update 3D Parabolic Lobbed Enemy Balloons
          for (const lb of lobbedBalloons) {
            if (!lb.active) continue;
            lb.progress += simDt / lb.duration;
            if (lb.progress >= 1) {
              lb.active = false;
              lb.mesh.visible = false;
              spawnParticleBurst(lb.targetX, 0.3, lb.targetZ, 0xf59e0b, 16, 6.0);

              const hitDist = Math.hypot(
                playerX - lb.targetX,
                playerZ - lb.targetZ
              );
              if (hitDist <= 2.2 && dashActiveTimer <= 0 && !currentProps.mountedRide) {
                if (shieldActiveTimer > 0) {
                  // Deflected by Sacred Lotus Shield -> Grants Speed Boost!
                  melaverseAudio.playShieldParry(true);
                  petalAuraTimer = Math.max(petalAuraTimer, 3.5);
                  emitFloatingCallout(
                    '+Speed Boost! Lotus Shield Block!',
                    '#38bdf8'
                  );
                  spawnParticleBurst(playerX, 1.2, playerZ, 0x38bdf8, 16, 6.8);
                } else {
                  spiritPips = Math.max(0, spiritPips - 1);
                  combo = 1;
                  comboStreak = 0;
                  comboDecayTimer = 0;
                  lastHudEmitTime = 0;
                  hitstopTimer = 0.045;
                  screenShakeState = triggerScreenShake(screenShakeState, {
                    traumaDelta: 0.5,
                    dirX: playerX - lb.startX,
                    dirZ: playerZ - lb.startZ,
                    verticalKick: 0.16,
                    frequencyHz: 24,
                  });
                  melaverseAudio.playPlayerHurt();
                  spawnParticleBurst(playerX, 1.1, playerZ, 0x38bdf8, 16, 6.0);
                }
              }
              continue;
            }

            const bx = THREE.MathUtils.lerp(lb.startX, lb.targetX, lb.progress);
            const bz = THREE.MathUtils.lerp(lb.startZ, lb.targetZ, lb.progress);
            const arcY = 1.25 + Math.sin(lb.progress * Math.PI) * 4.2;
            lb.mesh.position.set(bx, arcY, bz);
            lb.mesh.rotation.x += simDt * 6;
          }

          // Step Challenger AI with Adaptive Difficulty
          let activeAttackers = challengerNodes.filter(
            (n) => n.state.state === 'windup' || n.state.state === 'active'
          ).length;

          const currentWave = Math.min(3, Math.floor(revelersSplashed / 4) + 1);

          challengerNodes.forEach((node, idx) => {
            const canTakeToken =
              activeAttackers < adaptiveProfile.maxConcurrentAttackers;
            const res = stepChallengerAI(
              node.state,
              playerX,
              playerZ,
              simDt,
              canTakeToken,
              26,
              {
                movementSpeedScale: adaptiveProfile.movementSpeedScale,
                reactionFrequencyScale: adaptiveProfile.reactionFrequencyScale,
              }
            );
            node.state = res.updated;
            if (res.startedTelegraph) {
              activeAttackers++;
              melaverseAudio.playTelegraphCue();
            }

            const st = node.state;

            // Respawn KO challenger in the current wave
            if (st.state === 'ko' && st.koProgress >= 1) {
              node.state = spawnChallengerState(
                st.id,
                st.archetype,
                (idx + revelersSplashed) % 5,
                currentWave
              );
              node.model.bodyGroup.rotation.set(0, 0, 0);
              node.hpFillMesh.scale.x = 1;
              node.hpFillMesh.position.x = 0;
              const wHex = GULAL_WEAPONS[node.state.weaknessColor].threeHex;
              (
                node.hpFillMesh.material as THREE.MeshBasicMaterial
              ).color.setHex(wHex);
              node.weaknessGemMat.color.setHex(wHex);
            }

            // Expressive 3D Challenger Walk Cycle & Fighting Stance Animations
            node.model.root.position.set(st.x, 0, st.z);
            node.hpBarGroup.lookAt(camera.position);

            if (st.state === 'ko') {
              node.hpBarGroup.visible = false;
              node.model.bodyGroup.rotation.x = -st.koProgress * 1.15;
              node.model.bodyGroup.position.y =
                Math.sin(st.koProgress * Math.PI) * 0.65;
            } else {
              node.hpBarGroup.visible = true;
              node.model.root.lookAt(playerX, 0, playerZ);

              const moveSpd = Math.hypot(st.vx, st.vz);
              node.walkAccum += moveSpd * simDt * 3.2;
              const cSwing =
                moveSpd > 0.2 ? Math.sin(node.walkAccum) * 0.5 : 0;
              node.model.leftLeg.rotation.x = cSwing;
              node.model.rightLeg.rotation.x = -cSwing;

              if (st.state === 'windup') {
                if (st.archetype === 'sprinter') {
                  node.model.bodyGroup.position.y = -0.18;
                  node.model.bodyGroup.rotation.x = 0.22;
                  node.model.rightArm.rotation.x = -1.3;
                } else if (st.archetype === 'lobber') {
                  node.model.bodyGroup.position.y =
                    Math.abs(Math.sin(elapsedTotal * 12)) * 0.15;
                  node.model.rightArm.rotation.x = -2.35;
                } else {
                  node.model.bodyGroup.position.y = 0;
                  node.model.leftArm.rotation.x =
                    -0.7 + Math.sin(elapsedTotal * 28) * 0.55;
                  node.model.rightArm.rotation.x =
                    -0.7 - Math.sin(elapsedTotal * 28) * 0.55;
                }
              } else {
                node.model.bodyGroup.rotation.x = 0;
                node.model.bodyGroup.position.y = 0;
                node.model.leftArm.rotation.x = -cSwing * 0.6;
                node.model.rightArm.rotation.x = -0.5 + cSwing * 0.4;
              }
            }

            node.model.kurtaMat.emissive.setHex(
              st.hitFlashTimer > 0 ? 0xffffff : 0x000000
            );
            node.model.kurtaMat.emissiveIntensity =
              st.hitFlashTimer > 0 ? 0.55 : 0;

            if (st.state === 'windup') {
              node.telegraphRing.visible = true;
              node.telegraphRing.position.set(st.targetX, 0.04, st.targetZ);
              const pulse = 0.65 + Math.sin(elapsedTotal * 22) * 0.35;
              node.telegraphRing.scale.setScalar(pulse);

              if (st.archetype === 'captain') {
                node.telegraphLane.visible = true;
                node.telegraphLane.position.set(
                  (st.x + st.targetX) * 0.5,
                  0.035,
                  (st.z + st.targetZ) * 0.5
                );
                node.telegraphLane.lookAt(st.targetX, 0.035, st.targetZ);
                node.telegraphLane.rotateX(-Math.PI / 2);
              } else {
                node.telegraphLane.visible = false;
              }
            } else {
              node.telegraphRing.visible = false;
              node.telegraphLane.visible = false;
            }

            // Handle Challenger Attack Execution
            if (res.triggeredAttack && !currentProps.mountedRide) {
              if (st.archetype === 'lobber') {
                const bSlot = lobbedBalloons.find((b) => !b.active);
                if (bSlot) {
                  bSlot.active = true;
                  bSlot.startX = st.x;
                  bSlot.startZ = st.z;
                  bSlot.targetX = st.targetX;
                  bSlot.targetZ = st.targetZ;
                  bSlot.progress = 0;
                  bSlot.duration =
                    0.52 / adaptiveProfile.reactionFrequencyScale;
                  bSlot.mesh.position.set(st.x, 1.5, st.z);
                  bSlot.mesh.visible = true;
                }
              } else if (dashActiveTimer <= 0) {
                const hitDist = Math.hypot(
                  playerX - st.targetX,
                  playerZ - st.targetZ
                );
                const bodyDist = Math.hypot(playerX - st.x, playerZ - st.z);
                if (hitDist <= 2.15 || bodyDist <= 1.95) {
                  if (shieldActiveTimer > 0) {
                    melaverseAudio.playShieldParry(true);
                    petalAuraTimer = Math.max(petalAuraTimer, 3.5);
                    emitFloatingCallout(
                      '+Speed Boost! Lotus Shield Block!',
                      '#38bdf8'
                    );
                    damageChallengerNode(node, 'neel', 45);
                    spawnParticleBurst(playerX, 1.2, playerZ, 0x38bdf8, 16, 6.5);
                  } else {
                    spiritPips = Math.max(0, spiritPips - 1);
                    combo = 1;
                    comboStreak = 0;
                    comboDecayTimer = 0;
                    lastHudEmitTime = 0;
                    hitstopTimer = 0.05;
                    screenShakeState = triggerScreenShake(screenShakeState, {
                      traumaDelta: 0.55,
                      dirX: playerX - st.x,
                      dirZ: playerZ - st.z,
                      verticalKick: 0.18,
                      frequencyHz: 24,
                    });
                    melaverseAudio.playPlayerHurt();
                    spawnParticleBurst(playerX, 1.1, playerZ, 0x38bdf8, 16, 6.0);
                  }
                }
              }
            }
          });
        }

        // Proximity check for Rides, Mini-Game Stalls, World Portals, NPCs & Unlit Diyas (`[E]` interaction)
        let closestPrompt: HudSnapshot['nearbyPrompt'] = null;
        let closestDist = 4.2;

        if (!currentProps.mountedRide) {
          for (const d of diyaNodes) {
            if (!d.lit) {
              const dist = Math.hypot(playerX - d.x, playerZ - d.z);
              if (dist < closestDist) {
                closestDist = dist;
                closestPrompt = {
                  type: 'diya',
                  label: 'Light Sacred Brass Diya',
                  targetId: d.id,
                };
              }
            }
          }

          for (const n of npcMeshes) {
            const dist = Math.hypot(playerX - n.npc.x, playerZ - n.npc.z);
            if (dist < closestDist) {
              closestDist = dist;
              closestPrompt = {
                type: 'npc',
                label: `Talk to ${n.npc.name} (${n.npc.role.split('&')[0].trim()})`,
                targetId: n.npc.id,
              };
            }
          }

          if (currentProps.activeWorld === 'mela_central') {
            for (const portal of worldPortalNodes) {
              const dist = Math.hypot(playerX - portal.x, playerZ - portal.z);
              if (dist < 2.25) {
                // Seamless walk-through portal trigger when stepping directly into the glowing portal arch
                const destWorld = portal.id;
                melaverseAudio.playSacredChime();
                playerX = 0;
                playerZ = 6.5;
                melaPhysics.teleportPlayer(0, 0, 6.5);
                currentProps.onSelectWorld(destWorld);
                emitFloatingCallout(
                  `Entered Portal → ${
                    destWorld === 'holi_braj'
                      ? 'World 01: Holi — Braj'
                      : 'World 02: Diwali — Ghat'
                  }!`,
                  '#fde047'
                );
                break;
              }
              if (dist < 4.8 && dist < closestDist + 1.5) {
                closestDist = dist;
                closestPrompt = {
                  type: 'portal',
                  label: portal.label,
                  targetId: portal.id,
                };
              }
            }
          }

          for (const ride of MELA_RIDES) {
            const dist = Math.hypot(playerX - ride.x, playerZ - ride.z);
            if (dist < ride.interactionRadius && dist < closestDist + 3.5) {
              closestDist = dist;
              closestPrompt = {
                type: 'ride',
                label: `Board ${ride.name} (1st Ride Free / ${ride.ticketCostCoins} Coins · +50 Joy XP)`,
                targetId: ride.id,
                costCoins: ride.ticketCostCoins,
                rideId: ride.id,
              };
            }
          }

          for (const stall of MELA_STALLS) {
            const dist = Math.hypot(playerX - stall.x, playerZ - stall.z);
            if (dist < stall.interactionRadius && dist < closestDist + 3.0) {
              closestDist = dist;
              closestPrompt = {
                type: 'stall',
                label: stall.promptLabel,
                targetId: stall.id,
                stallId: stall.id,
              };
            }
          }
        }

        if (
          (keysJustPressed.has('KeyE') || interactJustTriggered) &&
          closestPrompt &&
          !currentProps.mountedRide
        ) {
          if (closestPrompt.type === 'diya') {
            const targetDiya = diyaNodes.find(
              (d) => d.id === closestPrompt!.targetId
            );
            if (targetDiya && !targetDiya.lit) {
              igniteDiyaNode(targetDiya);
            }
          } else if (closestPrompt.type === 'npc') {
            const foundNpc = COURT_NPCS.find(
              (n) => n.id === closestPrompt!.targetId
            );
            if (foundNpc) {
              if (foundNpc.id === 'halwai_mohan') {
                spiritPips = maxSpiritPips;
                gulalTankPct = 100;
              }
              applyKarmaDeed(
                'help_npc',
                `+100 Karma · Helped ${foundNpc.name.split(' ')[0]}`
              );
              melaverseAudio.playSacredChime();
              currentProps.onOpenNpcDialogue(foundNpc);
            }
          } else if (closestPrompt.type === 'portal') {
            const destWorld = closestPrompt.targetId as FestivalWorldId;
            melaverseAudio.playSacredChime();
            playerX = 0;
            playerZ = 6.5;
            melaPhysics.teleportPlayer(0, 0, 6.5);
            currentProps.onSelectWorld(destWorld);
            emitFloatingCallout(
              `Traveled to ${
                destWorld === 'holi_braj'
                  ? 'World 01: Holi — Braj'
                  : 'World 02: Diwali — Ghat'
              }!`,
              '#fde047'
            );
          } else if (closestPrompt.type === 'ride') {
            currentProps.onBoardRide(
              closestPrompt.targetId as RideId,
              closestPrompt.costCoins ?? 10
            );
            emitFloatingCallout(
              'Boarded Gondola! +50 Festival Joy XP · Drag or A/D to Look 360°',
              '#fde047'
            );
          } else if (closestPrompt.type === 'stall') {
            currentProps.onOpenStallModal(
              closestPrompt.targetId as MiniGameStallId
            );
          }
        } else if (keysJustPressed.has('KeyT')) {
          applyKarmaDeed('help_npc', '+100 Karma · Elder Blessing');
        }

        // AAA Dynamic Camera Director System:
        // - 2.0s "One-Take" Dive Transition from Preview Drone Spline into Over-The-Shoulder Rig
        // - Over-The-Shoulder Rule-of-Thirds Offset (x = +0.65, y = 2.1, distance = 5.2)
        // - Dual-Rate Exponential Damping (Position lambda = 7.5, Velocity Look-Ahead lambda = 14.0)
        // - Dynamic Speed FOV (43° Idle, 46° Walk, 58° Sprint/Dash, -1.5° Recoil Dip) & Cornering Dutch Roll (±2.5°)
        // - Monument Vista Auto-Framing (Temple & Giant Wheel), Lotus Shield Orbit, Firework Sky Tilt, Gondola & Stall S-Curves
        // - THREE.Raycaster Anti-Clip Camera Collision Whiskers (lambda = 18)
        const shakeStep = stepScreenShake(screenShakeState, dt);
        screenShakeState = shakeStep.state;

        const isSprintingNow =
          !currentProps.mountedRide &&
          (keysHeld.has('ShiftLeft') ||
            keysHeld.has('ShiftRight') ||
            currentProps.mobileMoveVec.sprinting ||
            dashActiveTimer > 0);

        playerModel.root.visible =
          !currentProps.mountedRide &&
          currentProps.cameraMode !== 'first_person';
        compassGroup.visible = !currentProps.mountedRide;

        const activeWorldColliderGroup = isHoliWorld
          ? holiWorldGroup
          : isDiwaliWorld
          ? diwaliGhatGroup
          : melaHubGroup;

        cameraDirector.step(camera, {
          dt,
          elapsedSec: elapsedTotal,
          isPlaying: true,
          activeWorld: currentProps.activeWorld,
          cameraMode: currentProps.cameraMode,
          mountedRide: currentProps.mountedRide,
          activeStallModal: currentProps.activeStallModal ?? null,
          playerX,
          playerY: playerY + frameBuoyancyYOffset,
          playerZ,
          playerYaw,
          velocityX: frameVelocityX,
          velocityZ: frameVelocityZ,
          strafeInputX: frameStrafeInputX,
          isSprintingOrDashing: isSprintingNow,
          shieldActive: shieldActiveTimer > 0,
          justFiredGulal: false,
          justLaunchedFirework: false,
          rideLookYawOffset,
          rideLookPitchOffset,
          shakeStep,
          colliderMeshes: [mandirGroup, activeWorldColliderGroup],
        });

        const litCount = diyaNodes.filter((d) => d.lit).length;
        const outcome = evaluateRoundOutcome({
          spiritPips,
          revelersSplashed,
          targetRevelers,
          diyasLit: litCount,
          targetDiyas,
        });

        if (outcome !== 'playing' && !roundEnded) {
          roundEnded = true;
          if (outcome === 'victory') {
            melaverseAudio.playVictoryFanfare();
          } else {
            melaverseAudio.playDefeatSting();
          }
          currentProps.onRoundEnd(outcome, {
            score,
            revelersSplashed,
            diyasLit: litCount,
            clearTimeSec: Math.max(1, Math.round(roundElapsedSec)),
          });
        }

        // Throttle React HUD state updates strictly to once every 250ms (4 Hz) — NEVER per-frame!
        if (now - lastHudEmitTime >= 250 || roundEnded) {
          lastHudEmitTime = now;
          const remainingDiyas = Math.max(0, targetDiyas - litCount);
          const remainingRevelers = Math.max(
            0,
            targetRevelers - revelersSplashed
          );
          const activeWave = Math.min(3, Math.floor(revelersSplashed / 4) + 1);
          const objectiveHint = currentProps.mountedRide
            ? `Enjoying 1st-Person Mela Ride · Press [Esc] or Exit Ride to return`
            : currentProps.activeWorld === 'diwali_ghat'
            ? `[R] Rhythm & Diyas (${litCount}/${targetDiyas} Lit) · [F] Multi-Stage Fireworks`
            : currentProps.activeWorld === 'mela_central'
            ? `[E] Board Giant Wheel · [G] Stamp Glowing Rangoli · Portals to Braj & Ghat`
            : remainingDiyas > 0 && remainingRevelers > 0
            ? `[Space/LMB] Fire Gulal · [Q/RMB] Lotus Shield · [Shift] Dash · [R] Diyas`
            : remainingDiyas > 0
            ? `Golden Compass → Ignite ${remainingDiyas} Sacred Diya${
                remainingDiyas > 1 ? 's' : ''
              } ([R] / [E])`
            : `Splash ${remainingRevelers} Reveler${
                remainingRevelers > 1 ? 's' : ''
              } · Refill Gulal at Courtyard Vats!`;

          // Project 3D Soft-Magnet Reticle to 2D Screen Percentage for HUD Overlay
          const activeMagnetCandidates = buildMagnetCandidates();
          const curAimX = hasCursorWorld
            ? cursorWorldX
            : playerX + Math.sin(playerYaw) * 6.5;
          const curAimZ = hasCursorWorld
            ? cursorWorldZ
            : playerZ + Math.cos(playerYaw) * 6.5;
          const curMagnet = computeSoftMagnetReticle({
            rawAimX: curAimX,
            rawAimZ: curAimZ,
            playerX,
            playerZ,
            playerYaw,
            isFiring:
              magnetFirePulseTimer > 0 ||
              pointerIsDown ||
              keysHeld.has('Space') ||
              keysHeld.has('KeyJ'),
            candidates: activeMagnetCandidates,
            passiveRadius: 18.0,
          });

          let magnetLockInfo: HudSnapshot['magnetLockInfo'] = null;
          if (curMagnet.lockedTarget && !currentProps.mountedRide) {
            _projScreenVec3.set(
              smoothReticleX,
              1.35,
              smoothReticleZ
            );
            _projScreenVec3.project(camera);
            if (_projScreenVec3.z < 1) {
              const sx = Math.max(
                14,
                Math.min(86, (_projScreenVec3.x * 0.5 + 0.5) * 100)
              );
              const sy = Math.max(
                18,
                Math.min(76, (-_projScreenVec3.y * 0.5 + 0.5) * 100)
              );
              magnetLockInfo = {
                label: curMagnet.lockedTarget.label,
                kind: curMagnet.lockedTarget.kind,
                weaknessColor: curMagnet.lockedTarget.weaknessColor,
                magnetStrength: curMagnet.magnetStrength,
                screenX: sx,
                screenY: sy,
              };
            }
          }

          currentProps.onHudUpdate({
            spiritPips,
            maxSpiritPips,
            spiritTrail,
            gulalTankPct: Math.round(gulalTankPct),
            score,
            bestScore: Math.max(bestScore, score),
            combo,
            comboStreak,
            comboTimerRatio: comboDecayTimer / comboMaxDecaySec,
            revelersSplashed,
            targetRevelers,
            diyasLit: litCount,
            targetDiyas,
            selectedGulal: currentProps.selectedGulal,
            selectedArsenal: currentProps.selectedArsenal,
            cooldownPct:
              Math.min(
                1,
                weaponCooldown /
                  ARSENAL_MODES[currentProps.selectedArsenal].cooldown
              ) * 100,
            dashCooldownPct: Math.min(1, dashCooldown / 0.95) * 100,
            shieldCooldownPct: Math.min(1, shieldCooldown / 6.0) * 100,
            shieldActive: shieldActiveTimer > 0,
            nearbyPrompt: closestPrompt,
            activeWave,
            activeBlessing: karmaState.activeBlessingId
              ? `${DIVINE_BLESSINGS[karmaState.activeBlessingId].name} (${Math.ceil(
                  karmaState.blessingRemainingSec
                )}s)`
              : petalAuraTimer > 0
              ? `Speed Aura (${Math.ceil(petalAuraTimer)}s)`
              : shieldActiveTimer > 0
              ? `Lotus Shield (${shieldActiveTimer.toFixed(1)}s)`
              : null,
            objectiveHint,
            magnetLockInfo,
            floatingCallout,
            adaptiveDifficulty: adaptiveProfile,
            karma: karmaState,
            dayNight: atmosphere,
            playerX,
            playerZ,
            playerYaw,
            fps: Math.round(smoothedFps),
            crowdPositions: crowdVisitors
              .slice(0, Math.min(18, activeCrowdCount))
              .map((v) => ({ x: v.x, z: v.z })),
          });
        }
      } else if (currentProps.gameState === 'paused' && currentProps.activeStallModal) {
        // Smooth 0.8s S-curve Stall Camera framing while Balloon Shooting or Ring Toss modal is active
        cameraDirector.step(camera, {
          dt,
          elapsedSec: elapsedTotal,
          isPlaying: true,
          activeWorld: currentProps.activeWorld,
          cameraMode: currentProps.cameraMode,
          mountedRide: currentProps.mountedRide,
          activeStallModal: currentProps.activeStallModal,
          playerX,
          playerY: playerY + frameBuoyancyYOffset,
          playerZ,
          playerYaw,
          velocityX: 0,
          velocityZ: 0,
          strafeInputX: 0,
          isSprintingOrDashing: false,
          shieldActive: false,
          justFiredGulal: false,
          justLaunchedFirework: false,
          rideLookYawOffset,
          rideLookPitchOffset,
          shakeStep: {
            state: screenShakeState,
            offsetX: 0,
            offsetY: 0,
            offsetZ: 0,
            rollRad: 0,
          },
          colliderMeshes: [],
        });
      }

      keysJustPressed.clear();
      pointerJustClicked = false;
      rightClickParryJustPressed = false;

      if (!isSoftwareGl && bloomPass.enabled) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      // Compute active frame FPS from actual render work duration so software-GL sync polling never artificially depresses FPS
      const frameWorkSec = Math.max(0.001, (performance.now() - now) / 1000);
      const instantFps = isSoftwareGl
        ? Math.min(60, 1 / Math.max(0.0166, frameWorkSec))
        : Math.min(60, 1 / Math.max(0.0166, rawDt));
      smoothedFps = THREE.MathUtils.damp(smoothedFps, instantFps, 6, dt);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      isUnmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('blur', clearAllInputs);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      renderer.domElement.removeEventListener(
        'pointerdown',
        handleCanvasPointerDown
      );
      renderer.domElement.removeEventListener(
        'pointermove',
        handleCanvasPointerMove
      );
      renderer.domElement.removeEventListener(
        'contextmenu',
        handleContextMenu
      );
      melaPhysics.dispose();
      melaRidesRig?.dispose();
      loadedMelaAssets?.dispose();
      crowdBodyGeo.dispose();
      crowdBodyMat.dispose();
      crowdHeadGeo.dispose();
      crowdHeadMat.dispose();
      crowdJoyGaugeGeo.dispose();
      crowdJoyGaugeMat.dispose();
      cobblestonePBRBundle.dispose();
      wetMarbleGulalBundle.dispose();
      carvedSandstonePBRBundle.dispose();
      gulalCloudTex.dispose();
      fireflyGeo.dispose();
      fireflyShaderMat.dispose();
      holiMistGeo.dispose();
      holiMistShaderMat.dispose();
      interactiveSwirlGeo.dispose();
      interactiveSwirlMat.dispose();
      diwaliWaterShaderMat.dispose();
      sunCoreGeo.dispose();
      sunCoreMat.dispose();
      sunHaloGeo.dispose();
      sunHaloMat.dispose();
      moonCoreGeo.dispose();
      moonCoreMat.dispose();
      moonHaloGeo.dispose();
      moonHaloMat.dispose();
      msaaRenderTarget.dispose();
      composer.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden z-0"
      aria-label="MELAVERSE 3D Festival World Viewport"
    />
  );
};

