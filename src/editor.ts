import { previewImport, applyImport, type ImportPreview } from "./import";
import { houseWalls, parseConfig, stubConfig } from "./config";
import type { CardConfig, HomeAssistant } from "./types";

const CSS = `:host{display:block;color:var(--primary-text-color,#172735);font-family:inherit}*{box-sizing:border-box}h3{font-size:15px;margin:20px 0 10px}label{display:grid;gap:5px;font-size:12px;margin-bottom:10px}input,select,button{font:inherit;color:inherit;min-height:38px;padding:7px 9px;border:1px solid var(--divider-color,#cbd5e1);border-radius:7px;background:var(--card-background-color,#fff)}input,select{width:100%;min-width:0}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #f59e0b}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.item{padding:12px;margin:8px 0;border:1px solid var(--divider-color,#cbd5e1);border-radius:10px}.wide{grid-column:1/-1}.error{color:var(--error-color,#b91c1c);white-space:pre-wrap;font-size:13px}.help{font-size:12px;line-height:1.6;color:var(--secondary-text-color,#64748b)}.remove{font-size:12px}.add{margin-top:6px}`;

export class HausBlickEditor extends HTMLElement {
  private config: CardConfig = stubConfig();
  private homeAssistant?: HomeAssistant;
  private root = this.attachShadow({ mode: "open" });
  private optionsSignature = "";
  private preview?: ImportPreview;
  private importGeneration = 0;

  setConfig(input: unknown) {
    this.config = parseConfig(input);
    this.render();
  }
  set hass(value: HomeAssistant | undefined) {
    this.homeAssistant = value;
    const signature = Object.keys(value?.states ?? {})
      .sort()
      .join("|");
    if (signature !== this.optionsSignature) {
      this.optionsSignature = signature;
      this.updateOptions();
    }
  }
  get hass(): HomeAssistant | undefined {
    return this.homeAssistant;
  }
  connectedCallback() {
    this.render();
  }

  private input(
    label: string,
    name: string,
    value: string | number,
    type = "text",
  ): HTMLLabelElement {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const input = document.createElement("input");
    input.name = name;
    input.type = type;
    input.value = String(value);
    if (type === "number") input.step = "any";
    if (name === "entity") {
      input.setAttribute("list", "ha-entities");
      input.autocomplete = "off";
    }
    wrapper.append(input);
    return wrapper;
  }

