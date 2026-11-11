import * as THREE from 'three';
import { MELA_RIDES, MELA_STALLS } from './rules';

export const BLOOM_LAYER = 1;

export interface MelaRidesAndStallsRig {
  rootGroup: THREE.Group;
  giantWheelWheelGroup: THREE.Group;
  giantWheelCabins: THREE.Group[];
  carouselSpinnerGroup: THREE.Group;
  carouselHorses: THREE.Group[];
  columbusPendulumGroup: THREE.Group;
  balloonStallTargets: THREE.Mesh[];
  updateKinematics: (elapsedSec: number) => void;
  dispose: () => void;
}

/**
 * Builds composite 3–12 part 3D models for:
 * 1. Aakash Jhula (Giant Wheel) with 8 hanging gondolas & glowing neon bulbs (BLOOM_LAYER)
 * 2. Rajwada Carousel (Merry-Go-Round) with bobbing horses & striped silk canopy
 * 3. Samudra Nauka (Columbus Swinging Pirate Boat) with A-frame towers & illuminated hull
 * 4. Balloon Shooting Stall, Ring Toss Stall, and Prize & Chaat Shop Stall
 */
export function buildMelaRidesAndStalls(
  canopyStripeTex: THREE.CanvasTexture,
  woodGrainTex: THREE.CanvasTexture
): MelaRidesAndStallsRig {
  const rootGroup = new THREE.Group();
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometriesToDispose.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materialsToDispose.push(m);
    return m;
  };

  // Shared PBR & Emissive Materials
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.25,
      metalness: 0.78,
    })
  );
  const crimsonStructuralMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xbe123c,
      roughness: 0.45,
      metalness: 0.3,
    })
  );
  const royalBlueMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.4,
      metalness: 0.35,
    })
  );
  const teakWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: woodGrainTex,
      roughness: 0.65,
      metalness: 0.1,
    })
  );
  const canopySilkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: canopyStripeTex,
      roughness: 0.55,
      metalness: 0.12,
    })
  );

  // Selective Bloom Emissive Bulb Materials
  const neonAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.6,
      roughness: 0.2,
    })
  );
  const neonMagentaMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xf43f5e,
      emissiveIntensity: 2.5,
      roughness: 0.2,
    })
  );
  const neonCyanMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.5,
      roughness: 0.2,
    })
  );

  const enableBloom = (mesh: THREE.Object3D) => {
    mesh.layers.enable(BLOOM_LAYER);
  };

  // =========================================================================
  // 1. AAKASH JHULA (GIANT FERRIS WHEEL) at (0, 0, -32)
  // =========================================================================
  const giantWheelSpec = MELA_RIDES[0];
  const giantWheelAnchor = new THREE.Group();
  giantWheelAnchor.position.set(giantWheelSpec.x, 0, giantWheelSpec.z);

  // Base platform
  const gwBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(5.2, 5.8, 0.7, 24)),
    teakWoodMat
  );
  gwBase.position.y = 0.35;
  gwBase.receiveShadow = true;
  giantWheelAnchor.add(gwBase);

  // A-frame support legs (front and back)
  const legGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.42, 13.5, 12));
  [-1.6, 1.6].forEach((zOff) => {
    [-1, 1].forEach((xSign) => {
      const leg = new THREE.Mesh(legGeo, crimsonStructuralMat);
      leg.position.set(xSign * 2.2, 6.5, zOff);
      leg.rotation.z = xSign * 0.17;
      leg.castShadow = true;
      giantWheelAnchor.add(leg);
    });
  });

  // Rotating Wheel Group at Y = 12.5m
  const giantWheelWheelGroup = new THREE.Group();
  giantWheelWheelGroup.position.set(0, 12.5, 0);
  giantWheelAnchor.add(giantWheelWheelGroup);

  const wheelRadius = 9.2;
  const rimGeo = trackGeo(new THREE.TorusGeometry(wheelRadius, 0.22, 12, 48));
  [-0.85, 0.85].forEach((zOff) => {
    const rim = new THREE.Mesh(rimGeo, brassMat);
    rim.position.z = zOff;
    giantWheelWheelGroup.add(rim);
  });

  // Central glowing hub
  const hubMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16)),
    neonAmberMat
  );
  hubMesh.rotation.x = Math.PI / 2;
  enableBloom(hubMesh);
  giantWheelWheelGroup.add(hubMesh);

  // 8 Spokes, Bulb Rings, and Counter-Rotating Passenger Cabins
  const spokeGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.08, wheelRadius * 2, 8));
  const bulbGeo = trackGeo(new THREE.SphereGeometry(0.18, 8, 8));
  const cabinRoofGeo = trackGeo(new THREE.ConeGeometry(1.05, 0.65, 8));
  const cabinBasketGeo = trackGeo(new THREE.CylinderGeometry(0.85, 0.72, 0.9, 8));

  const giantWheelCabins: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    if (i < 4) {
      const spoke = new THREE.Mesh(spokeGeo, brassMat);
      spoke.rotation.z = angle;
      giantWheelWheelGroup.add(spoke);
    }

    // Glowing perimeter bulb
    const bulb = new THREE.Mesh(
      bulbGeo,
      i % 2 === 0 ? neonMagentaMat : neonCyanMat
    );
    bulb.position.set(
      Math.cos(angle) * wheelRadius,
      Math.sin(angle) * wheelRadius,
      1.0
    );
    enableBloom(bulb);
    giantWheelWheelGroup.add(bulb);

    // Passenger Gondola Cabin
    const cabin = new THREE.Group();
    cabin.position.set(
      Math.cos(angle) * wheelRadius,
      Math.sin(angle) * wheelRadius,
      0
    );

    const roof = new THREE.Mesh(cabinRoofGeo, canopySilkMat);
    roof.position.y = 0.55;
    cabin.add(roof);

    const basket = new THREE.Mesh(
      cabinBasketGeo,
      i % 2 === 0 ? crimsonStructuralMat : royalBlueMat
    );
    basket.position.y = -0.55;
    cabin.add(basket);

    const lantern = new THREE.Mesh(bulbGeo, neonAmberMat);
    lantern.position.set(0, 0.1, 0);
    enableBloom(lantern);
    cabin.add(lantern);

    giantWheelCabins.push(cabin);
    giantWheelWheelGroup.add(cabin);
  }

  rootGroup.add(giantWheelAnchor);

  // =========================================================================
  // 2. RAJWADA CAROUSEL (MERRY-GO-ROUND) at (-29, 0, -16)
  // =========================================================================
  const carouselSpec = MELA_RIDES[1];
  const carouselAnchor = new THREE.Group();
  carouselAnchor.position.set(carouselSpec.x, 0, carouselSpec.z);

  const carouselBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(5.2, 5.5, 0.55, 24)),
    brassMat
  );
  carouselBase.position.y = 0.28;
  carouselBase.receiveShadow = true;
  carouselAnchor.add(carouselBase);

  const carouselCenterPillar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.85, 0.95, 5.2, 16)),
    crimsonStructuralMat
  );
  carouselCenterPillar.position.y = 2.8;
  carouselAnchor.add(carouselCenterPillar);

  const carouselSpinnerGroup = new THREE.Group();
  carouselAnchor.add(carouselSpinnerGroup);

  const carouselCanopy = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(5.6, 2.4, 24)),
    canopySilkMat
  );
  carouselCanopy.position.y = 6.2;
  carouselCanopy.castShadow = true;
  carouselSpinnerGroup.add(carouselCanopy);

  const carouselFinial = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.45, 12, 12)),
    neonAmberMat
  );
  carouselFinial.position.y = 7.55;
  enableBloom(carouselFinial);
  carouselSpinnerGroup.add(carouselFinial);

  const carouselHorses: THREE.Group[] = [];
  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 4.8, 8));
  const horseBodyGeo = trackGeo(new THREE.CapsuleGeometry(0.32, 0.75, 6, 12));
  const horseHeadGeo = trackGeo(new THREE.ConeGeometry(0.24, 0.55, 8));

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = 4.1;
    const pole = new THREE.Mesh(poleGeo, brassMat);
    pole.position.set(Math.cos(angle) * r, 2.8, Math.sin(angle) * r);
    carouselSpinnerGroup.add(pole);

    // Rim bulb
    const rimBulb = new THREE.Mesh(
      bulbGeo,
      i % 2 === 0 ? neonAmberMat : neonMagentaMat
    );
    rimBulb.position.set(Math.cos(angle) * 5.2, 5.05, Math.sin(angle) * 5.2);
    enableBloom(rimBulb);
    carouselSpinnerGroup.add(rimBulb);

    // Carousel Horse Mount
    const horse = new THREE.Group();
    horse.position.set(Math.cos(angle) * r, 1.8, Math.sin(angle) * r);
    horse.rotation.y = -angle;

    const body = new THREE.Mesh(
      horseBodyGeo,
      i % 2 === 0 ? royalBlueMat : crimsonStructuralMat
    );
    body.rotation.x = Math.PI / 2;
    horse.add(body);

    const head = new THREE.Mesh(horseHeadGeo, brassMat);
    head.position.set(0, 0.45, 0.48);
    head.rotation.x = Math.PI / 4;
    horse.add(head);

    carouselHorses.push(horse);
    carouselSpinnerGroup.add(horse);
  }

  rootGroup.add(carouselAnchor);

  // =========================================================================
  // 3. SAMUDRA NAUKA (COLUMBUS SWINGING BOAT) at (29, 0, -16)
  // =========================================================================
  const boatSpec = MELA_RIDES[2];
  const boatAnchor = new THREE.Group();
  boatAnchor.position.set(boatSpec.x, 0, boatSpec.z);

  const boatBase = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(5.6, 0.6, 9.6)),
    teakWoodMat
  );
  boatBase.position.y = 0.3;
  boatBase.receiveShadow = true;
  boatAnchor.add(boatBase);

  // A-frame support pillars
  const boatLegGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.36, 12.2, 10));
  [-2.2, 2.2].forEach((xOff) => {
    [-1, 1].forEach((zSign) => {
      const leg = new THREE.Mesh(boatLegGeo, royalBlueMat);
      leg.position.set(xOff, 5.8, zSign * 2.4);
      leg.rotation.x = -zSign * 0.2;
      leg.castShadow = true;
      boatAnchor.add(leg);
    });
  });

  const columbusPendulumGroup = new THREE.Group();
  columbusPendulumGroup.position.set(0, 11.5, 0);
  boatAnchor.add(columbusPendulumGroup);

  // Hanger struts
  const strutGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.1, 7.6, 8));
  [-1.2, 1.2].forEach((xOff) => {
    const strut = new THREE.Mesh(strutGeo, brassMat);
    strut.position.set(xOff, -3.8, 0);
    columbusPendulumGroup.add(strut);
  });

  // Ship Hull at bottom of pendulum (y = -7.6)
  const hullGroup = new THREE.Group();
  hullGroup.position.set(0, -7.6, 0);

  const hullMain = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.6, 1.4, 6.2)),
    crimsonStructuralMat
  );
  hullGroup.add(hullMain);

  // Prow & Stern tapered cones
  [-1, 1].forEach((zSign) => {
    const prow = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(1.3, 2.2, 6)),
      brassMat
    );
    prow.position.set(0, 0.4, zSign * 3.8);
    prow.rotation.x = zSign * (Math.PI / 2.4);
    hullGroup.add(prow);

    const prowLantern = new THREE.Mesh(bulbGeo, neonCyanMat);
    prowLantern.position.set(0, 1.2, zSign * 4.4);
    enableBloom(prowLantern);
    hullGroup.add(prowLantern);
  });

  columbusPendulumGroup.add(hullGroup);
  rootGroup.add(boatAnchor);

  // =========================================================================
  // 4. OPEN, AIRY INDIAN BAZAAR PAVILIONS (See-through silhouettes, zero boxy walls)
  // =========================================================================
  const balloonStallTargets: THREE.Mesh[] = [];
  const stallBalloonGeo = trackGeo(new THREE.SphereGeometry(0.22, 12, 12));

  const canopyCrimsonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9e1b32,
      roughness: 0.65,
      metalness: 0.08,
      emissiveIntensity: 0,
    })
  );
  const canopySaffronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe86f1c,
      roughness: 0.65,
      metalness: 0.08,
      emissiveIntensity: 0,
    })
  );
  const canopyTealMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f6b6e,
      roughness: 0.65,
      metalness: 0.08,
      emissiveIntensity: 0,
    })
  );
  const goldTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf5b841,
      roughness: 0.32,
      metalness: 0.72,
      emissiveIntensity: 0,
    })
  );
  const carvedWoodPillarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6b3e26,
      map: woodGrainTex,
      roughness: 0.68,
      metalness: 0.08,
      emissiveIntensity: 0,
    })
  );

  const canopyPalette = [canopyCrimsonMat, canopySaffronMat, canopyTealMat];
  const slenderPillarGeo = trackGeo(
    new THREE.CylinderGeometry(0.12, 0.12, 3.4, 12)
  );
  const pillarCapitalGeo = trackGeo(
    new THREE.CylinderGeometry(0.2, 0.14, 0.22, 12)
  );
  const scallopValanceGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 12));
  const innerLanternGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.1, 0.32, 8));

  const buildOpenBazaarPavilion = (
    px: number,
    pz: number,
    rotY: number,
    colorIndex: number,
    stallId?: string
  ) => {
    const pavGroup = new THREE.Group();
    pavGroup.position.set(px, 0, pz);
    pavGroup.rotation.y = rotY;

    const roofMat = canopyPalette[colorIndex % canopyPalette.length];

    // Open counter table (height: 1.1m — completely open above counter so sightlines pass right through)
    const counterBase = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.2, 1.0, 1.35)),
      carvedWoodPillarMat
    );
    counterBase.position.set(0, 0.5, 0);
    counterBase.castShadow = true;
    counterBase.receiveShadow = true;
    pavGroup.add(counterBase);

    const counterTop = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.4, 0.1, 1.5)),
      goldTrimMat
    );
    counterTop.position.set(0, 1.05, 0);
    counterTop.receiveShadow = true;
    pavGroup.add(counterTop);

    // 4 Slender Carved Wooden Corner Pillars (radius: 0.12)
    [-2.0, 2.0].forEach((cx) => {
      [-1.05, 1.05].forEach((cz) => {
        const pillar = new THREE.Mesh(slenderPillarGeo, carvedWoodPillarMat);
        pillar.position.set(cx, 1.7, cz);
        pillar.castShadow = true;
        pavGroup.add(pillar);

        const cap = new THREE.Mesh(pillarCapitalGeo, goldTrimMat);
        cap.position.set(cx, 3.32, cz);
        pavGroup.add(cap);
      });
    });

    // Scalloped Fabric Canopy Roof with Gold Trim (zero emissive bloom on roof)
    const canopyMain = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(3.25, 1.15, 4)),
      roofMat
    );
    canopyMain.position.y = 3.98;
    canopyMain.rotation.y = Math.PI / 4;
    canopyMain.castShadow = true;
    pavGroup.add(canopyMain);

    const goldEaveTrim = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.55, 0.1, 2.55)),
      goldTrimMat
    );
    goldEaveTrim.position.y = 3.42;
    pavGroup.add(goldEaveTrim);

    // Scalloped fabric valance border along front & back eaves
    for (let s = -4; s <= 4; s++) {
      const scallopFront = new THREE.Mesh(
        scallopValanceGeo,
        s % 2 === 0 ? roofMat : goldTrimMat
      );
      scallopFront.position.set(s * 0.48, 3.3, 1.24);
      scallopFront.rotation.x = Math.PI / 2;
      pavGroup.add(scallopFront);
    }

    // Warm Inner Hanging Lantern Core (small point source under canopy)
    const innerLantern = new THREE.Mesh(innerLanternGeo, neonAmberMat);
    innerLantern.position.set(0, 3.05, 0);
    enableBloom(innerLantern);
    pavGroup.add(innerLantern);

    // Subtle open-frame stall props (never blocking sightlines)
    if (stallId === 'balloon_shoot') {
      const frameBar = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 3.6, 8)),
        goldTrimMat
      );
      frameBar.rotation.z = Math.PI / 2;
      frameBar.position.set(0, 2.15, -0.45);
      pavGroup.add(frameBar);

      for (let b = 0; b < 6; b++) {
        const bMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: b % 3 === 0 ? 0x9e1b32 : b % 3 === 1 ? 0xe86f1c : 0x0f6b6e,
            roughness: 0.35,
            metalness: 0.1,
            emissiveIntensity: 0.08,
          })
        );
        const bMesh = new THREE.Mesh(stallBalloonGeo, bMat);
        bMesh.position.set(-1.5 + b * 0.6, 2.0 + (b % 2) * 0.35, -0.45);
        balloonStallTargets.push(bMesh);
        pavGroup.add(bMesh);
      }
    } else if (stallId === 'ring_toss') {
      const pegGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.09, 0.42, 10));
      for (let p = 0; p < 5; p++) {
        const peg = new THREE.Mesh(pegGeo, goldTrimMat);
        peg.position.set(-1.1 + p * 0.55, 1.31, 0);
        pavGroup.add(peg);
      }
    } else if (stallId === 'prize_shop') {
      const kalashGeo = trackGeo(new THREE.SphereGeometry(0.18, 12, 10));
      for (let t = 0; t < 4; t++) {
        const trophy = new THREE.Mesh(kalashGeo, goldTrimMat);
        trophy.position.set(-1.05 + t * 0.7, 1.28, 0);
        pavGroup.add(trophy);
      }
    }

    rootGroup.add(pavGroup);
  };

  // Build the 3 Interactive Mini-Game Bazaar Pavilions on the West/Left Bazaar Avenue
  MELA_STALLS.forEach((stall, idx) => {
    buildOpenBazaarPavilion(
      stall.x,
      stall.z,
      Math.atan2(-stall.x, -stall.z),
      idx,
      stall.id
    );
  });

  // 2 Additional Open Airy Artisan Pavilions flanking the West Bazaar curve (never blocking the East Ride Deck!)
  buildOpenBazaarPavilion(-22, -16, Math.PI / 3, 0);
  buildOpenBazaarPavilion(-22, 6, (Math.PI * 2) / 3, 2);

  // =========================================================================
  // 5. GOLDEN-SANDSTONE BORDER WALKWAYS & RAISED PAVED RIDE DECK WITH BRASS RAILINGS
  // =========================================================================
  const sandstoneWalkwayMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x352b38,
      roughness: 0.82,
      metalness: 0.06,
      emissiveIntensity: 0,
    })
  );
  const goldenSandstoneBorderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd49b6a,
      roughness: 0.65,
      metalness: 0.14,
      emissiveIntensity: 0,
    })
  );
  const ivoryGoldCurbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe8c391,
      roughness: 0.55,
      metalness: 0.22,
      emissiveIntensity: 0,
    })
  );

  const buildGoldenSandstoneWalkway = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    width = 3.4
  ) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const midX = (x1 + x2) * 0.5;
    const midZ = (z1 + z2) * 0.5;

    // Subtle dark slate inner runner
    const runner = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(width, 0.028, len)),
      sandstoneWalkwayMat
    );
    runner.position.set(midX, 0.014, midZ);
    runner.rotation.y = angle;
    runner.receiveShadow = true;
    rootGroup.add(runner);

    // Clean golden-sandstone border strips along both edges
    const halfW = width * 0.5 + 0.16;
    [-halfW, halfW].forEach((sideX) => {
      const border = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.28, 0.045, len)),
        goldenSandstoneBorderMat
      );
      border.position.set(
        midX + Math.cos(angle) * sideX,
        0.022,
        midZ - Math.sin(angle) * sideX
      );
      border.rotation.y = angle;
      border.receiveShadow = true;
      rootGroup.add(border);
    });
  };

  // 1) Central Rangoli (0, 0) -> Temple Mandap (0, -16.5)
  buildGoldenSandstoneWalkway(0, -5.2, 0, -16.5, 4.2);
  // 2) Central Rangoli (0, 0) -> Raised Ride Deck on the Right (22, -16)
  buildGoldenSandstoneWalkway(5.0, -2.5, 22.5, -15.5, 3.2);
  // 3) Central Rangoli (0, 0) -> Open Bazaar Pavilions on the Left (-28, -11)
  buildGoldenSandstoneWalkway(-5.0, -2.0, -28.0, -11.0, 3.2);

  // Raised Paved Ride Deck on the Right Side (x > 22) Framed by Clean Low Decorative Brass Railings
  const rideDeckCenter = { x: 34.5, z: -20.5 };
  const rideDeckRadius = 18.5;
  const rideDeckMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(rideDeckRadius, rideDeckRadius + 0.45, 0.16, 48)),
    sandstoneWalkwayMat
  );
  rideDeckMesh.position.set(rideDeckCenter.x, 0.08, rideDeckCenter.z);
  rideDeckMesh.receiveShadow = true;
  rootGroup.add(rideDeckMesh);

  // Golden-sandstone outer coping rim around the raised Ride Deck
  const rideDeckRim = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(rideDeckRadius, 0.18, 8, 64)),
    ivoryGoldCurbMat
  );
  rideDeckRim.rotation.x = Math.PI / 2;
  rideDeckRim.position.set(rideDeckCenter.x, 0.16, rideDeckCenter.z);
  rootGroup.add(rideDeckRim);

  // Clean Low Decorative Brass Railings around the Ride Deck (leaving a wide entrance gap facing the walkway)
  const railPostGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.82, 8));
  const railFinialGeo = trackGeo(new THREE.SphereGeometry(0.085, 8, 8));
  const railPostCount = 28;
  for (let i = 0; i < railPostCount; i++) {
    const angle = (i / railPostCount) * Math.PI * 2;
    // Leave entrance opening on the West-Southwest side (angle around 2.4 to 3.1 rad)
    const normAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (normAngle > 2.25 && normAngle < 3.05) continue;

    const px = rideDeckCenter.x + Math.cos(angle) * (rideDeckRadius - 0.35);
    const pz = rideDeckCenter.z + Math.sin(angle) * (rideDeckRadius - 0.35);

    const post = new THREE.Mesh(railPostGeo, goldTrimMat);
    post.position.set(px, 0.56, pz);
    rootGroup.add(post);

    const finial = new THREE.Mesh(railFinialGeo, brassMat);
    finial.position.set(px, 1.0, pz);
    rootGroup.add(finial);
  }

  // Subtle Bazaar Deck Disc on the West Side
  const bazaarPlazaDisc = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(15.5, 15.8, 0.06, 36)),
    sandstoneWalkwayMat
  );
  bazaarPlazaDisc.position.set(-31, 0.03, -13);
  bazaarPlazaDisc.receiveShadow = true;
  rootGroup.add(bazaarPlazaDisc);

  const updateKinematics = (elapsedSec: number) => {
    // 1. Giant Wheel smooth delta-time rotation + counter-rotating upright cabins
    const wheelAngle = elapsedSec * 0.48;
    giantWheelWheelGroup.rotation.z = wheelAngle;
    for (let i = 0; i < giantWheelCabins.length; i++) {
      giantWheelCabins[i].rotation.z = -wheelAngle;
    }

    // 2. Carousel rotation + sinusoidal horse bobbing
    const carouselAngle = elapsedSec * 0.95;
    carouselSpinnerGroup.rotation.y = carouselAngle;
    for (let i = 0; i < carouselHorses.length; i++) {
      carouselHorses[i].position.y =
        1.8 + Math.sin(elapsedSec * 3.2 + i * 0.8) * 0.35;
    }

    // 3. Columbus Swinging Boat pendulum motion
    const swingAngle = Math.sin(elapsedSec * 1.65) * 0.78;
    columbusPendulumGroup.rotation.x = swingAngle;

    // 4. Balloon Stall animated floating targets
    for (let i = 0; i < balloonStallTargets.length; i++) {
      balloonStallTargets[i].position.y =
        2.1 + (i % 2) * 0.45 + Math.sin(elapsedSec * 2.8 + i) * 0.16;
    }
  };

  const dispose = () => {
    geometriesToDispose.forEach((g) => g.dispose());
    materialsToDispose.forEach((m) => m.dispose());
  };

  return {
    rootGroup,
    giantWheelWheelGroup,
    giantWheelCabins,
    carouselSpinnerGroup,
    carouselHorses,
    columbusPendulumGroup,
    balloonStallTargets,
    updateKinematics,
    dispose,
  };
}
