import { Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight, Vector3, Color4 } from '@babylonjs/core';
import { generateCity } from './map/generateCity';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.55, 0.75, 0.95, 1);

const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3.2, 140, Vector3.Zero(), scene);
camera.lowerRadiusLimit = 20;
camera.upperRadiusLimit = 220;
camera.attachControl(canvas, true);

const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
hemi.intensity = 0.7;

const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), scene);
sun.intensity = 0.8;

generateCity(scene);

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
