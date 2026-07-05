import { Scene, MeshBuilder, StandardMaterial, Color3, Vector3, TransformNode } from '@babylonjs/core';

const GRID_SIZE = 6;
const BLOCK_SIZE = 18;
const ROAD_WIDTH = 6;
const CELL_SIZE = BLOCK_SIZE + ROAD_WIDTH;
const TOTAL_SIZE = CELL_SIZE * GRID_SIZE;

export function generateCity(scene: Scene): void {
  createGround(scene);
  createRoadGrid(scene);
  createBuildings(scene);
  createFlags(scene);
  createSpawnMarkers(scene);
}

function createGround(scene: Scene): void {
  const ground = MeshBuilder.CreateGround('ground', { width: TOTAL_SIZE, height: TOTAL_SIZE }, scene);
  const mat = new StandardMaterial('groundMat', scene);
  mat.diffuseColor = new Color3(0.35, 0.55, 0.35);
  ground.material = mat;
}

function createRoadGrid(scene: Scene): void {
  const roadMat = new StandardMaterial('roadMat', scene);
  roadMat.diffuseColor = new Color3(0.2, 0.2, 0.22);
  const origin = -TOTAL_SIZE / 2;

  for (let i = 0; i <= GRID_SIZE; i++) {
    const offset = origin + i * CELL_SIZE;

    const vertical = MeshBuilder.CreateBox(`road_v_${i}`, { width: ROAD_WIDTH, height: 0.1, depth: TOTAL_SIZE }, scene);
    vertical.position = new Vector3(offset, 0.05, 0);
    vertical.material = roadMat;

    const horizontal = MeshBuilder.CreateBox(`road_h_${i}`, { width: TOTAL_SIZE, height: 0.1, depth: ROAD_WIDTH }, scene);
    horizontal.position = new Vector3(0, 0.05, offset);
    horizontal.material = roadMat;
  }
}

function createBuildings(scene: Scene): void {
  const origin = -TOTAL_SIZE / 2;
  const center = (GRID_SIZE - 1) / 2;

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const distanceFromCenter = Math.max(Math.abs(x - center), Math.abs(z - center));
      const isDowntown = distanceFromCenter <= 1;
      const buildingsPerBlock = 1 + Math.floor(Math.random() * 2);

      for (let b = 0; b < buildingsPerBlock; b++) {
        const height = isDowntown ? rand(14, 28) : rand(4, 9);
        const footprint = rand(5, isDowntown ? 9 : 7);

        const building = MeshBuilder.CreateBox(`building_${x}_${z}_${b}`, { width: footprint, height, depth: footprint }, scene);
        const cellCenterX = origin + ROAD_WIDTH + x * CELL_SIZE + BLOCK_SIZE / 2;
        const cellCenterZ = origin + ROAD_WIDTH + z * CELL_SIZE + BLOCK_SIZE / 2;
        const jitterX = rand(-BLOCK_SIZE / 4, BLOCK_SIZE / 4);
        const jitterZ = rand(-BLOCK_SIZE / 4, BLOCK_SIZE / 4);

        building.position = new Vector3(cellCenterX + jitterX, height / 2, cellCenterZ + jitterZ);

        const mat = new StandardMaterial(`buildingMat_${x}_${z}_${b}`, scene);
        const v = isDowntown ? rand(0.5, 0.7) : rand(0.6, 0.85);
        mat.diffuseColor = new Color3(v, v, v * 1.05);
        building.material = mat;
      }
    }
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
    const poleMat = new StandardMaterial(`poleMat_${i}`, scene);
    poleMat.diffuseColor = new Color3(0.6, 0.6, 0.6);
    pole.material = poleMat;

    const banner = MeshBuilder.CreateBox(`banner_${i}`, { width: 1.2, height: 0.8, depth: 0.1 }, scene);
    banner.position = new Vector3(0.6, 3.2, 0);
    banner.parent = root;
    const bannerMat = new StandardMaterial(`bannerMat_${i}`, scene);
    bannerMat.diffuseColor = new Color3(1, 1, 1);
    banner.material = bannerMat;
  });
}

function createSpawnMarkers(scene: Scene): void {
  const half = TOTAL_SIZE / 2;

  const spawnA = MeshBuilder.CreateDisc('spawnA', { radius: 4 }, scene);
  spawnA.rotation.x = Math.PI / 2;
  spawnA.position = new Vector3(-half + BLOCK_SIZE / 2, 0.06, -half + BLOCK_SIZE / 2);
  const matA = new StandardMaterial('spawnAMat', scene);
  matA.diffuseColor = new Color3(0.2, 0.4, 1);
  spawnA.material = matA;

  const spawnB = MeshBuilder.CreateDisc('spawnB', { radius: 4 }, scene);
  spawnB.rotation.x = Math.PI / 2;
  spawnB.position = new Vector3(half - BLOCK_SIZE / 2, 0.06, half - BLOCK_SIZE / 2);
  const matB = new StandardMaterial('spawnBMat', scene);
  matB.diffuseColor = new Color3(1, 0.3, 0.2);
  spawnB.material = matB;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
