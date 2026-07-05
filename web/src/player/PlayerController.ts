import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3, ArcRotateCamera, TransformNode } from '@babylonjs/core';
import { getDoors } from '../map/generateCity';

const MOVE_SPEED = 6;
const DOOR_REACH = 3.0;
const RUN_MULTIPLIER = 1.6;
const GRAVITY = -18;
const JUMP_SPEED = 7;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;

export function createPlayer(scene: Scene, camera: ArcRotateCamera, spawnPosition: Vector3): void {
  const player = MeshBuilder.CreateCapsule('player', { height: PLAYER_HEIGHT, radius: PLAYER_RADIUS }, scene);
  player.position = new Vector3(spawnPosition.x, spawnPosition.y + PLAYER_HEIGHT / 2 + 0.1, spawnPosition.z);
  player.checkCollisions = true;
  player.ellipsoid = new Vector3(PLAYER_RADIUS, PLAYER_HEIGHT / 2, PLAYER_RADIUS);
  player.ellipsoidOffset = new Vector3(0, PLAYER_HEIGHT / 2, 0);
  player.receiveShadows = true;

  const mat = new PBRMaterial('playerMat', scene);
  mat.albedoColor = new Color3(0.2, 0.4, 1);
  mat.roughness = 0.6;
  player.material = mat;

  const cameraTarget = new TransformNode('cameraTarget', scene);
  cameraTarget.parent = player;
  cameraTarget.position = new Vector3(0, 1, 0);
  camera.lockedTarget = cameraTarget;
  camera.radius = 8;
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 25;

  const keys: Record<string, boolean> = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyE') toggleNearestDoor(player.position);
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  let verticalVelocity = 0;

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    if (dt <= 0) return;

    const forward = camera.getDirection(Vector3.Forward());
    forward.y = 0;
    forward.normalize();
    const right = camera.getDirection(Vector3.Right());
    right.y = 0;
    right.normalize();

    let moveDir = Vector3.Zero();
    if (keys.KeyW) moveDir = moveDir.add(forward);
    if (keys.KeyS) moveDir = moveDir.subtract(forward);
    if (keys.KeyD) moveDir = moveDir.add(right);
    if (keys.KeyA) moveDir = moveDir.subtract(right);

    if (moveDir.lengthSquared() > 0) {
      moveDir.normalize();
      const speed = MOVE_SPEED * (keys.ShiftLeft ? RUN_MULTIPLIER : 1);
      moveDir = moveDir.scale(speed * dt);
      player.rotation.y = Math.atan2(moveDir.x, moveDir.z);
    }

    verticalVelocity += GRAVITY * dt;
    const requestedDeltaY = verticalVelocity * dt;
    const beforeY = player.position.y;
    player.moveWithCollisions(new Vector3(moveDir.x, requestedDeltaY, moveDir.z));
    const actualDeltaY = player.position.y - beforeY;

    const isGrounded = verticalVelocity <= 0 && actualDeltaY > requestedDeltaY + 0.0005;
    if (isGrounded) {
      verticalVelocity = keys.Space ? JUMP_SPEED : 0;
    }
  });
}

function toggleNearestDoor(playerPos: Vector3): void {
  const doors = getDoors();
  let nearest: (typeof doors)[number] | null = null;
  let nearestDist = DOOR_REACH;
  for (const door of doors) {
    const dx = door.worldPos.x - playerPos.x;
    const dz = door.worldPos.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = door;
    }
  }
  if (nearest) nearest.isOpen = !nearest.isOpen;
}
