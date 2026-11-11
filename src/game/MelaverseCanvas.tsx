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
  computeRideCabinCameraPose,
  stepCrowdVisitorAI,
  DIVINE_BLESSINGS,
  GULAL_WEAPONS,
  ARSENAL_MODES,
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
  foodBoostMultiplier: number;
  mobileMoveVec: { dx: number; dz: number; sprinting: boolean };
  mobileLookDeltaYaw: number;
  jumpTriggerCount: number;
  interactTriggerCount: number;
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
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
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

// Helper to build a stylized low-poly 3D festival avatar (LatheGeometry Angarkha/Lehenga torso, proportioned head, turban/dupatta, swinging limbs & contact shadow)
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
  kurtaMat: THREE.MeshStandardMaterial;
  dhotiMat: THREE.MeshStandardMaterial;
  pagdiMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshStandardMaterial;
} {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // 1. Soft dark contact shadow disc directly under feet (y = 0.015)
  const shadowGeo = new THREE.CircleGeometry(0.68, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x050308,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Stylized PBR Materials
  const kurtaMat = new THREE.MeshStandardMaterial({
    color: opts.kurtaColor,
    roughness: 0.58,
    metalness: 0.12,
    emissiveIntensity: 0,
  });
  const warmLowerLimbColor = new THREE.Color(opts.dhotiColor).lerp(
    new THREE.Color(0x7c3f1d),
    0.72
  );
  const dhotiMat = new THREE.MeshStandardMaterial({
    color: warmLowerLimbColor,
    roughness: 0.78,
    metalness: 0.04,
    emissiveIntensity: 0,
  });
  const juttiLeatherMat = new THREE.MeshStandardMaterial({
    color: 0x2e150b,
    roughness: 0.72,
    metalness: 0.18,
    emissiveIntensity: 0,
  });
  const pagdiMat = new THREE.MeshStandardMaterial({
    color: opts.pagdiColor,
    roughness: 0.38,
    metalness: 0.25,
    emissiveIntensity: 0,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: opts.skinColor,
    roughness: 0.52,
    metalness: 0.04,
    emissiveIntensity: 0,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xf5b841,
    roughness: 0.2,
    metalness: 0.88,
    emissiveIntensity: 0,
  });

  // 2. Articulated Tapered Legs + Curved Mojari/Jutti Footwear
  const legLathePoints = [
    new THREE.Vector2(0.0, -0.28),
    new THREE.Vector2(0.09, -0.28),
    new THREE.Vector2(0.11, -0.05),
    new THREE.Vector2(0.145, 0.28),
    new THREE.Vector2(0.0, 0.28),
  ];
  const legGeo = new THREE.LatheGeometry(legLathePoints, 12);
  const juttiShoeGeo = new THREE.CapsuleGeometry(0.075, 0.16, 4, 8);
  juttiShoeGeo.rotateX(Math.PI / 2);
  const juttiTrimGeo = new THREE.ConeGeometry(0.055, 0.12, 8);

  const buildLegWithJutti = (xOffset: number) => {
    const legMesh = new THREE.Mesh(legGeo, dhotiMat);
    legMesh.position.set(xOffset, 0.39, 0);
    legMesh.castShadow = true;

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

  // 3. Sculpted Flared Angarkha / Lehenga-Kurta Torso using THREE.LatheGeometry
  const kurtaLathePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.44, 0.0),
    new THREE.Vector2(0.41, 0.18),
    new THREE.Vector2(0.32, 0.44),
    new THREE.Vector2(0.26, 0.62),
    new THREE.Vector2(0.33, 0.88),
    new THREE.Vector2(0.22, 0.96),
    new THREE.Vector2(0.0, 0.96),
  ];
  const torsoGeo = new THREE.LatheGeometry(kurtaLathePoints, 18);
  const torsoMesh = new THREE.Mesh(torsoGeo, kurtaMat);
  torsoMesh.position.set(0, 0.56, 0);
  torsoMesh.castShadow = true;
  bodyGroup.add(torsoMesh);

  // Gold Zari Waist Cummerbund (Kamarbandh) & Hem Border
  const hemTrimGeo = new THREE.TorusGeometry(0.43, 0.028, 8, 24);
  hemTrimGeo.rotateX(Math.PI / 2);
  const hemTrimMesh = new THREE.Mesh(hemTrimGeo, brassMat);
  hemTrimMesh.position.set(0, 0.58, 0);
  bodyGroup.add(hemTrimMesh);

  const waistBandGeo = new THREE.TorusGeometry(0.27, 0.032, 8, 20);
  waistBandGeo.rotateX(Math.PI / 2);
  const waistBandMesh = new THREE.Mesh(waistBandGeo, brassMat);
  waistBandMesh.position.set(0, 1.12, 0);
  bodyGroup.add(waistBandMesh);

  // 4. Festive Zari Stole / Dupatta Sash across chest
  const sashGeo = new THREE.TorusGeometry(0.31, 0.052, 8, 20);
  const sashMesh = new THREE.Mesh(sashGeo, pagdiMat);
  sashMesh.position.set(0, 1.22, 0);
  sashMesh.rotation.set(Math.PI * 0.38, 0.25, 0);
  bodyGroup.add(sashMesh);

  // 5. Articulated Swinging Arms with Gold Cuffs
  const armGeo = new THREE.CapsuleGeometry(0.082, 0.44, 6, 12);
  const cuffGeo = new THREE.TorusGeometry(0.082, 0.018, 6, 12);
  cuffGeo.rotateX(Math.PI / 2);

  const leftArm = new THREE.Mesh(armGeo, kurtaMat);
  leftArm.position.set(-0.37, 1.16, 0);
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
  rightArm.position.set(0.37, 1.16, 0.1);
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

  // 6. Proportioned Head with Neck & Facial Features
  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10),
    skinMat
  );
  neckMesh.position.set(0, 1.56, 0);
  bodyGroup.add(neckMesh);

  const headGeo = new THREE.SphereGeometry(0.235, 18, 16);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 1.76, 0);
  headMesh.castShadow = true;
  bodyGroup.add(headMesh);

  // 7. Layered Royal Pagdi (Turban) + Kalgi Fan Crest & Jewel Brooch
  const pagdiBaseGeo = new THREE.TorusGeometry(0.205, 0.088, 12, 24);
  pagdiBaseGeo.rotateX(Math.PI / 2);
  const pagdiMesh = new THREE.Mesh(pagdiBaseGeo, pagdiMat);
  pagdiMesh.position.set(0, 1.91, 0);
  pagdiMesh.rotation.z = 0.08;
  bodyGroup.add(pagdiMesh);

  const pagdiCrownGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const pagdiCrown = new THREE.Mesh(pagdiCrownGeo, pagdiMat);
  pagdiCrown.position.set(0, 1.95, 0);
  bodyGroup.add(pagdiCrown);

  const kalgiGeo = new THREE.ConeGeometry(0.085, 0.24, 10);
  const kalgiMesh = new THREE.Mesh(kalgiGeo, brassMat);
  kalgiMesh.position.set(0, 2.08, 0.16);
  kalgiMesh.rotation.x = 0.32;
  bodyGroup.add(kalgiMesh);

  // 8. Optional Accent Props (Brass Pichkari, Clay Matki, or Braj Dhol)
  if (opts.hasPichkari) {
    const pichkariGroup = new THREE.Group();
    const barrelGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.68, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, brassMat);
    const nozzleGeo = new THREE.ConeGeometry(0.08, 0.15, 12);
    nozzleGeo.rotateX(Math.PI / 2);
    const nozzle = new THREE.Mesh(nozzleGeo, pagdiMat);
    nozzle.position.z = 0.38;
    pichkariGroup.add(barrel, nozzle);
    pichkariGroup.position.set(0.38, 1.08, 0.38);
    bodyGroup.add(pichkariGroup);
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
      roughness: 0.42,
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
      roughness: 0.5,
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

    // 2. Scene, Deep Indigo-Velvet Skybox, Exponential Fog & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080512');
    scene.fog = new THREE.FogExp2('#080512', 0.0085);

    // Custom Deep Twilight Gradient Sky Dome (#050414 zenith -> #1b1236 horizon)
    const skyDomeGeo = new THREE.SphereGeometry(165, 32, 24);
    const skyPosAttr = skyDomeGeo.attributes.position;
    const skyColors = new Float32Array(skyPosAttr.count * 3);
    const zenithColor = new THREE.Color(0x050414);
    const midSkyColor = new THREE.Color(0x0d0922);
    const horizonColor = new THREE.Color(0x1b1236);
    const tempSkyColor = new THREE.Color();

    for (let i = 0; i < skyPosAttr.count; i++) {
      const py = skyPosAttr.getY(i);
      const normY = Math.max(0, Math.min(1, (py + 15) / 150));
      if (normY < 0.35) {
        tempSkyColor.copy(horizonColor).lerp(midSkyColor, normY / 0.35);
      } else {
        tempSkyColor
          .copy(midSkyColor)
          .lerp(zenithColor, (normY - 0.35) / 0.65);
      }
      skyColors[i * 3] = tempSkyColor.r;
      skyColors[i * 3 + 1] = tempSkyColor.g;
      skyColors[i * 3 + 2] = tempSkyColor.b;
    }
    skyDomeGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
    const skyDomeMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const skyDomeMesh = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    scene.add(skyDomeMesh);

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

    const camera = new THREE.PerspectiveCamera(48, initW / initH, 0.2, 260);
    camera.position.set(32, 11, 38);
    camera.lookAt(6, 6, -4);

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
      new THREE.Vector2(initW, initH),
      initialPresetCfg.bloomStrength,
      initialPresetCfg.bloomRadius,
      initialPresetCfg.bloomThreshold
    );
    bloomPass.threshold = 0.92;
    bloomPass.strength = initialPresetCfg.bloomEnabled ? 0.28 : 0;
    bloomPass.radius = 0.35;
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
      bloomPass.strength = cfg.bloomStrength;
      bloomPass.radius = cfg.bloomRadius;
      bloomPass.threshold = cfg.bloomThreshold;
    };

    // 3. Cinematic Lighting & Shadows Pipeline:
    //    - AmbientLight (0.2)
    //    - Cool Moonlight DirectionalLight (#6b7cff, intensity 0.8, casting crisp soft shadows)
    //    - Warm Golden Rim Directional Fill + Golden-Orange PointLight Pools (#ff9436, distance 35, decay 1.8)
    const ambientFillLight = new THREE.AmbientLight(0x241b38, 0.2);
    scene.add(ambientFillLight);

    const hemiLight = new THREE.HemisphereLight(0x6b7cff, 0x3b1f14, 0.52);
    hemiLight.position.set(0, 45, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0x6b7cff, 0.8);
    keyLight.position.set(-24, 38, 26);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = initialPresetCfg.shadowMapSize;
      keyLight.shadow.mapSize.height = initialPresetCfg.shadowMapSize;
      const d = 44;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 110;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    // Warm Golden Rim Directional Accent to sculpt sandstone carvings & gold Kalash
    const warmRimLight = new THREE.DirectionalLight(0xffa94d, 0.95);
    warmRimLight.position.set(28, 24, 18);
    scene.add(warmRimLight);

    // Warm Golden-Orange PointLight Pools (#ff9436, distance 35, decay 1.8) inside Temple, Plaza & Bazaar
    const templeSanctumPointLight = new THREE.PointLight(0xff9436, 3.2, 35, 1.8);
    templeSanctumPointLight.position.set(0, 5.8, -19.0);
    scene.add(templeSanctumPointLight);

    const templeStepsPointLight = new THREE.PointLight(0xff9436, 2.4, 35, 1.8);
    templeStepsPointLight.position.set(0, 3.2, -10.5);
    scene.add(templeStepsPointLight);

    const rangoliPlazaPointLight = new THREE.PointLight(0xff9436, 2.1, 35, 1.8);
    rangoliPlazaPointLight.position.set(0, 2.8, 0);
    scene.add(rangoliPlazaPointLight);

    const westBazaarPointLight = new THREE.PointLight(0xff9436, 2.2, 35, 1.8);
    westBazaarPointLight.position.set(-21.5, 4.2, -2.0);
    scene.add(westBazaarPointLight);

    // 3A. Atmospheric GPU Particle System (`THREE.Points` with Custom Vertex/Fragment Shaders — 1,550+ Particles)
    // (1) 800 Floating Golden Fireflies / Diya Embers drifting gently across the plaza
    const FIREFLY_COUNT = 800;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPositions = new Float32Array(FIREFLY_COUNT * 3);
    const fireflyPhases = new Float32Array(FIREFLY_COUNT);
    const fireflyScales = new Float32Array(FIREFLY_COUNT);
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const r = 4.0 + Math.sqrt((i / FIREFLY_COUNT)) * 54.0;
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
          gl_PointSize = (18.0 * aScale * uPixelRatio) / max(1.0, -mvPosition.z);
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

    // (2) 750 Swirling Airborne Gulal Mist Particles in World 01: Holi — Braj (Pink, Turquoise, Saffron)
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
      const r = 3.0 + ((i * 53) % 44);
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
          pos.x += sin(uTime * 0.85 + aPhase) * 1.6;
          pos.y += sin(uTime * 0.6 + aPhase * 0.7) * 0.55;
          pos.z += cos(uTime * 0.8 + aPhase) * 1.6;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = (28.0 * uPixelRatio) / max(1.0, -mvPosition.z);
          vAlpha = 0.24 + 0.18 * sin(uTime * 1.7 + aPhase);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float soft = smoothstep(0.5, 0.0, dist);
          gl_FragColor = vec4(vColor, soft * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const holiMistPoints = new THREE.Points(holiMistGeo, holiMistShaderMat);
    holiMistPoints.frustumCulled = false;
    scene.add(holiMistPoints);

    // 3B. Physics-Driven Character Controller (@dimforge/rapier3d-compat Capsule + Ride/Stall Colliders)
    const melaPhysics = new MelaPhysicsWorld();

    // 3C. Asset Loader (THREE.LoadingManager + GLTF/Draco + Procedural Mela Rides & Stalls)
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
      scene.add(melaRidesRig.rootGroup);
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

    // 4. Procedural 1024x1024 PBR Materials (`royalCobblestone`, `carvedSandstone`, `ornateSilk`)
    //    Every architectural and ground surface uses Canvas map, bumpMap, and roughnessMap!
    const cobblestonePBRBundle = createPBRMaterial('royalCobblestone', {
      anisotropy: maxAnisotropy,
      repeatX: 26,
      repeatY: 26,
    });
    const outerCobblestonePBRBundle = createPBRMaterial('royalCobblestone', {
      anisotropy: maxAnisotropy,
      repeatX: 64,
      repeatY: 64,
      tintHex: 0x9ca3af,
    });
    const carvedSandstonePBRBundle = createPBRMaterial('carvedSandstone', {
      anisotropy: maxAnisotropy,
      repeatX: 4,
      repeatY: 4,
    });
    const deepSandstonePBRBundle = createPBRMaterial('carvedSandstone', {
      anisotropy: maxAnisotropy,
      repeatX: 3,
      repeatY: 3,
      tintHex: 0xd99b66,
    });
    const ivorySandstonePBRBundle = createPBRMaterial('carvedSandstone', {
      anisotropy: maxAnisotropy,
      repeatX: 2,
      repeatY: 2,
      tintHex: 0xffe4c4,
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
      color: 0xf5b841,
      roughness: 0.15,
      metalness: 0.9,
      bumpMap: carvedSandstonePBRBundle.material.bumpMap,
      bumpScale: 0.015,
      emissive: 0x3b2104,
      emissiveIntensity: 0.08,
    });

    // Ground Floor: Deep Obsidian-Indigo Royal Cobblestone (#14111c to #1f1a2c) with Warm Bronze/Gold Mortar, BumpMap & RoughnessMap
    const outerTerrainGeo = new THREE.PlaneGeometry(240, 240);
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
      cobblestonePBRBundle.material
    );
    courtyardFloor.position.y = 0;
    courtyardFloor.receiveShadow = true;
    scene.add(courtyardFloor);

    const parapetRingGeo = new THREE.TorusGeometry(63.2, 0.38, 10, 84);
    parapetRingGeo.rotateX(Math.PI / 2);
    const parapetMesh = new THREE.Mesh(parapetRingGeo, sandstoneCarvedMat);
    parapetMesh.position.y = 0.2;
    parapetMesh.receiveShadow = true;
    scene.add(parapetMesh);

    // Authentic High-Res (1024x1024) Floor Rangoli Mandala Mapped onto a Flat Circular Plane (y = 0.02, zero intersecting strips)
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
      roughness: 0.65,
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
    //    - Raised Stepped Stone Jagati Platform with Carved Stairs & Brass Diyas on Every Step Corner
    //    - Cusped Mughal/Rajput Scalloped Arches (Mehrab) via THREE.ExtrudeGeometry
    //    - Fluted 12-Sided Columns with Ornate Base/Capital Rings (THREE.LatheGeometry)
    //    - Curved Parabolic Nagara Shikhara Spire (THREE.LatheGeometry) + Ribbed Lata Overlays,
    //      Clustered Urushringas, Grooved Amalaka, Shiny Gold Kalash & Vertex-Waving Saffron Dhwaja Flag
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

      // Glowing Brass Oil Lamp (Diya) on left & right corner of each step
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

    // Side Mehrab arches on East & West faces of Mandap
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

    // 2 Ornate Flanking Rajput Chhatri Pavilions on the Front Mandap Roof Corners (LatheGeometry Domes)
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

    // 5D. Sculpted Curved Parabolic Nagara Shikhara Spire (THREE.LatheGeometry + Ribbed Lata + Urushringas + Amalaka + Gold Kalash + Vertex-Waving Dhwaja)
    const shikharaGroup = new THREE.Group();
    shikharaGroup.position.set(0, 6.68, -1.2);
    mandirGroup.add(shikharaGroup);

    // Parabolic Rekha-Prasada Shikhara Lathe Profile with 9 Stepped Bhumi Molding Recesses
    const shikharaHeight = 9.4;
    const shikharaBaseRadius = 4.35;
    const shikharaLathePoints: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
    const shikharaSteps = 36;
    for (let i = 0; i <= shikharaSteps; i++) {
      const t = i / shikharaSteps;
      const y = t * shikharaHeight;
      // Parabolic Nagara Rekha curve: r(t) = R0 * (1 - 0.72 * t^1.38)
      const parabolicR = shikharaBaseRadius * (1 - 0.72 * Math.pow(t, 1.38));
      // Subtle Bhumi horizontal cornice ribs every 4th step
      const bhumiMod = Math.sin(t * Math.PI * 18) * 0.11;
      shikharaLathePoints.push(new THREE.Vector2(Math.max(0.85, parabolicR + bhumiMod), y));
    }
    shikharaLathePoints.push(new THREE.Vector2(0, shikharaHeight));

    // 8-Sided Cruciform-Faceted Parabolic Shikhara Core + Smooth Parabolic Inner Rib Spire
    const mainShikharaGeo = new THREE.LatheGeometry(shikharaLathePoints, 8);
    mainShikharaGeo.rotateY(Math.PI / 8);
    const mainShikharaMesh = new THREE.Mesh(mainShikharaGeo, sandstoneCarvedMat);
    mainShikharaMesh.castShadow = true;
    mainShikharaMesh.receiveShadow = true;
    shikharaGroup.add(mainShikharaMesh);

    // 4 Parabolic Ribbed Vertical Lata Spine Overlays ascending the 4 Cardinal Ratha Faces
    const lataRibPoints: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const y = t * (shikharaHeight - 0.3);
      const r = (shikharaBaseRadius + 0.25) * (1 - 0.74 * Math.pow(t, 1.38));
      lataRibPoints.push(new THREE.Vector2(r, y));
    }
    const lataRibGeo = new THREE.LatheGeometry(lataRibPoints, 4);
    const lataRibMesh = new THREE.Mesh(lataRibGeo, whiteMarbleMat);
    lataRibMesh.scale.set(1.04, 1.0, 0.34);
    shikharaGroup.add(lataRibMesh);

    const lataRibMeshZ = new THREE.Mesh(lataRibGeo, whiteMarbleMat);
    lataRibMeshZ.scale.set(0.34, 1.0, 1.04);
    shikharaGroup.add(lataRibMeshZ);

    // 8 Clustered Subsidiary Parabolic Spires (Urushringas & Corner Anga-Shikharas) via THREE.LatheGeometry
    const urushringaPoints = shikharaLathePoints.map(
      (pt) => new THREE.Vector2(pt.x * 0.38, pt.y * 0.56)
    );
    const urushringaGeo = new THREE.LatheGeometry(urushringaPoints, 8);
    urushringaGeo.rotateY(Math.PI / 8);

    const uruAmalakaGeo = new THREE.TorusGeometry(0.46, 0.13, 10, 18);
    uruAmalakaGeo.rotateX(Math.PI / 2);
    const uruKalashGeo = new THREE.ConeGeometry(0.24, 0.72, 12);

    const urushringaPositions = [
      { x: -3.35, z: 0, scale: 1.0 },
      { x: 3.35, z: 0, scale: 1.0 },
      { x: 0, z: 3.35, scale: 1.0 },
      { x: 0, z: -3.35, scale: 1.0 },
      { x: -2.55, z: 2.55, scale: 0.78 },
      { x: 2.55, z: 2.55, scale: 0.78 },
      { x: -2.55, z: -2.55, scale: 0.78 },
      { x: 2.55, z: -2.55, scale: 0.78 },
    ];
    urushringaPositions.forEach((uSpec) => {
      const uruGroup = new THREE.Group();
      uruGroup.position.set(uSpec.x, 0, uSpec.z);
      uruGroup.scale.setScalar(uSpec.scale);

      const spire = new THREE.Mesh(urushringaGeo, sandstoneDeepMat);
      spire.castShadow = true;
      uruGroup.add(spire);

      const miniAmalaka = new THREE.Mesh(uruAmalakaGeo, whiteMarbleMat);
      miniAmalaka.position.y = 5.32;
      uruGroup.add(miniAmalaka);

      const miniKalash = new THREE.Mesh(uruKalashGeo, brassTrimMat);
      miniKalash.position.y = 5.78;
      uruGroup.add(miniKalash);

      shikharaGroup.add(uruGroup);
    });

    // Detailed Grooved Circular Stone Amalaka Crown at Summit (LatheGeometry + 16 Radial Flutes)
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
    const amalakaCrown = new THREE.Mesh(amalakaGeo, whiteMarbleMat);
    amalakaCrown.castShadow = true;
    shikharaGroup.add(amalakaCrown);

    const fluteRibGeo = new THREE.BoxGeometry(0.18, 0.56, 3.85);
    for (let f = 0; f < 8; f++) {
      const flute = new THREE.Mesh(fluteRibGeo, sandstoneDeepMat);
      flute.position.y = 9.62;
      flute.rotation.y = (f / 8) * Math.PI;
      shikharaGroup.add(flute);
    }

    // Shiny Metallic Gold Kalash Finial (`LatheGeometry`, metalness: 0.9, roughness: 0.15)
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
    const kalashFinialMesh = new THREE.Mesh(kalashLatheGeo, brassTrimMat);
    kalashFinialMesh.castShadow = true;
    shikharaGroup.add(kalashFinialMesh);

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
    // Taper right edge into a traditional triangular Hindu temple Dhwaja pennant
    const dhwajaPosAttr = dhwajaGeo.attributes.position;
    const dhwajaBaseY = new Float32Array(dhwajaPosAttr.count);
    const dhwajaBaseX = new Float32Array(dhwajaPosAttr.count);
    for (let v = 0; v < dhwajaPosAttr.count; v++) {
      const vx = dhwajaPosAttr.getX(v) + 1.3; // Shift [0 .. 2.6] from flagpole
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
    // 6. OPEN ROYAL BAZAAR PAVILIONS ON WEST COURTYARD EDGE
    //    (Using LatheGeometry Pillars, ExtrudeGeometry Mehrab Eaves & ornateSilk Canopies)
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

      // Stacked brass pots on counter
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
        new THREE.CylinderGeometry(0.14, 0.1, 0.32, 8),
        stepDiyaFlameMat
      );
      lantern.position.set(0, 3.15, 0.25);
      pav.add(lantern);

      scene.add(pav);
    };

    buildOpenCourtyardPavilion(
      -21.5,
      -7.5,
      Math.PI / 2.5,
      silkCrimsonBundle.material
    );
    buildOpenCourtyardPavilion(
      -21.5,
      7.5,
      Math.PI / 1.75,
      silkEmeraldBundle.material
    );

    // 6B. Overhead Festive Toran Bunting Garlands (64 Instanced Pennant Flags anchored strictly between Temple & West Bazaar Pillars)
    const buntingCount = 64;
    const buntingGeo = new THREE.ConeGeometry(0.22, 0.48, 4);
    buntingGeo.rotateX(Math.PI);
    const buntingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.15,
    });
    const instancedBunting = new THREE.InstancedMesh(
      buntingGeo,
      buntingMat,
      buntingCount
    );
    const buntingColors = [0xf43f5e, 0xf5b841, 0x38bdf8, 0x10b981, 0xa855f7];
    const spanEndpoints = [
      { ax: -7.5, az: -15.5, bx: 7.5, bz: -15.5 },
      { ax: -19.5, az: -7.5, bx: -7.6, bz: -15.5 },
      { ax: -19.5, az: 6.0, bx: -19.5, bz: -6.0 },
      { ax: -7.5, az: -15.5, bx: -7.5, bz: -24.5 },
    ];
    for (let i = 0; i < buntingCount; i++) {
      const span = spanEndpoints[Math.floor(i / 16)];
      const t = (i % 16) / 15;
      const bx = THREE.MathUtils.lerp(span.ax, span.bx, t);
      const bz = THREE.MathUtils.lerp(span.az, span.bz, t);
      const sag = Math.sin(t * Math.PI) * 0.48;
      const by = 5.45 - sag;

      _dummyObj.position.set(bx, by, bz);
      _dummyObj.rotation.set(0, Math.atan2(span.bx - span.ax, span.bz - span.az), 0);
      _dummyObj.scale.setScalar(1);
      _dummyObj.updateMatrix();
      instancedBunting.setMatrixAt(i, _dummyObj.matrix);

      _dummyColor.setHex(buntingColors[i % buntingColors.length]);
      instancedBunting.setColorAt(i, _dummyColor);
    }
    instancedBunting.instanceMatrix.needsUpdate = true;
    if (instancedBunting.instanceColor) {
      instancedBunting.instanceColor.needsUpdate = true;
    }
    scene.add(instancedBunting);

    // =========================================================================
    // 7. ILLUMINATED BANYAN & KADAMBA FESTIVAL TREES (Zero Colored Balls!)
    //    - Organic Multi-Branched Trunks (LatheGeometry Flared Trunk + Spreading Boughs + Aerial Roots)
    //    - Dark Lush Night-Foliage Canopies (#132a26 & #1d3b32) with Leaf Bump/Roughness & Golden Rim-Lighting
    //    - Vertical Curtains of Glowing Golden Fairy Lights & Hanging Lanterns Drooping from Branches
    // =========================================================================
    const treeCount = 28;
    const trunkLathePoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.82, 0.0),
      new THREE.Vector2(0.58, 0.65),
      new THREE.Vector2(0.44, 1.85),
      new THREE.Vector2(0.38, 3.2),
      new THREE.Vector2(0.56, 4.1),
      new THREE.Vector2(0.0, 4.2),
    ];
    const trunkGeo = new THREE.LatheGeometry(trunkLathePoints, 9);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2415,
      bumpMap: carvedSandstonePBRBundle.material.bumpMap,
      bumpScale: 0.04,
      roughness: 0.88,
      metalness: 0.04,
    });
    const banyanBranchGeo = new THREE.CylinderGeometry(0.11, 0.24, 3.1, 7);

    // Sculpted Organic Banyan/Kadamba Crown Geometry (flattened layered foliage dome with vertex organic displacement)
    const canopyClusterGeo = new THREE.DodecahedronGeometry(2.45, 2);
    const cPos = canopyClusterGeo.attributes.position;
    for (let v = 0; v < cPos.count; v++) {
      const vx = cPos.getX(v);
      const vy = cPos.getY(v);
      const vz = cPos.getZ(v);
      const ripple =
        1.0 +
        0.14 * Math.sin(vx * 2.3 + vz * 1.9) +
        0.08 * Math.cos(vy * 3.1);
      cPos.setXYZ(v, vx * ripple * 1.35, vy * ripple * 0.56, vz * ripple * 1.32);
    }
    canopyClusterGeo.computeVertexNormals();

    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      bumpMap: cobblestonePBRBundle.material.bumpMap,
      bumpScale: 0.045,
      roughness: 0.72,
      metalness: 0.08,
      emissive: 0x241905,
      emissiveIntensity: 0.11, // Warm golden under-canopy rim glow
    });

    const instancedTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const instancedBanyanRoots = new THREE.InstancedMesh(
      banyanBranchGeo,
      trunkMat,
      treeCount * 3
    );
    const instancedCanopies = new THREE.InstancedMesh(
      canopyClusterGeo,
      canopyMat,
      treeCount * 3
    );

    // Vertical Curtains of Glowing Golden Fairy Lights & Hanging Lanterns under Tree Boughs
    const FAIRY_STRANDS_PER_TREE = 8;
    const fairyCurtainGeo = new THREE.CylinderGeometry(0.068, 0.068, 2.75, 8);
    const fairyCurtainMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.55,
      roughness: 0.18,
    });
    const instancedTreeFairyCurtains = new THREE.InstancedMesh(
      fairyCurtainGeo,
      fairyCurtainMat,
      treeCount * FAIRY_STRANDS_PER_TREE
    );
    const treeLanternGeo = new THREE.OctahedronGeometry(0.24, 1);
    const instancedTreeLanterns = new THREE.InstancedMesh(
      treeLanternGeo,
      fairyCurtainMat,
      treeCount * 2
    );

    // Strictly dark lush night-foliage canopy palette (#132a26 & #1d3b32)
    const nightFoliagePalette = [0x132a26, 0x1d3b32, 0x16332b];

    // 6 Scenic Midground Sacred Kadamba/Banyan Framing Trees + 22 Outer Grove Trees
    const scenicFramingTrees = [
      { x: -16.5, z: -26.5, scale: 1.18 },
      { x: 16.5, z: -26.5, scale: 1.22 },
      { x: -28.5, z: -16.5, scale: 1.12 },
      { x: 24.5, z: -26.5, scale: 1.15 },
      { x: -26.5, z: -32.5, scale: 1.14 },
      { x: 9.5, z: -32.5, scale: 1.16 },
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
        angle = (ringIdx / ringTotal) * Math.PI * 2;
        const rad = 46 + (ringIdx % 3) * 4.0;
        tx = Math.cos(angle) * rad;
        tz = Math.sin(angle) * rad;
        scale = 0.96 + ((i * 19) % 32) / 100;
      }

      // Main Gnarled Banyan/Kadamba Trunk
      _dummyObj.position.set(tx, 0, tz);
      _dummyObj.rotation.set(0.03, i * 0.7, -0.02);
      _dummyObj.scale.setScalar(scale);
      _dummyObj.updateMatrix();
      instancedTrunks.setMatrixAt(i, _dummyObj.matrix);

      // 3 Spreading Multi-Branched Boughs & Aerial Banyan Roots
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

      // 3 Layered Night-Foliage Bough Canopies (#132a26 & #1d3b32)
      const layerOffsets = [
        { ox: -0.85, oy: 4.1, oz: 0.55, sx: 1.25, sy: 0.85, sz: 1.2 },
        { ox: 0.9, oy: 4.65, oz: -0.6, sx: 1.15, sy: 0.88, sz: 1.15 },
        { ox: 0.0, oy: 5.35, oz: 0.0, sx: 0.95, sy: 0.82, sz: 0.95 },
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
        instancedCanopies.setMatrixAt(i * 3 + lIdx, _dummyObj.matrix);
        _dummyColor.setHex(
          nightFoliagePalette[(i + lIdx) % nightFoliagePalette.length]
        );
        instancedCanopies.setColorAt(i * 3 + lIdx, _dummyColor);
      });

      // 8 Vertical Curtains of Glowing Golden Fairy Lights drooping from the tree canopy
      for (let f = 0; f < FAIRY_STRANDS_PER_TREE; f++) {
        const fAngle = (f / FAIRY_STRANDS_PER_TREE) * Math.PI * 2 + i * 0.5;
        const fRad = (1.45 + (f % 2) * 0.65) * scale;
        _dummyObj.position.set(
          tx + Math.cos(fAngle) * fRad,
          (2.55 + (f % 2) * 0.25) * scale,
          tz + Math.sin(fAngle) * fRad
        );
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.set(1, (0.78 + (f % 3) * 0.16) * scale, 1);
        _dummyObj.updateMatrix();
        instancedTreeFairyCurtains.setMatrixAt(
          i * FAIRY_STRANDS_PER_TREE + f,
          _dummyObj.matrix
        );
      }

      // 2 Hanging Golden Lanterns under the main boughs
      for (let l = 0; l < 2; l++) {
        const lAngle = angle + (l === 0 ? 0.8 : -0.8);
        _dummyObj.position.set(
          tx + Math.cos(lAngle) * 1.85 * scale,
          2.1 * scale,
          tz + Math.sin(lAngle) * 1.85 * scale
        );
        _dummyObj.rotation.set(0, i + l, 0);
        _dummyObj.scale.setScalar(scale);
        _dummyObj.updateMatrix();
        instancedTreeLanterns.setMatrixAt(i * 2 + l, _dummyObj.matrix);
      }
    }
    instancedTrunks.instanceMatrix.needsUpdate = true;
    instancedBanyanRoots.instanceMatrix.needsUpdate = true;
    instancedCanopies.instanceMatrix.needsUpdate = true;
    instancedTreeFairyCurtains.instanceMatrix.needsUpdate = true;
    instancedTreeLanterns.instanceMatrix.needsUpdate = true;
    if (instancedCanopies.instanceColor) {
      instancedCanopies.instanceColor.needsUpdate = true;
    }
    instancedTrunks.computeBoundingSphere();
    instancedBanyanRoots.computeBoundingSphere();
    instancedCanopies.computeBoundingSphere();
    instancedTreeFairyCurtains.computeBoundingSphere();
    instancedTreeLanterns.computeBoundingSphere();
    scene.add(
      instancedTrunks,
      instancedBanyanRoots,
      instancedCanopies,
      instancedTreeFairyCurtains,
      instancedTreeLanterns
    );

    // 7B. WORLD 01 (HOLI — BRAJ): 4 Ornate Carved Brass Urli Color Basins Flanking Temple Steps (Zero Flat Floor Pads!)
    const holiWorldGroup = new THREE.Group();
    scene.add(holiWorldGroup);

    const colorVatConfigs = [
      { id: 'vat_gulabi', x: -9.6, z: -14.5, colorHex: 0xf43f5e, label: 'Gulabi Rose Urli' },
      { id: 'vat_haldi', x: 9.6, z: -14.5, colorHex: 0xf59e0b, label: 'Haldi Marigold Urli' },
      { id: 'vat_neel', x: -11.5, z: -6.5, colorHex: 0x38bdf8, label: 'Neel Indigo Urli' },
      { id: 'vat_panna', x: 11.5, z: -6.5, colorHex: 0x10b981, label: 'Panna Emerald Urli' },
    ];
    const urliLathePoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.45, 0.0),
      new THREE.Vector2(0.32, 0.35),
      new THREE.Vector2(0.78, 0.68),
      new THREE.Vector2(0.86, 0.85),
      new THREE.Vector2(0.68, 0.88),
      new THREE.Vector2(0.0, 0.55),
    ];
    const vatOuterGeo = new THREE.LatheGeometry(urliLathePoints, 18);
    const vatPowderGeo = new THREE.ConeGeometry(0.65, 0.38, 16);
    const colorVatNodes = colorVatConfigs.map((vCfg) => {
      const vatGroup = new THREE.Group();
      vatGroup.position.set(vCfg.x, 0, vCfg.z);
      const basin = new THREE.Mesh(vatOuterGeo, brassTrimMat);
      basin.castShadow = true;
      vatGroup.add(basin);

      const powderCone = new THREE.Mesh(
        vatPowderGeo,
        new THREE.MeshStandardMaterial({
          color: vCfg.colorHex,
          roughness: 0.78,
          metalness: 0.05,
          emissive: vCfg.colorHex,
          emissiveIntensity: 0.18,
        })
      );
      powderCone.position.y = 0.82;
      vatGroup.add(powderCone);
      holiWorldGroup.add(vatGroup);
      return { ...vCfg, group: vatGroup };
    });

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
          roughness: 0.8,
          metalness: 0.02,
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

    // 7C. WORLD 02 (DIWALI — GHAT): Stepped Sandstone Ghat, Custom Reflective Animated Water Shader Plane & Floating River Diyas
    const diwaliGhatGroup = new THREE.Group();
    scene.add(diwaliGhatGroup);

    // 5 Stepped Sandstone Ghat Tiers curving along the East/Front Temple Promenade (prominently visible in both orbital preview & gameplay!)
    for (let st = 0; st < 5; st++) {
      const ghatStep = new THREE.Mesh(
        new THREE.BoxGeometry(34, 0.28, 0.95),
        st % 2 === 0 ? sandstoneCarvedMat : sandstoneDeepMat
      );
      ghatStep.position.set(7.5, 0.68 - st * 0.12, 4.8 + st * 0.78);
      ghatStep.receiveShadow = true;
      diwaliGhatGroup.add(ghatStep);
    }

    // Reflective Animated Water Shader Plane at the bottom of the Ghat steps (mirrors flickering diyas & fireworks)
    const waterBorderCurb = new THREE.Mesh(
      new THREE.BoxGeometry(36.8, 0.18, 15.8),
      sandstoneDeepMat
    );
    waterBorderCurb.position.set(8.5, 0.05, 15.2);
    diwaliGhatGroup.add(waterBorderCurb);

    const waterGeo = new THREE.PlaneGeometry(36, 15, 64, 32);
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
          float wave = sin(pos.x * 0.45 + uTime * 2.1) * 0.018 + cos(pos.z * 0.65 + uTime * 1.7) * 0.014;
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
          vec3 deepRiver = vec3(0.03, 0.07, 0.16);
          vec3 moonSpec = vec3(0.28, 0.38, 0.72);
          float ripple1 = sin(vWorldPos.x * 2.2 + uTime * 3.2) * cos(vWorldPos.z * 2.8 - uTime * 2.5);
          float ripple2 = sin(vWorldPos.x * 3.6 - uTime * 2.4 + vWorldPos.z * 2.3);
          float shimmer = smoothstep(0.25, 0.95, (ripple1 + ripple2) * 0.5 + 0.5);

          // Mirrored golden columns from Temple & Floating Diyas
          float templeReflection = exp(-abs(vWorldPos.x - 2.0) * 0.065) * (0.48 + 0.52 * shimmer);
          vec3 diyaGold = vec3(1.0, 0.66, 0.18) * templeReflection * 0.88;
          vec3 fireworkReflection = vec3(0.95, 0.25, 0.48) * smoothstep(0.68, 1.0, sin(vWorldPos.x * 0.45 + uTime * 1.8)) * shimmer * 0.38;

          vec3 col = mix(deepRiver, moonSpec, shimmer * 0.32) + diyaGold + fireworkReflection;
          gl_FragColor = vec4(col, 0.96);
        }
      `,
      transparent: true,
    });
    const diwaliWaterMesh = new THREE.Mesh(waterGeo, diwaliWaterShaderMat);
    diwaliWaterMesh.position.set(8.5, 0.16, 15.2);
    diwaliGhatGroup.add(diwaliWaterMesh);

    // 24 Floating River Diyas on the Water Surface
    const riverDiyaBowlGeo = stepDiyaBowlGeo;
    const riverDiyaFlameGeo = new THREE.ConeGeometry(0.14, 0.38, 8);
    const riverDiyaFlameMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.5,
      roughness: 0.2,
    });
    const floatingRiverDiyas: {
      group: THREE.Group;
      baseX: number;
      baseZ: number;
      phase: number;
    }[] = [];
    for (let rd = 0; rd < 24; rd++) {
      const rdGroup = new THREE.Group();
      const bowl = new THREE.Mesh(riverDiyaBowlGeo, brassTrimMat);
      bowl.scale.setScalar(1.35);
      const flame = new THREE.Mesh(riverDiyaFlameGeo, riverDiyaFlameMat);
      flame.position.y = 0.24;
      rdGroup.add(bowl, flame);
      const bx = -5 + (rd % 8) * 3.8 + (rd >= 8 ? 1.2 : 0);
      const bz = 9.2 + Math.floor(rd / 8) * 2.8 + (rd % 3) * 0.6;
      rdGroup.position.set(bx, 0.2, bz);
      diwaliGhatGroup.add(rdGroup);
      floatingRiverDiyas.push({
        group: rdGroup,
        baseX: bx,
        baseZ: bz,
        phase: rd * 0.85,
      });
    }

    // 7D. MELA CENTRAL HUB: 2 Glowing 3D World Portals in Meena Bazaar Zone & Interactive Stamped Floor Rangolis ([G])
    const melaPortalsGroup = new THREE.Group();
    scene.add(melaPortalsGroup);

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
      // Burst of marigold & rose petals
      spawnParticleBurst(rx, 0.5, rz, 0xfbbf24, 18, 5.5);
      spawnParticleBurst(rx, 0.65, rz, 0xf43f5e, 10, 4.5);
    };

    // 8. Decorative Sky Kites Positioned over Carnival Ride Grounds (x: 38, z: -25) so Temple Silhouette stays Unobstructed
    const skyDecorGroup = new THREE.Group();
    scene.add(skyDecorGroup);

    const kiteMeshes: { mesh: THREE.Group; basePos: THREE.Vector3; phase: number }[] = [];
    const kiteColors = [0xf43f5e, 0xf59e0b, 0x38bdf8, 0x10b981, 0xa855f7];
    for (let k = 0; k < 14; k++) {
      const kGroup = new THREE.Group();
      const diamondGeo = new THREE.OctahedronGeometry(0.95, 0);
      diamondGeo.scale(1, 1.25, 0.08);
      const kMat = new THREE.MeshStandardMaterial({
        color: kiteColors[k % kiteColors.length],
        emissive: kiteColors[k % kiteColors.length],
        emissiveIntensity: 0.22,
        roughness: 0.55,
      });
      const diamond = new THREE.Mesh(diamondGeo, kMat);
      const tailGeo = new THREE.ConeGeometry(0.32, 0.65, 4);
      const tail = new THREE.Mesh(tailGeo, brassTrimMat);
      tail.position.y = -1.15;
      kGroup.add(diamond, tail);

      const angle = (k / 14) * Math.PI * 2;
      const dist = 10 + (k % 3) * 5;
      const basePos = new THREE.Vector3(
        38 + Math.cos(angle) * dist,
        14 + (k % 4) * 2.5,
        -25 + Math.sin(angle) * dist
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

    // 3D Pichkari Water-Stream Jet (visualizes nozzle spray toward locked direction)
    const streamBeamGeo = new THREE.CylinderGeometry(0.08, 0.14, 1, 10);
    streamBeamGeo.rotateX(Math.PI / 2);
    const streamBeamMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.78,
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

    // 13. Zero-GC Pooled Particle Ring Buffer + Homing Gulal Projectiles + 3D Enemy Lobbed Balloons
    const MAX_PARTICLES = 220;
    const particleGeo = new THREE.DodecahedronGeometry(0.2, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
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
      _dummyColor.setHex(0xf43f5e);
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

    // Pooled Player Homing Gulal Projectiles (28 reusable meshes)
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
      damage: number;
      mesh: THREE.Mesh;
    }
    const projGeo = new THREE.SphereGeometry(0.28, 10, 10);
    const projectiles: GulalProjectile[] = Array.from(
      { length: MAX_PROJECTILES },
      () => {
        const m = new THREE.Mesh(
          projGeo,
          new THREE.MeshBasicMaterial({ color: 0xf43f5e })
        );
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
          damage: 35,
          mesh: m,
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

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, entry.contentRect.width);
        const h = Math.max(1, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
        bloomPass.resolution.set(w, h);
      }
    });
    resizeObserver.observe(container);

    // 15. Simulation State Variables (Tactile 3-Wave Combat + 6 Unlit Diyas + Grand Mela Rides & Stalls)
    let playerX = 0;
    let playerY = 0;
    let playerZ = 6.5;
    let playerVy = 0;
    let playerYaw = Math.PI;
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
        lastHudEmitTime = 0;
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
        lastHudEmitTime = 0;
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
        for (const fd of floatingRiverDiyas) {
          spawnParticleBurst(
            fd.group.position.x,
            0.6,
            fd.group.position.z,
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
          slot.damage = gulalSpec.damage;
          (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(
            gulalSpec.threeHex
          );
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
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (isUnmounted) return;
      const now = performance.now();
      const rawDt = Math.max(0.001, (now - lastFrameTime) / 1000);
      lastFrameTime = now;
      const dt = clampDelta(rawDt);
      elapsedTotal += dt;
      smoothedFps = THREE.MathUtils.damp(
        smoothedFps,
        Math.min(120, 1 / rawDt),
        4,
        dt
      );

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
      holiWorldGroup.visible = currentProps.activeWorld === 'holi_braj';
      holiMistPoints.visible = currentProps.activeWorld === 'holi_braj';
      diwaliGhatGroup.visible = currentProps.activeWorld === 'diwali_ghat';
      melaPortalsGroup.visible = true;
      worldPortalNodes.forEach((p) => {
        p.group.visible = currentProps.activeWorld === 'mela_central';
        p.arch.rotation.z = elapsedTotal * 1.4;
      });

      // Step GPU Particle Uniforms (800 Golden Fireflies + 750 Swirling Holi Gulal Mist Particles)
      fireflyShaderMat.uniforms.uTime.value = elapsedTotal;
      holiMistShaderMat.uniforms.uTime.value = elapsedTotal;

      // Animate Diwali Ghat reflective water shader & floating river diyas
      if (currentProps.activeWorld === 'diwali_ghat') {
        diwaliWaterShaderMat.uniforms.uTime.value = elapsedTotal;
        floatingRiverDiyas.forEach((fd, idx) => {
          fd.group.position.x =
            fd.baseX + Math.sin(elapsedTotal * 0.55 + fd.phase) * 1.6;
          fd.group.position.z =
            fd.baseZ + Math.cos(elapsedTotal * 0.45 + idx) * 0.65;
          fd.group.position.y =
            0.21 + Math.sin(elapsedTotal * 2.4 + fd.phase) * 0.025;
        });
      }

      // Animate Holi Courtyard Color Urli Basins
      if (currentProps.activeWorld === 'holi_braj') {
        colorVatNodes.forEach((v, idx) => {
          v.group.rotation.y = elapsedTotal * 0.45 + idx;
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
          lastHudEmitTime = 0;
        }
      }

      // Animate Grand Mela Rides (Giant Wheel, Carousel, Columbus Swinging Boat & 15 Moving Booth Balloons)
      melaRidesRig?.updateKinematics(elapsedTotal);

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

      // Update Player 3D Attire & Equipped Lotus Shield Skin
      playerModel.kurtaMat.color.set(currentProps.attire.kurtaHex);
      playerModel.dhotiMat.color
        .set(currentProps.attire.dhotiHex)
        .lerp(new THREE.Color(0x7c3f1d), 0.72);
      playerModel.pagdiMat.color.set(currentProps.attire.pagdiHex);
      playerModel.skinMat.color.set(currentProps.attire.skinHex);

      const activeShieldSkin =
        LOTUS_SHIELD_SKINS.find(
          (s) => s.id === currentProps.equippedShieldSkin
        ) ?? LOTUS_SHIELD_SKINS[0];
      shieldDomeMat.color.set(activeShieldSkin.domeHex);
      shieldDomeMat.emissive.set(activeShieldSkin.domeHex);
      shieldRimMat.color.set(activeShieldSkin.rimHex);
      shieldRimMat.emissive.set(activeShieldSkin.rimHex);

      // Luminous night-time atmosphere per world (FogExp2 #080512, 0.0085)
      const targetSkyHex =
        currentProps.activeWorld === 'diwali_ghat'
          ? 0x060410
          : currentProps.activeWorld === 'mela_central'
          ? 0x080512
          : 0x0c0618;
      _dummyColor.setHex(targetSkyHex);
      (scene.background as THREE.Color).lerp(_dummyColor, 1 - Math.exp(-3 * dt));
      (scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color);

      // Keep diamond kites ONLY in World 01: Holi — Braj
      skyDecorGroup.visible = currentProps.activeWorld === 'holi_braj';

      const isMenuPreview = currentProps.gameState === 'title';

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

      for (let s = 0; s < STAR_COUNT; s++) {
        const sb = starBasePositions[s];
        const twinkle =
          sb.baseScale * (0.72 + Math.sin(elapsedTotal * 2.6 + sb.phase) * 0.28);
        _dummyObj.position.set(sb.x, sb.y, sb.z);
        _dummyObj.scale.setScalar(twinkle);
        _dummyObj.updateMatrix();
        starInstanced.setMatrixAt(s, _dummyObj.matrix);
      }
      starInstanced.instanceMatrix.needsUpdate = true;

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

      if (skyDecorGroup.visible) {
        kiteMeshes.forEach((k) => {
          k.mesh.position.y =
            k.basePos.y + Math.sin(elapsedTotal * 1.8 + k.phase) * 0.65;
          k.mesh.rotation.z = Math.sin(elapsedTotal * 2.2 + k.phase) * 0.22;
        });
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
        pVy[i] -= 9.2 * dt;
        pX[i] += pVx[i] * dt;
        pY[i] = Math.max(0.05, pY[i] + pVy[i] * dt);
        pZ[i] += pVz[i] * dt;
        const lifeRatio = pLife[i] / pMaxLife[i];
        _dummyObj.position.set(pX[i], pY[i], pZ[i]);
        _dummyObj.scale.setScalar(pScale[i] * lifeRatio);
        _dummyObj.rotation.set(elapsedTotal * 3, i, 0);
        _dummyObj.updateMatrix();
        particleInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      if (anyParticleUpdated) {
        particleInstanced.instanceMatrix.needsUpdate = true;
      }

      // STATE 1: CINEMATIC LANDING MENU ORBITAL PREVIEW (`gameState === 'title'`)
      // Dramatic low-angle three-quarter perspective (`position: [32, 11, 38]`, looking at `[6, 6, -4]`)
      // so the MELAVERSE typography sits over clean dark space on the left while the Temple, Rangoli & Giant Wheel shine on the right
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

        const orbitBreath = Math.sin(elapsedTotal * 0.22);
        const orbitSway = Math.cos(elapsedTotal * 0.18);
        _camTargetPos.set(
          32 + orbitBreath * 2.2,
          11 + orbitSway * 0.45,
          38 + orbitSway * 1.8
        );
        _camLookAt.set(
          6 + orbitBreath * 0.6,
          6,
          -4
        );
        camera.up.set(0, 1, 0);
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-4.5 * dt));
        camera.lookAt(_camLookAt);
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

          const isSprinting =
            keysHeld.has('ShiftLeft') ||
            keysHeld.has('ShiftRight') ||
            currentProps.mobileMoveVec.sprinting;
          const speedBoost =
            (petalAuraTimer > 0 ? 1.25 : 1.0) *
            karmaStep.speedMultiplier *
            currentProps.foodBoostMultiplier *
            (isSprinting ? 1.28 : 1.0);
          const baseSpeed = 8.8 * speedBoost;
          let stepVx = moveX * baseSpeed;
          let stepVz = moveZ * baseSpeed;

          if (dashActiveTimer > 0) {
            dashActiveTimer = Math.max(0, dashActiveTimer - simDt);
            stepVx = dashDirX * 20.0 * karmaStep.speedMultiplier;
            stepVz = dashDirZ * 20.0 * karmaStep.speedMultiplier;
            // Marigold & Gulal petal trail during directional Dash
            spawnParticleBurst(playerX, 0.35, playerZ, trailHexInt, 2, 3.2);
          }

          const wantsJump = jumpBufferTimer > 0 && coyoteTimer > 0;
          if (wantsJump) {
            jumpBufferTimer = 0;
            melaverseAudio.playDashOrJump();
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

          scaleSquashX = THREE.MathUtils.damp(scaleSquashX, 1, 12, simDt);
          scaleSquashY = THREE.MathUtils.damp(scaleSquashY, 1, 12, simDt);
          playerModel.bodyGroup.scale.set(
            scaleSquashX,
            scaleSquashY,
            scaleSquashX
          );
          playerModel.root.position.set(playerX, playerY, playerZ);
          playerModel.root.rotation.y = playerYaw;

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
            proj.mesh.position.set(proj.x, proj.y, proj.z);

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

        // Camera System:
        // 1) Mounted Ride 1st-Person Cabin Perspective (with 360° look-around)
        // 2) 1st-Person Player Perspective (`[V]` toggle)
        // 3) 3rd-Person Follow Camera + Harmonic & Directional Combat Screen-Shake
        const shakeStep = stepScreenShake(screenShakeState, dt);
        screenShakeState = shakeStep.state;

        if (currentProps.mountedRide) {
          playerModel.root.visible = false;
          compassGroup.visible = false;
          const cabinPose = computeRideCabinCameraPose(
            currentProps.mountedRide,
            elapsedTotal,
            rideLookYawOffset,
            rideLookPitchOffset
          );
          _camTargetPos.set(cabinPose.camX, cabinPose.camY, cabinPose.camZ);
          camera.position.lerp(_camTargetPos, 1 - Math.exp(-12 * dt));
          camera.up.set(0, 1, 0);
          _camLookAt.set(cabinPose.lookX, cabinPose.lookY, cabinPose.lookZ);
          camera.lookAt(_camLookAt);
          if (cabinPose.swingAngleRad !== 0) {
            camera.rotateZ(cabinPose.swingAngleRad * 0.22);
          }
        } else if (currentProps.cameraMode === 'first_person') {
          playerModel.root.visible = false;
          compassGroup.visible = true;
          const eyeX =
            playerX + Math.sin(playerYaw) * 0.25 + shakeStep.offsetX * 0.4;
          const eyeY = playerY + 1.65 + shakeStep.offsetY * 0.4;
          const eyeZ =
            playerZ + Math.cos(playerYaw) * 0.25 + shakeStep.offsetZ * 0.4;
          camera.position.set(eyeX, eyeY, eyeZ);
          camera.up.set(0, 1, 0);
          _camLookAt.set(
            eyeX + Math.sin(playerYaw) * 10,
            eyeY - 0.35,
            eyeZ + Math.cos(playerYaw) * 10
          );
          camera.lookAt(_camLookAt);
          if (shakeStep.rollRad !== 0) {
            camera.rotateZ(shakeStep.rollRad * 0.6);
          }
        } else {
          playerModel.root.visible = true;
          compassGroup.visible = true;
          const desiredCamX = playerX * 0.72 + shakeStep.offsetX * 0.65;
          const desiredCamY = 7.4 + shakeStep.offsetY * 0.65;
          const desiredCamZ = playerZ + 11.2 + shakeStep.offsetZ * 0.65;
          _camTargetPos.set(desiredCamX, desiredCamY, desiredCamZ);
          camera.position.lerp(_camTargetPos, 1 - Math.exp(-7.5 * dt));
          camera.position.x += shakeStep.offsetX * 0.35;
          camera.position.y += shakeStep.offsetY * 0.35;

          camera.up.set(0, 1, 0);
          _camLookAt.set(
            playerX + shakeStep.offsetX,
            playerY + 1.45 + shakeStep.offsetY,
            playerZ - 2.6 + shakeStep.offsetZ * 0.5
          );
          camera.lookAt(_camLookAt);
          if (shakeStep.rollRad !== 0) {
            camera.rotateZ(shakeStep.rollRad);
          }
        }

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

        if (now - lastHudEmitTime >= 100 || roundEnded) {
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
            playerX,
            playerZ,
            playerYaw,
            fps: Math.round(smoothedFps),
            crowdPositions: crowdVisitors
              .slice(0, Math.min(18, activeCrowdCount))
              .map((v) => ({ x: v.x, z: v.z })),
          });
        }
      }

      keysJustPressed.clear();
      pointerJustClicked = false;
      rightClickParryJustPressed = false;

      if (!isSoftwareGl && bloomPass.enabled) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

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
      carvedSandstonePBRBundle.dispose();
      fireflyGeo.dispose();
      fireflyShaderMat.dispose();
      holiMistGeo.dispose();
      holiMistShaderMat.dispose();
      diwaliWaterShaderMat.dispose();
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

