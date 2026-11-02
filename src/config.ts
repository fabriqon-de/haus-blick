import {
  parseSceneModel,
  parseDrawingPlan,
  type SceneModel,
} from "@fabriqon/sdk";
import type { Binding, CardConfig, HomeAssistant, Room } from "./types";

const DEFAULT_ROOMS: Room[] = [
  { id: "wohnen", name: "Wohnen", x: 0, z: 0, width: 6, depth: 4 },
  { id: "kueche", name: "Küche", x: 6, z: 0, width: 3, depth: 4 },
];
function object(value: unknown, path: string): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new Error(`${path}: Objekt erwartet.`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], path: string) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      throw new Error(`${path}.${key}: Unbekannte Option.`);
}
function text(value: unknown, path: string, max = 120): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${path}: Text mit 1–${max} Zeichen erwartet.`);
  return value;
}
function num(value: unknown, path: string, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${path}: Zahl zwischen ${min} und ${max} erwartet.`);
  return value;
}
function id(value: unknown, path: string): string {
  const result = text(value, path, 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(result))
    throw new Error(`${path}: Ungültige ID.`);
  return result;
}
function unique(values: string[], path: string) {
  if (new Set(values).size !== values.length)
    throw new Error(`${path}: Doppelte ID.`);
}

export function parseConfig(input: unknown): CardConfig {
  const root = object(input, "Karte");
  keys(
    root,
    [
      "type",
      "title",
      "height",
      "rooms",
      "entities",
      "grid_options",
      "visibility",
      "view_layout",
      "drawing",
      "building",
      "plants",
    ],
    "Karte",
  );
  if (root.type !== "custom:haus-blick-card")
    throw new Error("type muss custom:haus-blick-card sein.");
  const rawRooms = root.rooms ?? DEFAULT_ROOMS;
  if (!Array.isArray(rawRooms) || !rawRooms.length || rawRooms.length > 50)
    throw new Error("rooms: 1–50 Räume erwartet.");
  const rooms: Room[] = rawRooms.map((input, i) => {
    const r = object(input, `rooms[${i}]`);
    keys(
      r,
      [
        "id",
        "name",
        "x",
        "z",
        "width",
        "depth",
        "polygon",
        "elevation",
        "kind",
      ],
      `rooms[${i}]`,
    );
    const extra: Partial<Room> = {};
    if (r.polygon !== undefined) {
      const polygon = parseDrawingPlan({
        schemaVersion: 1,
        name: "Raum",
        unit: "m",
        walls: [],
        rooms: [{ id: "room", name: "Raum", polygon: r.polygon }],
      }).rooms[0].polygon;
      if (polygon.length > 128)
        throw new Error("Maximal 128 Konturpunkte je Raum.");
      extra.polygon = polygon;
    }
    if (r.elevation !== undefined)
      extra.elevation = num(r.elevation, "room.elevation", 0, 30);
    if (r.kind !== undefined) {
      if (!["interior", "garden", "terrace"].includes(String(r.kind)))
        throw new Error("Ungültiger Raumtyp.");
      extra.kind = r.kind as Room["kind"];
    }
    return {
      ...extra,
      id: id(r.id, `rooms[${i}].id`),
      name: text(r.name, `rooms[${i}].name`),
      x: num(r.x ?? 0, "room.x", -1000, 1000),
      z: num(r.z ?? 0, "room.z", -1000, 1000),
      width: num(r.width, "room.width", 0.5, 100),
      depth: num(r.depth, "room.depth", 0.5, 100),
    };
  });
  unique(
    rooms.map((r) => r.id),
    "rooms",
  );
  for (const r of rooms)
    if (
      r.polygon &&
      r.polygon.some(
        (p) =>
          p.x < r.x - 1e-6 ||
          p.x > r.x + r.width + 1e-6 ||
          p.z < r.z - 1e-6 ||
          p.z > r.z + r.depth + 1e-6,
      )
    )
      throw new Error("Raumkontur liegt außerhalb ihrer Maße.");
  const rawEntities = root.entities ?? [];
  if (!Array.isArray(rawEntities) || rawEntities.length > 200)
    throw new Error("entities: Höchstens 200 Zuordnungen erwartet.");
  const entities: Binding[] = rawEntities.map((input, i) => {
    const e = object(input, `entities[${i}]`);
    keys(e, ["entity", "room", "name", "x", "z"], `entities[${i}]`);
    const entity = text(e.entity, `entities[${i}].entity`, 200);
    if (!/^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(entity))
      throw new Error(`entities[${i}].entity: Ungültige HA-Entitäts-ID.`);
    const room = rooms.find((r) => r.id === e.room);
    if (!room) throw new Error(`entities[${i}].room: Raum existiert nicht.`);
    const x = num(e.x ?? room.width / 2, "entity.x", 0, room.width),
      z = num(e.z ?? room.depth / 2, "entity.z", 0, room.depth);
    if (!inside({ x: room.x + x, z: room.z + z }, roomPolygon(room)))
      throw new Error("Sensor liegt außerhalb der Raumkontur.");
    return {
      entity,
      room: room.id,
      ...(e.name === undefined ? {} : { name: text(e.name, "entity.name") }),
      x,
      z,
    };
  });
  unique(
    entities.map((e) => e.entity),
    "entities",
  );
  const config: CardConfig = {
    type: "custom:haus-blick-card",
    title: text(root.title ?? "Haus Blick", "title"),
    height: num(root.height ?? 420, "height", 240, 900),
    rooms,
    entities,
  };
  if (root.drawing !== undefined) {
    config.drawing = parseDrawingPlan(root.drawing);
    if (config.drawing.walls.length > 500 || config.drawing.rooms.length > 50)
      throw new Error("Import: maximal 500 Wände / 50 Räume.");
    for (const r of config.drawing.rooms) {
      const room = config.rooms.find((a) => a.id === r.id);
      if (
        !room ||
        !room.polygon ||
        JSON.stringify(room.polygon) !== JSON.stringify(r.polygon) ||
        (room.elevation ?? 0) !== 0 ||
        (room.kind && room.kind !== "interior")
      )
        throw new Error(
          "Importierte Raumkonturen und IDs müssen mit drawing übereinstimmen; importierte Räume liegen auf 0 m.",
        );
    }
    for (const w of config.drawing.walls) {
      id(w.id, "wall.id");
      num(w.height, "wall.height", 1, 6);
      num(w.thickness, "wall.thickness", 0.03, 1);
    }
    for (const w of config.drawing.walls)
      for (const p of [w.start, w.end]) {
        num(p.x, "wall.x", -1000, 1000);
        num(p.z, "wall.z", -1000, 1000);
      }
  }
  if (root.building !== undefined) {
    const b = object(root.building, "building");
    keys(b, ["wall_height", "roof", "roof_height", "openings"], "building");
    const roof = b.roof ?? "flat";
    if (!["flat", "gable", "none"].includes(String(roof)))
      throw new Error("Ungültige Dachform.");
    const openings = b.openings ?? [];
    if (!Array.isArray(openings) || openings.length > 100)
      throw new Error("Maximal 100 Öffnungen.");
    config.building = {
      wall_height: num(b.wall_height ?? 2.7, "wall_height", 1, 6),
      roof: roof as "flat" | "gable" | "none",
      roof_height: num(b.roof_height ?? 1.2, "roof_height", 0.1, 4),
      openings: openings.map((o) => {
        const v = object(o, "opening");
        keys(v, ["wall", "offset", "width", "height", "sill"], "opening");
        return {
          wall: id(v.wall, "opening.wall"),
          offset: num(v.offset, "offset", 0, 200),
          width: num(v.width, "width", 0.2, 10),
          height: num(v.height, "height", 0.2, 6),
          sill: num(v.sill ?? 0, "sill", 0, 5),
        };
      }),
    };
    const walls = houseWalls(config);
    for (const o of config.building.openings) {
      const wall = walls.find((w) => w.id === o.wall);
      if (
        !wall ||
        o.offset + o.width >
          Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) +
            1e-6 ||
        o.sill + o.height > wall.height
      )
        throw new Error("Öffnung passt nicht in die Wand.");
    }
    for (const [i, o] of config.building.openings.entries())
      if (
        config.building.openings
          .slice(0, i)
          .some(
            (a) =>
              a.wall === o.wall &&
              a.offset < o.offset + o.width &&
              a.offset + a.width > o.offset,
          )
      )
        throw new Error("Öffnungen dürfen sich nicht überlappen.");
  }
  if (root.plants !== undefined) {
    if (!Array.isArray(root.plants) || root.plants.length > 100)
      throw new Error("Maximal 100 Gartenobjekte.");
    config.plants = root.plants.map((v) => {
      const a = object(v, "plant");
      keys(a, ["id", "kind", "x", "z", "size", "elevation"], "plant");
      if (!["tree", "shrub", "pot", "bed"].includes(String(a.kind)))
        throw new Error("Ungültiges Gartenobjekt.");
      return {
        id: id(a.id, "plant.id"),
        kind: a.kind as "tree" | "shrub" | "pot" | "bed",
        x: num(a.x, "plant.x", -1000, 1000),
        z: num(a.z, "plant.z", -1000, 1000),
        size: num(a.size ?? 1, "plant.size", 0.2, 5),
        elevation: num(a.elevation ?? 0, "plant.elevation", 0, 30),
      };
    });
    unique(
      config.plants.map((p) => p.id),
      "plants",
    );
  }
  unique(
    houseWalls(config).map((w) => w.id),
    "walls",
  );
  if (houseWalls(config).length > 500) throw new Error("Maximal 500 Wände.");
  for (const key of ["grid_options", "visibility", "view_layout"] as const) {
    if (root[key] !== undefined) {
      const encoded = JSON.stringify(root[key]);
      if (!encoded || encoded.length > 20000)
        throw new Error(`${key}: Konfiguration ist zu groß.`);
      config[key] = JSON.parse(encoded);
    }
  }
  return config;
}

