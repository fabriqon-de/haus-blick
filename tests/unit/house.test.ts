import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { parseConfig } from "../../src/config";
import { previewImport, applyImport } from "../../src/import";
import { houseScene } from "../../src/house";
const polygon = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 2 },
  { x: 2, z: 2 },
  { x: 2, z: 4 },
  { x: 0, z: 4 },
];
const plan = () => ({
  schemaVersion: 1,
  name: "L-Haus",
  unit: "m",
  rooms: [{ id: "living", name: "Wohnen", polygon }],
  walls: [
    {
      id: "south",
      start: { x: 0, z: 0 },
      end: { x: 4, z: 0 },
      height: 2.7,
      thickness: 0.15,
    },
  ],
});
const options = { unit: "m", rotation: 0, scale: 1 } as const;
function dispose(o: THREE.Object3D) {
  o.traverse((n) => {
    if (n instanceof THREE.Mesh) {
      n.geometry.dispose();
      for (const m of Array.isArray(n.material) ? n.material : [n.material])
        m.dispose();
    }
  });
}
describe("local drawing import and backward compatibility", () => {
  it("preserves concave polygons and rejects sensors in the empty bounding-box corner", () => {
    const preview = previewImport(JSON.stringify(plan()), "json", options);
    expect(preview.rooms[0].polygon).toEqual(polygon);
    expect(preview.width).toBe(4);
    const config = applyImport(
      parseConfig({
        type: "custom:haus-blick-card",
        rooms: [{ id: "living", name: "Alt", x: 0, z: 0, width: 4, depth: 4 }],
        entities: [{ entity: "sensor.test", room: "living", x: 1, z: 1 }],
      }),
      preview,
    );
    expect(config.entities[0].entity).toBe("sensor.test");
    expect(() =>
      parseConfig({
        ...config,
        entities: [{ ...config.entities[0], x: 3, z: 3 }],
      }),
    ).toThrow(/Raumkontur/);
  });
  it("blocks reimport rather than discarding bindings or invalid openings", () => {
    const config = parseConfig({
      type: "custom:haus-blick-card",
      entities: [{ entity: "sensor.test", room: "wohnen" }],
    });
    expect(() =>
      applyImport(
        config,
        previewImport(JSON.stringify(plan()), "json", options),
      ),
    ).toThrow(/existiert nicht/);
    expect(config.entities).toHaveLength(1);
  });
  it("converts prepared DXF millimetres and applies orientation once", () => {
    const pairs = [
      "0",
      "SECTION",
      "2",
      "ENTITIES",
      "0",
      "LWPOLYLINE",
      "8",
      "ROOM:Test",
      "90",
      "4",
      "70",
      "1",
      "10",
      "0",
      "20",
      "0",
      "10",
      "4000",
      "20",
      "0",
      "10",
      "4000",
      "20",
      "3000",
      "10",
      "0",
      "20",
      "3000",
      "0",
      "ENDSEC",
      "0",
      "EOF",
    ];
    const preview = previewImport(pairs.join("\n"), "dxf", {
      unit: "mm",
      rotation: 90,
      scale: 1,
    });
    expect(preview.width).toBeCloseTo(3);
    expect(preview.depth).toBeCloseTo(4);
    expect(() =>
      previewImport(pairs.join("\n"), "dxf", { ...options, scale: Infinity }),
    ).toThrow(/Importparameter/);
  });
  it("rejects oversized, self-intersecting or excessively tall imports", () => {
    expect(() => previewImport(" ".repeat(2_000_001), "json", options)).toThrow(
      /2 MB/,
    );
    const crossing = plan();
    crossing.rooms[0].polygon = [
      { x: 0, z: 0 },
      { x: 4, z: 4 },
      { x: 0, z: 4 },
      { x: 4, z: 0 },
    ];
    expect(() =>
      previewImport(JSON.stringify(crossing), "json", options),
    ).toThrow();
    const tall = plan();
    tall.walls[0].height = 50;
    expect(() => previewImport(JSON.stringify(tall), "json", options)).toThrow(
      /wall.height/,
    );
  });
});
describe("owned building and garden geometry", () => {
  const config = () =>
    parseConfig({
      type: "custom:haus-blick-card",
      rooms: [
        { id: "living", name: "Wohnen", x: 0, z: 0, width: 4, depth: 4 },
        {
          id: "upstairs",
          name: "OG",
          x: 0,
          z: 0,
          width: 4,
          depth: 4,
          elevation: 3,
        },
        {
          id: "garden",
          name: "Garten",
          kind: "garden",
          x: 4,
          z: 0,
          width: 4,
          depth: 4,
        },
      ],
      building: {
        roof: "gable",
        openings: [{ wall: "wall-0", offset: 1, width: 1, height: 2, sill: 0 }],
      },
      plants: [{ id: "apple", kind: "tree", x: 6, z: 2, size: 1 }],
      entities: [
        { entity: "sensor.outside", room: "garden", x: 2, z: 2 },
        { entity: "sensor.upstairs", room: "upstairs", x: 1, z: 1 },
      ],
    });
  it("keeps marker identifiers stable when a floor filters assets", () => {
    const c = config(),
      { model } = houseScene(c, "inside", 3);
    expect(
      model.assets.filter((a) => a.id.startsWith("entity-")).map((a) => a.id),
    ).toEqual(["entity-1"]);
    expect(model.assets.find((a) => a.id === "entity-1")?.position.y).toBe(
      3.18,
    );
  });
  it("provides roofs only outside and never over the garden", () => {
    const c = config();
    const outside = houseScene(c, "outside", null),
      inside = houseScene(c, "inside", null);
    expect(outside.factories.has("roof-living")).toBe(true);
    expect(outside.factories.has("roof-garden")).toBe(false);
    expect(inside.factories.has("roof-living")).toBe(false);
    const roof = outside.factories.get("roof-living")!();
    const mesh = roof.children[0] as THREE.Mesh;
    const vertices = mesh.geometry.attributes.position;
    expect(
      Math.max(
        ...Array.from({ length: vertices.count }, (_, i) => vertices.getZ(i)),
      ),
    ).toBeCloseTo(1.2);
    dispose(roof);
  });
  it("cuts a real door gap and shortens walls in the interior and plan views", () => {
    const c = config(),
      outside = houseScene(c, "outside", null),
      wall = outside.factories.get("structure-wall-0")!();
    const pieces = wall.children as THREE.Mesh<THREE.BoxGeometry>[];
    expect(
      pieces.some(
        (m) => Math.abs(m.position.x - 1.5) < 0.01 && m.position.y < 2,
      ),
    ).toBe(false);
    expect(
      pieces.some(
        (m) => Math.abs(m.position.x - 1.5) < 0.01 && m.position.y > 2,
      ),
    ).toBe(true);
    dispose(wall);
    for (const view of ["inside", "plan"] as const) {
      const obj = houseScene(c, view, null).factories.get(
        "structure-wall-0",
      )!();
      expect(
        Math.max(
          ...obj.children.map(
            (o) =>
              (o as THREE.Mesh<THREE.BoxGeometry>).geometry.parameters.height,
          ),
        ),
      ).toBeLessThanOrEqual(view === "inside" ? 0.7 : 0.06);
      dispose(obj);
    }
  });
  it("validates openings, floor elevations and garden object limits before rendering", () => {
    const c = config();
    expect(() =>
      parseConfig({
        ...c,
        building: {
          ...c.building,
          openings: [
            { wall: "absent", offset: 0, width: 1, height: 2, sill: 0 },
          ],
        },
      }),
    ).toThrow(/Öffnung/);
    expect(() =>
      parseConfig({
        ...c,
        building: {
          ...c.building,
          openings: [
            { wall: "wall-0", offset: 0, width: 1, height: 2, sill: 0 },
            { wall: "wall-0", offset: 0.5, width: 1, height: 2, sill: 0 },
          ],
        },
      }),
    ).toThrow(/überlappen/);
    expect(() =>
      parseConfig({
        ...c,
        plants: Array.from({ length: 101 }, (_, i) => ({
          ...c.plants![0],
          id: String(i),
        })),
      }),
    ).toThrow(/100/);
    expect(() =>
      parseConfig({ ...c, rooms: [{ ...c.rooms[0], elevation: -1 }] }),
    ).toThrow();
  });
});

it("ships valid import and garden examples", async () => {
  const { readFileSync } = await import("node:fs");
  const garden = parseConfig(
    JSON.parse(readFileSync("examples/house-garden.json", "utf8")),
  );
  expect(
    houseScene(garden, "outside", null).model.assets.length,
  ).toBeGreaterThan(garden.entities.length);
  expect(
    previewImport(
      readFileSync("examples/floor-plan.json", "utf8"),
      "json",
      options,
    ).plan.walls,
  ).toHaveLength(6);
});
