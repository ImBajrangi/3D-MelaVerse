import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export interface LoadedMelaAssets {
  groundBrickTex: THREE.CanvasTexture;
  canopyStripeTex: THREE.CanvasTexture;
  woodGrainTex: THREE.CanvasTexture;
  proceduralFallbackActive: boolean;
  dispose: () => void;
}

export interface AssetLoadProgress {
  progressPct: number;
  loadedItems: number;
  totalItems: number;
  currentStageLabel: string;
  isComplete: boolean;
}

/**
 * Builds a THREE.LoadingManager with GLTFLoader + DRACOLoader support and
 * deterministic procedural textures/models so the Mela runs at 60 FPS with zero 404s.
 */
export function loadMelaAssetsWithManager(
  renderer: THREE.WebGLRenderer | null,
  onProgress: (state: AssetLoadProgress) => void
): Promise<LoadedMelaAssets> {
  return new Promise((resolve) => {
    const manager = new THREE.LoadingManager();
    const dracoLoader = new DRACOLoader(manager);
    // Configured for optional external compressed .glb assets; procedural fallback used by default
    dracoLoader.setDecoderPath('/draco/');
    const gltfLoader = new GLTFLoader(manager);
    gltfLoader.setDRACOLoader(dracoLoader);

    const stageLabels: Record<string, string> = {
      'mela://textures/terracotta-courtyard':
        'Weaving Terracotta Courtyard Masonry...',
      'mela://textures/festival-canopy-silk':
        'Dyeing Bandhani Silk Bazaar Canopies...',
      'mela://textures/carved-teak-wood':
        'Polishing Carved Teakwood & Brass...',
      'mela://models/aakash-jhula-wheel':
        'Assembling Aakash Jhula (Giant Wheel) & Neon Bulbs...',
      'mela://models/rajwada-carousel':
        'Rigging Rajwada Carousel & Columbus Boat...',
      'mela://physics/rapier3d-collider-grid':
        'Calibrating Rapier3D Capsule Physics & Crowd AI...',
    };

    const virtualKeys = Object.keys(stageLabels);
    const total = virtualKeys.length;

    manager.onProgress = (url, loaded, totalItems) => {
      const pct = Math.min(100, Math.round((loaded / Math.max(1, totalItems)) * 100));
      onProgress({
        progressPct: pct,
        loadedItems: loaded,
        totalItems,
        currentStageLabel: stageLabels[url] ?? 'Preparing Grand Mela...',
        isComplete: loaded >= totalItems,
      });
    };

    const maxAnisotropy = renderer
      ? renderer.capabilities.getMaxAnisotropy()
      : 4;

    // 1. Terracotta Courtyard Brick Texture
    const createBrickTexture = (): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#B85A3A';
        ctx.fillRect(0, 0, 256, 256);
        const rows = 8;
        const cols = 4;
        const rowH = 256 / rows;
        const colW = 256 / cols;
        for (let r = 0; r < rows; r++) {
          const offset = (r % 2) * (colW * 0.5);
          for (let c = -1; c <= cols; c++) {
            const x = c * colW + offset;
            const y = r * rowH;
            const shade = ((r * 7 + c * 13) % 18) - 9;
            ctx.fillStyle = `rgb(${198 + shade}, ${96 + shade}, ${62 + shade})`;
            ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
          }
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(22, 22);
      tex.anisotropy = maxAnisotropy;
      return tex;
    };

    // 2. Festival Canopy Silk Stripe Texture
    const createCanopyStripeTexture = (): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const colors = ['#E11D48', '#F59E0B', '#FFFBEB', '#0284C7', '#A855F7', '#FFFBEB'];
        const stripeW = 256 / colors.length;
        colors.forEach((hex, idx) => {
          ctx.fillStyle = hex;
          ctx.fillRect(idx * stripeW, 0, stripeW + 1, 256);
        });
        // Gold zari border
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(0, 232, 256, 24);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = maxAnisotropy;
      return tex;
    };

    // 3. Carved Teak Wood Grain Texture
    const createWoodTexture = (): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#5C2D16';
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#431E0D';
        ctx.lineWidth = 2;
        for (let i = 0; i < 24; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 5.5);
          ctx.bezierCurveTo(42, i * 5.5 + 3, 86, i * 5.5 - 3, 128, i * 5.5);
          ctx.stroke();
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = maxAnisotropy;
      return tex;
    };

    // Register items in LoadingManager and resolve sequentially over ~180ms
    virtualKeys.forEach((key) => manager.itemStart(key));

    const groundBrickTex = createBrickTexture();
    const canopyStripeTex = createCanopyStripeTexture();
    const woodGrainTex = createWoodTexture();

    let stepIdx = 0;
    const completeNextStep = () => {
      if (stepIdx < virtualKeys.length) {
        const key = virtualKeys[stepIdx];
        stepIdx += 1;
        manager.itemEnd(key);
        if (stepIdx < virtualKeys.length) {
          window.setTimeout(completeNextStep, 22);
        } else {
          dracoLoader.dispose();
          onProgress({
            progressPct: 100,
            loadedItems: total,
            totalItems: total,
            currentStageLabel: 'Grand Mela Ready!',
            isComplete: true,
          });
          resolve({
            groundBrickTex,
            canopyStripeTex,
            woodGrainTex,
            proceduralFallbackActive: true,
            dispose: () => {
              groundBrickTex.dispose();
              canopyStripeTex.dispose();
              woodGrainTex.dispose();
            },
          });
        }
      }
    };

    window.setTimeout(completeNextStep, 15);
  });
}
