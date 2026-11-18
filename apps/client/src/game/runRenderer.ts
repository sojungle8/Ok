import * as THREE from "three";
import type { RunContent, RunState } from "@ro-survivor/core-sim";
import { telegraphColors, type Settings } from "../settings.ts";
import type { OfficialShadowLayer } from "./formal/world.ts";
import {
  animationDuration,
  CombatOverlay,
  CombatPresentationState,
  officialShadowScale,
  sharedSpriteVisualScale,
  type ActorSnapshot,
  type DamageCue,
} from "./presentation.ts";
import { BillboardBatch } from "./renderer.ts";
import type { SpriteSheet } from "./sprites.ts";
import type { WorldLayer } from "./terrain.ts";

/**
 * Renders a RunState read-only. Actors use RO sprite sheets only (D-022). The world (formal: original
 * GND / RSM / water; fixture: test-only shading) is injected and lives in its own module. Telegraphs,
 * hazard and XP markers are gameplay overlays drawn from the geometry the simulation hits with (D-025).
 */
export class RunRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  readonly #player: BillboardBatch;
  readonly #batches = new Map<string, BillboardBatch>();
  readonly #telegraphs = new Map<number, THREE.Mesh>();
  readonly #markers: THREE.InstancedMesh;
  readonly #visualScales = new Map<string, number>();
  readonly #shadowScales = new Map<string, number>();
  readonly world: WorldLayer;
  readonly shadow: OfficialShadowLayer | null;
  readonly #heightAt: (xm: number, ym: number) => number;
  readonly #presentation = new CombatPresentationState();
  readonly #overlay: CombatOverlay | null;
  #cam = { x: 0, y: 0, ready: false };
  readonly content: RunContent;
  settings: Settings;
  textureBytes = 0;
  /** Monotonic presentation clock; results redraws must never rewind ACT or transient cues. */
  presentationTimeMs = 0;

  constructor(canvas: HTMLCanvasElement, content: RunContent, player: SpriteSheet, enemies: Record<string, SpriteSheet>, settings: Settings, world: WorldLayer, shadow: OfficialShadowLayer | null) {
    this.content = content;
    this.settings = settings;
    this.world = world;
    this.#heightAt = (xm, ym) => world.heightAt(xm, ym);
    this.shadow = shadow;
    for (const type of Object.keys(content.monsters)) {
      this.#visualScales.set(type, sharedSpriteVisualScale(content, type));
      this.#shadowScales.set(type, officialShadowScale(content, type));
    }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    if (world.skillEffects) canvas.dataset.roSkillFxSource = world.skillEffects.sourceAssetId;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x1d1b18);
    this.#player = new BillboardBatch(player, 1);
    this.#player.mesh.renderOrder = 5;
    this.textureBytes += player.textureBytes;
    for (const [ref, sheet] of Object.entries(enemies)) {
      const b = new BillboardBatch(sheet, 480);
      b.mesh.renderOrder = 4;
      this.#batches.set(ref, b);
      this.scene.add(b.mesh);
      this.textureBytes += sheet.textureBytes;
    }
    this.#markers = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), 1200);
    this.#markers.renderOrder = 3;
    this.#markers.frustumCulled = false;
    this.scene.add(world.object, this.#player.mesh, this.#markers);
    if (shadow) this.scene.add(shadow.mesh);
    this.#overlay = canvas.parentElement ? new CombatOverlay(canvas.parentElement) : null;
  }

  setDebugOverlay(on: boolean): void {
    this.world.setDebugOverlay(on);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height);
    const vh = 11;
    Object.assign(this.camera, { left: -vh * aspect, right: vh * aspect, top: vh, bottom: -vh });
    this.camera.updateProjectionMatrix();
  }

  #telegraphMesh(t: RunState["telegraphs"][number]): THREE.Mesh {
    let m = this.#telegraphs.get(t.id);
    if (m) return m;
    const g = t.placed.shape;
    let geo: THREE.BufferGeometry;
    if (g.shape === "circle") geo = new THREE.RingGeometry(Math.max(0.01, g.radiusMm / 1000 - 0.12), g.radiusMm / 1000, 40);
    else if (g.shape === "sector") {
      const half = (g.halfAngleDeg * Math.PI) / 180;
      const facing = Math.atan2(t.placed.dy, t.placed.dx);
      geo = new THREE.CircleGeometry(g.rangeMm / 1000, 32, facing - half, half * 2);
    } else {
      const shape = new THREE.Shape();
      const r = g.radiusMm / 1000;
      const len = g.rangeMm / 1000;
      shape.absarc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
      shape.lineTo(len, -r);
      shape.absarc(len, 0, r, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(0, r);
      geo = new THREE.ShapeGeometry(shape).rotateZ(Math.atan2(t.placed.dy, t.placed.dx));
    }
    geo.rotateX(-Math.PI / 2);
    m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: telegraphColors(this.settings).danger, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 2;
    m.userData.geomId = t.geomId; // the same ID the simulation reports on hit
    this.#telegraphs.set(t.id, m);
    this.scene.add(m);
    return m;
  }

  render(st: RunState, timeMs: number): void {
    const presentMs = Math.max(this.presentationTimeMs, timeMs);
    this.presentationTimeMs = presentMs;
    const p = st.player;
    const px = p.x / 1000;
    const pz = -p.y / 1000;
    const dir = (fx: number, fy: number): number => {
      const ax = Math.abs(fx);
      const ay = Math.abs(fy);
      if (ay * 1000 <= ax * 414) return fx > 0 ? 6 : 2;
      if (ax * 1000 <= ay * 414) return fy > 0 ? 4 : 0;
      return fx > 0 ? (fy > 0 ? 5 : 7) : fy > 0 ? 3 : 1;
    };
    const actors = new Map<number, ActorSnapshot>();
    for (const e of st.enemies) {
      const def = this.content.monsters[e.type];
      const ref = def?.assetRef ?? "";
      const batch = this.#batches.get(ref);
      const facing = dir(e.fx, e.fy);
      if (!def || !batch) continue;
      actors.set(e.id, {
        id: e.id,
        type: e.type,
        assetRef: ref,
        xMm: e.x,
        yMm: e.y,
        fx: e.fx,
        fy: e.fy,
        visualScale: this.#visualScales.get(e.type) ?? 1,
        shadowScale: this.#shadowScales.get(e.type) ?? 1,
        deathDurationMs: animationDuration(batch.sheet, "death", facing),
      });
    }
    this.#presentation.ingest(
      st,
      presentMs,
      actors,
      this.settings,
      this.content.player.basicSkillId,
      animationDuration(this.#player.sheet, "death", dir(p.fx, p.fy)),
    );
    this.world.skillEffects?.ingest(st.events, presentMs);
    // Camera follows with damping; it never feeds back into the simulation.
    if (!this.#cam.ready) this.#cam = { x: px, y: pz, ready: true };
    this.#cam.x += (px - this.#cam.x) * 0.15;
    this.#cam.y += (pz - this.#cam.y) * 0.15;
    const py = this.world.heightAt(px, p.y / 1000);
    const shake = this.#presentation.shake(presentMs, this.settings.shake);
    this.camera.position.set(this.#cam.x + shake.x, py + 30, this.#cam.y + 30 + shake.z);
    this.camera.lookAt(this.#cam.x + shake.x, py, this.#cam.y + shake.z);
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.world.skillEffects?.update(presentMs, this.#heightAt, right, up, this.settings.effectOpacity);
    if (this.world.skillEffects) this.renderer.domElement.dataset.roSkillFxActive = String(this.world.skillEffects.activeCount);
    const playerAnimation = this.#presentation.playerAnimation(st, presentMs, presentMs);
    this.#player.set(0, px, py, pz, playerAnimation.slot, dir(p.fx, p.fy), playerAnimation.timeMs);
    this.#player.commit(1, right, up);
    const counts = new Map<string, number>();
    for (const e of st.enemies) {
      const ref = this.content.monsters[e.type]?.assetRef ?? "";
      const b = this.#batches.get(ref);
      if (!b) continue;
      const i = counts.get(ref) ?? 0;
      if (i >= b.mesh.instanceMatrix.count) continue;
      counts.set(ref, i + 1);
      const animation = this.#presentation.enemyAnimation(e, st, presentMs, presentMs);
      b.set(i, e.x / 1000, this.world.heightAt(e.x / 1000, e.y / 1000), -e.y / 1000, animation.slot, dir(e.fx, e.fy), animation.timeMs, this.#visualScales.get(e.type) ?? 1);
    }
    for (const death of this.#presentation.deaths.values()) {
      const b = this.#batches.get(death.assetRef);
      if (!b) continue;
      const i = counts.get(death.assetRef) ?? 0;
      if (i >= b.mesh.instanceMatrix.count) continue;
      counts.set(death.assetRef, i + 1);
      b.set(i, death.xMm / 1000, this.world.heightAt(death.xMm / 1000, death.yMm / 1000), -death.yMm / 1000, "death", dir(death.fx, death.fy), presentMs - death.startMs, death.visualScale);
    }
    for (const [ref, b] of this.#batches) b.commit(counts.get(ref) ?? 0, right, up);
    if (this.shadow) {
      const feet: number[] = [px, py, pz];
      const scales: number[] = [1];
      for (const e of st.enemies) {
        feet.push(e.x / 1000, this.world.heightAt(e.x / 1000, e.y / 1000), -e.y / 1000);
        scales.push(this.#shadowScales.get(e.type) ?? 1);
      }
      for (const death of this.#presentation.deaths.values()) {
        feet.push(death.xMm / 1000, this.world.heightAt(death.xMm / 1000, death.yMm / 1000), -death.yMm / 1000);
        scales.push(death.shadowScale);
      }
      this.shadow.set(feet, scales);
    }
    this.world.update(presentMs);
    // Telegraphs: opacity ramps toward the hit tick; never reduced by effect settings.
    const live = new Set<number>();
    for (const t of st.telegraphs) {
      live.add(t.id);
      const m = this.#telegraphMesh(t);
      const span = Math.max(1, t.hitTick - t.startTick);
      const k = Math.min(1, Math.max(0, (st.runTick - t.startTick) / span));
      (m.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.55 * k;
      m.position.set(t.placed.ox / 1000, this.world.heightAt(t.placed.ox / 1000, t.placed.oy / 1000) + 0.05, -t.placed.oy / 1000);
    }
    for (const [id, m] of this.#telegraphs) {
      if (live.has(id)) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.#telegraphs.delete(id);
    }
    // Hazard and XP markers (projectiles, pools, orbs) in one instanced draw.
    const mtx = new THREE.Matrix4();
    const col = new THREE.Color();
    const colors = telegraphColors(this.settings);
    let n = 0;
    const put = (x: number, y: number, r: number, c: number): void => {
      if (n >= 1200) return;
      mtx.makeScale(r, 1, r).setPosition(x / 1000, this.world.heightAt(x / 1000, y / 1000) + 0.06, -y / 1000);
      this.#markers.setMatrixAt(n, mtx);
      this.#markers.setColorAt(n, col.setHex(c));
      n += 1;
    };
    for (const pj of st.projectiles) if (st.runTick >= pj.activeAt) put(pj.x, pj.y, pj.radius / 1000, colors.danger);
    for (const pool of st.pools) put(pool.x, pool.y, pool.radius / 1000, colors.warn);
    for (const o of st.orbs) put(o.x, o.y, 0.18 + Math.min(0.3, o.value * 0.01), colors.safe);
    this.#markers.count = n;
    this.#markers.instanceMatrix.needsUpdate = true;
    if (this.#markers.instanceColor) this.#markers.instanceColor.needsUpdate = true;
    (this.#markers.material as THREE.MeshBasicMaterial).opacity = Math.max(0.5, this.settings.effectOpacity);
    if (this.#overlay) {
      const width = Math.max(1, this.renderer.domElement.clientWidth);
      const height = Math.max(1, this.renderer.domElement.clientHeight);
      const point = new THREE.Vector3();
      const project = (cue: DamageCue) => {
        const x = cue.xMm / 1000;
        const y = cue.yMm / 1000;
        point.set(x, this.world.heightAt(x, y) + 1.25 * cue.visualScale, -y).project(this.camera);
        return {
          x: (point.x * 0.5 + 0.5) * width,
          y: (-point.y * 0.5 + 0.5) * height,
          visible: point.z >= -1 && point.z <= 1 && Math.abs(point.x) <= 1.1 && Math.abs(point.y) <= 1.1,
        };
      };
      this.#overlay.syncDamage(this.#presentation.damage, presentMs, this.settings.damageNumbers, project);
      this.#overlay.setFlash(this.#presentation.flash(presentMs, this.settings.flash, this.settings.effectOpacity));
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.#presentation.clearTransient();
    this.#overlay?.dispose();
    this.world.dispose();
    delete this.renderer.domElement.dataset.roSkillFxSource;
    delete this.renderer.domElement.dataset.roSkillFxActive;
    this.renderer.dispose();
  }
}
