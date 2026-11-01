import { HausBlickCard } from './card';
import { HausBlickEditor } from './editor';

if (!customElements.get('haus-blick-card')) customElements.define('haus-blick-card', HausBlickCard);
if (!customElements.get('haus-blick-card-editor')) customElements.define('haus-blick-card-editor', HausBlickEditor);
window.customCards = window.customCards ?? [];
if (!window.customCards.some(card => card.type === 'haus-blick-card')) window.customCards.push({
  type: 'haus-blick-card', name: 'Haus Blick',
  description: 'Vorhandene Home-Assistant-Entitäten im 3D-Hausmodell.', preview: true,
  documentationURL: 'https://github.com/fabriqon-de/haus-blick#readme'
});
console.info(`Haus Blick ${__HAUS_BLICK_VERSION__} · HACS dashboard card · Fabriqon`);
