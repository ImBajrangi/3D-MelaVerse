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
  // 4. PLAYABLE MINI-GAME STALLS (Balloon Shoot, Ring Toss, Prize Shop)
  // =========================================================================
  const balloonStallTargets: THREE.Mesh[] = [];
  const stallBalloonGeo = trackGeo(new THREE.SphereGeometry(0.28, 12, 12));

  MELA_STALLS.forEach((stall, idx) => {
    const stallGroup = new THREE.Group();
    stallGroup.position.set(stall.x, 0, stall.z);
    // Face inward toward courtyard center
    stallGroup.rotation.y = Math.atan2(-stall.x, -stall.z);

    // Counter table
    const counter = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(4.8, 1.2, 2.4)),
      teakWoodMat
    );
    counter.position.y = 0.6;
    counter.castShadow = true;
    counter.receiveShadow = true;
    stallGroup.add(counter);

    // 4 Corner brass poles
    const cornerPoleGeo = trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 3.6, 8));
    [-2.2, 2.2].forEach((px) => {
      [-1.0, 1.0].forEach((pz) => {
        const pole = new THREE.Mesh(cornerPoleGeo, brassMat);
        pole.position.set(px, 1.8, pz);
        stallGroup.add(pole);
      });
    });

    // Striped pitched canopy roof
    const roof = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(3.6, 1.5, 4)),
      canopySilkMat
    );
    roof.position.y = 4.25;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    stallGroup.add(roof);

    // Glowing Neon Marquee Signboard on roof front
    const signBulbMat =
      idx === 0 ? neonMagentaMat : idx === 1 ? neonCyanMat : neonAmberMat;
    const marquee = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.8, 0.48, 0.18)),
      signBulbMat
    );
    marquee.position.set(0, 3.45, 1.15);
    enableBloom(marquee);
    stallGroup.add(marquee);

    // Stall-specific 3D interior props
    if (stall.id === 'balloon_shoot') {
      const backboard = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(4.2, 2.0, 0.18)),
        royalBlueMat
      );
      backboard.position.set(0, 2.2, -0.85);
      stallGroup.add(backboard);

      for (let b = 0; b < 6; b++) {
        const bMesh = new THREE.Mesh(
          stallBalloonGeo,
          b % 2 === 0 ? neonMagentaMat : neonAmberMat
        );
        bMesh.position.set(-1.5 + b * 0.6, 2.1 + (b % 2) * 0.45, -0.65);
        enableBloom(bMesh);
        balloonStallTargets.push(bMesh);
        stallGroup.add(bMesh);
      }
    } else if (stall.id === 'ring_toss') {
      const pegGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.12, 0.55, 10));
      for (let p = 0; p < 5; p++) {
        const peg = new THREE.Mesh(pegGeo, neonCyanMat);
        peg.position.set(-1.2 + p * 0.6, 1.48, 0);
        enableBloom(peg);
        stallGroup.add(peg);
      }
    } else if (stall.id === 'prize_shop') {
      const trophyGeo = trackGeo(new THREE.OctahedronGeometry(0.32, 0));
      for (let t = 0; t < 4; t++) {
        const trophy = new THREE.Mesh(trophyGeo, neonAmberMat);
        trophy.position.set(-1.2 + t * 0.8, 1.65, -0.2);
        enableBloom(trophy);
        stallGroup.add(trophy);
      }
    }

    rootGroup.add(stallGroup);
  });

  // =========================================================================
  // 5. DECORATIVE BRICK PATHWAYS, FAIRY-LIGHT ARCHES & RIDE TICKET BOOTH
  // =========================================================================
  const brickPathMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7c2d12,
      roughness: 0.78,
      metalness: 0.08,
      emissive: 0x451a03,
      emissiveIntensity: 0.12,
    })
  );
  const pathBorderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      metalness: 0.45,
      emissive: 0x78350f,
      emissiveIntensity: 0.18,
    })
  );

  // Helper to build a brick promenade & fairy-light arch corridor between two zones
  const buildPromenadeCorridor = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    archCount: number
  ) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const midX = (x1 + x2) * 0.5;
    const midZ = (z1 + z2) * 0.5;

    const walkway = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.8, 0.06, len)),
      brickPathMat
    );
    walkway.position.set(midX, 0.025, midZ);
    walkway.rotation.y = angle;
    walkway.receiveShadow = true;
    rootGroup.add(walkway);

    // Raised brass-sandstone curbs along both sides of the brick pathway
    [-1.95, 1.95].forEach((sideX) => {
      const curb = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.18, 0.12, len)),
        pathBorderMat
      );
      curb.position.set(
        midX + Math.cos(angle) * sideX,
        0.06,
        midZ - Math.sin(angle) * sideX
      );
      curb.rotation.y = angle;
      rootGroup.add(curb);
    });

    // Overhead Fairy-Light Arches along the pathway
    const archPillarGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.12, 4.6, 8));
    const archTopGeo = trackGeo(
      new THREE.TorusGeometry(2.1, 0.08, 8, 20, Math.PI)
    );
    for (let a = 1; a <= archCount; a++) {
      const t = a / (archCount + 1);
      const ax = x1 + dx * t;
      const az = z1 + dz * t;
      const archGroup = new THREE.Group();
      archGroup.position.set(ax, 0, az);
      archGroup.rotation.y = angle;

      [-2.1, 2.1].forEach((px) => {
        const post = new THREE.Mesh(archPillarGeo, brassMat);
        post.position.set(px, 2.3, 0);
        archGroup.add(post);
      });

      const archSpan = new THREE.Mesh(archTopGeo, brassMat);
      archSpan.position.set(0, 4.5, 0);
      archGroup.add(archSpan);

      // 5 Fairy-light bulbs along each arch crown
      for (let b = -2; b <= 2; b++) {
        const bAngle = Math.PI * 0.5 + b * 0.28;
        const fBulb = new THREE.Mesh(
          bulbGeo,
          (a + b) % 2 === 0 ? neonAmberMat : neonMagentaMat
        );
        fBulb.position.set(
          Math.cos(bAngle) * 2.1,
          4.5 + Math.sin(bAngle) * 2.1,
          0
        );
        enableBloom(fBulb);
        archGroup.add(fBulb);
      }

      rootGroup.add(archGroup);
    }
  };

  // Connect Central Sanctum Plaza (0, 0) -> Carnival Ride Grounds (34, -22)
  buildPromenadeCorridor(9, -6, 33, -21, 3);
  // Connect Central Sanctum Plaza (0, 0) -> Meena Bazaar & Game Stalls (-31, -13)
  buildPromenadeCorridor(-9, -4, -30, -12, 3);

  // Carnival Ticket Booth next to the Aakash Jhula Giant Wheel at (30, 0, -19)
  const ticketBoothGroup = new THREE.Group();
  ticketBoothGroup.position.set(30, 0, -19);
  ticketBoothGroup.rotation.y = -0.65;
  const boothBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(1.6, 1.75, 2.6, 8)),
    crimsonStructuralMat
  );
  boothBase.position.y = 1.3;
  ticketBoothGroup.add(boothBase);
  const boothRoof = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(2.1, 1.3, 8)),
    brassMat
  );
  boothRoof.position.y = 3.25;
  ticketBoothGroup.add(boothRoof);
  const boothSign = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.2, 0.42, 0.16)),
    neonAmberMat
  );
  boothSign.position.set(0, 2.55, 1.45);
  enableBloom(boothSign);
  ticketBoothGroup.add(boothSign);
  rootGroup.add(ticketBoothGroup);

  // Grand Plaza Circular Pavings under Carnival Ride Grounds (38, -25) & Meena Bazaar (-34, -12)
  const ridePlazaDisc = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(18.5, 19.0, 0.05, 36)),
    brickPathMat
  );
  ridePlazaDisc.position.set(35, 0.018, -21);
  ridePlazaDisc.receiveShadow = true;
  rootGroup.add(ridePlazaDisc);

  const bazaarPlazaDisc = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(16.5, 17.0, 0.05, 36)),
    brickPathMat
  );
  bazaarPlazaDisc.position.set(-31, 0.018, -13);
  bazaarPlazaDisc.receiveShadow = true;
  rootGroup.add(bazaarPlazaDisc);

  // Overhead Fairy Light Festoon Ring around Central Sanctum
  const festoonBulbGeo = trackGeo(new THREE.SphereGeometry(0.14, 6, 6));
  const festoonCount = 36;
  for (let i = 0; i < festoonCount; i++) {
    const angle = (i / festoonCount) * Math.PI * 2;
    const r = 19.5;
    const bulb = new THREE.Mesh(
      festoonBulbGeo,
      i % 3 === 0
        ? neonAmberMat
        : i % 3 === 1
        ? neonMagentaMat
        : neonCyanMat
    );
    bulb.position.set(
      Math.cos(angle) * r,
      6.2 + Math.sin(angle * 6) * 0.45,
      Math.sin(angle) * r
    );
    enableBloom(bulb);
    rootGroup.add(bulb);
  }

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
