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
const SIDEWALK_WIDTH = 1.8;
const CELL_SIZE = BLOCK_SIZE + ROAD_WIDTH;
const TOTAL_SIZE = CELL_SIZE * GRID_SIZE;

const RING_RADIUS = TOTAL_SIZE / 2 + 30;
const RING_WIDTH = 6;
const WORLD_SIZE = RING_RADIUS * 2 + 20;

const ELEVATED_HEIGHT = 9;
const RAMP_LENGTH = CELL_SIZE;

let windowTexture: Texture | null = null;
let crosswalkTexture: Texture | null = null;
let fenceTexture: Texture | null = null;

const HOUSE_COLORS = [
  new Color3(0.62, 0.8, 0.9),
  new Color3(0.96, 0.85, 0.6),
  new Color3(0.94, 0.68, 0.68),
  new Color3(0.68, 0.88, 0.75),
  new Color3(0.9, 0.78, 0.55),
  new Color3(0.85, 0.75, 0.9),
];

export function generateCity(scene: Scene): void {
  createGround(scene);
  createRoadGrid(scene);
  createSidewalks(scene);
  createIntersectionProps(scene);
  createBuildings(scene);
  createTrees(scene);
  createRingRoad(scene);
  createElevatedHighway(scene);
  createFlags(scene);
  createSpawnMarkers(scene);
  createBoundaryFence(scene);
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

function getCrosswalkTexture(scene: Scene): Texture {
  if (crosswalkTexture) return crosswalkTexture;

  const size = 128;
  const texture = new DynamicTexture('crosswalkTex', { width: size, height: size }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = '#242427';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#e8e8e0';
  const stripes = 5;
  const stripeWidth = size / (stripes * 2);
  for (let i = 0; i < stripes; i++) {
    ctx.fillRect(i * stripeWidth * 2, 0, stripeWidth, size);
  }
  texture.update();
  crosswalkTexture = texture;
  return texture;
}

function getFenceTexture(scene: Scene): Texture {
  if (fenceTexture) return fenceTexture;

  const size = 128;
  const texture = new DynamicTexture('fenceTex', { width: size, height: size }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.strokeStyle = 'rgba(180, 185, 190, 0.9)';
  ctx.lineWidth = 2;
  const step = 16;
  for (let i = -size; i < size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }
  texture.update();
  texture.hasAlpha = true;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = WORLD_SIZE / 6;
  texture.vScale = 2;
  fenceTexture = texture;
  return texture;
}

function createBoundaryFence(scene: Scene): void {
  const fenceHeight = 6;
  const half = WORLD_SIZE / 2 - 1.5;

  const fenceMat = new PBRMaterial('fenceMat', scene);
  fenceMat.albedoTexture = getFenceTexture(scene);
  fenceMat.useAlphaFromAlbedoTexture = true;
  fenceMat.backFaceCulling = false;
  fenceMat.albedoColor = new Color3(0.75, 0.78, 0.8);
  fenceMat.roughness = 0.6;
  fenceMat.metallic = 0.3;

  const postMat = new PBRMaterial('fencePostMat', scene);
  postMat.albedoColor = new Color3(0.3, 0.3, 0.32);
  postMat.roughness = 0.6;
  postMat.metallic = 0.4;

  const sides: Array<[number, number, number, number]> = [
    [WORLD_SIZE - 3, fenceHeight, 0, -half],
    [WORLD_SIZE - 3, fenceHeight, 0, half],
    [fenceHeight, WORLD_SIZE - 3, -half, 0],
    [fenceHeight, WORLD_SIZE - 3, half, 0],
  ];

  sides.forEach(([w, d, ox, oz], i) => {
    const isVertical = ox !== 0;
    const panel = MeshBuilder.CreatePlane(
      `fence_${i}`,
      { width: isVertical ? d : w, height: fenceHeight },
      scene,
    );
    panel.position = new Vector3(ox, fenceHeight / 2, oz);
    if (isVertical) panel.rotation.y = Math.PI / 2;
    panel.material = fenceMat;
    panel.checkCollisions = true;

    const postCount = Math.round((isVertical ? d : w) / 12);
    for (let p = 0; p <= postCount; p += 1) {
      const t = p / postCount - 0.5;
      const post = MeshBuilder.CreateCylinder(`fence_post_${i}_${p}`, { diameter: 0.25, height: fenceHeight }, scene);
      post.position = isVertical
        ? new Vector3(ox, fenceHeight / 2, oz + t * d)
        : new Vector3(ox + t * w, fenceHeight / 2, oz);
      post.material = postMat;
      post.checkCollisions = true;
    }
  });
}

function createGround(scene: Scene): void {
  const ground = MeshBuilder.CreateGround('ground', { width: WORLD_SIZE, height: WORLD_SIZE }, scene);
  const mat = new PBRMaterial('groundMat', scene);
  mat.albedoTexture = getGrassTexture(scene);
  mat.roughness = 0.95;
  mat.metallic = 0;
  ground.material = mat;
  ground.receiveShadows = true;
  ground.checkCollisions = true;
}

function createRoadGrid(scene: Scene): void {
  const roadMat = new PBRMaterial('roadMat', scene);
  roadMat.albedoColor = new Color3(0.18, 0.18, 0.2);
  roadMat.roughness = 0.85;
  roadMat.metallic = 0.05;

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
}

function createSidewalks(scene: Scene): void {
  const sidewalkMat = new PBRMaterial('sidewalkMat', scene);
  sidewalkMat.albedoColor = new Color3(0.72, 0.71, 0.68);
  sidewalkMat.roughness = 0.9;
  sidewalkMat.metallic = 0;

  const origin = -TOTAL_SIZE / 2;

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const cellCenterX = origin + ROAD_WIDTH + x * CELL_SIZE + BLOCK_SIZE / 2;
      const cellCenterZ = origin + ROAD_WIDTH + z * CELL_SIZE + BLOCK_SIZE / 2;
      const half = BLOCK_SIZE / 2;

      const edges: Array<[number, number, number, number]> = [
        [BLOCK_SIZE, SIDEWALK_WIDTH, 0, -half + SIDEWALK_WIDTH / 2],
        [BLOCK_SIZE, SIDEWALK_WIDTH, 0, half - SIDEWALK_WIDTH / 2],
        [SIDEWALK_WIDTH, BLOCK_SIZE, -half + SIDEWALK_WIDTH / 2, 0],
        [SIDEWALK_WIDTH, BLOCK_SIZE, half - SIDEWALK_WIDTH / 2, 0],
      ];

      edges.forEach(([w, d, ox, oz], i) => {
        const strip = MeshBuilder.CreateBox(`sidewalk_${x}_${z}_${i}`, { width: w, height: 0.12, depth: d }, scene);
        strip.position = new Vector3(cellCenterX + ox, 0.06, cellCenterZ + oz);
        strip.material = sidewalkMat;
        strip.receiveShadows = true;
        strip.checkCollisions = true;
      });
    }
  }
}

function createIntersectionProps(scene: Scene): void {
  const poleMat = new PBRMaterial('poleMat', scene);
  poleMat.albedoColor = new Color3(0.25, 0.25, 0.27);
  poleMat.roughness = 0.6;
  poleMat.metallic = 0.4;

  const lampMat = new PBRMaterial('lampMat', scene);
  lampMat.albedoColor = new Color3(1, 0.95, 0.7);
  lampMat.emissiveColor = new Color3(0.9, 0.85, 0.5);
  lampMat.roughness = 0.5;

  const redMat = new PBRMaterial('trafficRedMat', scene);
  redMat.albedoColor = new Color3(1, 0.2, 0.15);
  redMat.emissiveColor = new Color3(0.6, 0.05, 0.05);

  const greenMat = new PBRMaterial('trafficGreenMat', scene);
  greenMat.albedoColor = new Color3(0.2, 0.9, 0.3);
  greenMat.emissiveColor = new Color3(0.05, 0.4, 0.1);

  const boxMat = new PBRMaterial('trafficBoxMat', scene);
  boxMat.albedoColor = new Color3(0.15, 0.15, 0.15);
  boxMat.roughness = 0.6;

  const crosswalkMat = new PBRMaterial('crosswalkMat', scene);
  crosswalkMat.albedoTexture = getCrosswalkTexture(scene);
  crosswalkMat.roughness = 0.9;

  const origin = -TOTAL_SIZE / 2;
  const cornerOffset = ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2;

  for (let i = 0; i <= GRID_SIZE; i++) {
    for (let j = 0; j <= GRID_SIZE; j++) {
      const x = origin + i * CELL_SIZE;
      const z = origin + j * CELL_SIZE;

      const lampPole = MeshBuilder.CreateCylinder(`lamp_pole_${i}_${j}`, { diameter: 0.25, height: 5 }, scene);
      lampPole.position = new Vector3(x + cornerOffset, 2.5, z + cornerOffset);
      lampPole.material = poleMat;
      lampPole.receiveShadows = true;

      const lampHead = MeshBuilder.CreateSphere(`lamp_head_${i}_${j}`, { diameter: 0.6 }, scene);
      lampHead.position = new Vector3(x + cornerOffset, 5, z + cornerOffset);
      lampHead.material = lampMat;

      if (i < GRID_SIZE && j < GRID_SIZE) {
        const signalPole = MeshBuilder.CreateCylinder(`signal_pole_${i}_${j}`, { diameter: 0.25, height: 4.5 }, scene);
        signalPole.position = new Vector3(x - cornerOffset, 2.25, z - cornerOffset);
        signalPole.material = poleMat;
        signalPole.receiveShadows = true;

        const signalBox = MeshBuilder.CreateBox(`signal_box_${i}_${j}`, { width: 0.5, height: 1.2, depth: 0.4 }, scene);
        signalBox.position = new Vector3(x - cornerOffset, 4.3, z - cornerOffset);
        signalBox.material = boxMat;

        const redLight = MeshBuilder.CreateSphere(`signal_red_${i}_${j}`, { diameter: 0.25 }, scene);
        redLight.position = new Vector3(x - cornerOffset, 4.6, z - cornerOffset - 0.21);
        redLight.material = redMat;

        const greenLight = MeshBuilder.CreateSphere(`signal_green_${i}_${j}`, { diameter: 0.25 }, scene);
        greenLight.position = new Vector3(x - cornerOffset, 4.0, z - cornerOffset - 0.21);
        greenLight.material = greenMat;

        const approaches: Array<[number, number, number]> = [
          [ROAD_WIDTH, 2.5, 0],
          [ROAD_WIDTH, -2.5, 0],
          [2.5, 0, ROAD_WIDTH],
          [-2.5, 0, ROAD_WIDTH],
        ];
        approaches.forEach(([ox, oz, rotFlag], k) => {
          const isVertical = rotFlag !== 0;
          const crosswalk = MeshBuilder.CreateGround(
            `crosswalk_${i}_${j}_${k}`,
            { width: isVertical ? ROAD_WIDTH : 2.4, height: isVertical ? 2.4 : ROAD_WIDTH },
            scene,
          );
          crosswalk.position = new Vector3(x + ox, 0.07, z + oz);
          crosswalk.material = crosswalkMat;
        });
      }
    }
  }
}

function createTrees(scene: Scene): void {
  const trunkMat = new PBRMaterial('trunkMat', scene);
  trunkMat.albedoColor = new Color3(0.35, 0.25, 0.15);
  trunkMat.roughness = 0.9;

  const foliageMat = new PBRMaterial('foliageMat', scene);
  foliageMat.albedoColor = new Color3(0.2, 0.45, 0.2);
  foliageMat.roughness = 0.9;

  const origin = -TOTAL_SIZE / 2;
  const center = (GRID_SIZE - 1) / 2;
  let treeId = 0;

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const distanceFromCenter = Math.max(Math.abs(x - center), Math.abs(z - center));
      const isDowntown = distanceFromCenter <= 1;
      const cellCenterX = origin + ROAD_WIDTH + x * CELL_SIZE + BLOCK_SIZE / 2;
      const cellCenterZ = origin + ROAD_WIDTH + z * CELL_SIZE + BLOCK_SIZE / 2;
      const treeCount = isDowntown ? 1 : Math.floor(rand(1, 4));

      for (let t = 0; t < treeCount; t++) {
        const ox = rand(-BLOCK_SIZE / 2 + 1.5, BLOCK_SIZE / 2 - 1.5);
        const oz = rand(-BLOCK_SIZE / 2 + 1.5, BLOCK_SIZE / 2 - 1.5);

        treeId += 1;
        const trunk = MeshBuilder.CreateCylinder(`tree_trunk_${treeId}`, { diameter: 0.35, height: 2.2 }, scene);
        trunk.position = new Vector3(cellCenterX + ox, 1.1, cellCenterZ + oz);
        trunk.material = trunkMat;
        trunk.receiveShadows = true;

        const foliage = MeshBuilder.CreateSphere(`tree_foliage_${treeId}`, { diameter: rand(2.2, 3.2), segments: 6 }, scene);
        foliage.position = new Vector3(cellCenterX + ox, 2.8, cellCenterZ + oz);
        foliage.material = foliageMat;
        foliage.receiveShadows = true;
      }
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

          const height = isDowntown ? rand(8, 16) : rand(3.5, 6);
          const footprint = subSize * rand(0.55, 0.8);
          const lotId = `${x}_${z}_${lotXi}_${lotZi}`;
          const position = new Vector3(cellCenterX + ox, 0, cellCenterZ + oz);

          if (isDowntown) {
            const v = rand(0.5, 0.7);
            createHollowBuilding(scene, lotId, position, footprint, height, new Color3(v, v, v * 1.05), winTex, true);
          } else {
            const color = HOUSE_COLORS[Math.floor(Math.random() * HOUSE_COLORS.length)];
            createHollowBuilding(scene, lotId, position, footprint, height, color, null, false);
          }
        });
      });
    }
  }
}

