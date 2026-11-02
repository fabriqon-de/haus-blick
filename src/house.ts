import * as THREE from "three";
import type { SceneAsset, SceneModel } from "@fabriqon/sdk";
import { houseWalls, roomPolygon, sceneModel } from "./config";
import type { CardConfig } from "./types";
export type HouseView = "inside" | "outside" | "plan";
export interface Decoration {
  id: string;
  object: THREE.Object3D;
}
function material(
  color: number,
  extra: THREE.MeshStandardMaterialParameters = {},
) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
}
function box(
  x: number,
  y: number,
  z: number,
  color: number,
  px = 0,
  py = 0,
  pz = 0,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material(color));
  m.position.set(px, py, pz);
  return m;
}
function floorShape(polygon: Array<{ x: number; z: number }>, color: number) {
  const shape = new THREE.Shape(
    polygon.map((p) => new THREE.Vector2(p.x, -p.z)),
  );
  const mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> =
    new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      material(color, { side: THREE.DoubleSide }),
    );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
/** Each decoration is an SDK asset: the viewer owns replacement and GPU disposal. */
export function houseScene(
  config: CardConfig,
  view: HouseView,
  floor: number | null,
) {
  const base = sceneModel(config),
    factories = new Map<string, () => THREE.Object3D>();
  const assets: SceneAsset[] = base.assets.filter(
    (_, i) =>
      floor === null ||
      (config.rooms.find((r) => r.id === config.entities[i].room)?.elevation ??
        0) === floor,
  );
  function add(
    id: string,
    x: number,
    y: number,
    z: number,
    build: () => THREE.Object3D,
  ) {
    assets.push({
      id,
      name: id,
      shape: "box",
      position: { x, y: y - 0.005, z },
      size: { x: 0.01, y: 0.01, z: 0.01 },
    });
    factories.set(id, build);
  }
  for (const r of config.rooms) {
    const elevation = r.elevation ?? 0;
    if (floor !== null && floor !== elevation) continue;
    add(`floor-${r.id}`, 0, elevation, 0, () =>
      floorShape(
        roomPolygon(r),
        r.kind === "garden"
          ? 0x78a65a
          : r.kind === "terrace"
            ? 0xb3997b
            : 0xd4dfdd,
      ),
    );
    if (
      view === "outside" &&
      (!r.kind || r.kind === "interior") &&
      config.building?.roof !== "none"
    ) {
      // Roofs follow each exact room contour; no rectangular enclosure over concave rooms.
      const wallTop =
        elevation +
        Math.max(
          config.building?.wall_height ?? 2.7,
          ...houseWalls(config)
            .filter((w) => w.elevation === elevation)
            .map((w) => w.height),
        );
      const gable = config.building?.roof === "gable";
      add(`roof-${r.id}`, 0, wallTop + 0.03, 0, () => {
        const roof = floorShape(roomPolygon(r), 0x596673);
        if (gable) {
          const source = roof.geometry,
            positions = source.attributes.position,
            index = source.index,
            vertices: number[] = [];
          const middle = r.x + r.width / 2;
          const count = index ? index.count : positions.count;
          for (let i = 0; i < count; i += 3) {
            const triangle = [0, 1, 2].map((j) => {
              const at = index ? index.getX(i + j) : i + j;
              return { x: positions.getX(at), z: positions.getY(at) };
            });
            for (const side of [-1, 1]) {
              const clipped: Array<{ x: number; z: number }> = [];
              for (let j = 0; j < 3; j++) {
                const a = triangle[j],
                  b = triangle[(j + 1) % 3],
                  inA = (a.x - middle) * side >= -1e-8,
                  inB = (b.x - middle) * side >= -1e-8;
                if (inA) clipped.push(a);
                if (inA !== inB) {
                  const t = (middle - a.x) / (b.x - a.x);
                  clipped.push({ x: middle, z: a.z + t * (b.z - a.z) });
                }
              }
              for (let j = 1; j < clipped.length - 1; j++)
                for (const p of [clipped[0], clipped[j], clipped[j + 1]])
                  vertices.push(
                    p.x,
                    p.z,
                    (config.building?.roof_height ?? 1.2) *
                      Math.max(0, 1 - Math.abs(p.x - middle) / (r.width / 2)),
                  );
            }
          }
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3),
          );
          geometry.computeVertexNormals();
          roof.geometry = geometry;
          source.dispose();
        }
        const group = new THREE.Group();
        group.add(roof);
        if (gable) {
          const vertices: number[] = [];
          const polygon = roomPolygon(r),
            middle = r.x + r.width / 2;
          const rise = (x: number) =>
            (config.building?.roof_height ?? 1.2) *
            Math.max(0, 1 - Math.abs(x - middle) / (r.width / 2));
          polygon.forEach((a, i) => {
            const b = polygon[(i + 1) % polygon.length],
              points = [a];
            if ((a.x - middle) * (b.x - middle) < 0) {
              const t = (middle - a.x) / (b.x - a.x);
              points.push({ x: middle, z: a.z + t * (b.z - a.z) });
            }
            points.push(b);
            for (let j = 0; j < points.length - 1; j++) {
              const p = points[j],
                q = points[j + 1];
              vertices.push(
                p.x,
                0,
                p.z,
                q.x,
                0,
                q.z,
                p.x,
                rise(p.x),
                p.z,
                p.x,
                rise(p.x),
                p.z,
                q.x,
                0,
                q.z,
                q.x,
                rise(q.x),
                q.z,
              );
            }
          });
          const g = new THREE.BufferGeometry();
          g.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3),
          );
          g.computeVertexNormals();
          group.add(
            new THREE.Mesh(g, material(0xe7e5df, { side: THREE.DoubleSide })),
          );
        }
        return group;
      });
    }
  }
  for (const wall of houseWalls(config)) {
    if (floor !== null && floor !== wall.elevation) continue;
    const length = Math.hypot(
        wall.end.x - wall.start.x,
        wall.end.z - wall.start.z,
      ),
      height =
        view === "outside"
          ? wall.height
          : view === "inside"
            ? Math.min(0.7, wall.height)
            : 0.06;
    const openings = (config.building?.openings ?? [])
      .filter((o) => o.wall === wall.id)
      .sort((a, b) => a.offset - b.offset);
    add(
      `structure-${wall.id}`,
      wall.start.x,
      wall.elevation,
      wall.start.z,
      () => {
        const group = new THREE.Group();
        group.rotation.y = -Math.atan2(
          wall.end.z - wall.start.z,
          wall.end.x - wall.start.x,
        );
        function section(
          start: number,
          width: number,
          bottom: number,
          top: number,
        ) {
          if (width > 1e-5 && top - bottom > 1e-5)
            group.add(
              box(
                width,
                top - bottom,
                wall.thickness,
                0xe7e5df,
                start + width / 2,
                (top + bottom) / 2,
              ),
            );
        }
        let cursor = 0;
        for (const o of openings) {
          section(cursor, o.offset - cursor, 0, height);
          section(o.offset, o.width, 0, Math.min(o.sill, height));
          section(
            o.offset,
            o.width,
            Math.min(o.sill + o.height, height),
            height,
          );
          if (view === "outside" && o.sill > 0) {
            const glass = box(
              o.width,
              o.height,
              0.025,
              0x8bc6de,
              o.offset + o.width / 2,
              o.sill + o.height / 2,
            );
            (glass.material as THREE.MeshStandardMaterial).transparent = true;
            (glass.material as THREE.MeshStandardMaterial).opacity = 0.4;
            group.add(glass);
          }
          cursor = o.offset + o.width;
        }
        section(cursor, length - cursor, 0, height);
        return group;
      },
    );
  }
  for (const p of config.plants ?? []) {
    if (floor !== null && floor !== p.elevation) continue;
    add(`plant-${p.id}`, p.x, p.elevation, p.z, () => {
      const g = new THREE.Group(),
        s = p.size;
      if (p.kind === "bed") {
        g.add(box(s, 0.12, s * 0.65, 0x73543a, 0, 0.06));
        for (const x of [-0.28, 0, 0.28])
          g.add(box(s * 0.12, s * 0.25, s * 0.35, 0x60904c, x * s, s * 0.18));
      } else {
        if (p.kind === "tree") {
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08 * s, 0.12 * s, s, 8),
            material(0x866044),
          );
          trunk.position.y = s / 2;
          g.add(trunk);
        }
        if (p.kind === "pot") {
          const pot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25 * s, 0.18 * s, 0.4 * s, 10),
            material(0xb77655),
          );
          pot.position.y = 0.2 * s;
          g.add(pot);
        }
        const crown = new THREE.Mesh(
          new THREE.IcosahedronGeometry(
            (p.kind === "tree" ? 0.65 : 0.4) * s,
            1,
          ),
          material(0x56894c),
        );
        crown.position.y =
          (p.kind === "tree" ? 1.25 : p.kind === "pot" ? 0.65 : 0.4) * s;
        g.add(crown);
      }
      return g;
    });
  }
  const model: SceneModel = {
    schemaVersion: 1,
    name: base.name,
    assets,
    connections: [],
  };
  return { model, factories };
}
