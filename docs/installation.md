# Installation und Updates

Als benutzerdefiniertes HACS-Repository `https://github.com/fabriqon-de/haus-blick` mit Kategorie Dashboard hinzufügen und herunterladen. Ein offizieller HACS-Verzeichniseintrag wird nicht vorausgesetzt. HACS verwendet `dist/haus-blick.js`; ohne GitHub Release wird der Hauptzweig verwendet. Ein späterer Release muss zur gebauten Distribution passen. Ein Git-Tag allein ist kein Release.

Ressource `/hacsfiles/haus-blick/haus-blick.js` als JavaScript-Modul registrieren, sofern HACS das nicht bereits erledigt hat. Bei YAML-verwalteten Ressourcen in den vorhandenen `lovelace.resources`-Abschnitt integrieren:

```yaml
lovelace:
  resources:
    - url: /hacsfiles/haus-blick/haus-blick.js
      type: module
```

Browser neu laden und Karte über den Kartenwähler oder `type: custom:haus-blick-card` hinzufügen.

## Manuell / PR testen

`dist/haus-blick.js` aus dem vorgesehenen Branch nach `config/www/haus-blick.js` kopieren und `/local/haus-blick.js` als Modul registrieren. Bei Updates ggf. `?v=0.1.0` zur Cache-Erneuerung verwenden. Manuelle und HACS-Ressource nicht gleichzeitig laden.

## Fehlersuche

- Custom element fehlt: Modul-Ressource und HTTP 200 für die JS-Datei prüfen, Browsercache erneuern.
- Entität fehlt: Exakte ID in Entwicklerwerkzeuge → Zustände prüfen. Die Karte erstellt keine Entitäten.
- Verlauf fehlt: Der normale HA-Dialog kann nur tatsächlich aufgezeichnete HA-Verläufe anzeigen.
- WebGL fehlt: Browser/GPU prüfen; Entitätsliste und Details bleiben nutzbar.
- Ungültige Position: X/Z sind lokale Meterwerte innerhalb des Raums.

Updates über HACS beziehen und Browser neu laden. Räume/Zuordnungen stehen in der Dashboard-Konfiguration; diese über die üblichen HA-Sicherungen sichern. Entfernen der Karte löscht keine HA-Entitäten.

Referenzen: [HACS Dashboard-Plugins](https://www.hacs.dev/docs/publish/plugin/), [HA Custom Cards](https://contributors.home-assistant.io/frontend/custom-ui/card/).