function createHollowBuilding(
  scene: Scene,
  id: string,
  position: Vector3,
  footprint: number,
  height: number,
  color: Color3,
  winTex: Texture | null,
  isDowntown: boolean,
): void {
  const wallThickness = 0.3;
  const half = footprint / 2;

  const wallMat = new PBRMaterial(`buildingMat_${id}`, scene);
  if (winTex) wallMat.albedoTexture = winTex;
  wallMat.albedoColor = color;
  wallMat.roughness = 0.6;
  wallMat.metallic = 0.1;

  const canHaveDoor = footprint >= 4;
  const doorWidth = Math.min(2.2, footprint * 0.4);

  const addWall = (name: string, w: number, d: number, ox: number, oz: number) => {
    const wall = MeshBuilder.CreateBox(name, { width: w, height, depth: d }, scene);
    wall.position = new Vector3(position.x + ox, height / 2, position.z + oz);
    wall.material = wallMat;
    wall.checkCollisions = true;
    wall.receiveShadows = true;
  };

  if (canHaveDoor) {
    const segW = (footprint - doorWidth) / 2;
    addWall(`${id}_wallS_a`, segW, wallThickness, -(doorWidth / 2 + segW / 2), -half + wallThickness / 2);
    addWall(`${id}_wallS_b`, segW, wallThickness, doorWidth / 2 + segW / 2, -half + wallThickness / 2);
  } else {
    addWall(`${id}_wallS`, footprint, wallThickness, 0, -half + wallThickness / 2);
  }

  addWall(`${id}_wallN`, footprint, wallThickness, 0, half - wallThickness / 2);
  addWall(`${id}_wallE`, wallThickness, footprint, half - wallThickness / 2, 0);
  addWall(`${id}_wallW`, wallThickness, footprint, -half + wallThickness / 2, 0);

  const walkableRoof = isDowntown && height > 8;

  if (walkableRoof) {
    const roofMat = new PBRMaterial(`roofMat_${id}`, scene);
    roofMat.albedoColor = new Color3(0.3, 0.3, 0.32);
    roofMat.roughness = 0.9;

    const roof = MeshBuilder.CreateBox(`${id}_roof`, { width: footprint, height: wallThickness, depth: footprint }, scene);
    roof.position = new Vector3(position.x, height, position.z);
    roof.material = roofMat;
    roof.checkCollisions = true;
    roof.receiveShadows = true;

    if (canHaveDoor) {
      createSpiralStaircase(scene, id, position, footprint, height, wallThickness);
    }
  } else {
    const pitchMat = new PBRMaterial(`pitchMat_${id}`, scene);
    pitchMat.albedoColor = new Color3(0.5, 0.32, 0.28);
    pitchMat.roughness = 0.85;

    const roofHeight = footprint * 0.4;
    const roof = MeshBuilder.CreateCylinder(
      `${id}_roof`,
      { diameterTop: 0, diameterBottom: footprint * 1.2, height: roofHeight, tessellation: 4 },
      scene,
    );
    roof.position = new Vector3(position.x, height + roofHeight / 2, position.z);
    roof.rotation.y = Math.PI / 4;
    roof.material = pitchMat;
    roof.checkCollisions = true;
    roof.receiveShadows = true;
  }
}

