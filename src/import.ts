import { parseDrawingPlan, type DrawingPlan } from "@fabriqon/sdk";
import { importDxf } from "@fabriqon/sdk/drawing";
import { parseConfig } from "./config";
import type { Binding, CardConfig, Room } from "./types";
export interface ImportOptions {
  unit: "m" | "cm" | "mm";
  rotation: 0 | 90 | 180 | 270;
  scale: number;
}
export interface ImportPreview {
  plan: DrawingPlan;
  rooms: Room[];
  warnings: string[];
  width: number;
  depth: number;
}
export function previewImport(
  text: string,
  format: "dxf" | "json",
  options: ImportOptions,
): ImportPreview {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error("Datei ist größer als 2 MB.");
  if (
    !Number.isFinite(options.scale) ||
    options.scale < 0.001 ||
    options.scale > 1000 ||
    ![0, 90, 180, 270].includes(options.rotation) ||
    !["m", "cm", "mm"].includes(options.unit)
  )
    throw new Error("Ungültige Importparameter.");
  const imported =
    format === "dxf"
      ? importDxf(text, { unit: options.unit, center: false })
      : { plan: parseDrawingPlan(JSON.parse(text)), warnings: [] };
  const factor = options.scale; // Neutral JSON is always metres; DXF unit conversion happens in the SDK.
  const angle = (options.rotation * Math.PI) / 180;
  const transform = (p: { x: number; z: number }) => ({
    x: factor * (p.x * Math.cos(angle) - p.z * Math.sin(angle)),
    z: factor * (p.x * Math.sin(angle) + p.z * Math.cos(angle)),
  });
  const plan = parseDrawingPlan({
    ...imported.plan,
    rooms: imported.plan.rooms.map((r) => ({
      ...r,
      polygon: r.polygon.map(transform),
    })),
    walls: imported.plan.walls.map((w) => ({
      ...w,
      start: transform(w.start),
      end: transform(w.end),
      height: w.height * factor,
      thickness: w.thickness * factor,
    })),
  });
  if (!plan.rooms.length)
    throw new Error(
      "Keine geschlossenen Raumkonturen gefunden. Wände allein reichen für die Sensorzuordnung nicht aus.",
    );
  const rooms = plan.rooms.map((r) => {
    const xs = r.polygon.map((p) => p.x),
      zs = r.polygon.map((p) => p.z),
      x = Math.min(...xs),
      z = Math.min(...zs);
    return {
      id: r.id,
      name: r.name,
      x,
      z,
      width: Math.max(...xs) - x,
      depth: Math.max(...zs) - z,
      polygon: r.polygon,
    };
  });
  if (!plan.walls.length) {
    const generated = new Map<string, import("@fabriqon/sdk").DrawingWall>();
    for (const r of rooms)
      r.polygon.forEach((start, i) => {
        const end = r.polygon[(i + 1) % r.polygon.length],
          key = [JSON.stringify(start), JSON.stringify(end)].sort().join("|");
        if (!generated.has(key))
          generated.set(key, {
            id: `wall-${generated.size + 1}`,
            start,
            end,
            height: 2.7,
            thickness: 0.15,
          });
      });
    plan.walls = [...generated.values()];
  }
  const validated = parseConfig({
    type: "custom:haus-blick-card",
    rooms,
    drawing: plan,
  });
  const points = [
    ...rooms.flatMap((r) => r.polygon),
    ...plan.walls.flatMap((w) => [w.start, w.end]),
  ];
  const xs = points.map((p) => p.x),
    zs = points.map((p) => p.z);
  return {
    plan: validated.drawing!,
    rooms: validated.rooms,
    warnings: imported.warnings,
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...zs) - Math.min(...zs),
  };
}
export function applyImport(
  config: CardConfig,
  preview: ImportPreview,
  entities: Binding[] = config.entities,
): CardConfig {
  // Never drop or silently move bindings. Missing rooms/points require explicit correction first.
  return parseConfig({
    ...config,
    entities,
    rooms: [
      ...preview.rooms,
      ...config.rooms.filter(
        (r) => r.kind === "garden" || r.kind === "terrace",
      ),
    ],
    drawing: preview.plan,
    building: config.building ?? {
      wall_height: 2.7,
      roof: "flat",
      roof_height: 1.2,
      openings: [],
    },
  });
}
