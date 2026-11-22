import * as THREE from "three";
import type { Str } from "@ro-survivor/ro-format-runtime/str";
import { sampleStrLayer, strKeyIndex } from "./strPlayer.ts";

/** STR screen pixels to world metres (one walk cell ≈ 35 px at the default RO camera). */
export const STR_PX_M = 1 / 35;
const STR_CENTRE = 320;

const STR_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  vUv = uv;
}`;

const STR_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec4 uColor;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uMap, vUv) * uColor;
  if (c.a < 0.004) discard;
  gl_FragColor = c;
  #include <colorspace_fragment>
}`;

/** D3DBLEND (1..11) → three.js blend factor; unknown values fall back to the RO default pair. */
export function d3dBlendFactor(value: number, fallback: THREE.BlendingSrcFactor): THREE.BlendingSrcFactor {
  switch (value) {
    case 1: return THREE.ZeroFactor;
    case 2: return THREE.OneFactor;
    case 3: return THREE.SrcColorFactor;
    case 4: return THREE.OneMinusSrcColorFactor;
    case 5: return THREE.SrcAlphaFactor;
    case 6: return THREE.OneMinusSrcAlphaFactor;
    case 7: return THREE.DstAlphaFactor;
    case 8: return THREE.OneMinusDstAlphaFactor;
    case 9: return THREE.DstColorFactor;
    case 10: return THREE.OneMinusDstColorFactor;
    case 11: return THREE.SrcAlphaSaturateFactor;
    default: return fallback;
  }
}

interface LayerMesh {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  position: THREE.BufferAttribute;
  uv: THREE.BufferAttribute;
}

/**
 * Bounded STR player: `slots × layers` pre-built quads with long-lived materials; textures are the
 * verified effect textures resolved by the loader. Nothing is allocated per cast.
 */
export class StrEffectPlayer {
  readonly object = new THREE.Group();
  readonly str: Str;
  readonly slots: number;
  readonly #layers: LayerMesh[][] = [];
  readonly #textures: readonly (readonly THREE.Texture[])[];
  readonly #right = new THREE.Vector3();
  readonly #up = new THREE.Vector3();
  #visible = 0;

  constructor(str: Str, layerTextures: readonly (readonly THREE.Texture[])[], slots: number, sourceAssetId: string) {
    if (layerTextures.length !== str.layers.length) throw new Error(`${sourceAssetId}: ${layerTextures.length} layer texture sets != ${str.layers.length} STR layers`);
    this.str = str;
    this.slots = slots;
    this.#textures = layerTextures;
    try {
      for (let s = 0; s < slots; s += 1) {
        const row: LayerMesh[] = [];
        this.#layers.push(row);
        for (let l = 0; l < str.layers.length; l += 1) {
          const geometry = new THREE.BufferGeometry();
          const position = new THREE.BufferAttribute(new Float32Array(12), 3).setUsage(THREE.DynamicDrawUsage);
          const uv = new THREE.BufferAttribute(new Float32Array(8), 2).setUsage(THREE.DynamicDrawUsage);
          geometry.setAttribute("position", position);
          geometry.setAttribute("uv", uv);
          geometry.setIndex([0, 1, 2, 2, 1, 3]);
          const material = new THREE.ShaderMaterial({
            vertexShader: STR_VERT,
            fragmentShader: STR_FRAG,
            uniforms: { uMap: { value: layerTextures[l]?.[0] ?? null }, uColor: { value: new THREE.Vector4(1, 1, 1, 1) } },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneFactor,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.visible = false;
          mesh.frustumCulled = false;
          mesh.renderOrder = 7;
          mesh.userData = { formal: "skill-effect", sourceAssetId, strLayer: l };
          row.push({ mesh, geometry, material, position, uv });
          this.object.add(mesh);
        }
      }
    } catch (err) {
      this.dispose();
      throw err;
    }
  }

  /** Number of STR layer quads drawn in the last frame. */
  get visibleLayerCount(): number {
    return this.#visible;
  }

  /** Draw slot `slot` at the given world centre, `elapsedMs` into the animation. Returns drawn quads. */
  draw(slot: number, elapsedMs: number, centre: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, opacity: number): number {
    const row = this.#layers[slot];
    if (!row) return 0;
    const key = strKeyIndex(this.str, elapsedMs);
    let drawn = 0;
    this.str.layers.forEach((layer, l) => {
      const lm = row[l] as LayerMesh;
      const sample = key < this.str.maxKey ? sampleStrLayer(layer, key) : null;
      if (!sample?.visible) {
        lm.mesh.visible = false;
        return;
      }
      const rad = (sample.angleDeg * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      for (let i = 0; i < 4; i += 1) {
        const px = sample.pos[0] - STR_CENTRE + (sample.xy[i] ?? 0);
        const py = -(sample.pos[1] - STR_CENTRE + (sample.xy[i + 4] ?? 0));
        const rx = (px * c - py * s) * STR_PX_M;
        const ry = (px * s + py * c) * STR_PX_M;
        this.#right.copy(right).multiplyScalar(rx);
        this.#up.copy(up).multiplyScalar(ry);
        lm.position.setXYZ(i, centre.x + this.#right.x + this.#up.x, centre.y + this.#right.y + this.#up.y, centre.z + this.#right.z + this.#up.z);
        lm.uv.setXY(i, sample.uv[i * 2] ?? 0, 1 - (sample.uv[i * 2 + 1] ?? 0));
      }
      lm.position.needsUpdate = true;
      lm.uv.needsUpdate = true;
      (lm.material.uniforms.uMap as { value: THREE.Texture | null }).value = this.#textures[l]?.[sample.textureIndex] ?? null;
      (lm.material.uniforms.uColor as { value: THREE.Vector4 }).value.set(sample.color[0], sample.color[1], sample.color[2], sample.color[3] * opacity);
      lm.material.blendSrc = d3dBlendFactor(sample.srcBlend, THREE.SrcAlphaFactor);
      lm.material.blendDst = d3dBlendFactor(sample.dstBlend, THREE.OneFactor) as THREE.BlendingDstFactor;
      lm.mesh.visible = true;
      drawn += 1;
    });
    return drawn;
  }

  hideSlot(slot: number): void {
    for (const lm of this.#layers[slot] ?? []) lm.mesh.visible = false;
  }

  setVisibleCount(n: number): void {
    this.#visible = n;
  }

  dispose(): void {
    for (const row of this.#layers) for (const lm of row) {
      this.object.remove(lm.mesh);
      lm.geometry.dispose();
      lm.material.dispose();
    }
    this.#layers.splice(0);
    this.#visible = 0;
  }
}
