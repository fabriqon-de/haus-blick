import { houseScene, type HouseView } from "./house";
import * as THREE from "three";
import {
  createViewer,
  type FabriqonViewer,
  type ViewerSceneContext,
} from "@fabriqon/sdk/viewer";
import { houseWalls, parseConfig, sceneModel, stubConfig } from "./config";
import { entityView, type EntityView } from "./state";
import type { Binding, CardConfig, HomeAssistant } from "./types";

const CSS = `
:host{display:block;--hb-blue:#1582b8;--hb-amber:#f59e0b;font-family:inherit}
*{box-sizing:border-box}ha-card{display:block;overflow:hidden;background:var(--ha-card-background,var(--card-background-color,#fff));color:var(--primary-text-color,#182735);border-radius:var(--ha-card-border-radius,12px);border:1px solid var(--divider-color,#dce3e9)}
header{display:flex;align-items:center;gap:12px;padding:16px 18px 10px}.brand{width:30px;height:30px;color:var(--hb-blue);flex:none}h2{font-size:20px;line-height:1.2;margin:0;font-weight:600}.subtitle{font-size:12px;color:var(--secondary-text-color,#64748b);margin-top:4px}
button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation}button:focus-visible{outline:3px solid var(--hb-amber);outline-offset:2px}button:disabled{cursor:default;opacity:.6}
.tools{display:flex;gap:6px;padding:0 16px 12px;flex-wrap:wrap}.tools button,.retry{border:1px solid var(--divider-color,#cbd5e1);border-radius:8px;padding:7px 10px;background:transparent;font-size:12px;min-height:36px}
.stage{position:relative;width:100%;min-height:240px;background:var(--hb-background,#edf3f8);overflow:hidden}.canvas-host{position:absolute;inset:0}.canvas-host canvas{display:block;width:100%;height:100%}.overlay{position:absolute;inset:0;pointer-events:none;overflow:hidden}.marker-label{position:absolute;left:0;top:0;max-width:180px;transform:translate(-9999px,-9999px);pointer-events:auto;border:1px solid var(--divider-color,#cbd5e1);border-left:4px solid var(--hb-blue);border-radius:8px;background:var(--ha-card-background,var(--card-background-color,#fff));padding:6px 9px;box-shadow:0 3px 12px #0002;text-align:left;line-height:1.25;min-height:36px}.marker-name{display:block;font-size:10px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.marker-value{display:block;font-size:13px;font-weight:700}.room-label{position:absolute;font-size:11px;font-weight:600;color:var(--secondary-text-color,#526477);text-shadow:0 1px 4px var(--card-background-color,#fff);white-space:nowrap}
.fallback{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;background:var(--hb-background,#edf3f8)}.fallback[hidden]{display:none}.fallback p{max-width:340px;line-height:1.5;margin:0 0 12px}
.hint{font-size:11px;line-height:1.5;color:var(--secondary-text-color,#64748b);padding:10px 18px;border-bottom:1px solid var(--divider-color,#dce3e9)}.entities{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:8px;padding:12px 16px}.entity-row{display:flex;align-items:center;gap:10px;min-width:0;min-height:54px;padding:8px 10px;border:1px solid var(--divider-color,#dce3e9);background:transparent;border-radius:9px;text-align:left}.dot{width:10px;height:10px;border-radius:50%;flex:none}.entity-text{min-width:0;flex:1}.entity-name{display:block;font-size:12px;overflow-wrap:anywhere}.entity-value{display:block;font-size:14px;font-weight:600;margin-top:2px}.room-name{font-size:10px;color:var(--secondary-text-color,#64748b)}.empty{padding:8px 18px 18px;font-size:13px;line-height:1.6;color:var(--secondary-text-color,#64748b)}.empty[hidden]{display:none}.powered{padding:0 18px 12px;font-size:10px;color:var(--secondary-text-color,#64748b)}
@media(max-width:480px){header{padding:14px 12px 10px}.tools{padding:0 12px 10px}.entities{padding:10px 12px}.marker-label{max-width:130px}.marker-name{max-width:108px}.hint{padding:8px 12px}}
`;

