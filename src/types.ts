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
  polygon?: Array<{ x: number; z: number }>;
  elevation?: number;
  kind?: "interior" | "garden" | "terrace";
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
  type: "custom:haus-blick-card";
  title: string;
  height: number;
  rooms: Room[];
  drawing?: import("@fabriqon/sdk").DrawingPlan;
  building?: {
    wall_height: number;
    roof: "flat" | "gable" | "none";
    roof_height: number;
    openings: Array<{
      wall: string;
      offset: number;
      width: number;
      height: number;
      sill: number;
    }>;
  };
  plants?: Array<{
    id: string;
    kind: "tree" | "shrub" | "pot" | "bed";
    x: number;
    z: number;
    size: number;
    elevation: number;
  }>;
  entities: Binding[];
  grid_options?: unknown;
  visibility?: unknown;
  view_layout?: unknown;
}
declare global {
  const __HAUS_BLICK_VERSION__: string;
  interface Window {
    customCards?: Array<Record<string, unknown>>;
  }
}