function createSpiralStaircase(
  scene: Scene,
  id: string,
  position: Vector3,
  footprint: number,
  height: number,
  wallThickness: number,
): void {
  const stairMat = new PBRMaterial(`stairMat_${id}`, scene);
  stairMat.albedoColor = new Color3(0.5, 0.5, 0.5);
  stairMat.roughness = 0.8;

  const radius = Math.min(footprint / 2 - wallThickness - 0.6, 2.2);
  const risePerSegment = 0.9;
  const numSegments = Math.max(8, Math.round(height / risePerSegment));
  const segmentsPerTurn = 8;
  const angleStep = (Math.PI * 2) / segmentsPerTurn;
  const actualRise = height / numSegments;

  for (let s = 0; s < numSegments; s++) {
    const angle0 = s * angleStep;
    const angle1 = (s + 1) * angleStep;
    const y0 = s * actualRise;
    const y1 = (s + 1) * actualRise;

    const x0 = Math.cos(angle0) * radius;
    const z0 = Math.sin(angle0) * radius;
    const x1 = Math.cos(angle1) * radius;
    const z1 = Math.sin(angle1) * radius;

    const dx = x1 - x0;
    const dz = z1 - z0;
    const dy = y1 - y0;
    const runLen = Math.sqrt(dx * dx + dz * dz);
    const segLen = Math.sqrt(runLen * runLen + dy * dy);

    const step = MeshBuilder.CreateBox(`${id}_stair_${s}`, { width: 1.2, height: 0.15, depth: segLen }, scene);
    step.position = new Vector3(position.x + (x0 + x1) / 2, (y0 + y1) / 2, position.z + (z0 + z1) / 2);
    step.rotation.y = Math.atan2(dx, dz);
    step.rotation.x = -Math.atan2(dy, runLen);
    step.material = stairMat;
    step.checkCollisions = true;
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
  southRamp.checkCollisions = true;

  const deck = MeshBuilder.CreateBox('highway_deck', { width: ROAD_WIDTH, height: 0.4, depth: flatLength }, scene);
  deck.position = new Vector3(0, ELEVATED_HEIGHT, 0);
  deck.material = deckMat;
  deck.receiveShadows = true;
  deck.checkCollisions = true;

  const northRamp = MeshBuilder.CreateBox('highway_ramp_north', { width: ROAD_WIDTH, height: 0.4, depth: slopeLength }, scene);
  northRamp.position = new Vector3(0, ELEVATED_HEIGHT / 2, half - RAMP_LENGTH / 2);
  northRamp.rotation.x = Math.atan2(ELEVATED_HEIGHT, RAMP_LENGTH);
  northRamp.material = deckMat;
  northRamp.receiveShadows = true;
  northRamp.checkCollisions = true;

  const origin = -TOTAL_SIZE / 2;
  for (let i = 0; i <= GRID_SIZE; i++) {
    const z = origin + i * CELL_SIZE;
    if (Math.abs(z) > flatLength / 2 - 1) continue;

    const pillar = MeshBuilder.CreateCylinder(`highway_pillar_${i}`, { diameter: 1.4, height: ELEVATED_HEIGHT }, scene);
    pillar.position = new Vector3(0, ELEVATED_HEIGHT / 2, z);
    pillar.material = pillarMat;
    pillar.receiveShadows = true;
    pillar.checkCollisions = true;
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

export function getSpawnPosition(team: 'A' | 'B'): Vector3 {
  const half = TOTAL_SIZE / 2;
  return team === 'A'
    ? new Vector3(-half + BLOCK_SIZE / 2, 0, -half + BLOCK_SIZE / 2)
    : new Vector3(half - BLOCK_SIZE / 2, 0, half - BLOCK_SIZE / 2);
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
