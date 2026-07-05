import {
  Scene,
  MeshBuilder,
  PBRMaterial,
  Color3,
  Vector3,
  TransformNode,
  DynamicTexture,
  Texture,
} from '@babylonjs/core';

const GRID_SIZE = 6;
const BLOCK_SIZE = 18;
const ROAD_WIDTH = 6;
const ALLEY_WIDTH = 2.5;
const CELL_SIZE = BLOCK_SIZE + ROAD_WIDTH;
const TOTAL_SIZE = CELL_SIZE * GRID_SIZE;

const RING_RADIUS = TOTAL_SIZE / 2 + 30;
const RING_WIDTH = 6;
const WORLD_SIZE = RING_RADIUS * 2 + 20;

const ELEVATED_HEIGHT = 9;
const RAMP_LENGTH = CELL_SIZE;

let windowTexture: Texture | null = null;

export function generateCity(scene: Scene): void {
  createGround(scene);
  createRoadGrid(scene);
  createBuildings(scene);
  createRingRoad(scene);
  createElevatedHighway(scene);
  createFlags(scene);
  createSpawnMarkers(scene);
}

function getWindowTexture(scene: Scene): Texture {
  if (windowTexture) return windowTexture;

  const size = 256;
  const texture = new DynamicTexture('windowTex', { width: size, height: size }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = '#4a4a4d';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#9fc4dd';
  const cell = size / 8;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      ctx.fillRect(col * cell + cell * 0.15, row * cell + cell * 0.15, cell * 0.7, cell * 0.7);
    }
  }
  texture.update();
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = 4;
  texture.vScale = 6;
  windowTexture = texture;
  return texture;
}

