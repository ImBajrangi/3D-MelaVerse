import * as THREE from 'three';
import { MELA_RIDES, MELA_STALLS } from './rules';
import { createPBRMaterial, type PBRMaterialBundle } from './pbrMaterials';

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
 * Helper to create a cusped Mughal/Rajput scalloped arch (Mehrab) valance via THREE.Shape + THREE.ExtrudeGeometry
 */
function createScallopedArchGeometry(
  width: number,
  height: number,
  depth: number,
  cusps = 5
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const halfW = width * 0.5;
  shape.moveTo(-halfW, height);
  shape.lineTo(halfW, height);
  shape.lineTo(halfW, 0);

  // Scalloped cusps along the lower arch edge from right to left
  const cuspSpan = width / cusps;
  for (let i = 0; i < cusps; i++) {
    const xRight = halfW - i * cuspSpan;
    const xLeft = xRight - cuspSpan;
    const xMid = (xRight + xLeft) * 0.5;
    const archPeakY = height * 0.58 + Math.sin(((i + 0.5) / cusps) * Math.PI) * (height * 0.22);
    shape.quadraticCurveTo(xMid, archPeakY, xLeft, 0);
  }

  shape.lineTo(-halfW, height);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

/**
 * Builds commercial-grade 3D Mela Rides & Open Royal Bazaar Pavilions:
 * 1. Aakash Jhula (Giant Wheel) with latticed metallic truss frame (metalness: 0.8, roughness: 0.2),
 *    12 upright passenger gondolas with ornateSilk canopies, and animated chasing warm-gold & magenta LED spoke lights.
 * 2. Rajwada Carousel (Merry-Go-Round) with turned LatheGeometry columns, ornateSilk canopy & bobbing horses.
 * 3. Samudra Nauka (Columbus Swinging Boat) with A-frame truss & carved hull.
 * 4. Open Royal Bazaar Pavilions (Balloon Shoot with 15 backlit moving balloons, Ring Toss bottle pegs, Chaat & Bangle Craft stalls)
 *    with zero intersecting ground strips or flat floor circles.
 */
export function buildMelaRidesAndStalls(
  canopyStripeTex: THREE.CanvasTexture,
  woodGrainTex: THREE.CanvasTexture
): MelaRidesAndStallsRig {
  const rootGroup = new THREE.Group();
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const pbrBundlesToDispose: PBRMaterialBundle[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometriesToDispose.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materialsToDispose.push(m);
    return m;
  };
  const trackPBR = (bundle: PBRMaterialBundle): THREE.MeshStandardMaterial => {
    pbrBundlesToDispose.push(bundle);
    return bundle.material;
  };

  // Procedural 1024x1024 PBR Materials (map + bumpMap + roughnessMap)
  const sandstonePBRMat = trackPBR(
    createPBRMaterial('carvedSandstone', { repeatX: 3, repeatY: 2 })
  );
  const silkCrimsonPBRMat = trackPBR(
    createPBRMaterial('ornateSilk', { silkVariant: 'crimson', repeatX: 2, repeatY: 2 })
  );
  const silkSaffronPBRMat = trackPBR(
    createPBRMaterial('ornateSilk', { silkVariant: 'saffron', repeatX: 2, repeatY: 2 })
  );
  const silkEmeraldPBRMat = trackPBR(
    createPBRMaterial('ornateSilk', { silkVariant: 'emerald', repeatX: 2, repeatY: 2 })
  );
  const silkMaterials = [silkCrimsonPBRMat, silkSaffronPBRMat, silkEmeraldPBRMat];

  // Metallic Truss, Gold Brass & Carved Teak Materials
  const trussMetallicMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4a359,
      metalness: 0.8,
      roughness: 0.2,
      map: woodGrainTex,
    })
  );
  const crimsonTrussMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9e1b32,
      metalness: 0.78,
      roughness: 0.22,
      bumpMap: woodGrainTex,
      bumpScale: 0.02,
    })
  );
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf5b841,
      metalness: 0.88,
      roughness: 0.16,
      bumpMap: canopyStripeTex,
      bumpScale: 0.015,
    })
  );
  const teakWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8c583a,
      map: woodGrainTex,
      bumpMap: woodGrainTex,
      bumpScale: 0.035,
      roughness: 0.58,
      metalness: 0.12,
    })
  );
  const canopySilkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: canopyStripeTex,
      bumpMap: canopyStripeTex,
      bumpScale: 0.025,
      roughness: 0.48,
      metalness: 0.18,
    })
  );

  // Chasing LED Spoke & Lantern Core Materials
  const neonGoldBaseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.1,
      roughness: 0.18,
    })
  );
  const neonMagentaBaseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xe11d48,
      emissiveIntensity: 2.0,
      roughness: 0.18,
    })
  );

  const enableBloom = (mesh: THREE.Object3D) => {
    mesh.layers.enable(BLOOM_LAYER);
  };

  // Shared Turned Lathe Pillar Geometry (Fluted 12-sided column with base & capital rings)
  const pillarLathePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.24, 0.0),
    new THREE.Vector2(0.24, 0.22),
    new THREE.Vector2(0.18, 0.34),
    new THREE.Vector2(0.13, 0.45),
    new THREE.Vector2(0.11, 2.85),
    new THREE.Vector2(0.17, 3.02),
    new THREE.Vector2(0.12, 3.16),
    new THREE.Vector2(0.22, 3.32),
    new THREE.Vector2(0.22, 3.45),
    new THREE.Vector2(0.0, 3.45),
  ];
  const turnedPillarGeo = trackGeo(new THREE.LatheGeometry(pillarLathePoints, 12));

  // Shared Turned Brass Pot / Kalash Lathe Geometry
  const brassPotLathePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.12, 0.0),
    new THREE.Vector2(0.21, 0.14),
    new THREE.Vector2(0.18, 0.26),
    new THREE.Vector2(0.09, 0.33),
    new THREE.Vector2(0.14, 0.39),
    new THREE.Vector2(0.0, 0.4),
  ];
  const brassPotGeo = trackGeo(new THREE.LatheGeometry(brassPotLathePoints, 14));

  // =========================================================================
  // 1. AAKASH JHULA (GIANT WHEEL) — Latticed Metallic Truss, 12 Upright Gondolas & Chasing Spoke LEDs
  // =========================================================================
  const giantWheelSpec = MELA_RIDES[0];
  const giantWheelAnchor = new THREE.Group();
  giantWheelAnchor.position.set(giantWheelSpec.x, 0, giantWheelSpec.z);

  // Warm Golden PointLight Pool under the Giant Wheel (#ff9436, distance 35, decay 1.8)
  const wheelPointLight = new THREE.PointLight(0xff9436, 2.4, 35, 1.8);
  wheelPointLight.position.set(0, 5.5, 2.5);
  giantWheelAnchor.add(wheelPointLight);

  // Carved Sandstone Stepped Plinth Base (LatheGeometry)
  const gwPlinthPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(6.2, 0),
    new THREE.Vector2(6.2, 0.38),
    new THREE.Vector2(5.5, 0.42),
    new THREE.Vector2(5.5, 0.78),
    new THREE.Vector2(0, 0.78),
  ];
  const gwBase = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry(gwPlinthPoints, 24)),
    sandstonePBRMat
  );
  gwBase.receiveShadow = true;
  gwBase.castShadow = true;
  giantWheelAnchor.add(gwBase);

  // Delicate Latticed A-Frame Support Truss Legs
  const mainStrutGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 13.8, 10));
  const crossBraceGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 3.4, 8));
  [-1.65, 1.65].forEach((zOff) => {
    [-1, 1].forEach((xSign) => {
      const leg = new THREE.Mesh(mainStrutGeo, crimsonTrussMat);
      leg.position.set(xSign * 2.35, 6.6, zOff);
      leg.rotation.z = xSign * 0.18;
      leg.castShadow = true;
      giantWheelAnchor.add(leg);
    });
    // Horizontal & diagonal lattice cross-bracing between A-frame legs
    for (let level = 1; level <= 4; level++) {
      const ly = level * 2.5;
      const spanW = (1 - level * 0.16) * 4.2;
      const hBar = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.06, 0.06, spanW, 8)),
        trussMetallicMat
      );
      hBar.position.set(0, ly, zOff);
      hBar.rotation.z = Math.PI / 2;
      giantWheelAnchor.add(hBar);
    }
  });

  // Rotating Wheel Group at Y = 12.6m
  const giantWheelWheelGroup = new THREE.Group();
  giantWheelWheelGroup.position.set(0, 12.6, 0);
  giantWheelAnchor.add(giantWheelWheelGroup);

  const wheelRadius = 9.4;
  const outerRimGeo = trackGeo(new THREE.TorusGeometry(wheelRadius, 0.15, 12, 64));
  const innerTrussRimGeo = trackGeo(new THREE.TorusGeometry(wheelRadius - 0.85, 0.09, 10, 64));

  [-0.9, 0.9].forEach((zOff) => {
    const outerRim = new THREE.Mesh(outerRimGeo, trussMetallicMat);
    outerRim.position.z = zOff;
    giantWheelWheelGroup.add(outerRim);

    const innerRim = new THREE.Mesh(innerTrussRimGeo, brassMat);
    innerRim.position.z = zOff;
    giantWheelWheelGroup.add(innerRim);
  });

  // Latticed diagonal zig-zag truss struts connecting inner and outer wheel rims
  const trussChordGeo = trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6));
  for (let t = 0; t < 36; t++) {
    const a = (t / 36) * Math.PI * 2;
    const midR = wheelRadius - 0.42;
    const strut = new THREE.Mesh(trussChordGeo, trussMetallicMat);
    strut.position.set(Math.cos(a) * midR, Math.sin(a) * midR, 0);
    strut.rotation.x = Math.PI / 2;
    strut.rotation.z = a;
    giantWheelWheelGroup.add(strut);
  }

  // Ornate Central Lotus Hub
  const hubMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.15, 1.15, 2.3, 16)),
    brassMat
  );
  hubMesh.rotation.x = Math.PI / 2;
  giantWheelWheelGroup.add(hubMesh);

  // 12 Spokes, Chasing LED Rim/Spoke Nodes, and 12 Counter-Rotating Passenger Gondolas
  const GONDOLA_COUNT = 12;
  const spokeGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, wheelRadius * 2, 8));
  const ledNodeGeo = trackGeo(new THREE.SphereGeometry(0.11, 8, 8));

  // Gondola Lathe Basket & Scalloped Silk Canopy
  const gondolaBasketPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.58, 0),
    new THREE.Vector2(0.76, 0.35),
    new THREE.Vector2(0.72, 0.72),
    new THREE.Vector2(0.55, 0.75),
    new THREE.Vector2(0, 0.15),
  ];
  const gondolaBasketGeo = trackGeo(new THREE.LatheGeometry(gondolaBasketPoints, 12));
  const gondolaCanopyPoints = [
    new THREE.Vector2(0, 0.62),
    new THREE.Vector2(0.25, 0.52),
    new THREE.Vector2(0.62, 0.24),
    new THREE.Vector2(0.88, 0.0),
  ];
  const gondolaCanopyGeo = trackGeo(new THREE.LatheGeometry(gondolaCanopyPoints, 12));
  const hangerRodGeo = trackGeo(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6));

  const giantWheelCabins: THREE.Group[] = [];
  const chasingLedMaterials: THREE.MeshStandardMaterial[] = [];

  for (let i = 0; i < GONDOLA_COUNT; i++) {
    const angle = (i / GONDOLA_COUNT) * Math.PI * 2;

    if (i < GONDOLA_COUNT / 2) {
      [-0.85, 0.85].forEach((zSpoke) => {
        const spoke = new THREE.Mesh(spokeGeo, trussMetallicMat);
        spoke.position.z = zSpoke;
        spoke.rotation.z = angle;
        giantWheelWheelGroup.add(spoke);
      });
    }

    // 3 Chasing LED nodes along each spoke (inner, mid, outer rim)
    for (let ringStep = 1; ringStep <= 3; ringStep++) {
      const rDist = (ringStep / 3) * wheelRadius;
      const ledMat = trackMat(
        (i + ringStep) % 2 === 0 ? neonGoldBaseMat.clone() : neonMagentaBaseMat.clone()
      );
      chasingLedMaterials.push(ledMat);
      const ledBulb = new THREE.Mesh(ledNodeGeo, ledMat);
      ledBulb.position.set(Math.cos(angle) * rDist, Math.sin(angle) * rDist, 0.96);
      enableBloom(ledBulb);
      giantWheelWheelGroup.add(ledBulb);
    }

    // Passenger Gondola Cabin (always stays upright via counter-rotation in updateKinematics)
    const cabin = new THREE.Group();
    cabin.position.set(
      Math.cos(angle) * wheelRadius,
      Math.sin(angle) * wheelRadius,
      0
    );

    const silkMat = silkMaterials[i % silkMaterials.length];
    const roof = new THREE.Mesh(gondolaCanopyGeo, silkMat);
    roof.position.y = 0.05;
    roof.castShadow = true;
    cabin.add(roof);

    const finial = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.08, 0.22, 8)),
      brassMat
    );
    finial.position.y = 0.76;
    cabin.add(finial);

    [-0.45, 0.45].forEach((hx) => {
      const rod = new THREE.Mesh(hangerRodGeo, brassMat);
      rod.position.set(hx, -0.42, 0);
      cabin.add(rod);
    });

    const basket = new THREE.Mesh(gondolaBasketGeo, teakWoodMat);
    basket.position.y = -1.32;
    basket.castShadow = true;
    cabin.add(basket);

    const cabinLantern = new THREE.Mesh(ledNodeGeo, neonGoldBaseMat);
    cabinLantern.position.set(0, -0.52, 0);
    enableBloom(cabinLantern);
    cabin.add(cabinLantern);

    giantWheelCabins.push(cabin);
    giantWheelWheelGroup.add(cabin);
  }

  rootGroup.add(giantWheelAnchor);

  // =========================================================================
  // 2. RAJWADA CAROUSEL (MERRY-GO-ROUND) — Turned Lathe Columns & Ornate Silk Canopy
  // =========================================================================
  const carouselSpec = MELA_RIDES[1];
  const carouselAnchor = new THREE.Group();
  carouselAnchor.position.set(carouselSpec.x, 0, carouselSpec.z);

  const carouselBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(4.8, 5.2, 0.48, 28)),
    sandstonePBRMat
  );
  carouselBase.position.y = 0.24;
  carouselBase.receiveShadow = true;
  carouselAnchor.add(carouselBase);

  const centerPillar = new THREE.Mesh(
    turnedPillarGeo,
    brassMat
  );
  centerPillar.scale.set(2.2, 1.35, 2.2);
  centerPillar.position.y = 0.45;
  carouselAnchor.add(centerPillar);

  const carouselSpinnerGroup = new THREE.Group();
  carouselSpinnerGroup.position.set(0, 0.48, 0);
  carouselAnchor.add(carouselSpinnerGroup);

  // Scalloped Lathe Canopy Dome
  const carouselRoofPoints = [
    new THREE.Vector2(0, 2.35),
    new THREE.Vector2(1.4, 1.85),
    new THREE.Vector2(3.4, 0.95),
    new THREE.Vector2(5.1, 0.25),
    new THREE.Vector2(5.2, 0.0),
  ];
  const carouselRoof = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry(carouselRoofPoints, 24)),
    canopySilkMat
  );
  carouselRoof.position.y = 3.95;
  carouselRoof.castShadow = true;
  carouselSpinnerGroup.add(carouselRoof);

  const roofCrown = new THREE.Mesh(brassPotGeo, brassMat);
  roofCrown.scale.setScalar(2.4);
  roofCrown.position.y = 6.25;
  carouselSpinnerGroup.add(roofCrown);

  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 4.1, 8));
  const horseBodyGeo = trackGeo(new THREE.CapsuleGeometry(0.22, 0.62, 6, 12));
  const horseNeckGeo = trackGeo(new THREE.ConeGeometry(0.16, 0.48, 8));
  const carouselHorses: THREE.Group[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r = 3.55;
    const hx = Math.cos(angle) * r;
    const hz = Math.sin(angle) * r;

    const pole = new THREE.Mesh(poleGeo, brassMat);
    pole.position.set(hx, 2.05, hz);
    carouselSpinnerGroup.add(pole);

    const horseGroup = new THREE.Group();
    horseGroup.position.set(hx, 1.4, hz);
    horseGroup.rotation.y = -angle + Math.PI / 2;

    const hMat = silkMaterials[i % silkMaterials.length];
    const body = new THREE.Mesh(horseBodyGeo, hMat);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    horseGroup.add(body);

    const saddle = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.32, 0.12, 0.46)),
      brassMat
    );
    saddle.position.set(0, 0.2, 0);
    horseGroup.add(saddle);

    const neck = new THREE.Mesh(horseNeckGeo, brassMat);
    neck.position.set(0.35, 0.3, 0);
    neck.rotation.z = -0.35;
    horseGroup.add(neck);

    carouselHorses.push(horseGroup);
    carouselSpinnerGroup.add(horseGroup);
  }

  rootGroup.add(carouselAnchor);

  // =========================================================================
  // 3. SAMUDRA NAUKA (COLUMBUS SWINGING BOAT)
  // =========================================================================
  const columbusSpec = MELA_RIDES[2];
  const columbusAnchor = new THREE.Group();
  columbusAnchor.position.set(columbusSpec.x, 0, columbusSpec.z);

  const colBase = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.8, 0.46, 4.4)),
    sandstonePBRMat
  );
  colBase.position.y = 0.23;
  colBase.receiveShadow = true;
  columbusAnchor.add(colBase);

  const colSupportGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 8.8, 10));
  [-1.75, 1.75].forEach((zOff) => {
    [-1, 1].forEach((xSign) => {
      const strut = new THREE.Mesh(colSupportGeo, crimsonTrussMat);
      strut.position.set(xSign * 1.9, 4.3, zOff);
      strut.rotation.z = xSign * 0.22;
      strut.castShadow = true;
      columbusAnchor.add(strut);
    });
  });

  const columbusPendulumGroup = new THREE.Group();
  columbusPendulumGroup.position.set(0, 8.2, 0);
  columbusAnchor.add(columbusPendulumGroup);

  const hangerGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 5.8, 8));
  [-1.4, 1.4].forEach((xOff) => {
    const hanger = new THREE.Mesh(hangerGeo, brassMat);
    hanger.position.set(xOff, -2.9, 0);
    columbusPendulumGroup.add(hanger);
  });

  const hullGroup = new THREE.Group();
  hullGroup.position.set(0, -5.8, 0);
  columbusPendulumGroup.add(hullGroup);

  const hullCenter = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(4.4, 0.9, 1.65)),
    teakWoodMat
  );
  hullCenter.castShadow = true;
  hullGroup.add(hullCenter);

  const prowGeo = trackGeo(new THREE.ConeGeometry(0.95, 1.75, 6));
  [-1, 1].forEach((xSign) => {
    const prow = new THREE.Mesh(prowGeo, silkCrimsonPBRMat);
    prow.position.set(xSign * 2.8, 0.25, 0);
    prow.rotation.z = -xSign * (Math.PI / 2.3);
    hullGroup.add(prow);
  });

  rootGroup.add(columbusAnchor);

  // =========================================================================
  // 4. OPEN ROYAL BAZAAR PAVILIONS (Balloon Shoot, Ring Toss, Chaat & Craft Stalls)
  //    Constructed with LatheGeometry Turned Pillars, ExtrudeGeometry Scalloped Arches,
  //    ornateSilk Canopies, Warm PointLight Pools, and Detailed Counter Props
  // =========================================================================
  const balloonStallTargets: THREE.Mesh[] = [];
  const stallArchValanceGeo = trackGeo(createScallopedArchGeometry(4.2, 0.58, 0.12, 5));
  const stallBalloonGeo = trackGeo(new THREE.SphereGeometry(0.18, 14, 12));

  // Curved Scalloped Pavilion Roof (LatheGeometry pagoda/chhatri dome profile)
  const pavilionRoofPoints = [
    new THREE.Vector2(0.0, 1.45),
    new THREE.Vector2(0.35, 1.15),
    new THREE.Vector2(1.25, 0.68),
    new THREE.Vector2(2.45, 0.22),
    new THREE.Vector2(3.15, 0.0),
  ];
  const pavilionRoofGeo = trackGeo(new THREE.LatheGeometry(pavilionRoofPoints, 4));

  // Glass / Brass Ring-Toss Bottle Lathe Geometry
  const bottleLathePoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0),
    new THREE.Vector2(0.12, 0.22),
    new THREE.Vector2(0.05, 0.34),
    new THREE.Vector2(0.045, 0.48),
    new THREE.Vector2(0.065, 0.51),
    new THREE.Vector2(0, 0.51),
  ];
  const prizeBottleGeo = trackGeo(new THREE.LatheGeometry(bottleLathePoints, 12));
  const bangleRingGeo = trackGeo(new THREE.TorusGeometry(0.14, 0.025, 8, 18));

  const buildOpenBazaarPavilion = (
    x: number,
    z: number,
    rotY: number,
    silkVariantIdx: number,
    stallId?: string
  ) => {
    const pavGroup = new THREE.Group();
    pavGroup.position.set(x, 0, z);
    pavGroup.rotation.y = rotY;

    const roofSilkMat = silkMaterials[silkVariantIdx % silkMaterials.length];

    // Warm Golden-Orange PointLight Pool inside each Bazaar Stall (#ff9436, distance 28, decay 1.8)
    if (stallId) {
      const stallLight = new THREE.PointLight(0xff9436, 1.55, 28, 1.8);
      stallLight.position.set(0, 2.85, 0.2);
      pavGroup.add(stallLight);
    }

    // Carved Sandstone Stepped Base Plinth
    const plinth = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.6, 0.18, 2.8)),
      sandstonePBRMat
    );
    plinth.position.y = 0.09;
    plinth.receiveShadow = true;
    pavGroup.add(plinth);

    // Open Carved Teak Counter Table (height: 1.1m)
    const counterBase = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.9, 0.92, 1.15)),
      teakWoodMat
    );
    counterBase.position.set(0, 0.55, 0.25);
    counterBase.castShadow = true;
    counterBase.receiveShadow = true;
    pavGroup.add(counterBase);

    const counterTop = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.15, 0.1, 1.32)),
      sandstonePBRMat
    );
    counterTop.position.set(0, 1.06, 0.25);
    counterTop.receiveShadow = true;
    pavGroup.add(counterTop);

    // 4 Turned LatheGeometry Pillars at the Pavilion Corners
    [-2.05, 2.05].forEach((cx) => {
      [-1.12, 1.12].forEach((cz) => {
        const pillar = new THREE.Mesh(turnedPillarGeo, teakWoodMat);
        pillar.position.set(cx, 0.16, cz);
        pillar.castShadow = true;
        pavGroup.add(pillar);
      });
    });

    // Cusped Scalloped Mehrab Arch Valance along Front & Back Eaves (ExtrudeGeometry)
    const frontArch = new THREE.Mesh(stallArchValanceGeo, sandstonePBRMat);
    frontArch.position.set(0, 3.28, 1.12);
    frontArch.castShadow = true;
    pavGroup.add(frontArch);

    const backArch = new THREE.Mesh(stallArchValanceGeo, sandstonePBRMat);
    backArch.position.set(0, 3.28, -1.12);
    pavGroup.add(backArch);

    // Curved Ornate Silk Canopy Roof with Woven Gold Zari Border (`ornateSilk` PBR material)
    const canopyMain = new THREE.Mesh(pavilionRoofGeo, roofSilkMat);
    canopyMain.position.y = 3.52;
    canopyMain.rotation.y = Math.PI / 4;
    canopyMain.scale.set(1.12, 1.0, 0.76);
    canopyMain.castShadow = true;
    pavGroup.add(canopyMain);

    const roofFinial = new THREE.Mesh(brassPotGeo, brassMat);
    roofFinial.position.y = 4.95;
    pavGroup.add(roofFinial);

    // Hanging Brass Lantern inside the Pavilion
    const lanternPot = new THREE.Mesh(brassPotGeo, brassMat);
    lanternPot.scale.setScalar(0.75);
    lanternPot.position.set(0, 3.05, 0.15);
    pavGroup.add(lanternPot);

    const lanternFlame = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.09, 8, 8)),
      neonGoldBaseMat
    );
    lanternFlame.position.set(0, 2.98, 0.15);
    enableBloom(lanternFlame);
    pavGroup.add(lanternFlame);

    // Detailed Counter Props per Bazaar Stall Type
    if (stallId === 'balloon_shoot') {
      // Backlit target board holding 15 moving balloons (3 rows x 5 columns)
      const boardFrame = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(3.75, 1.65, 0.14)),
        teakWoodMat
      );
      boardFrame.position.set(0, 2.15, -0.88);
      boardFrame.castShadow = true;
      pavGroup.add(boardFrame);

      const boardBacklight = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(3.45, 1.38)),
        sandstonePBRMat
      );
      boardBacklight.position.set(0, 2.15, -0.79);
      pavGroup.add(boardBacklight);

      const balloonColors = [0xe11d48, 0xf59e0b, 0x06b6d4, 0x10b981, 0xa855f7];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 5; col++) {
          const bIdx = row * 5 + col;
          const bMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: balloonColors[bIdx % balloonColors.length],
              roughness: 0.25,
              metalness: 0.12,
              emissive: balloonColors[bIdx % balloonColors.length],
              emissiveIntensity: 0.14,
            })
          );
          const bMesh = new THREE.Mesh(stallBalloonGeo, bMat);
          bMesh.position.set(
            -1.28 + col * 0.64,
            1.72 + row * 0.42,
            -0.68
          );
          bMesh.scale.set(0.85, 1.08, 0.85);
          balloonStallTargets.push(bMesh);
          pavGroup.add(bMesh);
        }
      }

      // Stack of brass pots on counter corner
      const pot1 = new THREE.Mesh(brassPotGeo, brassMat);
      pot1.position.set(-1.55, 1.11, 0.35);
      pavGroup.add(pot1);
    } else if (stallId === 'ring_toss') {
      // Prize Peg Table with 7 Turned Brass & Colored Glass Prize Bottles + Golden Toss Rings
      for (let p = 0; p < 7; p++) {
        const bottle = new THREE.Mesh(
          prizeBottleGeo,
          p % 2 === 0 ? brassMat : silkMaterials[p % silkMaterials.length]
        );
        bottle.position.set(
          -1.35 + p * 0.45,
          1.11,
          0.15 + (p % 2 === 0 ? -0.16 : 0.18)
        );
        bottle.castShadow = true;
        pavGroup.add(bottle);

        if (p % 2 === 0) {
          const ring = new THREE.Mesh(bangleRingGeo, brassMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(bottle.position.x, 1.14, bottle.position.z);
          pavGroup.add(ring);
        }
      }
    } else {
      // Chaat, Mithai & Glass Bangle Craft Stall Props (Stacked Brass Pots + Colorful Glass Bangles)
      for (let s = 0; s < 3; s++) {
        const lowerPot = new THREE.Mesh(brassPotGeo, brassMat);
        lowerPot.position.set(-1.25 + s * 0.55, 1.11, 0.22);
        pavGroup.add(lowerPot);

        const upperPot = new THREE.Mesh(brassPotGeo, brassMat);
        upperPot.scale.setScalar(0.76);
        upperPot.position.set(-1.25 + s * 0.55, 1.46, 0.22);
        pavGroup.add(upperPot);
      }

      // Colorful glass bangle display bars on the right half of the counter
      const bangleRackRod = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8)),
        brassMat
      );
      bangleRackRod.rotation.z = Math.PI / 2;
      bangleRackRod.position.set(0.95, 1.38, 0.25);
      pavGroup.add(bangleRackRod);

      for (let b = 0; b < 8; b++) {
        const bangle = new THREE.Mesh(
          bangleRingGeo,
          silkMaterials[b % silkMaterials.length]
        );
        bangle.rotation.y = Math.PI / 2;
        bangle.position.set(0.46 + b * 0.14, 1.38, 0.25);
        pavGroup.add(bangle);
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

  // 2 Additional Open Royal Bazaar Pavilions on the West Curve
  buildOpenBazaarPavilion(-22, -16, Math.PI / 3, 0);
  buildOpenBazaarPavilion(-22, 6, (Math.PI * 2) / 3, 2);

  // =========================================================================
  // 5. DELTA-TIME KINEMATICS UPDATER
  // =========================================================================
  const updateKinematics = (elapsedSec: number) => {
    // 1. Giant Wheel rotation + Counter-rotation of 12 passenger gondolas so they stay strictly upright
    const wheelAngle = elapsedSec * 0.35;
    giantWheelWheelGroup.rotation.z = wheelAngle;
    for (let i = 0; i < giantWheelCabins.length; i++) {
      giantWheelCabins[i].rotation.z = -wheelAngle;
    }

    // Chasing warm-gold & magenta LED rim/spoke lights
    for (let l = 0; l < chasingLedMaterials.length; l++) {
      const wave = Math.sin(elapsedSec * 6.5 - l * 0.55) * 0.5 + 0.5;
      chasingLedMaterials[l].emissiveIntensity = 0.85 + wave * 1.95;
    }

    // 2. Carousel rotation + Sine-wave horse bobbing
    carouselSpinnerGroup.rotation.y = elapsedSec * 0.85;
    for (let i = 0; i < carouselHorses.length; i++) {
      carouselHorses[i].position.y =
        1.4 + Math.sin(elapsedSec * 2.8 + i * 1.05) * 0.34;
    }

    // 3. Columbus Swinging Boat pendulum motion
    columbusPendulumGroup.rotation.z = Math.sin(elapsedSec * 1.65) * 0.58;

    // 4. 15 Moving Balloons on the Backlit Shooting Board
    for (let i = 0; i < balloonStallTargets.length; i++) {
      const row = Math.floor(i / 5);
      const col = i % 5;
      const baseX = -1.28 + col * 0.64;
      const baseY = 1.72 + row * 0.42;
      const dir = row % 2 === 0 ? 1 : -1;
      balloonStallTargets[i].position.x =
        baseX + Math.sin(elapsedSec * 2.4 * dir + i * 0.7) * 0.16;
      balloonStallTargets[i].position.y =
        baseY + Math.cos(elapsedSec * 3.1 + i * 0.9) * 0.06;
    }
  };

  const dispose = () => {
    geometriesToDispose.forEach((g) => g.dispose());
    materialsToDispose.forEach((m) => m.dispose());
    pbrBundlesToDispose.forEach((b) => b.dispose());
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