interface Row {
  binding: Binding;
  label: HTMLButtonElement;
  row: HTMLButtonElement;
  name: HTMLElement[];
  value: HTMLElement[];
  dot: HTMLElement;
  anchor: THREE.Vector3;
  view?: EntityView;
}

export class HausBlickCard extends HTMLElement {
  private config?: CardConfig;
  private view: HouseView = "inside";
  private floor: number | null = null;
  private factories = new Map<string, () => THREE.Object3D>();
  private homeAssistant?: HomeAssistant;
  private viewer?: FabriqonViewer;
  private context?: ViewerSceneContext;
  private intersection?: IntersectionObserver;
  private rows: Row[] = [];
  private markers = new Map<
    string,
    THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  >();
  private roomLabels: Array<{
    element: HTMLElement;
    anchor: THREE.Vector3;
    elevation: number;
  }> = [];
  private root = this.attachShadow({ mode: "open" });
  private canvasHost?: HTMLElement;
  private stage?: HTMLElement;
  private overlay?: HTMLElement;
  private fallback?: HTMLElement;
  private fallbackText?: HTMLElement;

  static getConfigElement() {
    return document.createElement("haus-blick-card-editor");
  }
  static getStubConfig(hass?: HomeAssistant) {
    return stubConfig(hass);
  }
  getCardSize() {
    return Math.ceil(
      ((this.config?.height ?? 420) + 160 + this.rows.length * 28) / 50,
    );
  }
  getGridOptions() {
    return {
      columns: 12,
      rows: Math.ceil(((this.config?.height ?? 420) + 180) / 56),
      min_columns: 6,
      min_rows: 6,
    };
  }

  setConfig(input: unknown) {
    const next = parseConfig(input);
    this.config = next;
    if (this.isConnected) this.renderConfig();
  }
  set hass(value: HomeAssistant | undefined) {
    this.homeAssistant = value;
    if (!this.isConnected || !this.config) return;
    this.updateStates();
    this.updateTheme();
  }
  get hass(): HomeAssistant | undefined {
    return this.homeAssistant;
  }

  connectedCallback() {
    if (this.config) this.renderConfig();
  }
  disconnectedCallback() {
    this.intersection?.disconnect();
    this.intersection = undefined;
    this.disposeViewer();
  }