function getGrassTexture(scene: Scene): Texture {
  const size = 128;
  const texture = new DynamicTexture('grassTex', { width: size, height: size }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = '#4c7a3f';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const shade = 30 + Math.random() * 40;
    ctx.fillStyle = `rgba(${40 + shade * 0.3}, ${90 + shade}, ${45 + shade * 0.3}, 0.5)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  texture.update();
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = WORLD_SIZE / 12;
  texture.vScale = WORLD_SIZE / 12;
  return texture;
}

function createGround(scene: Scene): void {
  const ground = MeshBuilder.CreateGround('ground', { width: WORLD_SIZE, height: WORLD_SIZE }, scene);
  const mat = new PBRMaterial('groundMat', scene);
  mat.albedoTexture = getGrassTexture(scene);
  mat.roughness = 0.95;
  mat.metallic = 0;
  ground.material = mat;
  ground.receiveShadows = true;
}

function createRoadGrid(scene: Scene): void {
  const roadMat = new PBRMaterial('roadMat', scene);
  roadMat.albedoColor = new Color3(0.18, 0.18, 0.2);
  roadMat.roughness = 0.85;
  roadMat.metallic = 0.05;

  const alleyMat = new PBRMaterial('alleyMat', scene);
  alleyMat.albedoColor = new Color3(0.4, 0.39, 0.37);
  alleyMat.roughness = 0.9;
  alleyMat.metallic = 0;

  const origin = -TOTAL_SIZE / 2;

  for (let i = 0; i <= GRID_SIZE; i++) {
    const offset = origin + i * CELL_SIZE;

    const vertical = MeshBuilder.CreateBox(`road_v_${i}`, { width: ROAD_WIDTH, height: 0.1, depth: TOTAL_SIZE }, scene);
    vertical.position = new Vector3(offset, 0.05, 0);
    vertical.material = roadMat;
    vertical.receiveShadows = true;

    const horizontal = MeshBuilder.CreateBox(`road_h_${i}`, { width: TOTAL_SIZE, height: 0.1, depth: ROAD_WIDTH }, scene);
    horizontal.position = new Vector3(0, 0.05, offset);
    horizontal.material = roadMat;
    horizontal.receiveShadows = true;
  }

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const cellCenterX = origin + ROAD_WIDTH + x * CELL_SIZE + BLOCK_SIZE / 2;
      const cellCenterZ = origin + ROAD_WIDTH + z * CELL_SIZE + BLOCK_SIZE / 2;

      const alleyH = MeshBuilder.CreateBox(`alley_h_${x}_${z}`, { width: BLOCK_SIZE, height: 0.08, depth: ALLEY_WIDTH }, scene);
      alleyH.position = new Vector3(cellCenterX, 0.04, cellCenterZ);
      alleyH.material = alleyMat;
      alleyH.receiveShadows = true;

      const alleyV = MeshBuilder.CreateBox(`alley_v_${x}_${z}`, { width: ALLEY_WIDTH, height: 0.08, depth: BLOCK_SIZE }, scene);
      alleyV.position = new Vector3(cellCenterX, 0.04, cellCenterZ);
      alleyV.material = alleyMat;
      alleyV.receiveShadows = true;
    }
  }
}

function createBuildings(scene: Scene): void {
  const origin = -TOTAL_SIZE / 2;
  const center = (GRID_SIZE - 1) / 2;
  const subSize = (BLOCK_SIZE - ALLEY_WIDTH) / 2;
  const subOffsets = [-(subSize / 2 + ALLEY_WIDTH / 2), subSize / 2 + ALLEY_WIDTH / 2];
  const winTex = getWindowTexture(scene);

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const distanceFromCenter = Math.max(Math.abs(x - center), Math.abs(z - center));
      const isDowntown = distanceFromCenter <= 1;
      const cellCenterX = origin + ROAD_WIDTH + x * CELL_SIZE + BLOCK_SIZE / 2;
      const cellCenterZ = origin + ROAD_WIDTH + z * CELL_SIZE + BLOCK_SIZE / 2;

      subOffsets.forEach((ox, lotXi) => {
        subOffsets.forEach((oz, lotZi) => {
          const occupyChance = isDowntown ? 0.9 : 0.6;
          if (Math.random() > occupyChance) return;

          const height = isDowntown ? rand(14, 30) : rand(4, 10);
          const footprint = subSize * rand(0.55, 0.8);

          const lotId = `${x}_${z}_${lotXi}_${lotZi}`;
          const building = MeshBuilder.CreateBox(`building_${lotId}`, { width: footprint, height, depth: footprint }, scene);
          building.position = new Vector3(cellCenterX + ox, height / 2, cellCenterZ + oz);
          building.receiveShadows = true;

          const mat = new PBRMaterial(`buildingMat_${lotId}`, scene);
          mat.albedoTexture = winTex;
          const v = isDowntown ? rand(0.5, 0.7) : rand(0.6, 0.85);
          mat.albedoColor = new Color3(v, v, v * 1.05);
          mat.roughness = 0.6;
          mat.metallic = 0.1;
          building.material = mat;
        });
      });
    }
  }
}

function createRingRoad(scene: Scene): void {
  const ringMat = new PBRMaterial('ringRoadMat', scene);
  ringMat.albedoColor = new Color3(0.2, 0.2, 0.22);
  ringMat.roughness = 0.85;
  ringMat.metallic = 0.05;

  const sides = 8;
  const points: Vector3[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    points.push(new Vector3(Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS));
  }

  for (let i = 0; i < sides; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % sides];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const segment = MeshBuilder.CreateBox(`ring_${i}`, { width: RING_WIDTH, height: 0.1, depth: length }, scene);
    segment.position = new Vector3((p1.x + p2.x) / 2, 0.05, (p1.z + p2.z) / 2);
    segment.rotation.y = Math.atan2(dx, dz);
    segment.material = ringMat;
    segment.receiveShadows = true;
  }
}

function createElevatedHighway(scene: Scene): void {
  const half = TOTAL_SIZE / 2;
  const flatLength = TOTAL_SIZE - 2 * RAMP_LENGTH;
  const slopeLength = Math.sqrt(RAMP_LENGTH * RAMP_LENGTH + ELEVATED_HEIGHT * ELEVATED_HEIGHT);

  const deckMat = new PBRMaterial('highwayDeckMat', scene);
  deckMat.albedoColor = new Color3(0.28, 0.28, 0.3);
  deckMat.roughness = 0.8;
  deckMat.metallic = 0.1;

  const pillarMat = new PBRMaterial('highwayPillarMat', scene);
  pillarMat.albedoColor = new Color3(0.45, 0.45, 0.45);
  pillarMat.roughness = 0.7;
  pillarMat.metallic = 0.05;

  const southRamp = MeshBuilder.CreateBox('highway_ramp_south', { width: ROAD_WIDTH, height: 0.4, depth: slopeLength }, scene);
  southRamp.position = new Vector3(0, ELEVATED_HEIGHT / 2, -half + RAMP_LENGTH / 2);
  southRamp.rotation.x = -Math.atan2(ELEVATED_HEIGHT, RAMP_LENGTH);
  southRamp.material = deckMat;
  southRamp.receiveShadows = true;

  const deck = MeshBuilder.CreateBox('highway_deck', { width: ROAD_WIDTH, height: 0.4, depth: flatLength }, scene);
  deck.position = new Vector3(0, ELEVATED_HEIGHT, 0);
  deck.material = deckMat;
  deck.receiveShadows = true;

  const northRamp = MeshBuilder.CreateBox('highway_ramp_north', { width: ROAD_WIDTH, height: 0.4, depth: slopeLength }, scene);
  northRamp.position = new Vector3(0, ELEVATED_HEIGHT / 2, half - RAMP_LENGTH / 2);
  northRamp.rotation.x = Math.atan2(ELEVATED_HEIGHT, RAMP_LENGTH);
  northRamp.material = deckMat;
  northRamp.receiveShadows = true;

  const origin = -TOTAL_SIZE / 2;
  for (let i = 0; i <= GRID_SIZE; i++) {
    const z = origin + i * CELL_SIZE;
    if (Math.abs(z) > flatLength / 2 - 1) continue;

    const pillar = MeshBuilder.CreateCylinder(`highway_pillar_${i}`, { diameter: 1.4, height: ELEVATED_HEIGHT }, scene);
    pillar.position = new Vector3(0, ELEVATED_HEIGHT / 2, z);
    pillar.material = pillarMat;
    pillar.receiveShadows = true;
  }
}

function createFlags(scene: Scene): void {
  const half = TOTAL_SIZE / 2;
  const positions = [
    new Vector3(0, 0, 0),
    new Vector3(half * 0.6, 0, half * 0.6),
    new Vector3(-half * 0.6, 0, half * 0.6),
    new Vector3(half * 0.6, 0, -half * 0.6),
    new Vector3(-half * 0.6, 0, -half * 0.6),
  ];

  positions.forEach((pos, i) => {
    const root = new TransformNode(`flag_${i}`, scene);
    root.position = pos;

    const pole = MeshBuilder.CreateCylinder(`pole_${i}`, { diameter: 0.3, height: 4 }, scene);
    pole.position = new Vector3(0, 2, 0);
    pole.parent = root;
    const poleMat = new PBRMaterial(`poleMat_${i}`, scene);
    poleMat.albedoColor = new Color3(0.6, 0.6, 0.6);
    poleMat.roughness = 0.5;
    poleMat.metallic = 0.6;
    pole.material = poleMat;

    const banner = MeshBuilder.CreateBox(`banner_${i}`, { width: 1.2, height: 0.8, depth: 0.1 }, scene);
    banner.position = new Vector3(0.6, 3.2, 0);
    banner.parent = root;
    const bannerMat = new PBRMaterial(`bannerMat_${i}`, scene);
    bannerMat.albedoColor = new Color3(1, 1, 1);
    bannerMat.roughness = 0.6;
    banner.material = bannerMat;
  });
}

function createSpawnMarkers(scene: Scene): void {
  const half = TOTAL_SIZE / 2;

  const spawnA = MeshBuilder.CreateDisc('spawnA', { radius: 4 }, scene);
  spawnA.rotation.x = Math.PI / 2;
  spawnA.position = new Vector3(-half + BLOCK_SIZE / 2, 0.06, -half + BLOCK_SIZE / 2);
  const matA = new PBRMaterial('spawnAMat', scene);
  matA.albedoColor = new Color3(0.2, 0.4, 1);
  matA.roughness = 0.7;
  spawnA.material = matA;

  const spawnB = MeshBuilder.CreateDisc('spawnB', { radius: 4 }, scene);
  spawnB.rotation.x = Math.PI / 2;
  spawnB.position = new Vector3(half - BLOCK_SIZE / 2, 0.06, half - BLOCK_SIZE / 2);
  const matB = new PBRMaterial('spawnBMat', scene);
  matB.albedoColor = new Color3(1, 0.3, 0.2);
  matB.roughness = 0.7;
  spawnB.material = matB;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