export function stubConfig(hass?: HomeAssistant): CardConfig {
  const entities = Object.keys(hass?.states ?? {})
    .filter((id) => /^(sensor|binary_sensor|light|switch)\./.test(id))
    .slice(0, 3);
  return parseConfig({
    type: "custom:haus-blick-card",
    rooms: DEFAULT_ROOMS,
    entities: entities.map((entity, i) => ({
      entity,
      room: "wohnen",
      x: 1.5 + i * 1.5,
      z: 2,
    })),
  });
}

export function roomPolygon(room: Room) {
  return (
    room.polygon ?? [
      { x: room.x, z: room.z },
      { x: room.x + room.width, z: room.z },
      { x: room.x + room.width, z: room.z + room.depth },
      { x: room.x, z: room.z + room.depth },
    ]
  );
}
export function inside(
  p: { x: number; z: number },
  polygon: Array<{ x: number; z: number }>,
) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    const cross = (p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x);
    if (
      Math.abs(cross) < 1e-7 &&
      p.x >= Math.min(a.x, b.x) - 1e-7 &&
      p.x <= Math.max(a.x, b.x) + 1e-7 &&
      p.z >= Math.min(a.z, b.z) - 1e-7 &&
      p.z <= Math.max(a.z, b.z) + 1e-7
    )
      return true;
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      hit = !hit;
  }
  return hit;
}
export function houseWalls(config: CardConfig) {
  const walls = new Map<
    string,
    import("@fabriqon/sdk").DrawingWall & { elevation: number }
  >();
  for (const w of config.drawing?.walls ?? [])
    walls.set(
      [JSON.stringify(w.start), JSON.stringify(w.end)].sort().join("|") + ":0",
      { ...w, elevation: 0 },
    );
  for (const room of config.rooms.filter(
    (r) => !r.kind || r.kind === "interior",
  )) {
    if (config.drawing?.rooms.some((r) => r.id === room.id)) continue;
    const polygon = roomPolygon(room);
    polygon.forEach((start, i) => {
      const end = polygon[(i + 1) % polygon.length];
      const key =
        [JSON.stringify(start), JSON.stringify(end)].sort().join("|") +
        ":" +
        (room.elevation ?? 0);
      if (!walls.has(key))
        walls.set(key, {
          id: config.drawing
            ? `manual-wall-${walls.size}`
            : `wall-${walls.size}`,
          start,
          end,
          height: config.building?.wall_height ?? 2.7,
          thickness: 0.15,
          elevation: room.elevation ?? 0,
        });
    });
  }
  return [...walls.values()];
}
export function sceneModel(config: CardConfig): SceneModel {
  return parseSceneModel({
    schemaVersion: 1,
    name: config.title,
    connections: [],
    drawing: {
      schemaVersion: 1,
      name: config.title,
      unit: "m",
      walls: houseWalls(config).map(({ elevation: _, ...w }) => w),
      rooms: config.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        polygon: roomPolygon(r),
      })),
    },
    assets: config.entities.map((b, i) => {
      const r = config.rooms.find((r) => r.id === b.room)!;
      return {
        id: `entity-${i}`,
        name: b.name ?? b.entity,
        shape: "sphere",
        kind: "sensor",
        position: { x: r.x + b.x, y: (r.elevation ?? 0) + 0.18, z: r.z + b.z },
        size: { x: 0.44, y: 0.44, z: 0.44 },
        color: 0x64748b,
      };
    }),
  });
}
