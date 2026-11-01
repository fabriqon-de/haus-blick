export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
}
export interface HomeAssistant {
  states: Record<string, HassEntity | undefined>;
  language?: string;
  locale?: { language?: string };
  themes?: { darkMode?: boolean };
  formatEntityState?: (entity: HassEntity) => string;
}
export interface Room {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
}
export interface Binding {
  entity: string;
  room: string;
  name?: string;
  x: number;
  z: number;
}
export interface CardConfig {
  type: 'custom:haus-blick-card';
  title: string;
  height: number;
  rooms: Room[];
  entities: Binding[];
  grid_options?: unknown;
  visibility?: unknown;
  view_layout?: unknown;
}
declare global {
  const __HAUS_BLICK_VERSION__: string;
  interface Window { customCards?: Array<Record<string, unknown>> }
}
