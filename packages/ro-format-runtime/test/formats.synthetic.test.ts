import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encodeCp949, bytesToHex } from "@ro-survivor/asset-contracts";
import {
  createTempDir, syntheticBytes, syntheticPalette, writeAct, writeGat, writeGnd, writeGrf, writeRsw, writeSpr,
} from "@ro-survivor/testkit";
import {
  type ActLayer,
  actionIndex, composeFrame, floodReachable, frameToRgba, mapDependencies, parseAct, parseGat, parseGnd, parsePalette, parseRsw, parseSpr, summarizeAct,
} from "../src/index.ts";
import { openGrf } from "../src/grf.ts";

const dirs: { dispose(): void }[] = [];
afterEach(() => {
  while (dirs.length) dirs.pop()?.dispose();
});

function indexedFrame(w: number, h: number, seed: number) {
  const indices = syntheticBytes(seed, w * h).map((b) => (b % 5 === 0 ? 0 : b));
  return { width: w, height: h, indices };
}

describe("SPR (synthetic)", () => {
  it("round-trips 2.1 RLE indexed frames, RGBA frames and the palette", () => {
    const pal = syntheticPalette(3);
    const frames = [indexedFrame(7, 5, 1), indexedFrame(16, 9, 2), indexedFrame(1, 1, 3)];
    const rgba = { width: 3, height: 2, rgba: Uint8Array.from(syntheticBytes(4, 24)) };
    const spr = parseSpr(writeSpr({ indexed: frames, rgba: [rgba], palette: pal }));
    expect(spr.version).toBe("2.1");
    expect(spr.indexed.map((f) => [f.width, f.height])).toEqual([[7, 5], [16, 9], [1, 1]]);
    spr.indexed.forEach((f, i) => expect([...f.indices]).toEqual([...(frames[i]?.indices ?? [])]));
    expect([...(spr.rgba[0]?.rgba ?? [])]).toEqual([...rgba.rgba]);
    expect(spr.palette?.[3]).toBe(0);
    expect(spr.palette?.[7]).toBe(255);
    const px = frameToRgba(spr.indexed[1] as never, spr.palette);
    expect(px.length).toBe(16 * 9 * 4);
  });

  it("parses 2.0 (no RLE) and rejects truncation and bad magic", () => {
    const pal = syntheticPalette();
    const bytes = writeSpr({ indexed: [indexedFrame(4, 4, 9)], palette: pal, version: "2.0" });
    expect(parseSpr(bytes).version).toBe("2.0");
    expect(() => parseSpr(bytes.subarray(0, 20))).toThrow(/SPR/u);
    const bad = bytes.slice();
    bad[0] = 0x58;
    expect(() => parseSpr(bad)).toThrow(/bad magic/u);
  });

  it("palette must be 1024 bytes", () => {
    expect(() => parsePalette(new Uint8Array(10))).toThrow(/1024/u);
  });
});

function monsterAct(version: "2.4" | "2.5" | "2.3" | "2.0") {
  const actions = Array.from({ length: 40 }, (_, a) => ({
    delay: 4 + (a % 3),
    frames: Array.from({ length: 1 + (a % 4) }, (_, f) => ({
      layers: [{ x: f, y: -20 - f, sprIndex: (a + f) % 2, mirror: a % 8 >= 5, scaleX: 1, scaleY: version === "2.4" || version === "2.5" ? 2 : 1, width: 7, height: 5 }],
      soundIndex: a === 16 && f === 0 ? 0 : -1,
      anchors: [{ x: 1, y: -2 }],
    })),
  }));
  return writeAct({ version, actions, sounds: ["poring_attack.wav"] });
}

describe("ACT (synthetic)", () => {
  for (const version of ["2.0", "2.3", "2.4", "2.5"] as const) {
    it(`round-trips version ${version}`, () => {
      const act = parseAct(monsterAct(version));
      expect(act.version).toBe(version);
      expect(act.actions).toHaveLength(40);
      const walkSouth = act.actions[actionIndex(1, 0)];
      expect(walkSouth?.frames).toHaveLength(1 + (8 % 4));
      const layer = act.actions[5]?.frames[0]?.layers[0];
      expect(layer?.mirror).toBe(true);
      expect(layer?.y).toBe(-20);
      if (version === "2.4" || version === "2.5") expect(layer?.scaleY).toBe(2);
      if (version === "2.5") expect(layer?.width).toBe(7);
      if (version === "2.3" || version === "2.4" || version === "2.5") expect(act.actions[0]?.frames[0]?.anchors).toEqual([{ x: 1, y: -2, attr: 0 }]);
      if (version === "2.0") {
        expect(act.sounds).toEqual([]);
        expect(act.actions[0]?.delay).toBe(4);
      } else {
        expect(act.sounds).toEqual(["poring_attack.wav"]);
        expect(act.actions[16]?.frames[0]?.soundIndex).toBe(0);
      }
      if (version !== "2.0") {
        const s = summarizeAct(act);
        expect(s.soundEvents).toEqual([{ action: 16, frame: 0, sound: "poring_attack.wav" }]);
        expect(s.delaysMs[1]).toBe(125);
      }
    });
  }

  it("rejects trailing bytes, truncation and unsupported versions", () => {
    const b = monsterAct("2.5");
    expect(() => parseAct(Uint8Array.from([...b, 0]))).toThrow(/trailing/u);
    expect(() => parseAct(b.subarray(0, b.length - 3))).toThrow(/unexpected end/u);
    const old = b.slice();
    old[3] = 1;
    expect(() => parseAct(old)).toThrow(/unsupported version/u);
  });
});