  private shell() {
    if (this.stage) return;
    this.root.innerHTML = `<style>${CSS}</style><ha-card>
      <header><svg class="brand" viewBox="0 0 32 32" aria-hidden="true"><path d="m4 14 12-9 12 9v14H4ZM12 28V17h8v11" fill="none" stroke="currentColor" stroke-width="2"/></svg><div><h2></h2><div class="subtitle"></div></div></header>
      <div class="tools"><button class="fit" type="button">Ansicht zurücksetzen</button><button class="outside" type="button">Außenansicht</button><button class="inside" type="button">Innenansicht</button><button class="top" type="button">Grundriss</button><label>Geschoss <select class="floor" aria-label="Geschoss auswählen"></select></label></div>
      <div class="stage"><div class="canvas-host"></div><div class="overlay"></div><div class="fallback"><p></p><button class="retry" type="button">3D starten</button></div></div>
      <div class="hint">Ziehen dreht das Haus · Tab erreicht die Sensoren · Anklicken öffnet Zustand und Verlauf in Home Assistant.</div>
      <div class="entities" aria-label="Zugeordnete Entitäten"></div><p class="empty">Ordne deine vorhandenen Entitäten im Karteneditor zu. Der Grundriss ist ein konfigurierbares Beispiel.</p>
      <div class="powered">Haus Blick · Powered by Fabriqon</div>
    </ha-card>`;
    this.stage = this.root.querySelector(".stage")!;
    this.canvasHost = this.root.querySelector(".canvas-host")!;
    this.overlay = this.root.querySelector(".overlay")!;
    this.fallback = this.root.querySelector(".fallback")!;
    this.fallbackText = this.root.querySelector(".fallback p")!;
    this.root
      .querySelector(".retry")!
      .addEventListener("click", () => this.startViewer());
    this.root
      .querySelector(".fit")!
      .addEventListener("click", () => this.fitHouse());
    for (const view of ["inside", "outside"] as const)
      this.root.querySelector("." + view)!.addEventListener("click", () => {
        this.view = view;
        this.refreshHouse();
        this.fitHouse();
      });
    this.root.querySelector(".floor")!.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value;
      this.floor = value === "all" ? null : Number(value);
      this.refreshHouse();
      this.fitHouse();
    });
    this.root.querySelector(".top")!.addEventListener("click", () => {
      if (!this.viewer || !this.config) return;
      this.view = "plan";
      this.refreshHouse();
      this.fitHouse();
    });
  }

  private bounds() {
    const rooms = this.config!.rooms;
    const plants = this.config!.plants ?? [];
    const points = houseWalls(this.config!).flatMap((w) => [w.start, w.end]);
    return {
      minX: Math.min(
        ...rooms.map((r) => r.x),
        ...plants.map((p) => p.x - p.size),
        ...points.map((p) => p.x),
      ),
      maxX: Math.max(
        ...rooms.map((r) => r.x + r.width),
        ...plants.map((p) => p.x + p.size),
        ...points.map((p) => p.x),
      ),
      minZ: Math.min(
        ...rooms.map((r) => r.z),
        ...plants.map((p) => p.z - p.size),
        ...points.map((p) => p.z),
      ),
      maxZ: Math.max(
        ...rooms.map((r) => r.z + r.depth),
        ...plants.map((p) => p.z + p.size),
        ...points.map((p) => p.z),
      ),
    };
  }

  private fitHouse() {
    if (!this.viewer || !this.context || !this.stage) return;
    if (this.view === "plan") {
      const b = this.bounds(),
        x = (b.minX + b.maxX) / 2,
        z = (b.minZ + b.maxZ) / 2,
        aspect =
          Math.max(this.stage.clientWidth, 1) /
          Math.max(this.stage.clientHeight, 1);
      this.viewer.setCamera(
        {
          x,
          y:
            Math.max((b.maxX - b.minX) / aspect, b.maxZ - b.minZ) * 1.5 +
            (this.floor ?? 0) +
            1,
          z: z + 0.01,
        },
        { x, y: this.floor ?? 0, z },
      );
      return;
    }
    const b = this.bounds(),
      maxY = Math.max(
        ...houseWalls(this.config!).map(
          (w) =>
            w.elevation +
            w.height +
            (this.config!.building?.roof_height ?? 1.2),
        ),
        ...this.config!.rooms.map(
          (r) =>
            (r.elevation ?? 0) +
            (this.config!.building?.wall_height ?? 2.7) +
            (this.config!.building?.roof_height ?? 1.2),
        ),
        ...(this.config!.plants ?? []).map((p) => p.elevation + p.size * 2),
      );
    const center = new THREE.Vector3(
      (b.minX + b.maxX) / 2,
      maxY / 2,
      (b.minZ + b.maxZ) / 2,
    );
    const direction = new THREE.Vector3(1, 1.15, 1).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    let halfWidth = 0,
      halfHeight = 0,
      halfDepth = 0;
    for (const x of [b.minX, b.maxX])
      for (const z of [b.minZ, b.maxZ])
        for (const y of [0, maxY]) {
          const corner = new THREE.Vector3(x, y, z).sub(center);
          halfWidth = Math.max(halfWidth, Math.abs(corner.dot(right)));
          halfHeight = Math.max(halfHeight, Math.abs(corner.dot(up)));
          halfDepth = Math.max(halfDepth, Math.abs(corner.dot(direction)));
        }
    const tangent = Math.tan(
      THREE.MathUtils.degToRad(this.context.camera.fov / 2),
    );
    const aspect =
      Math.max(this.stage.clientWidth, 1) /
      Math.max(this.stage.clientHeight, 1);
    const distance =
      (Math.max(halfWidth / (tangent * aspect), halfHeight / tangent) +
        halfDepth) *
      1.15;
    this.viewer.setCamera(
      center.clone().addScaledVector(direction, distance),
      center,
    );
  }

  private renderConfig() {
    this.shell();
    const config = this.config!;
    this.root.querySelector("h2")!.textContent = config.title;
    this.root.querySelector(".subtitle")!.textContent =
      `${config.rooms.length} Räume · ${config.entities.length} Entitäten`;
    this.stage!.style.height = `${config.height}px`;
    const floors = [...new Set(config.rooms.map((r) => r.elevation ?? 0))].sort(
      (a, b) => a - b,
    );
    if (this.floor !== null && !floors.includes(this.floor)) this.floor = null;
    const select = this.root.querySelector<HTMLSelectElement>(".floor")!;
    select.replaceChildren();
    for (const value of ["all", ...floors.map(String)]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "all" ? "Alle" : `${value} m`;
      select.append(option);
    }
    select.value = this.floor === null ? "all" : String(this.floor);
    this.overlay!.replaceChildren();
    this.roomLabels = config.rooms.map((room) => {
      const element = document.createElement("span");
      element.className = "room-label";
      element.textContent = room.name;
      this.overlay!.append(element);
      return {
        element,
        elevation: room.elevation ?? 0,
        anchor: new THREE.Vector3(
          room.x + room.width / 2,
          (room.elevation ?? 0) + 0.03,
          room.z + room.depth / 2,
        ),
      };
    });
    const list = this.root.querySelector(".entities")!;
    list.replaceChildren();
    const model = sceneModel(config);
    this.rows = config.entities.map((binding, i) => {
      const label = document.createElement("button");
      label.className = "marker-label";
      label.type = "button";
      const labelName = document.createElement("span"),
        labelValue = document.createElement("span");
      labelName.className = "marker-name";
      labelValue.className = "marker-value";
      label.append(labelName, labelValue);
      label.addEventListener("click", () => this.moreInfo(binding.entity));
      this.overlay!.append(label);
      const row = document.createElement("button");
      row.className = "entity-row";
      row.type = "button";
      row.dataset.entityId = binding.entity;
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");
      const texts = document.createElement("span");
      texts.className = "entity-text";
      const name = document.createElement("span"),
        value = document.createElement("span"),
        roomName = document.createElement("span");
      name.className = "entity-name";
      value.className = "entity-value";
      roomName.className = "room-name";
      roomName.textContent = config.rooms.find(
        (r) => r.id === binding.room,
      )!.name;
      texts.append(name, value, roomName);
      row.append(dot, texts);
      row.addEventListener("click", () => this.moreInfo(binding.entity));
      list.append(row);
      const position = model.assets[i].position;
      return {
        binding,
        label,
        row,
        name: [labelName, name],
        value: [labelValue, value],
        dot,
        anchor: new THREE.Vector3(position.x, position.y + 0.82, position.z),
      };
    });
    (this.root.querySelector(".empty") as HTMLElement).hidden =
      config.entities.length > 0;
    this.updateStates();
    this.updateTheme();
    if (this.viewer) {
      this.markers.clear();
      try {
        this.refreshHouse();
        this.fitHouse();
        this.updateStates(true);
      } catch {
        this.showFallback(
          "Das 3D-Modell konnte nicht aufgebaut werden. Die Entitätsliste bleibt nutzbar.",
        );
      }
    } else this.observeVisibility();
  }

  private observeVisibility() {
    this.intersection?.disconnect();
    this.fallbackText!.textContent =
      "3D wird gestartet, sobald diese Karte sichtbar ist.";
    this.fallback!.hidden = false;
    if (typeof IntersectionObserver === "undefined") {
      this.startViewer();
      return;
    }
    this.intersection = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.intersection?.disconnect();
        this.intersection = undefined;
        this.startViewer();
      }
    });
    this.intersection.observe(this.stage!);
  }

  private startViewer() {
    if (!this.isConnected || !this.config || this.viewer) return;
    this.intersection?.disconnect();
    this.intersection = undefined;
    this.canvasHost!.replaceChildren();
    try {
      this.viewer = createViewer(this.canvasHost!, {
        maxFps: 24,
        autoRotate: false,
        keyboard: "camera",
        assetFactory: (asset) => {
          const factory = this.factories.get(asset.id);
          if (factory) return factory();
          const material = new THREE.MeshStandardMaterial({
            color: asset.color,
            roughness: 0.45,
            metalness: 0.1,
          });
          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 16, 12),
            material,
          );
          this.markers.set(asset.id, marker);
          return marker;
        },
        configure: (context) => {
          this.context = context;
        },
        onSelect: (id) => {
          if (!id) return;
          if (!/^entity-\d+$/.test(id)) {
            this.viewer?.select(null);
            return;
          }
          const binding =
            this.config?.entities[Number(id.slice("entity-".length))];
          // Reset selection so a second click on the same marker opens more-info again.
          this.viewer?.select(null);
          if (binding) this.moreInfo(binding.entity);
        },
        onFrame: ({ camera }) => this.projectLabels(camera),
        onContextLost: () =>
          this.showFallback(
            "Der 3D-Kontext wurde unterbrochen. Die Entitätsliste bleibt nutzbar.",
          ),
      });
      this.refreshHouse();
      this.fitHouse();
      this.fallback!.hidden = true;
      this.overlay!.hidden = false;
      this.updateTheme();
      this.updateStates(true);
      this.root
        .querySelector("canvas")
        ?.setAttribute(
          "aria-label",
          "3D-Hausmodell. Ziehen dreht die Ansicht. Pfeiltasten bewegen die Kamera. Sensoren sind auch in der Liste erreichbar.",
        );
      this.root
        .querySelectorAll<HTMLButtonElement>(".tools button")
        .forEach((button) => {
          button.disabled = false;
        });
    } catch {
      this.showFallback(
        "3D ist auf diesem Gerät nicht verfügbar. Deine Entitäten und ihre Details bleiben unten erreichbar.",
      );
    }
  }

  private refreshHouse() {
    if (!this.config || !this.viewer) return;
    const { model, factories } = houseScene(this.config, this.view, this.floor);
    this.factories = factories;
    this.markers.clear();
    this.viewer.setModel(model, { fit: false });
    this.updateStates(true);
    for (const view of ["outside", "inside", "plan"])
      this.root
        .querySelector(view === "plan" ? ".top" : "." + view)
        ?.setAttribute("aria-pressed", String(view === this.view));
  }

  private projectLabels(camera: THREE.Camera) {
    if (!this.stage) return;
    const width = this.stage.clientWidth,
      height = this.stage.clientHeight;
    for (const item of this.roomLabels) {
      const point = item.anchor.clone().project(camera);
      const visible =
        this.view !== "outside" &&
        (this.floor === null || item.elevation === this.floor) &&
        point.z >= -1 &&
        point.z <= 1 &&
        Math.abs(point.x) < 1.2 &&
        Math.abs(point.y) < 1.2;
      item.element.style.visibility = visible ? "visible" : "hidden";
      item.element.style.transform = `translate(${((point.x + 1) * width) / 2}px,${((1 - point.y) * height) / 2}px) translate(-50%,-100%)`;
    }
    const occupied: Array<{
      left: number;
      top: number;
      width: number;
      height: number;
    }> = [];
    for (const row of this.rows) {
      const point = row.anchor.clone().project(camera),
        element = row.label;
      const w = element.offsetWidth,
        h = element.offsetHeight;
      const x = ((point.x + 1) * width) / 2,
        y = ((1 - point.y) * height) / 2;
      let placed = false;
      const room = this.config!.rooms.find((r) => r.id === row.binding.room)!;
      if (
        (this.view !== "outside" ||
          room.kind === "garden" ||
          room.kind === "terrace") &&
        (this.floor === null || (room.elevation ?? 0) === this.floor) &&
        point.z >= -1 &&
        point.z <= 1 &&
        Math.abs(point.x) < 1.2 &&
        Math.abs(point.y) < 1.2
      ) {
        for (const side of [0, -1, 1]) {
          for (let level = 0; level < 7; level++) {
            const box = {
              left: THREE.MathUtils.clamp(
                x - w / 2 + side * (w + 8),
                4,
                Math.max(4, width - w - 4),
              ),
              top: THREE.MathUtils.clamp(
                y - h - 8 - level * (h + 6),
                4,
                Math.max(4, height - h - 4),
              ),
              width: w,
              height: h,
            };
            if (
              occupied.some(
                (other) =>
                  box.left < other.left + other.width + 6 &&
                  box.left + w + 6 > other.left &&
                  box.top < other.top + other.height + 6 &&
                  box.top + h + 6 > other.top,
              )
            )
              continue;
            occupied.push(box);
            placed = true;
            const transform = `translate(${box.left}px,${box.top}px)`;
            if (element.style.transform !== transform)
              element.style.transform = transform;
            break;
          }
          if (placed) break;
        }
      }
      element.style.visibility = placed ? "visible" : "hidden";
    }
  }

  private updateStates(force = false) {
    this.rows.forEach((row, index) => {
      const view = entityView(row.binding, this.homeAssistant);
      if (
        !force &&
        row.view &&
        JSON.stringify(row.view) === JSON.stringify(view)
      )
        return;
      row.view = view;
      row.name.forEach((node) => {
        node.textContent = view.name;
      });
      row.value.forEach((node) => {
        node.textContent = view.value;
      });
      const color = "#" + view.color.toString(16).padStart(6, "0");
      row.dot.style.backgroundColor = color;
      row.label.style.borderLeftColor = color;
      row.row.dataset.status = view.status;
      row.label.setAttribute(
        "aria-label",
        `${view.name}: ${view.value} – Details im Hausmodell`,
      );
      row.row.setAttribute(
        "aria-label",
        `${view.name}: ${view.value} – Details`,
      );
      row.label.disabled = row.row.disabled =
        !this.homeAssistant?.states[row.binding.entity];
      const marker = this.markers.get(`entity-${index}`);
      if (marker) {
        marker.material.color.setHex(view.color);
        marker.material.emissive.setHex(view.color).multiplyScalar(0.12);
      }
    });
  }

  private updateTheme() {
    const dark = !!this.homeAssistant?.themes?.darkMode;
    const color = dark ? 0x121e2b : 0xedf3f8;
    this.style.setProperty("--hb-background", dark ? "#121e2b" : "#edf3f8");
    this.context?.renderer.setClearColor(color);
  }

  private moreInfo(entity: string) {
    if (!this.homeAssistant?.states[entity]) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: entity },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private showFallback(message: string) {
    this.disposeViewer();
    this.canvasHost!.replaceChildren();
    this.overlay!.hidden = true;
    this.fallbackText!.textContent = message;
    this.fallback!.hidden = false;
    (this.root.querySelector(".retry") as HTMLButtonElement).textContent =
      "3D erneut versuchen";
    this.root
      .querySelectorAll<HTMLButtonElement>(".tools button")
      .forEach((button) => {
        button.disabled = true;
      });
  }

  private disposeViewer() {
    this.viewer?.dispose();
    this.viewer = undefined;
    this.context = undefined;
    this.markers.clear();
  }
}
