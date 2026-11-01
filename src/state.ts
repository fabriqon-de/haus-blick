import type { Binding, HomeAssistant } from './types';
export interface EntityView { name: string; value: string; status: 'ready' | 'active' | 'unknown' | 'unavailable' | 'missing' | 'waiting'; color: number }

export function entityView(binding: Binding, hass?: HomeAssistant): EntityView {
  const entity = hass?.states[binding.entity];
  const name = binding.name ?? (typeof entity?.attributes.friendly_name === 'string' ? entity.attributes.friendly_name.slice(0, 120) : binding.entity);
  const base = { name, color: 0x64748b };
  if (!hass) return { ...base, value: 'Warte auf Home Assistant', status: 'waiting' };
  if (!entity) return { ...base, value: 'Entität nicht gefunden', status: 'missing' };
  if (entity.state === 'unavailable') return { ...base, value: 'Nicht verfügbar', status: 'unavailable' };
  if (entity.state === 'unknown') return { ...base, value: 'Unbekannt', status: 'unknown' };
  let value = entity.state.slice(0, 120);
  try {
    if (hass.formatEntityState) value = String(hass.formatEntityState(entity)).slice(0, 160);
    else {
      const numeric = Number(entity.state);
      if (entity.state.trim() && Number.isFinite(numeric)) value = new Intl.NumberFormat(hass.locale?.language ?? hass.language ?? 'de', { maximumFractionDigits: 3 }).format(numeric);
      const unit = entity.attributes.unit_of_measurement;
      if (typeof unit === 'string') value += ' ' + unit.slice(0, 32);
    }
  } catch { /* A formatting helper must not break the dashboard. */ }
  const active = ['on', 'open', 'opening', 'unlocked', 'detected', 'home'].includes(entity.state);
  const alert = active && ['door', 'window', 'opening', 'safety', 'smoke', 'gas', 'problem'].includes(String(entity.attributes.device_class));
  return { name, value, status: active ? 'active' : 'ready', color: alert ? 0xef4444 : active ? 0xf59e0b : 0x1582b8 };
}
