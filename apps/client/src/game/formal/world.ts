/**
 * Formal world: only original RO data from the derived scene contract. Ground = GND surfaces with
 * their texture UVs, vertex colour and embedded lightmap; props = GRSM models instanced at every RSW
 * placement; water = the 32 official frames. No checker, solid fill, generated texture or fallback.
 */
import * as THREE from "three";
import type { GroundData } from "../renderer.ts";
import { gatHeightAt, type WorldLayer } from "../terrain.ts";
import { waterFrameAt } from "./contract.ts";
import type { FormalSceneData, ImageLike } from "./load.ts";

export type TextureFactory = (image: ImageLike, opts: { repeat?: boolean }) => THREE.Texture;

/** Nearest-filtered texture for original RO pixels (no smoothing, no mipmaps). */
export const nearestTexture: TextureFactory = (image, opts) => {
  const tex = new THREE.Texture(image as unknown as HTMLImageElement);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
};

const GROUND_VERT = /* glsl */ `
attribute vec2 uvLightmap;
attribute vec3 color;
varying vec2 vUv;
varying vec2 vLm;
varying vec3 vColor;
void main() {
  vUv = uv;
  vLm = uvLightmap;
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// RO ground: texture × surface colour × lightmap brightness + lightmap colour.
const GROUND_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uLightmap;
varying vec2 vUv;
varying vec2 vLm;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  vec4 lm = texture2D(uLightmap, vLm);
  gl_FragColor = vec4(t.rgb * vColor * lm.a + lm.rgb, 1.0);
  #include <colorspace_fragment>
}`;

export class FormalWorld implements WorldLayer {
  readonly kind = "formal" as const;
  readonly object = new THREE.Group();
  readonly heightAt: (xm: number, ym: number) => number;
  readonly groundMeshes: THREE.Mesh[] = [];
  readonly propMeshes: THREE.InstancedMesh[] = [];
  readonly water: THREE.Mesh | null = null;
  readonly #waterFrames = new Map<string, THREE.Texture>();
  readonly #data: FormalSceneData;
  #waterFrame = "";

