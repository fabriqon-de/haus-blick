import { describe, expect, it } from 'vitest';
import { parseConfig, sceneModel, stubConfig } from '../../src/config';
import { entityView } from '../../src/state';
import type { HomeAssistant } from '../../src/types';

const input = () => ({ type: 'custom:haus-blick-card', rooms: [{ id: 'room', name: 'Wohnzimmer', x: 3, z: -2, width: 5, depth: 4 }], entities: [{ entity: 'sensor.temperature', room: 'room', x: 2, z: 1 }] });
describe('house configuration boundary', () => {
  it('maps room-relative markers into a detached SDK house model', () => {
    const original = input(); const config = parseConfig(original); const model = sceneModel(config);
    original.rooms[0].width = 99;
    expect(config.rooms[0].width).toBe(5);
    expect(model.assets[0].position).toEqual({ x: 5, y: .18, z: -1 });
    expect(model.drawing?.rooms[0].polygon).toEqual([{ x: 3, z: -2 }, { x: 8, z: -2 }, { x: 8, z: 2 }, { x: 3, z: 2 }]);
    expect(model.connections).toEqual([]); expect(model.zones).toBeUndefined();
  });
  it.each([NaN, Infinity, -.1, 101])('rejects unusable room dimensions: %s', width => {
    const candidate = input(); candidate.rooms[0].width = width; expect(() => parseConfig(candidate)).toThrow();
  });
  it('rejects ambiguous entities, broken references and markers outside the room', () => {
    const duplicate = input(); duplicate.entities.push({ ...duplicate.entities[0] }); expect(() => parseConfig(duplicate)).toThrow(/Doppelte/);
    const missing = input(); missing.entities[0].room = 'missing'; expect(() => parseConfig(missing)).toThrow(/existiert nicht/);
    const outside = input(); outside.entities[0].x = 6; expect(() => parseConfig(outside)).toThrow();
    const invalid = input(); invalid.entities[0].entity = 'https://example.test/token'; expect(() => parseConfig(invalid)).toThrow(/Entitäts-ID/);
  });
  it('rejects oversized input, unknown options and non-plain objects', () => {
    expect(() => parseConfig({ ...input(), rooms: Array.from({ length: 51 }, (_, i) => ({ ...input().rooms[0], id: String(i) })) })).toThrow();
    expect(() => parseConfig({ ...input(), mqtt_password: 'not-a-supported-option' })).toThrow(/Unbekannte/);
    expect(() => parseConfig(Object.assign(Object.create({ injected: true }), input()))).toThrow(/Objekt/);
  });
  it('deduplicates identical shared walls without inventing security zones', () => {
    const config = parseConfig({ type: 'custom:haus-blick-card' });
    expect(sceneModel(config).drawing?.walls).toHaveLength(7);
  });
  it('uses only real HA entity IDs for its suggested configuration', () => {
    const hass: HomeAssistant = { states: { 'sensor.actual': { entity_id: 'sensor.actual', state: '23', attributes: {} } } };
    expect(stubConfig(hass).entities.map(e => e.entity)).toEqual(['sensor.actual']);
    expect(stubConfig().entities).toEqual([]);
  });
});
describe('existing HA states', () => {
  const binding = parseConfig(input()).entities[0];
  const hass = (state: string, attributes = {}): HomeAssistant => ({ states: { [binding.entity]: { entity_id: binding.entity, state, attributes } } });
  it('distinguishes waiting, missing, unknown and unavailable states', () => {
    expect(entityView(binding).status).toBe('waiting');
    expect(entityView(binding, { states: {} }).status).toBe('missing');
    expect(entityView(binding, hass('unknown')).status).toBe('unknown');
    expect(entityView(binding, hass('unavailable')).status).toBe('unavailable');
  });
  it('uses the HA formatter and falls back to a local numeric value with units', () => {
    expect(entityView(binding, hass('21.5', { unit_of_measurement: '°C' })).value).toBe('21,5 °C');
    const localized = hass('21.5'); localized.formatEntityState = () => 'HA localized value';
    expect(entityView(binding, localized).value).toBe('HA localized value');
  });
  it('keeps door alarms visually distinct and restores a normal state', () => {
    const open = entityView(binding, hass('on', { device_class: 'window' }));
    const closed = entityView(binding, hass('off', { device_class: 'window' }));
    expect(open.status).toBe('active'); expect(closed.status).toBe('ready'); expect(open.color).not.toBe(closed.color);
  });
});
