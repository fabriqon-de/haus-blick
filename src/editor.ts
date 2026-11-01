import { parseConfig, stubConfig } from './config';
import type { CardConfig, HomeAssistant } from './types';

const CSS = `:host{display:block;color:var(--primary-text-color,#172735);font-family:inherit}*{box-sizing:border-box}h3{font-size:15px;margin:20px 0 10px}label{display:grid;gap:5px;font-size:12px;margin-bottom:10px}input,select,button{font:inherit;color:inherit;min-height:38px;padding:7px 9px;border:1px solid var(--divider-color,#cbd5e1);border-radius:7px;background:var(--card-background-color,#fff)}input,select{width:100%;min-width:0}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #f59e0b}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.item{padding:12px;margin:8px 0;border:1px solid var(--divider-color,#cbd5e1);border-radius:10px}.wide{grid-column:1/-1}.error{color:var(--error-color,#b91c1c);white-space:pre-wrap;font-size:13px}.help{font-size:12px;line-height:1.6;color:var(--secondary-text-color,#64748b)}.remove{font-size:12px}.add{margin-top:6px}`;

export class HausBlickEditor extends HTMLElement {
  private config: CardConfig = stubConfig();
  private homeAssistant?: HomeAssistant;
  private root = this.attachShadow({ mode: 'open' });
  private optionsSignature = '';

  setConfig(input: unknown) { this.config = parseConfig(input); this.render(); }
  set hass(value: HomeAssistant | undefined) {
    this.homeAssistant = value;
    const signature = Object.keys(value?.states ?? {}).sort().join('|');
    if (signature !== this.optionsSignature) { this.optionsSignature = signature; this.updateOptions(); }
  }
  get hass(): HomeAssistant | undefined { return this.homeAssistant; }
  connectedCallback() { this.render(); }

  private input(label: string, name: string, value: string | number, type = 'text'): HTMLLabelElement {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    const input = document.createElement('input'); input.name = name; input.type = type; input.value = String(value);
    if (type === 'number') input.step = 'any';
    if (name === 'entity') { input.setAttribute('list', 'ha-entities'); input.autocomplete = 'off'; }
    wrapper.append(input); return wrapper;
  }