  private select(
    label: string,
    name: string,
    options: string[][],
    value: string,
  ) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const select = document.createElement("select");
    select.name = name;
    for (const [id, text] of options) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = text;
      select.append(option);
    }
    select.value = value;
    wrapper.append(select);
    return wrapper;
  }

  private render() {
    // hass updates only refresh suggestions; this method is for actual configuration changes.
    this.root.innerHTML = `<style>${CSS}</style><div class="general grid"></div>
      <p class="help">Räume und Positionen in Metern. Sensorpositionen sind relativ zur linken unteren Ecke des zugeordneten Raums. Werte kommen aus Home Assistant.</p>
      <h3>Grundriss importieren</h3><div class="import item"><label>Datei (DXF oder DrawingPlan JSON, maximal 2 MB)<input type="file" accept=".dxf,.json" class="import-file"></label><label>DXF-Einheit<select class="import-unit"><option value="m">Meter</option><option value="cm">Zentimeter</option><option value="mm">Millimeter</option></select></label><label>Drehung<select class="import-rotation"><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label><label>Zusätzlicher Maßstab<input class="import-scale" type="number" value="1" step="any"></label><button type="button" class="preview-import">Vorschau erstellen</button><div class="import-preview"></div><button type="button" class="apply-import" disabled>Grundriss übernehmen</button><button type="button" class="cancel-import">Verwerfen</button></div>
      <h3>Gebäude und Garten</h3><div class="building item"></div>
      <h3>Räume und Außenflächen</h3><div class="rooms"></div><button class="add-room add" type="button">Raum hinzufügen</button>
      <h3>Entitäten zuordnen</h3><datalist id="ha-entities"></datalist><div class="bindings"></div><button class="add-entity add" type="button">Entität hinzufügen</button>
      <p class="error" role="alert"></p><p class="help">Home Assistant speichert diese Konfiguration mit dem Dashboard. Es wird keine zusätzliche Verbindung zum Broker oder zu einer Datenbank aufgebaut.</p>`;
    this.root
      .querySelector(".general")!
      .append(
        this.input("Titel", "title", this.config.title),
        this.input("3D-Höhe (Pixel)", "height", this.config.height, "number"),
      );
    const building = this.root.querySelector(".building")!;
    building.append(
      this.input(
        "Wandhöhe (m)",
        "wall_height",
        this.config.building?.wall_height ?? 2.7,
        "number",
      ),
      this.input(
        "Dachhöhe (m)",
        "roof_height",
        this.config.building?.roof_height ?? 1.2,
        "number",
      ),
    );
    const roofLabel = document.createElement("label");
    roofLabel.textContent = "Dachform";
    const roof = document.createElement("select");
    roof.name = "roof";
    for (const [value, label] of [
      ["flat", "Flachdach"],
      ["gable", "Satteldach"],
      ["none", "Kein Dach"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      roof.append(option);
    }
    roof.value = this.config.building?.roof ?? "flat";
    roofLabel.append(roof);
    building.append(roofLabel);
    const walls = houseWalls(this.config);
    const openingTitle = document.createElement("h3");
    openingTitle.textContent = "Türen und Fenster";
    building.append(openingTitle);
    for (const [index, o] of (this.config.building?.openings ?? []).entries()) {
      const row = document.createElement("div");
      row.className = "item opening grid";
      row.append(
        this.select(
          "Wand",
          "wall",
          walls.map((w) => [w.id, w.id]),
          o.wall,
        ),
        this.input("Abstand vom Wandanfang (m)", "offset", o.offset, "number"),
        this.input("Breite (m)", "width", o.width, "number"),
        this.input("Höhe (m)", "height", o.height, "number"),
        this.input("Brüstung (0 = Tür, m)", "sill", o.sill, "number"),
      );
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Öffnung entfernen";
      remove.addEventListener("click", () => {
        const c = structuredClone(this.config);
        c.building!.openings.splice(index, 1);
        this.commit(c);
      });
      row.append(remove);
      building.append(row);
    }
    const addOpening = document.createElement("button");
    addOpening.type = "button";
    addOpening.textContent = "Öffnung hinzufügen";
    addOpening.addEventListener("click", () => {
      const c = structuredClone(this.config);
      c.building ??= {
        wall_height: 2.7,
        roof: "flat",
        roof_height: 1.2,
        openings: [],
      };
      const wall = walls.find(
        (w) =>
          Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) >= 0.2 &&
          !c.building!.openings.some((o) => o.wall === w.id),
      );
      if (!wall) {
        this.error(
          "Keine freie Wand für eine weitere Öffnung. Bestehende Öffnungen anpassen oder YAML nutzen.",
        );
        return;
      }
      c.building.openings.push({
        wall: wall.id,
        offset: 0,
        width: Math.min(
          1,
          Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z),
        ),
        height: Math.min(2, wall.height),
        sill: 0,
      });
      this.commit(c);
    });
    building.append(addOpening);
    const plantTitle = document.createElement("h3");
    plantTitle.textContent = "Pflanzen und Beete";
    building.append(plantTitle);
    for (const [index, p] of (this.config.plants ?? []).entries()) {
      const row = document.createElement("div");
      row.className = "item plant grid";
      row.append(
        this.input("Objekt-ID", "id", p.id),
        this.select(
          "Pflanze",
          "kind",
          [
            ["tree", "Baum"],
            ["shrub", "Strauch"],
            ["pot", "Topfpflanze"],
            ["bed", "Beet"],
          ],
          p.kind,
        ),
        this.input("X (m)", "x", p.x, "number"),
        this.input("Z (m)", "z", p.z, "number"),
        this.input("Größe (m)", "size", p.size, "number"),
        this.input("Elevation (m)", "elevation", p.elevation, "number"),
      );
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Gartenobjekt entfernen";
      remove.addEventListener("click", () => {
        const c = structuredClone(this.config);
        c.plants!.splice(index, 1);
        this.commit(c);
      });
      row.append(remove);
      building.append(row);
    }
    const addPlant = document.createElement("button");
    addPlant.type = "button";
    addPlant.textContent = "Gartenobjekt hinzufügen";
    addPlant.addEventListener("click", () => {
      const c = structuredClone(this.config);
      c.plants ??= [];
      let id = "pflanze-" + (c.plants.length + 1);
      while (c.plants.some((p) => p.id === id)) id += "-neu";
      c.plants.push({
        id,
        kind: "tree",
        x: Math.max(...c.rooms.map((r) => r.x + r.width)) + 1,
        z: 1,
        size: 1,
        elevation: 0,
      });
      this.commit(c);
    });
    building.append(addPlant);
    const wallHelp = document.createElement("p");
    wallHelp.className = "help";
    wallHelp.textContent =
      "Wände (Start → Ende): " +
      houseWalls(this.config)
        .map(
          (w) =>
            `${w.id}: (${w.start.x}, ${w.start.z}) → (${w.end.x}, ${w.end.z})`,
        )
        .join("; ");
    building.append(wallHelp);
    this.config.rooms.forEach((room, index) => {
      const item = document.createElement("div");
      item.className = "item room";
      item.dataset.index = String(index);
      const grid = document.createElement("div");
      grid.className = "grid";
      grid.append(
        this.input("Raum-ID", "id", room.id),
        this.input("Name", "name", room.name),
        this.input("X", "x", room.x, "number"),
        this.input("Z", "z", room.z, "number"),
        this.input("Breite", "width", room.width, "number"),
        this.input("Tiefe", "depth", room.depth, "number"),
      );
      grid.append(
        this.input(
          "Geschosshöhe / Elevation (m)",
          "elevation",
          room.elevation ?? 0,
          "number",
        ),
      );
      const kindLabel = document.createElement("label");
      kindLabel.textContent = "Flächentyp";
      const kind = document.createElement("select");
      kind.name = "kind";
      for (const [value, label] of [
        ["interior", "Innenraum"],
        ["garden", "Garten"],
        ["terrace", "Terrasse"],
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        kind.append(option);
      }
      kind.value = room.kind ?? "interior";
      kindLabel.append(kind);
      grid.append(kindLabel);
      if (room.polygon) {
        grid.querySelector<HTMLInputElement>('[name="elevation"]')!.disabled =
          true;
        const hint = document.createElement("p");
        hint.className = "help";
        hint.textContent =
          "Importierte Kontur: Maße und Position nur über erneuten Import oder YAML ändern.";
        grid.append(hint);
        grid
          .querySelectorAll<HTMLInputElement>(
            '[name="id"],[name="x"],[name="z"],[name="width"],[name="depth"]',
          )
          .forEach((i) => (i.disabled = true));
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Raum entfernen";
      remove.className = "remove";
      remove.addEventListener("click", () => {
        const candidate = structuredClone(this.config);
        candidate.rooms.splice(index, 1);
        this.commit(candidate);
      });
      item.append(grid, remove);
      this.root.querySelector(".rooms")!.append(item);
    });
    this.config.entities.forEach((binding, index) => {
      const item = document.createElement("div");
      item.className = "item binding";
      item.dataset.index = String(index);
      const grid = document.createElement("div");
      grid.className = "grid";
      grid.append(
        this.input("Entitäts-ID", "entity", binding.entity),
        this.input("Anzeigename (optional)", "name", binding.name ?? ""),
      );
      const label = document.createElement("label");
      label.textContent = "Raum";
      const select = document.createElement("select");
      select.name = "room";
      this.config.rooms.forEach((room) => {
        const option = document.createElement("option");
        option.value = room.id;
        option.textContent = room.name;
        select.append(option);
      });
      select.value = binding.room;
      label.append(select);
      grid.append(label);
      grid.append(
        this.input("X im Raum", "x", binding.x, "number"),
        this.input("Z im Raum", "z", binding.z, "number"),
      );
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Zuordnung entfernen";
      remove.className = "remove";
      remove.addEventListener("click", () => {
        const candidate = structuredClone(this.config);
        candidate.entities.splice(index, 1);
        this.commit(candidate);
      });
      item.append(grid, remove);
      this.root.querySelector(".bindings")!.append(item);
    });
    this.root.querySelector(".add-room")!.addEventListener("click", () => {
      const candidate = structuredClone(this.config);
      let id = "raum-" + (candidate.rooms.length + 1);
      while (candidate.rooms.some((room) => room.id === id)) id += "-neu";
      candidate.rooms.push({
        id,
        name: "Neuer Raum",
        x: Math.max(...candidate.rooms.map((room) => room.x + room.width)),
        z: 0,
        width: 4,
        depth: 4,
      });
      this.commit(candidate);
    });
    this.root.querySelector(".add-entity")!.addEventListener("click", () => {
      const candidate = structuredClone(this.config);
      const available = Object.keys(this.homeAssistant?.states ?? {})
        .sort()
        .find(
          (id) => !candidate.entities.some((binding) => binding.entity === id),
        );
      if (!available) {
        this.error(
          "Keine weitere HA-Entität verfügbar. Du kannst Zuordnungen auch im YAML-Editor anlegen.",
        );
        return;
      }
      const room = candidate.rooms[0];
      candidate.entities.push({
        entity: available,
        room: room.id,
        x: room.width / 2,
        z: room.depth / 2,
      });
      this.commit(candidate);
    });
    this.root
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement
      >(".general input,.room input,.room select,.binding input,.binding select,.building input,.building select,.building textarea")
      .forEach((input) =>
        input.addEventListener("change", () => this.readForm()),
      );
    this.setupImport();
    this.updateOptions();
  }

  private updateOptions() {
    const list = this.root.querySelector("datalist");
    if (!list) return;
    list.replaceChildren();
    for (const [id, entity] of Object.entries(
      this.homeAssistant?.states ?? {},
    ).slice(0, 5000)) {
      const option = document.createElement("option");
      option.value = id;
      if (typeof entity?.attributes.friendly_name === "string")
        option.label = entity.attributes.friendly_name;
      list.append(option);
    }
  }

  private readForm() {
    const get = (root: ParentNode, name: string) =>
      root.querySelector<HTMLInputElement | HTMLSelectElement>(
        `[name="${name}"]`,
      )!.value;
    const candidate = structuredClone(this.config);
    candidate.title = get(this.root.querySelector(".general")!, "title");
    candidate.height = Number(
      get(this.root.querySelector(".general")!, "height"),
    );
    const previousRooms = this.config.rooms;
    candidate.rooms = [...this.root.querySelectorAll<HTMLElement>(".room")].map(
      (item, index) => ({
        ...(previousRooms[index].polygon
          ? { polygon: previousRooms[index].polygon }
          : {}),
        elevation: Number(get(item, "elevation")),
        kind: get(item, "kind") as "interior" | "garden" | "terrace",
        id: get(item, "id"),
        name: get(item, "name"),
        x: Number(get(item, "x")),
        z: Number(get(item, "z")),
        width: Number(get(item, "width")),
        depth: Number(get(item, "depth")),
      }),
    );
    candidate.entities = [
      ...this.root.querySelectorAll<HTMLElement>(".binding"),
    ].map((item) => {
      const roomId = get(item, "room");
      const oldIndex = previousRooms.findIndex((room) => room.id === roomId);
      return {
        entity: get(item, "entity"),
        room: oldIndex >= 0 ? candidate.rooms[oldIndex].id : roomId,
        ...(get(item, "name").trim() ? { name: get(item, "name") } : {}),
        x: Number(get(item, "x")),
        z: Number(get(item, "z")),
      };
    });
    candidate.building = {
      wall_height: Number(
        get(this.root.querySelector(".building")!, "wall_height"),
      ),
      roof_height: Number(
        get(this.root.querySelector(".building")!, "roof_height"),
      ),
      roof: get(this.root.querySelector(".building")!, "roof") as
        | "flat"
        | "gable"
        | "none",
      openings: [...this.root.querySelectorAll(".opening")].map((row) => ({
        wall: get(row, "wall"),
        offset: Number(get(row, "offset")),
        width: Number(get(row, "width")),
        height: Number(get(row, "height")),
        sill: Number(get(row, "sill")),
      })),
    };
    candidate.plants = [...this.root.querySelectorAll(".plant")].map((row) => ({
      id: get(row, "id"),
      kind: get(row, "kind") as "tree" | "shrub" | "pot" | "bed",
      x: Number(get(row, "x")),
      z: Number(get(row, "z")),
      size: Number(get(row, "size")),
      elevation: Number(get(row, "elevation")),
    }));
    this.commit(candidate);
  }

  private setupImport() {
    const result = this.root.querySelector(".import-preview")!,
      apply = this.root.querySelector<HTMLButtonElement>(".apply-import")!;
    this.preview = undefined;
    this.importGeneration++;
    const invalidate = () => {
      this.importGeneration++;
      this.preview = undefined;
      apply.disabled = true;
      result.replaceChildren();
    };
    this.root
      .querySelectorAll(".import input,.import select")
      .forEach((i) => i.addEventListener("change", invalidate));
    this.root
      .querySelector(".cancel-import")!
      .addEventListener("click", invalidate);
    this.root
      .querySelector(".preview-import")!
      .addEventListener("click", async () => {
        invalidate();
        const generation = this.importGeneration;
        try {
          const file =
            this.root.querySelector<HTMLInputElement>(".import-file")!
              .files?.[0];
          if (!file) throw new Error("Bitte eine Datei auswählen.");
          if (file.size > 2_000_000)
            throw new Error("Datei ist größer als 2 MB.");
          const unit = this.root.querySelector<HTMLSelectElement>(
            ".import-unit",
          )!.value as "m" | "cm" | "mm";
          const rotation = Number(
            this.root.querySelector<HTMLSelectElement>(".import-rotation")!
              .value,
          ) as 0 | 90 | 180 | 270;
          const scale = Number(
            this.root.querySelector<HTMLInputElement>(".import-scale")!.value,
          );
          const source = await file.text();
          if (generation !== this.importGeneration) return;
          const preview = previewImport(
            source,
            file.name.toLowerCase().endsWith(".dxf") ? "dxf" : "json",
            { unit, rotation, scale },
          );
          this.preview = preview;
          const info = document.createElement("p");
          info.textContent = `${preview.rooms.length} Räume · ${preview.plan.walls.length} Wände · ${preview.width.toFixed(2)} × ${preview.depth.toFixed(2)} m. ${preview.warnings.join(" ")}`;
          result.append(info);
          const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg",
          );
          const points = [
            ...preview.rooms.flatMap((r) => r.polygon!),
            ...preview.plan.walls.flatMap((w) => [w.start, w.end]),
          ];
          const minX = Math.min(...points.map((p) => p.x)),
            minZ = Math.min(...points.map((p) => p.z));
          svg.setAttribute(
            "viewBox",
            `${minX - 0.5} ${minZ - 0.5} ${preview.width + 1} ${preview.depth + 1}`,
          );
          svg.setAttribute("height", "200");
          svg.setAttribute("width", "100%");
          svg.setAttribute(
            "aria-label",
            "Importvorschau, X nach rechts und Z nach unten",
          );
          for (const room of preview.rooms) {
            const polygon = document.createElementNS(
              svg.namespaceURI,
              "polygon",
            );
            polygon.setAttribute(
              "points",
              room.polygon!.map((p) => `${p.x},${p.z}`).join(" "),
            );
            polygon.setAttribute("fill", "#1582b833");
            polygon.setAttribute("stroke", "#1582b8");
            polygon.setAttribute("stroke-width", ".06");
            svg.append(polygon);
          }
          for (const wall of preview.plan.walls) {
            const line = document.createElementNS(svg.namespaceURI, "line");
            for (const [key, value] of Object.entries({
              x1: wall.start.x,
              y1: wall.start.z,
              x2: wall.end.x,
              y2: wall.end.z,
              "stroke-width": wall.thickness,
            }))
              line.setAttribute(key, String(value));
            line.setAttribute("stroke", "#526477");
            svg.append(line);
          }
          result.append(svg);
          const check = () => {
            try {
              applyImport(this.config, preview, this.importBindings());
              apply.disabled = false;
              conflicts.textContent =
                "Zuordnungen geprüft. Erst „Grundriss übernehmen“ speichert die Änderung.";
            } catch (error) {
              apply.disabled = true;
              conflicts.textContent =
                "Übernahme gesperrt: " +
                (error instanceof Error
                  ? error.message
                  : "Zuordnungen prüfen.") +
                " Zielraum und Positionen unten korrigieren. Öffnungen gegebenenfalls vor dem Import anpassen.";
            }
          };
          const targets = [
            ...preview.rooms,
            ...this.config.rooms.filter(
              (r) => r.kind === "garden" || r.kind === "terrace",
            ),
          ];
          for (const binding of this.config.entities) {
            const row = document.createElement("div");
            row.className = "import-binding item grid";
            const title = document.createElement("span");
            title.textContent = binding.name ?? binding.entity;
            row.append(
              title,
              this.select(
                "Zielraum",
                "room",
                [["", "Bitte zuordnen"], ...targets.map((r) => [r.id, r.name])],
                targets.some((r) => r.id === binding.room) ? binding.room : "",
              ),
              this.input("X im Zielraum (m)", "x", binding.x, "number"),
              this.input("Z im Zielraum (m)", "z", binding.z, "number"),
            );
            row
              .querySelectorAll("input,select")
              .forEach((i) => i.addEventListener("change", check));
            result.append(row);
          }
          const conflicts = document.createElement("p");
          conflicts.className = "import-conflicts";
          conflicts.setAttribute("role", "status");
          result.append(conflicts);
          check();
        } catch (error) {
          this.error(
            error instanceof Error ? error.message : "Import fehlgeschlagen.",
          );
        }
      });
    apply.addEventListener("click", () => {
      if (this.preview) {
        try {
          this.commit(
            applyImport(this.config, this.preview, this.importBindings()),
          );
        } catch (error) {
          this.error(
            error instanceof Error ? error.message : "Import fehlgeschlagen.",
          );
        }
      }
    });
  }

  private importBindings() {
    return this.config.entities.map((binding, i) => {
      const row = this.root.querySelectorAll(".import-binding")[i];
      if (!row) return binding;
      return {
        ...binding,
        room: row.querySelector<HTMLSelectElement>("select")!.value,
        x: Number(row.querySelector<HTMLInputElement>('[name="x"]')!.value),
        z: Number(row.querySelector<HTMLInputElement>('[name="z"]')!.value),
      };
    });
  }

  private commit(candidate: unknown) {
    try {
      this.config = parseConfig(candidate);
      this.render();
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: structuredClone(this.config) },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (error) {
      this.error(
        error instanceof Error ? error.message : "Ungültige Konfiguration.",
      );
    }
  }
  private error(message: string) {
    const node = this.root.querySelector(".error");
    if (node) node.textContent = message;
  }
}
