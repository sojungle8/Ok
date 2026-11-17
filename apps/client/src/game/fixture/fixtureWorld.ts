/**
 * TEST FIXTURE ONLY. Code-shaded ground from the GAT walk grid for automated tests against synthetic
 * sources. Loaded only through a dynamic import guarded by the compile-time fixture flag, so it is
 * absent from the formal bundle (checked by tools/e2e/run-all.mjs and the static graph test).
 */
import * as THREE from "three";
import type { GroundData } from "../renderer.ts";
import { gatHeightAt, type WorldLayer } from "../terrain.ts";

export const FIXTURE_MODULE_MARKER = "RO-SURVIVOR-FIXTURE-ONLY-MODULE";

export class FixtureWorld implements WorldLayer {
  readonly kind = "fixture" as const;
  readonly marker = FIXTURE_MODULE_MARKER;
  readonly object = new THREE.Group();
  readonly heightAt: (xm: number, ym: number) => number;
  readonly #overlay: THREE.Mesh;

  constructor(data: GroundData) {
    this.heightAt = gatHeightAt(data);
    const w = data.width;
    const h = data.height;
    const geo = new THREE.PlaneGeometry(w, h, w, h).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const overlay = new Float32Array(pos.count * 3);
    const base = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      const vx = pos.getX(i) + w / 2;
      const vz = pos.getZ(i) + h / 2;
      const cx = Math.min(w - 1, Math.floor(vx));
      const cy = Math.min(h - 1, Math.floor(h - vz));
      pos.setXYZ(i, vx, this.heightAt(cx, cy), -(h - vz));
      const t = data.types.charCodeAt(cy * w + cx) - 48;
      overlay.set(t === 0 || t === 3 ? [0.2, 0.75, 0.3] : [0.85, 0.15, 0.15], i * 3);
      base.set([0.32, 0.45, 0.28], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(base, 3));
    const og = geo.clone();
    og.setAttribute("color", new THREE.BufferAttribute(overlay, 3));
    this.#overlay = new THREE.Mesh(og, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false }));
    this.#overlay.visible = false;
    this.object.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true })), this.#overlay);
  }

  update(): void {}

  setDebugOverlay(on: boolean): void {
    this.#overlay.visible = on;
  }

  dispose(): void {
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        (o.geometry as THREE.BufferGeometry).dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