  private render() {
    // hass updates only refresh suggestions; this method is for actual configuration changes.
    this.root.innerHTML = `<style>${CSS}</style><div class="general grid"></div>
      <p class="help">Räume und Positionen in Metern. Sensorpositionen sind relativ zur linken unteren Ecke des zugeordneten Raums. Werte kommen aus Home Assistant.</p>
      <h3>Räume</h3><div class="rooms"></div><button class="add-room add" type="button">Raum hinzufügen</button>
      <h3>Entitäten zuordnen</h3><datalist id="ha-entities"></datalist><div class="bindings"></div><button class="add-entity add" type="button">Entität hinzufügen</button>
      <p class="error" role="alert"></p><p class="help">Home Assistant speichert diese Konfiguration mit dem Dashboard. Es wird keine zusätzliche Verbindung zum Broker oder zu einer Datenbank aufgebaut.</p>`;
    this.root.querySelector('.general')!.append(this.input('Titel', 'title', this.config.title), this.input('3D-Höhe (Pixel)', 'height', this.config.height, 'number'));
    this.config.rooms.forEach((room, index) => {
      const item = document.createElement('div'); item.className = 'item room'; item.dataset.index = String(index);
      const grid = document.createElement('div'); grid.className = 'grid';
      grid.append(this.input('Raum-ID', 'id', room.id), this.input('Name', 'name', room.name), this.input('X', 'x', room.x, 'number'), this.input('Z', 'z', room.z, 'number'), this.input('Breite', 'width', room.width, 'number'), this.input('Tiefe', 'depth', room.depth, 'number'));
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Raum entfernen'; remove.className = 'remove';
      remove.addEventListener('click', () => {
        const candidate = structuredClone(this.config);
        candidate.rooms.splice(index, 1);
        this.commit(candidate);
      });
      item.append(grid, remove); this.root.querySelector('.rooms')!.append(item);
    });
    this.config.entities.forEach((binding, index) => {
      const item = document.createElement('div'); item.className = 'item binding'; item.dataset.index = String(index);
      const grid = document.createElement('div'); grid.className = 'grid';
      grid.append(this.input('Entitäts-ID', 'entity', binding.entity), this.input('Anzeigename (optional)', 'name', binding.name ?? ''));
      const label = document.createElement('label'); label.textContent = 'Raum';
      const select = document.createElement('select'); select.name = 'room';
      this.config.rooms.forEach(room => { const option = document.createElement('option'); option.value = room.id; option.textContent = room.name; select.append(option); });
      select.value = binding.room; label.append(select); grid.append(label);
      grid.append(this.input('X im Raum', 'x', binding.x, 'number'), this.input('Z im Raum', 'z', binding.z, 'number'));
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Zuordnung entfernen'; remove.className = 'remove';
      remove.addEventListener('click', () => { const candidate = structuredClone(this.config); candidate.entities.splice(index, 1); this.commit(candidate); });
      item.append(grid, remove); this.root.querySelector('.bindings')!.append(item);
    });
    this.root.querySelector('.add-room')!.addEventListener('click', () => {
      const candidate = structuredClone(this.config);
      let id = 'raum-' + (candidate.rooms.length + 1);
      while (candidate.rooms.some(room => room.id === id)) id += '-neu';
      candidate.rooms.push({ id, name: 'Neuer Raum', x: Math.max(...candidate.rooms.map(room => room.x + room.width)), z: 0, width: 4, depth: 4 });
      this.commit(candidate);
    });
    this.root.querySelector('.add-entity')!.addEventListener('click', () => {
      const candidate = structuredClone(this.config);
      const available = Object.keys(this.homeAssistant?.states ?? {}).sort().find(id => !candidate.entities.some(binding => binding.entity === id));
      if (!available) { this.error('Keine weitere HA-Entität verfügbar. Du kannst Zuordnungen auch im YAML-Editor anlegen.'); return; }
      const room = candidate.rooms[0];
      candidate.entities.push({ entity: available, room: room.id, x: room.width / 2, z: room.depth / 2 });
      this.commit(candidate);
    });
    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select').forEach(input => input.addEventListener('change', () => this.readForm()));
    this.updateOptions();
  }

  private updateOptions() {
    const list = this.root.querySelector('datalist'); if (!list) return;
    list.replaceChildren();
    for (const [id, entity] of Object.entries(this.homeAssistant?.states ?? {}).slice(0, 5000)) {
      const option = document.createElement('option'); option.value = id;
      if (typeof entity?.attributes.friendly_name === 'string') option.label = entity.attributes.friendly_name;
      list.append(option);
    }
  }

  private readForm() {
    const get = (root: ParentNode, name: string) => root.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!.value;
    const candidate = structuredClone(this.config);
    candidate.title = get(this.root.querySelector('.general')!, 'title');
    candidate.height = Number(get(this.root.querySelector('.general')!, 'height'));
    const previousRooms = this.config.rooms;
    candidate.rooms = [...this.root.querySelectorAll<HTMLElement>('.room')].map(item => ({ id: get(item, 'id'), name: get(item, 'name'), x: Number(get(item, 'x')), z: Number(get(item, 'z')), width: Number(get(item, 'width')), depth: Number(get(item, 'depth')) }));
    candidate.entities = [...this.root.querySelectorAll<HTMLElement>('.binding')].map(item => {
      const roomId = get(item, 'room');
      const oldIndex = previousRooms.findIndex(room => room.id === roomId);
      return { entity: get(item, 'entity'), room: oldIndex >= 0 ? candidate.rooms[oldIndex].id : roomId,
        ...(get(item, 'name').trim() ? { name: get(item, 'name') } : {}), x: Number(get(item, 'x')), z: Number(get(item, 'z')) };
    });
    this.commit(candidate);
  }

  private commit(candidate: unknown) {
    try {
      this.config = parseConfig(candidate);
      this.render();
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: structuredClone(this.config) }, bubbles: true, composed: true }));
    } catch (error) { this.error(error instanceof Error ? error.message : 'Ungültige Konfiguration.'); }
  }
  private error(message: string) { const node = this.root.querySelector('.error'); if (node) node.textContent = message; }
}
