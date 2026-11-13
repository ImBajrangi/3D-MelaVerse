import * as THREE from 'three';
import type { WeatherState } from './weatherSystem';

const RAIN_COUNT = 180;
const WIND_MOTE_COUNT = 72;

export class WeatherVfxSystem {
  public readonly group = new THREE.Group();
  private readonly rainMesh: THREE.InstancedMesh;
  private readonly rainMat: THREE.MeshBasicMaterial;
  private readonly windMoteMesh: THREE.InstancedMesh;
  private readonly windMoteMat: THREE.MeshBasicMaterial;

  private readonly rainPosX = new Float32Array(RAIN_COUNT);
  private readonly rainPosY = new Float32Array(RAIN_COUNT);
  private readonly rainPosZ = new Float32Array(RAIN_COUNT);
  private readonly rainSpeed = new Float32Array(RAIN_COUNT);

  private readonly motePosX = new Float32Array(WIND_MOTE_COUNT);
  private readonly motePosY = new Float32Array(WIND_MOTE_COUNT);
  private readonly motePosZ = new Float32Array(WIND_MOTE_COUNT);
  private readonly motePhase = new Float32Array(WIND_MOTE_COUNT);

  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const rainGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.85, 4);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xcbe7ff,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(rainGeo, this.rainMat, RAIN_COUNT);
    this.rainMesh.frustumCulled = false;
    this.rainMesh.visible = false;

    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainPosX[i] = ((i * 37) % 36) - 18;
      this.rainPosY[i] = ((i * 53) % 16) + 0.5;
      this.rainPosZ[i] = ((i * 29) % 36) - 18;
      this.rainSpeed[i] = 16.5 + (i % 7) * 1.4;
    }

    const moteGeo = new THREE.PlaneGeometry(0.18, 0.06);
    this.windMoteMat = new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.windMoteMesh = new THREE.InstancedMesh(
      moteGeo,
      this.windMoteMat,
      WIND_MOTE_COUNT
    );
    this.windMoteMesh.frustumCulled = false;
    this.windMoteMesh.visible = false;

    for (let i = 0; i < WIND_MOTE_COUNT; i++) {
      this.motePosX[i] = ((i * 41) % 38) - 19;
      this.motePosY[i] = 0.4 + ((i * 19) % 8);
      this.motePosZ[i] = ((i * 31) % 38) - 19;
      this.motePhase[i] = i * 0.77;
    }

    this.group.add(this.rainMesh, this.windMoteMesh);
    scene.add(this.group);
  }

  public step(params: {
    dt: number;
    elapsedSec: number;
    weather: WeatherState;
    centerX: number;
    centerZ: number;
    cameraYaw: number;
  }): void {
    const dt = Math.max(0.001, Math.min(0.05, params.dt));
    const rain = params.weather.rainIntensity;
    const windSpeed = params.weather.windSpeed;

    // 1. Angled Monsoon Rain Streaks localized in a 36x36m volume around player/camera
    if (rain > 0.03) {
      this.rainMesh.visible = true;
      this.rainMat.opacity = Math.min(0.48, rain * 0.52);

      const tiltX = Math.max(-0.32, Math.min(0.32, params.weather.windX * 0.04));
      const tiltZ = Math.max(-0.32, Math.min(0.32, params.weather.windZ * 0.04));
      const activeDropCount = Math.max(
        24,
        Math.round(RAIN_COUNT * Math.min(1, rain * 1.15))
      );

      for (let i = 0; i < RAIN_COUNT; i++) {
        if (i >= activeDropCount) {
          this.dummy.position.set(0, -100, 0);
          this.dummy.scale.setScalar(0.001);
          this.dummy.updateMatrix();
          this.rainMesh.setMatrixAt(i, this.dummy.matrix);
          continue;
        }

        let x = this.rainPosX[i] + params.weather.windX * 0.42 * dt;
        let y = this.rainPosY[i] - this.rainSpeed[i] * dt;
        let z = this.rainPosZ[i] + params.weather.windZ * 0.42 * dt;

        if (y < 0.1) {
          y += 16.0;
        }
        if (x < -18) x += 36;
        if (x > 18) x -= 36;
        if (z < -18) z += 36;
        if (z > 18) z -= 36;

        this.rainPosX[i] = x;
        this.rainPosY[i] = y;
        this.rainPosZ[i] = z;

        this.dummy.position.set(params.centerX + x, y, params.centerZ + z);
        this.dummy.rotation.set(tiltZ, 0, -tiltX);
        this.dummy.scale.set(1, 0.8 + rain * 0.55, 1);
        this.dummy.updateMatrix();
        this.rainMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.rainMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.rainMesh.visible = false;
    }

    // 2. Wind-Blown Shimmering Motes / River Breeze Streaks when wind is noticeable
    if (windSpeed > 1.6) {
      this.windMoteMesh.visible = true;
      this.windMoteMat.opacity = Math.min(0.42, (windSpeed - 1.4) * 0.075);
      const windAngle = Math.atan2(params.weather.windX, params.weather.windZ);

      for (let i = 0; i < WIND_MOTE_COUNT; i++) {
        let x = this.motePosX[i] + params.weather.windX * 0.72 * dt;
        let z = this.motePosZ[i] + params.weather.windZ * 0.72 * dt;
        const y =
          this.motePosY[i] +
          Math.sin(params.elapsedSec * 2.1 + this.motePhase[i]) * 0.35;

        if (x < -19) x += 38;
        if (x > 19) x -= 38;
        if (z < -19) z += 38;
        if (z > 19) z -= 38;

        this.motePosX[i] = x;
        this.motePosZ[i] = z;

        this.dummy.position.set(params.centerX + x, y, params.centerZ + z);
        this.dummy.rotation.set(0, windAngle + Math.PI * 0.5, 0);
        const streakLen = Math.min(2.2, 0.8 + windSpeed * 0.18);
        this.dummy.scale.set(streakLen, 1, 1);
        this.dummy.updateMatrix();
        this.windMoteMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.windMoteMesh.instanceMatrix.needsUpdate = true;
    } else {
      this.windMoteMesh.visible = false;
    }
  }

  public dispose(): void {
    this.rainMesh.geometry.dispose();
    this.rainMat.dispose();
    this.windMoteMesh.geometry.dispose();
    this.windMoteMat.dispose();
    this.group.parent?.remove(this.group);
  }
}