describe("compose (synthetic)", () => {
  it("composes multiple layer sets on one clock and mirrors without extra frames", () => {
    const pal = syntheticPalette(2);
    const body = parseSpr(writeSpr({ indexed: [indexedFrame(6, 10, 1)], palette: pal }));
    const act = parseAct(writeAct({ version: "2.5", actions: [{ frames: [{ layers: [{ x: 0, y: -5, sprIndex: 0 }] }] }, { frames: [{ layers: [{ x: 0, y: -5, sprIndex: 0, mirror: true }] }] }] }));
    const a = composeFrame([{ sprite: body, frame: act.actions[0]?.frames[0] as never }]);
    const m = composeFrame([{ sprite: body, frame: act.actions[1]?.frames[0] as never }]);
    expect([a.width, a.height]).toEqual([6, 10]);
    expect(a.originY).toBe(10);
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 6; x += 1) {
        const i = (y * 6 + x) * 4 + 3;
        const j = (y * 6 + (5 - x)) * 4 + 3;
        expect(m.rgba[i]).toBe(a.rgba[j]);
      }
    }
    expect(() => composeFrame([{ sprite: body, frame: { layers: [{ ...(act.actions[0]?.frames[0]?.layers[0] as ActLayer), sprIndex: 9 }], soundIndex: -1, anchors: [] } }])).toThrow(/missing/u);
  });
});

describe("GAT / GND / RSW (synthetic)", () => {
  it("GAT: parses cells and flood-fills only connected walkable cells", () => {
    const w = 8;
    const h = 6;
    const types = new Array<number>(w * h).fill(0);
    for (let y = 0; y < h; y += 1) types[y * w + 4] = 1; // wall column
    const gat = parseGat(writeGat(w, h, types, (x) => x * 0.5));
    expect([gat.width, gat.height, gat.version]).toEqual([8, 6, "1.2"]);
    expect(gat.heights[(1 * w + 2) * 4]).toBe(1);
    expect(floodReachable(gat, 0, 0).count).toBe(4 * 6);
    expect(floodReachable(gat, 4, 0).count).toBe(0);
  });

  it("GND: parses textures (CP949), surfaces and cubes", () => {
    const tex = [encodeCp949("유저인터페이스\\grass.bmp"), encodeCp949("prontera\\road.bmp")];
    const gnd = parseGnd(writeGnd(5, 4, tex, (x, y) => x + y));
    expect(gnd.version).toBe("1.7");
    expect(gnd.textures).toEqual(["유저인터페이스\\grass.bmp", "prontera\\road.bmp"]);
    expect(gnd.surfaces).toHaveLength(20);
    expect(gnd.cubes[1 * 5 + 2]?.heights[0]).toBe(2 + 1);
  });

  it("RSW 2.1: parses references, objects and the dependency closure", () => {
    const rsw = parseRsw(writeRsw({ gnd: "synthetic.gnd", gat: "synthetic.gat", models: [{ name: "tree", file: encodeCp949("내부소품\\나무01.rsm") }, { name: "tree2", file: encodeCp949("내부소품\\나무01.rsm") }] }));
    expect([rsw.version, rsw.gndFile, rsw.gatFile]).toEqual(["2.1", "synthetic.gnd", "synthetic.gat"]);
    expect(rsw.counts).toEqual({ models: 2, lights: 1, sounds: 1, effects: 1 });
    expect(mapDependencies(rsw, ["a.bmp", "a.bmp"])).toEqual({ gnd: "synthetic.gnd", gat: "synthetic.gat", textures: ["a.bmp"], models: ["내부소품\\나무01.rsm"], sounds: ["ambient.wav"] });
  });
});

describe("GRF 0x200 (synthetic archive)", () => {
  it("looks entries up by raw CP949 hex, inflates on demand and refuses encrypted entries", () => {
    const d = createTempDir("grf-");
    dirs.push(d);
    const n1 = encodeCp949("data\\sprite\\몬스터\\poring.spr");
    const n2 = encodeCp949("data\\prt_fild08.gat");
    const data1 = syntheticBytes(11, 5000);
    const p = join(d.root, "synthetic.grf");
    writeFileSync(p, writeGrf([{ rawName: n1, data: data1 }, { rawName: n2, data: syntheticBytes(12, 100) }, { rawName: encodeCp949("data\\secret.bin"), data: syntheticBytes(13, 10), flags: 3 }]));
    const grf = openGrf(p);
    try {
      expect(grf.fileCount).toBe(3);
      const e = grf.byRawHex.get(bytesToHex(n1));
      expect(e?.name).toBe("data\\sprite\\몬스터\\poring.spr");
      expect([...grf.read(e as never)]).toEqual([...data1]);
      const enc = grf.byRawHex.get(bytesToHex(encodeCp949("data\\secret.bin")));
      expect(() => grf.read(enc as never)).toThrow(/encrypted/u);
    } finally {
      grf.close();
    }
  });

  it("rejects non-GRF files and other versions", () => {
    const d = createTempDir("grf-");
    dirs.push(d);
    const p = join(d.root, "x.grf");
    writeFileSync(p, syntheticBytes(1, 100));
    expect(() => openGrf(p)).toThrow(/signature/u);
    const g = writeGrf([{ rawName: encodeCp949("a"), data: syntheticBytes(1, 4) }]);
    g[42] = 0x03;
    g[43] = 0x01;
    writeFileSync(p, g);
    expect(() => openGrf(p)).toThrow(/unsupported version/u);
  });
});
