import * as THREE from 'three';

export type PBRMaterialType =
  | 'royalCobblestone'
  | 'carvedSandstone'
  | 'ornateSilk'
  | 'wetMarbleGulal';
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
 * - `royalCobblestone`: Reflective night basalt cobblestone (#14111c to #1f1a2c) with warm bronze/gold inlaid mortar lines,
 *    matching grayscale bumpMap (bumpScale: 0.04), and low roughness (0.25) + metalness (0.2) for wet night reflections.
 * - `wetMarbleGulal`: White Makrana marble courtyard floor heavily splashed with overlapping magenta, turmeric yellow,
 *    cyan, and violet Gulal powder decals (roughness: 0.25 so it gleams like wet marble in golden-hour sunlight).
 * - `carvedSandstone`: Rich warm Rajasthani sandstone (#d68952 to #e8ad76) with horizontal stone block joints,
 *    carved floral relief bands, bumpScale: 0.05, and warm golden rim reflections.
 * - `ornateSilk`: Deep crimson (#8c1428), royal saffron (#d95b16), and peacock emerald (#0b525b) with woven gold Zari border patterns.
 */
export function createPBRMaterial(
  type: PBRMaterialType,
  options: CreatePBRMaterialOptions = {}
): PBRMaterialBundle {
  const anisotropy = options.anisotropy ?? 16;

  if (type === 'wetMarbleGulal') {
    const repeatX = options.repeatX ?? 16;
    const repeatY = options.repeatY ?? 16;
    const { colorCanvas, bumpCanvas, roughCanvas } = getOrBuildCanvases(
      'wetMarbleGulal_sandstoneSlateInlay',
      (cCtx, bCtx, rCtx, size) => {
        // 1. Warm Medium Sandstone Base (#b8865c) — Zero near-white glare under sunlight!
        cCtx.fillStyle = '#b8865c';
        cCtx.fillRect(0, 0, size, size);

        bCtx.fillStyle = 'rgb(185, 185, 185)';
        bCtx.fillRect(0, 0, size, size);

        rCtx.fillStyle = 'rgb(204, 204, 204)'; // ~0.80 matte stone roughness
        rCtx.fillRect(0, 0, size, size);

        // 2. Patterned Sandstone & Deep Slate (#3a3542) Geometric Courtyard Inlay Grid
        const grid = 4;
        const tileSpan = size / grid;
        for (let r = 0; r < grid; r++) {
          for (let c = 0; c < grid; c++) {
            const tx = c * tileSpan;
            const ty = r * tileSpan;
            const cx = tx + tileSpan * 0.5;
            const cy = ty + tileSpan * 0.5;

            // Alternate warm terracotta-sandstone (#ad7a50) & medium sandstone (#c18f65) field tiles
            cCtx.fillStyle = (r + c) % 2 === 0 ? '#b8865c' : '#a8764d';
            cCtx.fillRect(tx + 4, ty + 4, tileSpan - 8, tileSpan - 8);

            // Deep Slate (#3a3542) recessed border frame around each courtyard slab
            cCtx.strokeStyle = '#3a3542';
            cCtx.lineWidth = 10;
            cCtx.strokeRect(tx + 8, ty + 8, tileSpan - 16, tileSpan - 16);

            // Warm brass-ochre inner hairline inlay (#8c5a32)
            cCtx.strokeStyle = '#784b27';
            cCtx.lineWidth = 3;
            cCtx.strokeRect(tx + 18, ty + 18, tileSpan - 36, tileSpan - 36);

            // Central Geometric Slate (#3a3542) Diamond/Octagon Inlay Medallion inside each tile
            const medR = tileSpan * 0.22;
            cCtx.fillStyle = '#3a3542';
            cCtx.beginPath();
            cCtx.moveTo(cx, cy - medR);
            cCtx.lineTo(cx + medR, cy);
            cCtx.lineTo(cx, cy + medR);
            cCtx.lineTo(cx - medR, cy);
            cCtx.closePath();
            cCtx.fill();

            cCtx.fillStyle = '#9c6b43';
            cCtx.beginPath();
            cCtx.arc(cx, cy, medR * 0.42, 0, Math.PI * 2);
            cCtx.fill();

            // Matching bump relief for mortar joints and inlay medallions
            bCtx.strokeStyle = 'rgb(75, 75, 75)';
            bCtx.lineWidth = 8;
            bCtx.strokeRect(tx + 4, ty + 4, tileSpan - 8, tileSpan - 8);

            bCtx.strokeStyle = 'rgb(130, 130, 130)';
            bCtx.lineWidth = 4;
            bCtx.beginPath();
            bCtx.moveTo(cx, cy - medR);
            bCtx.lineTo(cx + medR, cy);
            bCtx.lineTo(cx, cy + medR);
            bCtx.lineTo(cx - medR, cy);
            bCtx.closePath();
            bCtx.stroke();
          }
        }

        // 3. Natural Sandstone Mineral Grain (zero white highlights)
        for (let g = 0; g < 220; g++) {
          const gx = (g * 193 + 37) % size;
          const gy = (g * 271 + 83) % size;
          const gr = 4 + (g % 5) * 3;
          cCtx.fillStyle =
            g % 2 === 0
              ? 'rgba(140, 92, 56, 0.18)'
              : 'rgba(58, 53, 66, 0.14)';
          cCtx.beginPath();
          cCtx.arc(gx, gy, gr, 0, Math.PI * 2);
          cCtx.fill();
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
      bumpScale: 0.035,
      roughnessMap,
      roughness: 0.8,
      metalness: 0.05,
      envMapIntensity: 0.45,
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

        // Roughness map: wet night basalt stone surface (~0.22 - 0.28 roughness -> rgb 56..72)
        const roughVal = Math.round(56 + frac * 16);
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
      roughness: 0.25, // Reflective night cobblestone (wet-look dark basalt floor)
      metalness: 0.2,
      envMapIntensity: 1.2,
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
      'carvedSandstone_medium',
      (cCtx, bCtx, rCtx, size) => {
        // Warm Medium Rajasthani Sandstone (#b8865c base) so stairs & masonry never glare white
        const baseGrad = cCtx.createLinearGradient(0, 0, 0, size);
        baseGrad.addColorStop(0, '#be8c62');
        baseGrad.addColorStop(0.5, '#b8865c');
        baseGrad.addColorStop(1, '#ab784e');
        cCtx.fillStyle = baseGrad;
        cCtx.fillRect(0, 0, size, size);

        bCtx.fillStyle = 'rgb(165, 165, 165)';
        bCtx.fillRect(0, 0, size, size);

        rCtx.fillStyle = 'rgb(204, 204, 204)'; // ~0.80 roughness
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
            const shade = Math.sin(r * 4.1 + c * 2.7) * 8;
            cCtx.fillStyle = `rgb(${Math.round(184 + shade)}, ${Math.round(134 + shade * 0.7)}, ${Math.round(92 + shade * 0.5)})`;
            cCtx.fillRect(x + 3, y + 3, blockW - 6, courseH - 6);

            // Recessed stone joint in diffuse, bump, and roughness
            cCtx.strokeStyle = '#5c3318';
            cCtx.lineWidth = 3;
            cCtx.strokeRect(x + 1.5, y + 1.5, blockW - 3, courseH - 3);

            bCtx.strokeStyle = 'rgb(45, 45, 45)';
            bCtx.lineWidth = 4;
            bCtx.strokeRect(x + 1.5, y + 1.5, blockW - 3, courseH - 3);

            rCtx.strokeStyle = 'rgb(235, 235, 235)';
            rCtx.lineWidth = 4;
            rCtx.strokeRect(x + 1.5, y + 1.5, blockW - 3, courseH - 3);
          }

          // Carved floral / lotus relief frieze band on every second course
          if (r % 2 === 1) {
            const bandY = y + courseH * 0.5;
            cCtx.fillStyle = '#c9976d';
            cCtx.fillRect(0, bandY - 14, size, 28);
            bCtx.fillStyle = 'rgb(220, 220, 220)';
            bCtx.fillRect(0, bandY - 14, size, 28);
            rCtx.fillStyle = 'rgb(190, 190, 190)';
            rCtx.fillRect(0, bandY - 14, size, 28);

            const motifs = 16;
            const motifW = size / motifs;
            for (let m = 0; m < motifs; m++) {
              const mx = (m + 0.5) * motifW;
              // Carved diamond & lotus petal relief
              cCtx.fillStyle = '#7c421e';
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
      roughness: 0.8,
      metalness: 0.05,
      emissive: options.emissiveHex ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0.0,
      envMapIntensity: 0.45,
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
