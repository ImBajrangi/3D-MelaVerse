import * as THREE from 'three';

export type PBRMaterialType = 'royalCobblestone' | 'carvedSandstone' | 'ornateSilk';
export type OrnateSilkVariant = 'crimson' | 'saffron' | 'emerald';

export interface CreatePBRMaterialOptions {
  anisotropy?: number;
  repeatX?: number;
  repeatY?: number;
  silkVariant?: OrnateSilkVariant;
  tintHex?: number;
  emissiveHex?: number;
  emissiveIntensity?: number;
}

export interface PBRMaterialBundle {
  material: THREE.MeshStandardMaterial;
  dispose: () => void;
}

function configureTexture(
  tex: THREE.CanvasTexture,
  isColorMap: boolean,
  anisotropy: number,
  repeatX: number,
  repeatY: number
): THREE.CanvasTexture {
  tex.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(16, Math.max(1, anisotropy));
  return tex;
}

const pbrCanvasCache = new Map<
  string,
  {
    colorCanvas: HTMLCanvasElement;
    bumpCanvas: HTMLCanvasElement;
    roughCanvas: HTMLCanvasElement;
  }
>();

function getOrBuildCanvases(
  cacheKey: string,
  builder: (
    cCtx: CanvasRenderingContext2D,
    bCtx: CanvasRenderingContext2D,
    rCtx: CanvasRenderingContext2D,
    size: number
  ) => void
) {
  const existing = pbrCanvasCache.get(cacheKey);
  if (existing) return existing;

  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  builder(cCtx, bCtx, rCtx, size);
  const entry = { colorCanvas, bumpCanvas, roughCanvas };
  pbrCanvasCache.set(cacheKey, entry);
  return entry;
}

/**
 * Generates 1024x1024 Diffuse, Bump, and Roughness CanvasTextures for:
 * - `royalCobblestone`: Deep obsidian-indigo stone pavers (#14111c to #1f1a2c) with warm bronze/gold inlaid mortar lines,
 *    matching grayscale bumpMap (bumpScale: 0.04), and varied roughnessMap (0.4 on polished stone tiles, 0.9 in crevices).
 * - `carvedSandstone`: Rich warm Rajasthani sandstone (#d68952 to #e8ad76) with horizontal stone block joints,
 *    carved floral relief bands, bumpScale: 0.05, and warm golden rim reflections.
 * - `ornateSilk`: Deep crimson (#8c1428), royal saffron (#d95b16), and peacock emerald (#0b525b) with woven gold Zari border patterns.
 */
