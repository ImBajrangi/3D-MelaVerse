import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
} from './rules';
import {
  COURT_NPCS,
  RANGOLI_PIGMENTS,
  type CharacterAttirePreset,
  type NpcCharacter,
} from './worldData';
import { melaverseAudio } from './audio';

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
  cooldownPct: number;
  dashCooldownPct: number;
  shieldCooldownPct: number;
  shieldActive: boolean;
  nearbyPrompt: {
    type: 'npc' | 'diya' | 'portal';
    label: string;
    targetId: string;
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
}

interface MelaverseCanvasProps {
  gameState: GameState;
  activeWorld: FestivalWorldId;
  selectedGulal: GulalColorId;
  selectedArsenal: ArsenalModeId;
  attire: CharacterAttirePreset;
  rangoliGrid: number[][];
  resetCounter: number;
  fireworksCount: number;
  shieldTriggerCount: number;
  fireTriggerCount: number;
  karmaOfferingCount: number;
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
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8A422D';
  ctx.fillRect(0, 0, 256, 256);

  // Ashlar stone blocks with warm Braj sandstone variation
  const blockH = 32;
  const blockW = 64;
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * 32;
    for (let col = -1; col < 5; col++) {
      const x = col * blockW + offset;
      const y = row * blockH;
      const shade = (Math.sin(row * 3.7 + col * 2.3) * 0.5 + 0.5) * 18 - 9;
      ctx.fillStyle = `rgb(${146 + shade}, ${72 + shade * 0.6}, ${48 + shade * 0.4})`;
      ctx.fillRect(x + 2, y + 2, blockW - 3, blockH - 3);
      ctx.strokeStyle = 'rgba(42, 18, 12, 0.50)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, blockW - 2, blockH - 2);
    }
  }

  // Festive gulal dust specks on courtyard stones
  const gulalHues = ['#F43F5E', '#F59E0B', '#38BDF8', '#A855F7', '#10B981'];
  for (let i = 0; i < 55; i++) {
    ctx.fillStyle = gulalHues[i % gulalHues.length];
    ctx.globalAlpha = 0.22;
    const rx = (i * 73) % 256;
    const ry = (i * 139) % 256;
    const rad = 4 + (i % 9);
    ctx.beginPath();
    ctx.arc(rx, ry, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
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

  const grad = ctx.createRadialGradient(cx, cy, 12, cx, cy, w * 0.48);
  grad.addColorStop(0, '#5A221A');
  grad.addColorStop(0.75, '#351510');
  grad.addColorStop(1, 'rgba(42, 17, 13, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.48, 0, Math.PI * 2);
  ctx.fill();

  const petalCount = 16;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.34);
    ctx.quadraticCurveTo(w * 0.06, -w * 0.41, 0, -w * 0.46);
    ctx.quadraticCurveTo(-w * 0.06, -w * 0.41, 0, -w * 0.34);
    ctx.fillStyle = i % 2 === 0 ? '#F59E0B' : '#E11D48';
    ctx.fill();
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  ctx.strokeStyle = '#FDE68A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  const rows = grid.length;
  const cols = grid[0]?.length || 9;
  const gridSpan = w * 0.46;
  const cellW = gridSpan / cols;
  const startX = cx - gridSpan / 2;
  const startY = cy - gridSpan / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c];
      if (val <= 0) continue;
      const pigment = RANGOLI_PIGMENTS[val] || RANGOLI_PIGMENTS[1];
      const px = startX + (c + 0.5) * cellW;
      const py = startY + (r + 0.5) * cellW;

      ctx.fillStyle = pigment.hex;
      ctx.beginPath();
      ctx.arc(px, py, cellW * 0.44, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath();
      ctx.arc(px, py, cellW * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Helper to build a composite 8-part 3D human character (Player, NPC, or Challenger)
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

  // 1. Contact shadow disc flush on ground (y = 0.015)
  const shadowGeo = new THREE.CircleGeometry(0.64, 20);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x090403,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Materials with varied roughness (>= 0.25 difference between cloth, skin, and brass)
  const kurtaMat = new THREE.MeshStandardMaterial({
    color: opts.kurtaColor,
    roughness: 0.68,
    metalness: 0.08,
  });
  const dhotiMat = new THREE.MeshStandardMaterial({
    color: opts.dhotiColor,
    roughness: 0.82,
    metalness: 0.02,
  });
  const pagdiMat = new THREE.MeshStandardMaterial({
    color: opts.pagdiColor,
    roughness: 0.42,
    metalness: 0.22,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: opts.skinColor,
    roughness: 0.55,
    metalness: 0.04,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.18,
    metalness: 0.88,
  });

  // 2. Left & Right Legs (Dhoti / Churidars)
  const legGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.72, 12);
  const leftLeg = new THREE.Mesh(legGeo, dhotiMat);
  leftLeg.position.set(-0.17, 0.36, 0);
  leftLeg.castShadow = true;
  bodyGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, dhotiMat);
  rightLeg.position.set(0.17, 0.36, 0);
  rightLeg.castShadow = true;
  bodyGroup.add(rightLeg);

  // 3. Primary Silhouette: Flared Traditional Kurta / Angarkha Torso
  const torsoGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.92, 16);
  const torsoMesh = new THREE.Mesh(torsoGeo, kurtaMat);
  torsoMesh.position.set(0, 1.05, 0);
  torsoMesh.castShadow = true;
  bodyGroup.add(torsoMesh);

  // 4. Festive Zari Stole / Dupatta Sash across chest
  const sashGeo = new THREE.TorusGeometry(0.31, 0.055, 8, 20);
  const sashMesh = new THREE.Mesh(sashGeo, pagdiMat);
  sashMesh.position.set(0, 1.18, 0);
  sashMesh.rotation.set(Math.PI * 0.38, 0.25, 0);
  bodyGroup.add(sashMesh);

  // 5. Arms
  const armGeo = new THREE.CapsuleGeometry(0.085, 0.45, 4, 10);
  const leftArm = new THREE.Mesh(armGeo, kurtaMat);
  leftArm.position.set(-0.38, 1.12, 0);
  leftArm.castShadow = true;
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, kurtaMat);
  rightArm.position.set(0.38, 1.12, 0.1);
  rightArm.rotation.x = -0.5;
  rightArm.castShadow = true;
  bodyGroup.add(rightArm);

  // 6. Head
  const headGeo = new THREE.SphereGeometry(0.24, 16, 16);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 1.74, 0);
  headMesh.castShadow = true;
  bodyGroup.add(headMesh);

  // 7. Traditional Pagdi (Turban) + Kalgi Brass Crest
  const pagdiBaseGeo = new THREE.TorusGeometry(0.21, 0.09, 10, 20);
  pagdiBaseGeo.rotateX(Math.PI / 2);
  const pagdiMesh = new THREE.Mesh(pagdiBaseGeo, pagdiMat);
  pagdiMesh.position.set(0, 1.9, 0);
  bodyGroup.add(pagdiMesh);

  const kalgiGeo = new THREE.ConeGeometry(0.08, 0.22, 8);
  const kalgiMesh = new THREE.Mesh(kalgiGeo, brassMat);
  kalgiMesh.position.set(0, 2.04, 0.16);
  kalgiMesh.rotation.x = 0.35;
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
    const matkiGeo = new THREE.SphereGeometry(0.23, 14, 12);
    const matkiMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      metalness: 0.15,
    });
    const matki = new THREE.Mesh(matkiGeo, matkiMat);
    matki.scale.set(1, 0.85, 1);
    matki.position.set(0.36, 1.25, 0.28);
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

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
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

    // 2. Scene, Studio Environment Reflection (RoomEnvironment) & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x281020);
    scene.fog = new THREE.FogExp2(0x281020, 0.0042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(52, initW / initH, 0.2, 220);
    camera.position.set(3.5, 6.8, 12.5);
    camera.lookAt(0, 1.8, -3.5);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 3. Luminous 3-Point Warm/Cool Festival Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xfff1f2, 0x451a14, 1.35);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.55);
    keyLight.position.set(22, 34, 18);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      const d = 30;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 85;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xfbbf24, 0.95);
    rimLight.position.set(-20, 18, -22);
    scene.add(rimLight);

    // 4. Ground & Courtyard Surfaces
    const outerTerrainGeo = new THREE.PlaneGeometry(200, 200);
    outerTerrainGeo.rotateX(-Math.PI / 2);
    const outerTerrainMat = new THREE.MeshStandardMaterial({
      color: 0x4a241b,
      roughness: 0.92,
      metalness: 0.02,
    });
    const outerTerrain = new THREE.Mesh(outerTerrainGeo, outerTerrainMat);
    outerTerrain.position.y = -0.04;
    outerTerrain.receiveShadow = true;
    scene.add(outerTerrain);

    const sandstoneTex = createSandstoneTexture(maxAnisotropy);
    const courtyardGeo = new THREE.CircleGeometry(28.5, 48);
    courtyardGeo.rotateX(-Math.PI / 2);
    const courtyardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sandstoneTex,
      roughness: 0.75,
      metalness: 0.06,
    });
    const courtyardFloor = new THREE.Mesh(courtyardGeo, courtyardMat);
    courtyardFloor.position.y = 0;
    courtyardFloor.receiveShadow = true;
    scene.add(courtyardFloor);

    // Outer Carved Courtyard Boundary Parapet Ring
    const parapetRingGeo = new THREE.TorusGeometry(28.2, 0.35, 8, 64);
    parapetRingGeo.rotateX(Math.PI / 2);
    const sandstoneCarvedMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.68,
      metalness: 0.08,
    });
    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.2,
      metalness: 0.86,
    });
    const whiteMarbleMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      roughness: 0.35,
      metalness: 0.1,
    });

    const parapetMesh = new THREE.Mesh(parapetRingGeo, sandstoneCarvedMat);
    parapetMesh.position.y = 0.22;
    scene.add(parapetMesh);

    // Central Octagonal Chowk Platform & Dynamic Rangoli Mandala Decal
    const chowkPlinthGeo = new THREE.CylinderGeometry(5.6, 6.1, 0.18, 8);
    const chowkPlinth = new THREE.Mesh(chowkPlinthGeo, sandstoneCarvedMat);
    chowkPlinth.position.set(0, 0.09, 0);
    chowkPlinth.receiveShadow = true;
    scene.add(chowkPlinth);

    const rangoliCanvas = document.createElement('canvas');
    rangoliCanvas.width = 512;
    rangoliCanvas.height = 512;
    drawRangoliMandalaToCanvas(rangoliCanvas, propsRef.current.rangoliGrid);
    rangoliCanvasRef.current = rangoliCanvas;

    const rangoliTex = new THREE.CanvasTexture(rangoliCanvas);
    rangoliTex.colorSpace = THREE.SRGBColorSpace;
    rangoliTex.anisotropy = maxAnisotropy;
    rangoliTextureRef.current = rangoliTex;

    const rangoliPlaneGeo = new THREE.CircleGeometry(4.8, 32);
    rangoliPlaneGeo.rotateX(-Math.PI / 2);
    const rangoliPlaneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: rangoliTex,
      transparent: true,
      roughness: 0.52,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const rangoliDisc = new THREE.Mesh(rangoliPlaneGeo, rangoliPlaneMat);
    rangoliDisc.position.set(0, 0.2, 0);
    scene.add(rangoliDisc);

    // 5. Landmark Vista: Grand Braj Mandir & Nagara Shikhara on North Axis (z = -22.5)
    const mandirGroup = new THREE.Group();
    mandirGroup.position.set(0, 0, -22.5);
    scene.add(mandirGroup);

    const plinth1 = new THREE.Mesh(
      new THREE.BoxGeometry(16, 1.1, 10),
      sandstoneCarvedMat
    );
    plinth1.position.y = 0.55;
    plinth1.castShadow = true;
    plinth1.receiveShadow = true;
    mandirGroup.add(plinth1);

    for (let s = 0; s < 4; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.28, 0.65),
        whiteMarbleMat
      );
      step.position.set(0, 0.14 + s * 0.26, 5.2 - s * 0.45);
      mandirGroup.add(step);
    }

    const pillarGeo = new THREE.CylinderGeometry(0.36, 0.44, 4.6, 12);
    [-6.2, -3.2, 3.2, 6.2].forEach((px) => {
      const pillar = new THREE.Mesh(pillarGeo, sandstoneCarvedMat);
      pillar.position.set(px, 3.4, 3.6);
      pillar.castShadow = true;
      mandirGroup.add(pillar);

      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.35, 1.1),
        brassTrimMat
      );
      cap.position.set(px, 5.7, 3.6);
      mandirGroup.add(cap);
    });

    const sanctumBody = new THREE.Mesh(
      new THREE.BoxGeometry(11, 5.2, 7.5),
      sandstoneCarvedMat
    );
    sanctumBody.position.set(0, 3.7, -0.5);
    sanctumBody.castShadow = true;
    mandirGroup.add(sanctumBody);

    const shikharaPoints = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(4.2, 0),
      new THREE.Vector2(3.6, 2.8),
      new THREE.Vector2(2.7, 5.6),
      new THREE.Vector2(1.5, 8.0),
      new THREE.Vector2(0.4, 9.2),
      new THREE.Vector2(0.01, 9.4),
    ];
    const shikharaGeo = new THREE.LatheGeometry(shikharaPoints, 8);
    const shikharaMesh = new THREE.Mesh(shikharaGeo, sandstoneCarvedMat);
    shikharaMesh.position.set(0, 6.2, -0.6);
    shikharaMesh.rotation.y = Math.PI / 8;
    shikharaMesh.castShadow = true;
    mandirGroup.add(shikharaMesh);

    const amalaka = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.32, 10, 20),
      whiteMarbleMat
    );
    amalaka.rotation.x = Math.PI / 2;
    amalaka.position.set(0, 15.4, -0.6);
    mandirGroup.add(amalaka);

    const kalash = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 1.8, 16),
      brassTrimMat
    );
    kalash.position.set(0, 16.5, -0.6);
    mandirGroup.add(kalash);

    const sanctumGlow = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 3.8, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    sanctumGlow.position.set(0, 3.1, 3.28);
    mandirGroup.add(sanctumGlow);

    // 6. Four Flanking Braj Havelis & Mithai / Rangoli Stalls
    const buildHaveliFacade = (
      x: number,
      z: number,
      rotY: number,
      canopyColor: number
    ) => {
      const haveli = new THREE.Group();
      haveli.position.set(x, 0, z);
      haveli.rotation.y = rotY;

      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(9.5, 5.4, 3.6),
        sandstoneCarvedMat
      );
      wall.position.y = 2.7;
      wall.castShadow = true;
      wall.receiveShadow = true;
      haveli.add(wall);

      const jharokha = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 2.2, 1.4),
        whiteMarbleMat
      );
      jharokha.position.set(0, 3.8, 2.1);
      haveli.add(jharokha);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        brassTrimMat
      );
      dome.position.set(0, 4.9, 2.1);
      haveli.add(dome);

      const canopyMat = new THREE.MeshStandardMaterial({
        color: canopyColor,
        roughness: 0.6,
        metalness: 0.05,
      });
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.22, 2.6),
        canopyMat
      );
      canopy.position.set(0, 2.65, 2.7);
      canopy.rotation.x = 0.18;
      haveli.add(canopy);

      scene.add(haveli);
    };

    buildHaveliFacade(-21, -8, Math.PI / 2.4, 0xe11d48);
    buildHaveliFacade(21, -8, -Math.PI / 2.4, 0xf59e0b);
    buildHaveliFacade(-21, 9, Math.PI / 1.7, 0x10b981);
    buildHaveliFacade(21, 9, -Math.PI / 1.7, 0x0284c7);

    // 6B. Overhead Festive Toran Bunting Garlands (64 Instanced Pennant Flags across the Courtyard)
    const buntingCount = 64;
    const buntingGeo = new THREE.ConeGeometry(0.28, 0.62, 4);
    buntingGeo.rotateX(Math.PI);
    const buntingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
    });
    const instancedBunting = new THREE.InstancedMesh(
      buntingGeo,
      buntingMat,
      buntingCount
    );
    const buntingColors = [0xf43f5e, 0xfbbf24, 0x38bdf8, 0x10b981, 0xa855f7];
    const spanEndpoints = [
      { ax: -18, az: -8, bx: -6, bz: -18 },
      { ax: 18, az: -8, bx: 6, bz: -18 },
      { ax: -18, az: 8, bx: -18, bz: -7 },
      { ax: 18, az: 8, bx: 18, bz: -7 },
    ];
    for (let i = 0; i < buntingCount; i++) {
      const span = spanEndpoints[Math.floor(i / 16)];
      const t = (i % 16) / 15;
      const bx = THREE.MathUtils.lerp(span.ax, span.bx, t);
      const bz = THREE.MathUtils.lerp(span.az, span.bz, t);
      const sag = Math.sin(t * Math.PI) * 1.35;
      const by = 6.2 - sag;

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

    // 7. Natural Outdoor Perimeter: Instanced Banyan/Ashoka Tree Groves (32 instances)
    const treeCount = 32;
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 3.2, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.88,
    });
    const canopyGeo = new THREE.DodecahedronGeometry(2.3, 1);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
    });

    const instancedTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const instancedCanopies = new THREE.InstancedMesh(
      canopyGeo,
      canopyMat,
      treeCount
    );

    const foliagePalette = [0x15803d, 0x166534, 0xca8a04, 0xdb2777];
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const rad = 31 + (i % 3) * 4.5;
      const tx = Math.cos(angle) * rad;
      const tz = Math.sin(angle) * rad;
      const scale = 0.85 + ((i * 19) % 30) / 100;

      _dummyObj.position.set(tx, 1.6 * scale, tz);
      _dummyObj.rotation.set(0, i * 0.7, 0);
      _dummyObj.scale.setScalar(scale);
      _dummyObj.updateMatrix();
      instancedTrunks.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(tx, 3.9 * scale, tz);
      _dummyObj.scale.set(scale * 1.15, scale * 0.9, scale * 1.15);
      _dummyObj.updateMatrix();
      instancedCanopies.setMatrixAt(i, _dummyObj.matrix);

      _dummyColor.setHex(foliagePalette[i % foliagePalette.length]);
      instancedCanopies.setColorAt(i, _dummyColor);
    }
    instancedTrunks.instanceMatrix.needsUpdate = true;
    instancedCanopies.instanceMatrix.needsUpdate = true;
    if (instancedCanopies.instanceColor) {
      instancedCanopies.instanceColor.needsUpdate = true;
    }
    instancedTrunks.computeBoundingSphere();
    instancedCanopies.computeBoundingSphere();
    scene.add(instancedTrunks, instancedCanopies);

    // 8. World-Specific Overhead Celebration Group (Kites & Kandil Lanterns)
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
        emissiveIntensity: 0.45,
        roughness: 0.4,
      });
      const diamond = new THREE.Mesh(diamondGeo, kMat);
      const tailGeo = new THREE.ConeGeometry(0.32, 0.65, 4);
      const tail = new THREE.Mesh(tailGeo, brassTrimMat);
      tail.position.y = -1.15;
      kGroup.add(diamond, tail);

      const angle = (k / 14) * Math.PI * 2;
      const dist = 12 + (k % 3) * 6;
      const basePos = new THREE.Vector3(
        Math.cos(angle) * dist,
        11 + (k % 4) * 2.5,
        Math.sin(angle) * dist - 4
      );
      kGroup.position.copy(basePos);
      skyDecorGroup.add(kGroup);
      kiteMeshes.push({ mesh: kGroup, basePos, phase: k * 0.9 });
    }

    // 9. Sacred Brass Diyas (6 Interactive Deepstambh Lamps around the Chowk — ALL 6 start UNLIT for genuine progression)
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
    const diyaCoords = [
      { x: -7.5, z: -7.5 },
      { x: 7.5, z: -7.5 },
      { x: -9.5, z: 2.5 },
      { x: 9.5, z: 2.5 },
      { x: -6.5, z: 10.5 },
      { x: 6.5, z: 10.5 },
    ];

    const flameGeo = new THREE.ConeGeometry(0.28, 0.76, 10);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const haloGeo = new THREE.SphereGeometry(0.62, 12, 12);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    });
    const unlitRingGeo = new THREE.RingGeometry(0.65, 0.82, 20);
    unlitRingGeo.rotateX(-Math.PI / 2);
    const unlitRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    diyaCoords.forEach((coord, idx) => {
      const dGroup = new THREE.Group();
      dGroup.position.set(coord.x, 0, coord.z);

      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.52, 1.15, 10),
        sandstoneCarvedMat
      );
      ped.position.y = 0.575;
      ped.castShadow = true;
      dGroup.add(ped);

      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.25, 0.28, 14),
        brassTrimMat
      );
      bowl.position.y = 1.25;
      dGroup.add(bowl);

      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 1.62;
      flame.visible = false;
      dGroup.add(flame);

      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = 1.62;
      halo.visible = false;
      dGroup.add(halo);

      const unlitRing = new THREE.Mesh(unlitRingGeo, unlitRingMat);
      unlitRing.position.y = 0.03;
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

    // 9B. Three Floating 3D Festival Blessing Shrines (Placed along outer courtyard perimeter so player actively walks to collect them)
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

      const orbGeo = new THREE.OctahedronGeometry(0.45, 1);
      const orbMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.color,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.6,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      bGroup.add(orb);

      const haloRingGeo = new THREE.TorusGeometry(0.68, 0.05, 8, 24);
      haloRingGeo.rotateX(Math.PI / 2);
      const haloRing = new THREE.Mesh(haloRingGeo, brassTrimMat);
      bGroup.add(haloRing);

      scene.add(bGroup);
      return {
        id: cfg.id,
        label: cfg.label,
        x: cfg.x,
        z: cfg.z,
        cooldown: 0,
        group: bGroup,
      };
    });

    // 10. Build 4 Cultural NPCs in the Courtyard (Animated Musicians, Poets & Artisans)
    const npcMeshes = COURT_NPCS.map((npc) => {
      const built = buildCompositeCharacterMesh({
        kurtaColor: npc.kurtaColor,
        dhotiColor: 0xfffbeb,
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

    // 11. Build Player Character + 3D Water-Lotus Parry Shield Dome + Golden Objective Compass
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

    // 3D Water-Lotus Parry Shield Dome around Player (Activated via [Q] or Right-Click)
    const shieldGroup = new THREE.Group();
    const shieldDomeGeo = new THREE.SphereGeometry(1.38, 20, 16);
    const shieldDomeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
      depthWrite: false,
    });
    const shieldDome = new THREE.Mesh(shieldDomeGeo, shieldDomeMat);
    shieldDome.position.y = 1.05;
    shieldGroup.add(shieldDome);

    const shieldRingGeo = new THREE.TorusGeometry(1.35, 0.06, 8, 28);
    shieldRingGeo.rotateX(Math.PI / 2);
    const shieldRing = new THREE.Mesh(shieldRingGeo, brassTrimMat);
    shieldRing.position.y = 0.95;
    shieldGroup.add(shieldRing);
    shieldGroup.visible = false;
    playerModel.root.add(shieldGroup);

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
        dhotiColor: 0xfefce8,
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

    const updateCursorWorldFromPointer = (e: PointerEvent, isClick: boolean) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      _ndcVec2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _ndcVec2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndcVec2, camera);
      const hit = _raycaster.ray.intersectPlane(_groundPlane, _planeHitVec3);
      if (hit) {
        hasCursorWorld = true;
        cursorWorldX = Math.max(-24, Math.min(24, _planeHitVec3.x));
        cursorWorldZ = Math.max(-24, Math.min(24, _planeHitVec3.z));
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
        updateCursorWorldFromPointer(e, true);
      } else if (e.button === 2) {
        rightClickParryJustPressed = true;
      }
    };

    const handleCanvasPointerMove = (e: PointerEvent) => {
      if (propsRef.current.gameState === 'playing') {
        updateCursorWorldFromPointer(e, pointerIsDown);
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
      }
    });
    resizeObserver.observe(container);

    // 15. Simulation State Variables (Tactile 3-Wave Combat + 6 Unlit Diyas)
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
    let bombShockwaveMaxRadius = 6.5;

    const maxSpiritPips = 6;
    let spiritPips = 6;
    let spiritTrail = 6;
    let spiritRegenAccum = 0;
    let petalAuraTimer = 0;
    let petalPulseAccum = 0;

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
    const targetDiyas = 6; // All 6 Sacred Brass Diyas around the courtyard
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
      }
    };
    let lastResetCounter = propsRef.current.resetCounter;
    let lastFireworksCount = propsRef.current.fireworksCount;
    let lastShieldTriggerCount = propsRef.current.shieldTriggerCount;
    let lastFireTriggerCount = propsRef.current.fireTriggerCount;
    let lastKarmaOfferingCount = propsRef.current.karmaOfferingCount;
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
      spiritPips = maxSpiritPips;
      spiritTrail = maxSpiritPips;
      spiritRegenAccum = 0;
      petalAuraTimer = 0;
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

      const weaponHex = GULAL_WEAPONS[weaponColorId].threeHex;

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
        score += Math.round((matchedWeakness ? 35 : 22) * combo);
        bestScore = Math.max(bestScore, score);
        lastHudEmitTime = 0;
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

    // Helper: Light an unlit Sacred Diya when hit by a Gulal Projectile or [E] interaction
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
      applyKarmaDeed('light_diya', '+55 Karma · Sacred Diya Lit');
      propsRef.current.onRewardEarned(30, 45, 'Sacred Deepotsav Diya Stamp');
    };

    // Activate Water-Lotus Parry Shield ([Q] or Right-Click), enhanced by Divine Karma Blessings
    const activateWaterShield = () => {
      if (shieldCooldown > 0 || shieldActiveTimer > 0) return;
      const kBoost = stepKarmaState(karmaState, 0);
      shieldActiveTimer = 1.05 * kBoost.shieldDurationMultiplier;
      shieldCooldown = 2.4 * kBoost.shieldCooldownMultiplier;
      shieldGroup.visible = true;
      melaverseAudio.playShieldParry(false);
      spawnParticleBurst(playerX, 1.0, playerZ, 0x38bdf8, 16, 6.0);

      // Push back & splash any Challenger right next to the player (scaled by Divine Shield Aegis)
      const effectiveRadius = 3.2 * kBoost.shieldRadiusMultiplier;
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

    // Player-Driven 5-Mode Festival Arsenal + Soft-Magnet Target Acquisition
    const fireGulalBurst = (overrideArsenal?: ArsenalModeId) => {
      if (activeVolleyPendingTimer > 0 && !activeVolleyScoredHit) {
        recordVolleyOutcome(false);
      }
      activeVolleyScoredHit = false;
      activeVolleyPendingTimer = 0.55;

      const activeModeId = overrideArsenal ?? propsRef.current.selectedArsenal;
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

    // Grand Sky Fireworks Celebration (Atmospheric Sky Burst + Stamp without skipping gameplay objectives!)
    const triggerGrandSkyFireworks = () => {
      melaverseAudio.playVictoryFanfare();
      const fwColors = [0xf43f5e, 0xfbbf24, 0x38bdf8, 0xa855f7, 0x10b981];
      for (let b = 0; b < 5; b++) {
        const fx = (b - 2) * 5.5;
        const fy = 9.0 + (b % 2) * 3.2;
        const fz = -12 - (b % 3) * 4;
        spawnParticleBurst(fx, fy, fz, fwColors[b % fwColors.length], 24, 9.5);
      }
      score += 50;
      bestScore = Math.max(bestScore, score);
      propsRef.current.onRewardEarned(
        15,
        25,
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
      const rawDt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      const dt = clampDelta(rawDt);
      elapsedTotal += dt;

      const currentProps = propsRef.current;

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

      if (currentProps.karmaOfferingCount !== lastKarmaOfferingCount) {
        lastKarmaOfferingCount = currentProps.karmaOfferingCount;
        applyKarmaDeed('help_npc', '+100 Karma · Elder & Studio Blessing');
      }

      playerModel.kurtaMat.color.set(currentProps.attire.kurtaHex);
      playerModel.dhotiMat.color.set(currentProps.attire.dhotiHex);
      playerModel.pagdiMat.color.set(currentProps.attire.pagdiHex);
      playerModel.skinMat.color.set(currentProps.attire.skinHex);

      // Luminous atmosphere per world
      const targetSkyHex =
        currentProps.activeWorld === 'diwali_ghat'
          ? 0x0f172a
          : currentProps.activeWorld === 'mela_central'
          ? 0x1e1040
          : 0x281020;
      _dummyColor.setHex(targetSkyHex);
      (scene.background as THREE.Color).lerp(_dummyColor, 1 - Math.exp(-3 * dt));
      (scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color);
      keyLight.intensity = THREE.MathUtils.damp(
        keyLight.intensity,
        currentProps.activeWorld === 'diwali_ghat' ? 1.75 : 2.55,
        4,
        dt
      );

      // Animate overhead kites
      kiteMeshes.forEach((k) => {
        k.mesh.position.y =
          k.basePos.y + Math.sin(elapsedTotal * 1.8 + k.phase) * 0.65;
        k.mesh.rotation.z = Math.sin(elapsedTotal * 2.2 + k.phase) * 0.22;
      });

      const adaptiveProfile = evaluateAdaptiveDifficulty(
        recentAttackOutcomes,
        spiritPips
      );

      // Animate Courtyard NPCs (Dancing, Dhol Drumming & Waving, scaled by adaptive reaction tempo)
      npcMeshes.forEach((n, idx) => {
        const beat =
          elapsedTotal * 5.7 * adaptiveProfile.reactionFrequencyScale +
          idx * 1.3;
        n.built.bodyGroup.position.y = Math.abs(Math.sin(beat)) * 0.08;
        n.built.bodyGroup.rotation.z = Math.sin(beat * 0.5) * 0.06;
        if (n.npc.id === 'ustad_kabir') {
          // Ustad Kabir vigorously plays the Braj Dhol
          n.built.leftArm.rotation.x = -0.6 + Math.sin(beat * 2) * 0.45;
          n.built.rightArm.rotation.x = -0.6 - Math.sin(beat * 2) * 0.45;
        } else {
          n.built.leftArm.rotation.z = 0.25 + Math.sin(beat) * 0.2;
          n.built.rightArm.rotation.x = -0.4 + Math.cos(beat) * 0.25;
        }
      });

      diyaNodes.forEach((d, idx) => {
        if (d.lit) {
          const flicker = 0.9 + Math.sin(elapsedTotal * 14 + idx * 2.1) * 0.14;
          d.flameMesh.scale.set(1, flicker, 1);
          d.haloMesh.scale.setScalar(0.95 + flicker * 0.12);
        } else {
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

      blessingNodes.forEach((b, idx) => {
        if (b.cooldown > 0) {
          b.cooldown = Math.max(0, b.cooldown - dt);
          if (b.cooldown <= 0) {
            b.group.visible = true;
            spawnParticleBurst(b.x, 1.0, b.z, 0xfbbf24, 10, 4.0);
          }
        } else {
          b.group.position.y = 0.95 + Math.sin(elapsedTotal * 2.8 + idx) * 0.22;
          b.group.rotation.y = elapsedTotal * 1.6 + idx;
        }
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

      if (Math.random() < 0.4) {
        const gColors = [0xf43f5e, 0xf59e0b, 0x38bdf8, 0xa855f7];
        spawnParticleBurst(
          (Math.random() - 0.5) * 24,
          3.5 + Math.random() * 5,
          (Math.random() - 0.5) * 24,
          gColors[Math.floor(Math.random() * gColors.length)],
          1,
          1.4
        );
      }

      if (currentProps.gameState === 'title') {
        compassGroup.visible = false;
        lockReticleGroup.visible = false;
        magnetTetherMesh.visible = false;
        const orbitAngle = 0.25 + Math.sin(elapsedTotal * 0.28) * 0.5;
        const camRad = 12.6;
        _camTargetPos.set(
          Math.sin(orbitAngle) * camRad,
          6.5 + Math.sin(elapsedTotal * 0.45) * 0.55,
          Math.cos(orbitAngle) * camRad
        );
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-5 * dt));
        _camLookAt.set(-1.2, 2.1, -4.5);
        camera.lookAt(_camLookAt);
      } else if (currentProps.gameState === 'playing' && !roundEnded) {
        compassGroup.visible = true;
        roundElapsedSec += dt;

        // Step subtle courtyard Tala & Tanpura rhythm ambiance
        melaverseAudio.stepAmbientCourtyardMusic(dt);

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
        weaponCooldown = Math.max(0, weaponCooldown - simDt);
        dashCooldown = Math.max(0, dashCooldown - simDt);
        shieldCooldown = Math.max(0, shieldCooldown - simDt);

        const karmaStep = stepKarmaState(karmaState, simDt);
        karmaState = karmaStep.state;

        if (shieldActiveTimer > 0) {
          shieldActiveTimer = Math.max(0, shieldActiveTimer - simDt);
          shieldGroup.rotation.y = elapsedTotal * 5.5;
          const sPulse =
            (0.96 + Math.sin(elapsedTotal * 16) * 0.06) *
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

          let moveX = 0;
          let moveZ = 0;
          if (keysHeld.has('KeyW') || keysHeld.has('ArrowUp')) moveZ -= 1;
          if (keysHeld.has('KeyS') || keysHeld.has('ArrowDown')) moveZ += 1;
          if (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft')) moveX -= 1;
          if (keysHeld.has('KeyD') || keysHeld.has('ArrowRight')) moveX += 1;

          let moveLen = Math.hypot(moveX, moveZ);
          if (moveLen > 0.01) {
            // Manual movement overrides any auto-stride
            autoStrideTimer = 0;
            moveX /= moveLen;
            moveZ /= moveLen;
            const targetYaw = Math.atan2(moveX, moveZ);
            let angleDiff = targetYaw - playerYaw;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            playerYaw += angleDiff * (1 - Math.exp(-14 * simDt));
          } else if (autoStrideTimer > 0) {
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
          }

          if (dashBufferTimer > 0 && dashCooldown <= 0) {
            dashBufferTimer = 0;
            dashCooldown = 0.95;
            dashActiveTimer = 0.25;
            dashDirX = moveLen > 0.01 ? moveX : Math.sin(playerYaw);
            dashDirZ = moveLen > 0.01 ? moveZ : Math.cos(playerYaw);
            playerVy = 4.2;
            scaleSquashX = 0.84;
            scaleSquashY = 1.2;
            melaverseAudio.playDashOrJump();
            spawnParticleBurst(playerX, 0.4, playerZ, 0xfbbf24, 10, 5.0);
          }

          const speedBoost =
            (petalAuraTimer > 0 ? 1.22 : 1.0) * karmaStep.speedMultiplier;
          const baseSpeed = 8.8 * speedBoost;
          let stepVx = moveX * baseSpeed;
          let stepVz = moveZ * baseSpeed;

          if (dashActiveTimer > 0) {
            dashActiveTimer = Math.max(0, dashActiveTimer - simDt);
            stepVx = dashDirX * 20.0 * karmaStep.speedMultiplier;
            stepVz = dashDirZ * 20.0 * karmaStep.speedMultiplier;
          }

          playerX += stepVx * simDt;
          playerZ += stepVz * simDt;

          if (playerY <= 0.001) {
            coyoteTimer = 0.1;
          } else {
            coyoteTimer = Math.max(0, coyoteTimer - simDt);
          }

          if (playerY > 0 || playerVy > 0) {
            playerY += playerVy * simDt;
            playerVy -= 18 * simDt;
            if (playerY <= 0) {
              playerY = 0;
              playerVy = 0;
              scaleSquashX = 1.22;
              scaleSquashY = 0.78;
            }
          }

          const radial = Math.hypot(playerX, playerZ);
          if (radial > 25.5) {
            const s = 25.5 / radial;
            playerX *= s;
            playerZ *= s;
          }
          if (playerZ < -16.8 && Math.abs(playerX) < 8.2) {
            playerZ = -16.8;
          }

          const frameMoveDist = Math.hypot(stepVx * simDt, stepVz * simDt);
          walkDistAccum += frameMoveDist * 3.4;
          footstepAccum += frameMoveDist;
          if (footstepAccum >= 2.1 && playerY <= 0.05) {
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
          lockReticleGroup.visible = true;
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
          if (tetherLen > 1.2 && magnetState.magnetStrength > 0.05) {
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
              } else if (b.id === 'gujiya_heal') {
                spiritPips = maxSpiritPips;
                score += 120;
                currentProps.onRewardEarned(25, 40);
              } else if (b.id === 'matki_burst') {
                score += 160;
                currentProps.onRewardEarned(35, 50);
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
          if (pendingArsenalKeyAttack !== null && weaponCooldown <= 0) {
            const modeToFire = pendingArsenalKeyAttack;
            pendingArsenalKeyAttack = null;
            attackBufferTimer = 0;
            fireGulalBurst(modeToFire);
          } else if (attackBufferTimer > 0 && weaponCooldown <= 0) {
            attackBufferTimer = 0;
            fireGulalBurst();
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
              if (hitDist <= 2.2 && dashActiveTimer <= 0) {
                if (shieldActiveTimer > 0) {
                  // Deflected by Water-Lotus Shield!
                  melaverseAudio.playShieldParry(true);
                  spawnParticleBurst(playerX, 1.2, playerZ, 0x38bdf8, 14, 6.5);
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

          // Step Challenger AI with Adaptive Difficulty (movement speed, reaction frequency & concurrent attack cap)
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
                // Distinct Windup Fighting Stances per Archetype
                if (st.archetype === 'sprinter') {
                  node.model.bodyGroup.position.y = -0.18;
                  node.model.bodyGroup.rotation.x = 0.22;
                  node.model.rightArm.rotation.x = -1.3;
                } else if (st.archetype === 'lobber') {
                  node.model.bodyGroup.position.y =
                    Math.abs(Math.sin(elapsedTotal * 12)) * 0.15;
                  node.model.rightArm.rotation.x = -2.35; // Raising Matki overhead!
                } else {
                  // Captain beats the Braj Dhol rapidly before charging!
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
              st.hitFlashTimer > 0 ? 0.85 : 0;

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
            if (res.triggeredAttack) {
              if (st.archetype === 'lobber') {
                // Spawn a real 3D parabolic arcing Gulal Balloon toward targetX/targetZ!
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
                // Sprinter or Captain close-range splash check
                const hitDist = Math.hypot(
                  playerX - st.targetX,
                  playerZ - st.targetZ
                );
                const bodyDist = Math.hypot(playerX - st.x, playerZ - st.z);
                if (hitDist <= 2.15 || bodyDist <= 1.95) {
                  if (shieldActiveTimer > 0) {
                    // Parried by Water-Lotus Shield! Counter-splash the attacker!
                    melaverseAudio.playShieldParry(true);
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

        // Proximity check for NPCs & Unlit Diyas (`[E]` interaction)
        let closestPrompt: HudSnapshot['nearbyPrompt'] = null;
        let closestDist = 3.5;

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

        if (keysJustPressed.has('KeyE') && closestPrompt) {
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
              }
              applyKarmaDeed(
                'help_npc',
                `+100 Karma · Helped ${foundNpc.name.split(' ')[0]}`
              );
              melaverseAudio.playSacredChime();
              currentProps.onOpenNpcDialogue(foundNpc);
            }
          }
        } else if (keysJustPressed.has('KeyT')) {
          // Direct shortcut [T] to offer greetings / help the nearest courtyard elder for Karma
          applyKarmaDeed('help_npc', '+100 Karma · Elder Blessing');
        }

        // Smooth Third-Person Follow Camera + Harmonic & Directional Combat Screen-Shake
        const shakeStep = stepScreenShake(screenShakeState, dt);
        screenShakeState = shakeStep.state;

        const desiredCamX = playerX * 0.72 + shakeStep.offsetX * 0.65;
        const desiredCamY = 7.4 + shakeStep.offsetY * 0.65;
        const desiredCamZ = playerZ + 11.2 + shakeStep.offsetZ * 0.65;
        _camTargetPos.set(desiredCamX, desiredCamY, desiredCamZ);
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-7.5 * dt));
        camera.position.x += shakeStep.offsetX * 0.35;
        camera.position.y += shakeStep.offsetY * 0.35;

        _camLookAt.set(
          playerX + shakeStep.offsetX,
          playerY + 1.45 + shakeStep.offsetY,
          playerZ - 2.6 + shakeStep.offsetZ * 0.5
        );
        camera.lookAt(_camLookAt);
        camera.rotation.z += shakeStep.rollRad;

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
          const objectiveHint =
            remainingDiyas > 0 && remainingRevelers > 0
              ? `Space/Click: Fire Gulal · Match Gem [1-3] · Q: Shield`
              : remainingDiyas > 0
              ? `Golden Compass → Ignite ${remainingDiyas} Sacred Diya${
                  remainingDiyas > 1 ? 's' : ''
                } (Space / [E])`
              : `Splash ${remainingRevelers} Reveler${
                  remainingRevelers > 1 ? 's' : ''
                } · Match Gem [1-3] for 1.5× Crit!`;

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
          if (curMagnet.lockedTarget) {
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
            cooldownPct: Math.min(
              1,
              weaponCooldown / ARSENAL_MODES[currentProps.selectedArsenal].cooldown
            ),
            dashCooldownPct: Math.min(1, dashCooldown / 0.95),
            shieldCooldownPct: Math.min(1, shieldCooldown / 2.4),
            shieldActive: shieldActiveTimer > 0,
            nearbyPrompt: closestPrompt,
            activeWave,
            activeBlessing: karmaState.activeBlessingId
              ? `${DIVINE_BLESSINGS[karmaState.activeBlessingId].name} (${Math.ceil(
                  karmaState.blessingRemainingSec
                )}s)`
              : petalAuraTimer > 0
              ? `Petal Aura (${Math.ceil(petalAuraTimer)}s)`
              : shieldActiveTimer > 0
              ? 'Lotus Shield ON'
              : null,
            objectiveHint,
            magnetLockInfo,
            adaptiveDifficulty: adaptiveProfile,
            karma: karmaState,
          });
        }
      }

      keysJustPressed.clear();
      pointerJustClicked = false;
      rightClickParryJustPressed = false;

      renderer.render(scene, camera);

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
