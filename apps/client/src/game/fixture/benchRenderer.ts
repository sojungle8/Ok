/**
 * TEST FIXTURE ONLY: render bench (?bench=N in test-fixture builds). Code-shaded GAT ground; never
 * part of the formal bundle (main.tsx imports the bench dynamically behind the fixture flag).
 */
import * as THREE from "three";
import type { RenderSnapshot } from "@ro-survivor/core-sim";
import { BillboardBatch, type GroundData } from "../renderer.ts";
import type { SpriteSheet } from "../sprites.ts";

/** Renders the arena from RenderSnapshots only. It never mutates simulation state. */
export class ArenaRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly #player: BillboardBatch;
  readonly #enemies: BillboardBatch;
  #ground: THREE.Mesh | null = null;
  #overlay: THREE.Mesh | null = null;
  #heightAt: (x: number, y: number) => number = () => 0;
  readonly viewHeightM: number;
  textureBytes: number;

  constructor(canvas: HTMLCanvasElement, player: SpriteSheet, enemy: SpriteSheet, options: { capacity: number; viewHeightM?: number; pixelRatio?: number }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(options.pixelRatio ?? window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x8fb6d8);
    this.viewHeightM = options.viewHeightM ?? 22;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.#player = new BillboardBatch(player, 1);
    this.#enemies = new BillboardBatch(enemy, options.capacity);
    // No engine-drawn shadows: the RO ground-shadow sprite is not whitelisted yet (GAP-003).
    this.#enemies.mesh.renderOrder = 2;
    this.#player.mesh.renderOrder = 3;
    this.scene.add(this.#enemies.mesh, this.#player.mesh);
    this.textureBytes = player.textureBytes + enemy.textureBytes;
  }

  /**
   * Ground geometry from GAT heights. Y-up world: sim (x, y north) -> (X, -Z). Untextured shading is
   * only reachable in test-fixture builds; the formal game requires the GND textures (GAP-002).
   */
  setGround(data: GroundData): void {
    if (this.#ground) this.scene.remove(this.#ground);
    if (this.#overlay) this.scene.remove(this.#overlay);
    const w = data.width;
    const h = data.height;
    const off = 0;
    const heightAt = (cx: number, cy: number): number => {
      const x = Math.max(0, Math.min(w - 1, cx));
      const y = Math.max(0, Math.min(h - 1, cy));
      return -(data.cellHeights[y * w + x] ?? 0) * 0.2;
    };
    this.#heightAt = (xm, ym) => heightAt(Math.floor(xm), Math.floor(ym));
    const geo = new THREE.PlaneGeometry(w, h, w, h).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const overlayColors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      const vx = pos.getX(i) + w / 2;
      const vz = pos.getZ(i) + h / 2;
      const cx = Math.min(w - 1, Math.floor(vx));
      const cy = Math.min(h - 1, Math.floor(h - vz));
      pos.setXYZ(i, vx + off, heightAt(cx, cy), -(h - vz + off));
      const checker = (Math.floor(vx / 4) + Math.floor(vz / 4)) % 2 === 0 ? 0.04 : 0;
      colors.set([0.36 + checker, 0.55 + checker, 0.3], i * 3);
      const t = data.types.charCodeAt(cy * w + cx) - 48;
      overlayColors.set(t === 0 || t === 3 ? [0.2, 0.75, 0.3] : [0.85, 0.15, 0.15], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.#ground = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    const ogeo = geo.clone();
    ogeo.setAttribute("color", new THREE.BufferAttribute(overlayColors, 3));
    this.#overlay = new THREE.Mesh(ogeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.#overlay.visible = false;
    this.scene.add(this.#ground, this.#overlay);
  }

  setDebugOverlay(on: boolean): void {
    if (this.#overlay) this.#overlay.visible = on;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    const vh = this.viewHeightM / 2;
    this.camera.left = -vh * aspect;
    this.camera.right = vh * aspect;
    this.camera.top = vh;
    this.camera.bottom = -vh;
    this.camera.updateProjectionMatrix();
  }

  render(snap: RenderSnapshot, timeMs: number): void {
    const px = snap.player.x / 1000;
    const pz = -snap.player.y / 1000;
    const py = this.#heightAt(px, snap.player.y / 1000);
    this.camera.position.set(px, py + 30, pz + 30);
    this.camera.lookAt(px, py, pz);
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.#player.set(0, px, py, pz, snap.player.moving ? "walk" : "idle", snap.player.dir, timeMs);
    this.#player.commit(1, right, up);
    const e = snap.enemies;
    for (let i = 0; i < snap.enemyCount; i += 1) {
      const ex = (e[i * 5 + 1] as number) / 1000;
      const ey = (e[i * 5 + 2] as number) / 1000;
      const eh = this.#heightAt(ex, ey);
      this.#enemies.set(i, ex, eh, -ey, e[i * 5 + 4] ? "walk" : "idle", e[i * 5 + 3] as number, timeMs + (e[i * 5] as number) * 37);
    }
    this.#enemies.commit(snap.enemyCount, right, up);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