export function createPBRMaterial(
  type: PBRMaterialType,
  options: CreatePBRMaterialOptions = {}
): PBRMaterialBundle {
  const anisotropy = options.anisotropy ?? 16;

  if (type === 'royalCobblestone') {
    const repeatX = options.repeatX ?? 22;
    const repeatY = options.repeatY ?? 22;
    const { colorCanvas, bumpCanvas, roughCanvas } = getOrBuildCanvases(
      'royalCobblestone',
      (cCtx, bCtx, rCtx, size) => {

    // 1. Base mortar bed (warm bronze/gold inlaid mortar lines in diffuse, recessed dark in bump, 0.9 rough in crevices)
    cCtx.fillStyle = '#3d2e1e';
    cCtx.fillRect(0, 0, size, size);

    bCtx.fillStyle = 'rgb(28, 28, 28)';
    bCtx.fillRect(0, 0, size, size);

    rCtx.fillStyle = 'rgb(230, 230, 230)'; // ~0.90 roughness in mortar crevices
    rCtx.fillRect(0, 0, size, size);

    const rows = 16;
    const cols = 8;
    const tileH = size / rows;
    const tileW = size / cols;

    for (let r = 0; r < rows; r++) {
      const xOffset = (r % 2) * (tileW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const tx = c * tileW + xOffset;
        const ty = r * tileH;
        const hash = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
        const frac = hash - Math.floor(hash);

        // Deep obsidian-indigo stone pavers (#14111c to #1f1a2c)
        const baseR = Math.round(20 + frac * 11);
        const baseG = Math.round(17 + frac * 9);
        const baseB = Math.round(28 + frac * 16);

        const pad = 4;
        const innerW = tileW - pad * 2;
        const innerH = tileH - pad * 2;

        // Subtle stone bevel gradient
        const tileGrad = cCtx.createLinearGradient(tx, ty, tx + tileW, ty + tileH);
        tileGrad.addColorStop(0, `rgb(${baseR + 5}, ${baseG + 4}, ${baseB + 7})`);
        tileGrad.addColorStop(0.5, `rgb(${baseR}, ${baseG}, ${baseB})`);
        tileGrad.addColorStop(1, `rgb(${Math.max(12, baseR - 4)}, ${Math.max(10, baseG - 4)}, ${Math.max(18, baseB - 4)})`);
        cCtx.fillStyle = tileGrad;
        cCtx.fillRect(tx + pad, ty + pad, innerW, innerH);

        // Warm bronze/gold inlaid micro-frame on stone edge
        cCtx.strokeStyle = 'rgba(212, 163, 89, 0.26)';
        cCtx.lineWidth = 1.5;
        cCtx.strokeRect(tx + pad + 0.5, ty + pad + 0.5, innerW - 1, innerH - 1);

        // Bump map: elevated stone plateau with beveled rim
        bCtx.fillStyle = `rgb(${185 + Math.round(frac * 45)}, ${185 + Math.round(frac * 45)}, ${185 + Math.round(frac * 45)})`;
        bCtx.fillRect(tx + pad, ty + pad, innerW, innerH);
        bCtx.strokeStyle = 'rgb(115, 115, 115)';
        bCtx.lineWidth = 3;
        bCtx.strokeRect(tx + pad + 1, ty + pad + 1, innerW - 2, innerH - 2);

        // Roughness map: polished stone tile surface (~0.38 - 0.45 roughness -> rgb 96..115)
        const roughVal = Math.round(96 + frac * 22);
        rCtx.fillStyle = `rgb(${roughVal}, ${roughVal}, ${roughVal})`;
        rCtx.fillRect(tx + pad, ty + pad, innerW, innerH);
      }
    }

    // Fine mineral grain across pavers
    for (let i = 0; i < 2400; i++) {
      const gx = (i * 173) % size;
      const gy = (i * 311) % size;
      const gSize = 1 + (i % 3);
      cCtx.fillStyle = i % 2 === 0 ? 'rgba(255, 240, 210, 0.035)' : 'rgba(8, 6, 14, 0.06)';
      cCtx.fillRect(gx, gy, gSize, gSize);
        bCtx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
        bCtx.fillRect(gx, gy, gSize, gSize);
      }
      }
    );

    const map = configureTexture(new THREE.CanvasTexture(colorCanvas), true, anisotropy, repeatX, repeatY);
    const bumpMap = configureTexture(new THREE.CanvasTexture(bumpCanvas), false, anisotropy, repeatX, repeatY);
    const roughnessMap = configureTexture(new THREE.CanvasTexture(roughCanvas), false, anisotropy, repeatX, repeatY);

    const material = new THREE.MeshStandardMaterial({
      color: options.tintHex ?? 0xffffff,
      map,
      bumpMap,
      bumpScale: 0.04,
      roughnessMap,
      roughness: 1.0, // Driven by roughnessMap (0.4 on tiles, 0.9 in crevices)
      metalness: 0.14,
      envMapIntensity: 0.95,
    });

    return {
      material,
      dispose: () => {
        map.dispose();
        bumpMap.dispose();
        roughnessMap.dispose();
        material.dispose();
      },
    };
  }

  if (type === 'carvedSandstone') {
    const repeatX = options.repeatX ?? 4;
    const repeatY = options.repeatY ?? 4;
    const { colorCanvas, bumpCanvas, roughCanvas } = getOrBuildCanvases(
      'carvedSandstone',
      (cCtx, bCtx, rCtx, size) => {
        // Rich warm Rajasthani sandstone (#d68952 to #e8ad76)
        const baseGrad = cCtx.createLinearGradient(0, 0, 0, size);
        baseGrad.addColorStop(0, '#e39e67');
        baseGrad.addColorStop(0.5, '#d68952');
        baseGrad.addColorStop(1, '#e8ad76');
        cCtx.fillStyle = baseGrad;
        cCtx.fillRect(0, 0, size, size);

        bCtx.fillStyle = 'rgb(165, 165, 165)';
        bCtx.fillRect(0, 0, size, size);

        rCtx.fillStyle = 'rgb(158, 158, 158)';
        rCtx.fillRect(0, 0, size, size);

        // Horizontal ashlar stone courses & block joints
        const courses = 8;
        const courseH = size / courses;
        for (let r = 0; r < courses; r++) {
          const y = r * courseH;
          const cols = 4;
          const blockW = size / cols;
          const offset = (r % 2) * (blockW * 0.5);

          for (let c = -1; c <= cols; c++) {
            const x = c * blockW + offset;
            const shade = Math.sin(r * 4.1 + c * 2.7) * 10;
            cCtx.fillStyle = `rgb(${Math.round(220 + shade)}, ${Math.round(145 + shade * 0.7)}, ${Math.round(90 + shade * 0.5)})`;
            cCtx.fillRect(x + 3, y + 3, blockW - 6, courseH - 6);

            // Recessed stone joint in diffuse, bump, and roughness
            cCtx.strokeStyle = '#7c3f1d';
            cCtx.lineWidth = 3;
            cCtx.strokeRect(x + 1.5, y + 1.5, blockW - 3, courseH - 3);

            bCtx.strokeStyle = 'rgb(45, 45, 45)';
            bCtx.lineWidth = 4;
            bCtx.strokeRect(x + 1.5, y + 1.5, blockW - 3, courseH - 3);

            rCtx.strokeStyle = 'rgb(225, 225, 225)';
            rCtx.lineWidth = 4;
            rCtx.strokeRect(x + 1.5, y + 1.5, blockW - 3, courseH - 3);
          }

          // Carved floral / lotus relief frieze band on every second course
          if (r % 2 === 1) {
            const bandY = y + courseH * 0.5;
            cCtx.fillStyle = '#f2be8c';
            cCtx.fillRect(0, bandY - 14, size, 28);
            bCtx.fillStyle = 'rgb(235, 235, 235)';
            bCtx.fillRect(0, bandY - 14, size, 28);
            rCtx.fillStyle = 'rgb(120, 120, 120)';
            rCtx.fillRect(0, bandY - 14, size, 28);

            const motifs = 16;
            const motifW = size / motifs;
            for (let m = 0; m < motifs; m++) {
              const mx = (m + 0.5) * motifW;
              // Carved diamond & lotus petal relief
              cCtx.fillStyle = '#b55e2c';
              cCtx.beginPath();
              cCtx.moveTo(mx, bandY - 11);
              cCtx.lineTo(mx + 14, bandY);
              cCtx.lineTo(mx, bandY + 11);
              cCtx.lineTo(mx - 14, bandY);
              cCtx.closePath();
              cCtx.fill();

              bCtx.fillStyle = 'rgb(75, 75, 75)';
              bCtx.beginPath();
              bCtx.moveTo(mx, bandY - 11);
              bCtx.lineTo(mx + 14, bandY);
              bCtx.lineTo(mx, bandY + 11);
              bCtx.lineTo(mx - 14, bandY);
              cCtx.closePath();
              bCtx.fill();
            }
          }
        }
      }
    );

    const map = configureTexture(new THREE.CanvasTexture(colorCanvas), true, anisotropy, repeatX, repeatY);
    const bumpMap = configureTexture(new THREE.CanvasTexture(bumpCanvas), false, anisotropy, repeatX, repeatY);
    const roughnessMap = configureTexture(new THREE.CanvasTexture(roughCanvas), false, anisotropy, repeatX, repeatY);

    const material = new THREE.MeshStandardMaterial({
      color: options.tintHex ?? 0xffffff,
      map,
      bumpMap,
      bumpScale: 0.05,
      roughnessMap,
      roughness: 0.85,
      metalness: 0.12,
      emissive: options.emissiveHex ?? 0x240e04,
      emissiveIntensity: options.emissiveIntensity ?? 0.05,
      envMapIntensity: 0.8,
    });

    return {
      material,
      dispose: () => {
        map.dispose();
        bumpMap.dispose();
        roughnessMap.dispose();
        material.dispose();
      },
    };
  }

  // `ornateSilk`: Deep crimson (#8c1428), royal saffron (#d95b16), and peacock emerald (#0b525b) with woven gold Zari border patterns
  const variant = options.silkVariant ?? 'crimson';
  const repeatX = options.repeatX ?? 2;
  const repeatY = options.repeatY ?? 2;

  const { colorCanvas, bumpCanvas, roughCanvas } = getOrBuildCanvases(
    `ornateSilk_${variant}`,
    (cCtx, bCtx, rCtx, size) => {
      const baseHex =
        variant === 'crimson'
          ? '#8c1428'
          : variant === 'saffron'
          ? '#d95b16'
          : '#0b525b';
      const highlightHex =
        variant === 'crimson'
          ? '#ad1c35'
          : variant === 'saffron'
          ? '#ef742b'
          : '#12707c';

      const silkGrad = cCtx.createLinearGradient(0, 0, size, size);
      silkGrad.addColorStop(0, baseHex);
      silkGrad.addColorStop(0.5, highlightHex);
      silkGrad.addColorStop(1, baseHex);
      cCtx.fillStyle = silkGrad;
      cCtx.fillRect(0, 0, size, size);

      bCtx.fillStyle = 'rgb(128, 128, 128)';
      bCtx.fillRect(0, 0, size, size);

      rCtx.fillStyle = 'rgb(118, 118, 118)'; // Silk sheen (~0.46 roughness)
      rCtx.fillRect(0, 0, size, size);

      // Fine silk cross-weave threads
      cCtx.strokeStyle = 'rgba(255, 235, 190, 0.06)';
      cCtx.lineWidth = 1;
      for (let i = 0; i < size; i += 8) {
        cCtx.beginPath();
        cCtx.moveTo(0, i);
        cCtx.lineTo(size, i);
        cCtx.stroke();
      }

      // Woven Gold Zari Border Bands & Buti Motifs
      const zariBands = [size * 0.14, size * 0.86];
      zariBands.forEach((by) => {
        cCtx.fillStyle = '#f5b841';
        cCtx.fillRect(0, by - 22, size, 44);
        cCtx.strokeStyle = '#fffbeb';
        cCtx.lineWidth = 3;
        cCtx.strokeRect(0, by - 22, size, 44);

        bCtx.fillStyle = 'rgb(230, 230, 230)';
        bCtx.fillRect(0, by - 22, size, 44);

        rCtx.fillStyle = 'rgb(64, 64, 64)'; // Metallic gold Zari threads (~0.25 roughness)
        rCtx.fillRect(0, by - 22, size, 44);

        for (let x = 16; x < size; x += 32) {
          cCtx.fillStyle = baseHex;
          cCtx.beginPath();
          cCtx.moveTo(x, by - 14);
          cCtx.lineTo(x + 10, by);
          cCtx.lineTo(x, by + 14);
          cCtx.lineTo(x - 10, by);
          cCtx.closePath();
          cCtx.fill();
        }
      });

      // Woven Zari Buti medallions across the silk field
      for (let r = 1; r <= 3; r++) {
        const my = size * (0.25 + (r - 1) * 0.25);
        for (let c = 0; c < 8; c++) {
          const mx = (c + 0.5) * (size / 8);
          cCtx.fillStyle = '#f5b841';
          cCtx.beginPath();
          cCtx.arc(mx, my, 12, 0, Math.PI * 2);
          cCtx.fill();
          bCtx.fillStyle = 'rgb(220, 220, 220)';
          bCtx.beginPath();
          bCtx.arc(mx, my, 12, 0, Math.PI * 2);
          bCtx.fill();
          rCtx.fillStyle = 'rgb(70, 70, 70)';
          rCtx.beginPath();
          rCtx.arc(mx, my, 12, 0, Math.PI * 2);
          rCtx.fill();
        }
      }
    }
  );

  const map = configureTexture(new THREE.CanvasTexture(colorCanvas), true, anisotropy, repeatX, repeatY);
  const bumpMap = configureTexture(new THREE.CanvasTexture(bumpCanvas), false, anisotropy, repeatX, repeatY);
  const roughnessMap = configureTexture(new THREE.CanvasTexture(roughCanvas), false, anisotropy, repeatX, repeatY);

  const material = new THREE.MeshStandardMaterial({
    color: options.tintHex ?? 0xffffff,
    map,
    bumpMap,
    bumpScale: 0.03,
    roughnessMap,
    roughness: 0.72,
    metalness: 0.22,
    side: THREE.DoubleSide,
  });

  return {
    material,
    dispose: () => {
      map.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
      material.dispose();
    },
  };
}
