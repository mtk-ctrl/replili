import Phaser from "phaser";

/**
 * Procedurally generated textures (glows, particles, arrows, gradients).
 * Everything is drawn once into canvas textures at startup so the rest of the
 * game can use cheap Images/Particles instead of per-frame Graphics.
 */
export function createProceduralTextures(scene: Phaser.Scene): void {
  createGlow(scene, "fx-glow", 128);
  createSpark(scene, "fx-spark", 10);
  createFlame(scene, "fx-flame");
  createVignette(scene, "fx-vignette", scene.scale.width, scene.scale.height);
  createTitleBackground(scene, "title-bg", scene.scale.width, scene.scale.height);
  createArrowTexture(scene, "arrow-red", "#e5735f");
  createArrowTexture(scene, "arrow-blue", "#6fb3dc");
}

function makeCanvas(scene: Phaser.Scene, key: string, w: number, h: number): CanvasRenderingContext2D | null {
  if (scene.textures.exists(key)) return null;
  const tex = scene.textures.createCanvas(key, w, h);
  return tex ? tex.getContext() : null;
}

function refresh(scene: Phaser.Scene, key: string): void {
  (scene.textures.get(key) as Phaser.Textures.CanvasTexture).refresh();
}

/** Soft radial white glow — tinted at use-site for torches, flags, and the player light. */
function createGlow(scene: Phaser.Scene, key: string, size: number): void {
  const ctx = makeCanvas(scene, key, size, size);
  if (!ctx) return;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  refresh(scene, key);
}

/** Tiny bright dot used by every particle burst (hits, deaths, embers). */
function createSpark(scene: Phaser.Scene, key: string, size: number): void {
  const ctx = makeCanvas(scene, key, size, size);
  if (!ctx) return;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  refresh(scene, key);
}

/** Small teardrop flame for wall torches. */
function createFlame(scene: Phaser.Scene, key: string): void {
  const w = 18;
  const h = 26;
  const ctx = makeCanvas(scene, key, w, h);
  if (!ctx) return;

  const outer = ctx.createRadialGradient(w / 2, h * 0.62, 1, w / 2, h * 0.62, h * 0.55);
  outer.addColorStop(0, "rgba(255,150,40,0.95)");
  outer.addColorStop(0.7, "rgba(230,80,20,0.55)");
  outer.addColorStop(1, "rgba(200,50,10,0)");
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.quadraticCurveTo(w, h * 0.55, w / 2, h);
  ctx.quadraticCurveTo(0, h * 0.55, w / 2, 0);
  ctx.fill();

  const core = ctx.createRadialGradient(w / 2, h * 0.68, 0, w / 2, h * 0.68, h * 0.3);
  core.addColorStop(0, "rgba(255,240,170,1)");
  core.addColorStop(1, "rgba(255,190,60,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.68, w * 0.28, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  refresh(scene, key);
}

/** Screen-space darkened corners; sits on top of everything for a cinematic frame. */
function createVignette(scene: Phaser.Scene, key: string, w: number, h: number): void {
  const ctx = makeCanvas(scene, key, w, h);
  if (!ctx) return;
  const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.95);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.65, "rgba(4,5,12,0.28)");
  grad.addColorStop(1, "rgba(2,3,8,0.62)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  refresh(scene, key);
}

/** Deep navy-to-violet gradient with a faint central glow, used behind the title. */
function createTitleBackground(scene: Phaser.Scene, key: string, w: number, h: number): void {
  const ctx = makeCanvas(scene, key, w, h);
  if (!ctx) return;

  const vertical = ctx.createLinearGradient(0, 0, 0, h);
  vertical.addColorStop(0, "#070a14");
  vertical.addColorStop(0.55, "#101426");
  vertical.addColorStop(1, "#1c1030");
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, w, h);

  const halo = ctx.createRadialGradient(w / 2, h * 0.4, 20, w / 2, h * 0.4, h * 0.7);
  halo.addColorStop(0, "rgba(212,175,90,0.16)");
  halo.addColorStop(0.5, "rgba(120,90,50,0.06)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  // scattered faint stars
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.8;
    const r = Math.random() * 1.2 + 0.3;
    ctx.fillStyle = `rgba(220,225,255,${0.08 + Math.random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  refresh(scene, key);
}

/** A proper arrow (fletching, shaft, steel head) pointing right; rotated at spawn time. */
function createArrowTexture(scene: Phaser.Scene, key: string, fletchColor: string): void {
  const w = 30;
  const h = 10;
  const ctx = makeCanvas(scene, key, w, h);
  if (!ctx) return;
  const cy = h / 2;

  ctx.strokeStyle = "#8a6a42";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, cy);
  ctx.lineTo(23, cy);
  ctx.stroke();

  ctx.fillStyle = fletchColor;
  ctx.beginPath();
  ctx.moveTo(0, cy - 4);
  ctx.lineTo(7, cy);
  ctx.lineTo(0, cy + 4);
  ctx.lineTo(3, cy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#c8d0d8";
  ctx.beginPath();
  ctx.moveTo(30, cy);
  ctx.lineTo(22, cy - 4);
  ctx.lineTo(24, cy);
  ctx.lineTo(22, cy + 4);
  ctx.closePath();
  ctx.fill();

  refresh(scene, key);
}
