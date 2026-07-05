import { Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight, Vector3, Color3, Color4, ShadowGenerator, Mesh } from '@babylonjs/core';
import { generateCity, getSpawnPosition } from './map/generateCity';
import { createPlayer } from './player/PlayerController';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.6, 0.78, 0.92, 1);
scene.fogMode = Scene.FOGMODE_LINEAR;
scene.fogColor = new Color3(0.72, 0.82, 0.9);
scene.fogStart = 160;
scene.fogEnd = 340;

const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3.2, 140, Vector3.Zero(), scene);
camera.lowerRadiusLimit = 3;
camera.upperRadiusLimit = 240;
camera.attachControl(canvas, true);

const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.55;

const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), scene);
sun.intensity = 1.1;
sun.position = new Vector3(200, 200, 200);

scene.collisionsEnabled = true;
generateCity(scene);
createPlayer(scene, camera, getSpawnPosition('A'));

const shadowGenerator = new ShadowGenerator(2048, sun);
shadowGenerator.usePercentageCloserFiltering = true;
scene.meshes.forEach((mesh) => {
  if (mesh.name === 'ground') return;
  shadowGenerator.addShadowCaster(mesh as Mesh);
});

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