  constructor(data: FormalSceneData, gat: GroundData, makeTexture: TextureFactory) {
    this.#data = data;
    this.heightAt = gatHeightAt(gat);
    const tex = new Map<string, THREE.Texture>();
    const textureOf = (id: string): THREE.Texture => {
      let t = tex.get(id);
      if (!t) {
        const img = data.images.get(id);
        if (!img) throw new Error(`formal texture ${id} not loaded`);
        t = makeTexture(img, { repeat: true });
        tex.set(id, t);
      }
      return t;
    };
    const lightmapImg = data.images.get(data.scene.ground);
    if (!lightmapImg) throw new Error("GND lightmap atlas not loaded");
    const lightmap = makeTexture(lightmapImg, {});

    for (const g of data.ground.groups) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(g.positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uvs, 2));
      geo.setAttribute("uvLightmap", new THREE.Float32BufferAttribute(g.lightmapUvs, 2));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(g.colors, 3));
      const mat = new THREE.ShaderMaterial({ vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, uniforms: { uMap: { value: textureOf(g.assetId) }, uLightmap: { value: lightmap } }, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { formal: "gnd", textureAssetId: g.assetId };
      this.groundMeshes.push(mesh);
      this.object.add(mesh);
    }

    // Props: one InstancedMesh per (model, texture); instance matrix = RSW placement.
    const byModel = new Map<string, typeof data.instances>();
    for (const inst of data.instances) byModel.set(inst.modelAssetId, [...(byModel.get(inst.modelAssetId) ?? []), inst]);
    const deg = Math.PI / 180;
    for (const [modelId, list] of byModel) {
      const baked = data.baked.get(modelId);
      if (!baked) throw new Error(`model ${modelId} not baked`);
      const alpha = (data.models.get(modelId)?.alpha ?? 255) / 255;
      for (const g of baked.groups) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(g.positions, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uvs, 2));
        const mat = new THREE.MeshBasicMaterial({ map: textureOf(g.assetId), alphaTest: 0.5, side: THREE.DoubleSide, transparent: alpha < 1, opacity: alpha });
        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((inst, i) => {
          const m = new THREE.Matrix4().compose(
            new THREE.Vector3(inst.world.x, inst.world.height, -inst.world.y),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-inst.rotationDeg[0] * deg, -inst.rotationDeg[1] * deg, inst.rotationDeg[2] * deg, "ZXY")),
            new THREE.Vector3(...inst.scale),
          );
          mesh.setMatrixAt(i, m);
        });
        mesh.userData = { formal: "rsm", modelAssetId: modelId, textureAssetId: g.assetId };
        mesh.frustumCulled = false;
        this.propMeshes.push(mesh);
        this.object.add(mesh);
      }
    }

    // Water: official frames only, on the selected GND cells only (never over land).
    const w = data.scene.water;
    if (w && w.frames.length > 0) {
      const cells = data.waterCells;
      if (!cells || cells.cells !== w.cells) throw new Error(`water cells ${cells?.cells ?? "missing"} != derived ${w.cells}`);
      for (const id of w.frames) {
        const img = data.water.get(id);
        if (!img) throw new Error(`water frame ${id} not loaded`);
        this.#waterFrames.set(id, makeTexture(img, { repeat: true }));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(cells.positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(cells.uvs, 2));
      const first = this.#waterFrames.get(w.frames[0] as string) as THREE.Texture;
      // Opacity is calibrated against the local client (DEFERRED_LOCAL); no wave motion is applied.
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: first, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
      mesh.renderOrder = 1;
      mesh.userData = { formal: "water", frames: w.frames.length, cells: cells.cells };
      (this as { water: THREE.Mesh | null }).water = mesh;
      this.#waterFrame = w.frames[0] as string;
      this.object.add(mesh);
    }
  }

  /** Current official water frame (asset ID). */
  get waterFrame(): string {
    return this.#waterFrame;
  }

  update(timeMs: number): void {
    const w = this.#data.scene.water;
    if (!w || !this.water) return;
    const id = waterFrameAt(w, timeMs);
    if (id === this.#waterFrame) return;
    (this.water.material as THREE.MeshBasicMaterial).map = this.#waterFrames.get(id) as THREE.Texture;
    this.#waterFrame = id;
  }

  setDebugOverlay(): void {
    // The formal world has no debug surface (developer overlays live in test-fixture builds only).
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

const SHADOW_VERT = /* glsl */ `
uniform vec4 uRect;
varying vec2 vUv;
void main() {
  vUv = vec2(uRect.x + uv.x * uRect.z, uRect.y + (1.0 - uv.y) * uRect.w);
  gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const SHADOW_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMap, vUv);
  if (c.a < 0.01) discard;
  gl_FragColor = vec4(c.rgb, c.a * uAlpha);
  #include <colorspace_fragment>
}`;

/**
 * Official RO shadow (data\\sprite\\shadow.spr/.act) under every actor, lying on the ground at scale 1.0
 * with the ACT layer alpha (128 → 0.502). Never an ellipse, CSS or procedural shape.
 */
export class OfficialShadowLayer {
  readonly mesh: THREE.InstancedMesh;
  readonly alpha: number;
  readonly scale: number;
  readonly #offset: { x: number; z: number };

  constructor(data: FormalSceneData, makeTexture: TextureFactory, capacity: number, pxToWorld = 0.025) {
    const sp = data.shadowParams;
    const img = data.images.get(`${data.scene.shadow}.spr`);
    if (!img) throw new Error("official shadow atlas not loaded");
    this.alpha = sp.alpha;
    this.scale = sp.scale;
    const geo = new THREE.PlaneGeometry(sp.rect.w * pxToWorld * sp.scale, sp.rect.h * pxToWorld * sp.scale).rotateX(-Math.PI / 2);
    const atlas = data.shadow.atlas;
    const mat = new THREE.ShaderMaterial({
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      uniforms: {
        uMap: { value: makeTexture(img, {}) },
        uAlpha: { value: sp.alpha },
        uRect: { value: new THREE.Vector4(sp.rect.x / atlas.width, sp.rect.y / atlas.height, sp.rect.w / atlas.width, sp.rect.h / atlas.height) },
      },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.#offset = { x: sp.offsetX * pxToWorld, z: sp.offsetY * pxToWorld };
  }

  /** `actors`: flat [x, height, z, …] world positions of actor feet. */
  set(actors: readonly number[]): void {
    const n = Math.min(this.mesh.instanceMatrix.count, Math.floor(actors.length / 3));
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i += 1) {
      m.makeTranslation((actors[i * 3] as number) + this.#offset.x, (actors[i * 3 + 1] as number) + 0.02, (actors[i * 3 + 2] as number) + this.#offset.z);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
