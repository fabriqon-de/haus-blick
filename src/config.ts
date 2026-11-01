import { parseSceneModel, type SceneModel } from '@fabriqon/sdk';
import type { Binding, CardConfig, HomeAssistant, Room } from './types';

const DEFAULT_ROOMS: Room[] = [
  { id: 'wohnen', name: 'Wohnen', x: 0, z: 0, width: 6, depth: 4 },
  { id: 'kueche', name: 'Küche', x: 6, z: 0, width: 3, depth: 4 }
];
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${path}: Objekt erwartet.`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], path: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${path}.${key}: Unbekannte Option.`);
}
function text(value: unknown, path: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${path}: Text mit 1–${max} Zeichen erwartet.`);
  return value;
}
function num(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${path}: Zahl zwischen ${min} und ${max} erwartet.`);
  return value;
}
function id(value: unknown, path: string): string {
  const result = text(value, path, 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new Error(`${path}: Ungültige ID.`);
  return result;
}
function unique(values: string[], path: string) {
  if (new Set(values).size !== values.length) throw new Error(`${path}: Doppelte ID.`);
}

export function parseConfig(input: unknown): CardConfig {
  const root = object(input, 'Karte');
  keys(root, ['type', 'title', 'height', 'rooms', 'entities', 'grid_options', 'visibility', 'view_layout'], 'Karte');
  if (root.type !== 'custom:haus-blick-card') throw new Error('type muss custom:haus-blick-card sein.');
  const rawRooms = root.rooms ?? DEFAULT_ROOMS;
  if (!Array.isArray(rawRooms) || !rawRooms.length || rawRooms.length > 50) throw new Error('rooms: 1–50 Räume erwartet.');
  const rooms: Room[] = rawRooms.map((input, i) => {
    const r = object(input, `rooms[${i}]`);
    keys(r, ['id', 'name', 'x', 'z', 'width', 'depth'], `rooms[${i}]`);
    return { id: id(r.id, `rooms[${i}].id`), name: text(r.name, `rooms[${i}].name`),
      x: num(r.x ?? 0, 'room.x', -1000, 1000), z: num(r.z ?? 0, 'room.z', -1000, 1000),
      width: num(r.width, 'room.width', .5, 100), depth: num(r.depth, 'room.depth', .5, 100) };
  });
  unique(rooms.map(r => r.id), 'rooms');
  const rawEntities = root.entities ?? [];
  if (!Array.isArray(rawEntities) || rawEntities.length > 200) throw new Error('entities: Höchstens 200 Zuordnungen erwartet.');
  const entities: Binding[] = rawEntities.map((input, i) => {
    const e = object(input, `entities[${i}]`);
    keys(e, ['entity', 'room', 'name', 'x', 'z'], `entities[${i}]`);
    const entity = text(e.entity, `entities[${i}].entity`, 200);
    if (!/^[a-z][a-z0-9_]*\.[a-z0-9_]+$/.test(entity)) throw new Error(`entities[${i}].entity: Ungültige HA-Entitäts-ID.`);
    const room = rooms.find(r => r.id === e.room);
    if (!room) throw new Error(`entities[${i}].room: Raum existiert nicht.`);
    return { entity, room: room.id, ...(e.name === undefined ? {} : { name: text(e.name, 'entity.name') }),
      x: num(e.x ?? room.width / 2, 'entity.x', 0, room.width), z: num(e.z ?? room.depth / 2, 'entity.z', 0, room.depth) };
  });
  unique(entities.map(e => e.entity), 'entities');
  const config: CardConfig = { type: 'custom:haus-blick-card', title: text(root.title ?? 'Haus Blick', 'title'),
    height: num(root.height ?? 420, 'height', 240, 900), rooms, entities };
  for (const key of ['grid_options', 'visibility', 'view_layout'] as const) {
    if (root[key] !== undefined) {
      const encoded = JSON.stringify(root[key]);
      if (!encoded || encoded.length > 20000) throw new Error(`${key}: Konfiguration ist zu groß.`);
      config[key] = JSON.parse(encoded);
    }
  }
  return config;
}

export function stubConfig(hass?: HomeAssistant): CardConfig {
  const entities = Object.keys(hass?.states ?? {}).filter(id => /^(sensor|binary_sensor|light|switch)\./.test(id)).slice(0, 3);
  return parseConfig({ type: 'custom:haus-blick-card', rooms: DEFAULT_ROOMS,
    entities: entities.map((entity, i) => ({ entity, room: 'wohnen', x: 1.5 + i * 1.5, z: 2 })) });
}

export function sceneModel(config: CardConfig): SceneModel {
  const walls = new Map<string, { id: string; start: { x: number; z: number }; end: { x: number; z: number }; height: number; thickness: number }>();
  const rooms = config.rooms.map(room => {
    const polygon = [{ x: room.x, z: room.z }, { x: room.x + room.width, z: room.z },
      { x: room.x + room.width, z: room.z + room.depth }, { x: room.x, z: room.z + room.depth }];
    polygon.forEach((start, i) => {
      const end = polygon[(i + 1) % 4];
      const key = [JSON.stringify(start), JSON.stringify(end)].sort().join('|');
      if (!walls.has(key)) walls.set(key, { id: `wall-${walls.size}`, start, end, height: .7, thickness: .12 });
    });
    return { id: room.id, name: room.name, polygon };
  });
  return parseSceneModel({ schemaVersion: 1, name: config.title, connections: [],
    drawing: { schemaVersion: 1, name: config.title, unit: 'm', walls: [...walls.values()], rooms },
    assets: config.entities.map((binding, i) => {
      const room = config.rooms.find(r => r.id === binding.room)!;
      return { id: `entity-${i}`, name: binding.name ?? binding.entity, shape: 'sphere', kind: 'sensor',
        position: { x: room.x + binding.x, y: .18, z: room.z + binding.z }, size: { x: .44, y: .44, z: .44 }, color: 0x64748b };
    }) });
}
