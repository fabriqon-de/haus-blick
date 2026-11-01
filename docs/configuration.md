# Konfiguration

Editor und YAML verwenden dasselbe validierte Format; Home Assistant speichert es im Dashboard.

| Feld | Bedeutung |
| --- | --- |
| `type` | `custom:haus-blick-card` |
| `title` | Überschrift, Standard Haus Blick |
| `height` | 240–900 Pixel für die 3D-Ansicht, Standard 420 |
| `rooms` | 1–50 rechteckige Räume; ohne Angabe wird ein Beispielgrundriss verwendet |
| `entities` | Bis zu 200 Zuordnungen, Standard leer |

Räume: `id`, `name`, `x`, `z`, `width`, `depth`. X/Z sind die Raumecke im gemeinsamen Hauskoordinatensystem, Maße in Metern, Breite/Tiefe 0,5–100. Wände werden bei 0,7 m abgeschnitten, damit Sensoren im offenen Modell sichtbar sind. Dies ist keine Angabe tatsächlicher Wandhöhen. Überlappungen sowie Tür-/Fensteröffnungen werden nicht automatisch korrigiert.

Zuordnung: `entity`, `room`, optional `name`, `x`, `z`. X/Z sind relativ zur Raumecke und müssen innerhalb der Raummaße liegen; Standard Raummitte. Jede Entität wird einmal zugeordnet. Vor dem Löschen eines belegten Raums Zuordnungen umhängen oder entfernen.

Die Karte liest vorhandene Entitäten über `hass.states`. Namen kommen aus `friendly_name`, sofern nicht überschrieben. HA formatiert Werte, wenn sein Helfer vorhanden ist; sonst lokale Zahlenformatierung und Einheit. Unbekannte, nicht verfügbare und fehlende Zustände bleiben unterscheidbar. Aktive Lichter/Kontakte sind hervorgehoben, offene Tür-/Fensterkontakte rot; Text ergänzt jede Farbe.

Ein Klick sendet `hass-more-info` für die entsprechende Entität. Die Karte schaltet keine Geräte und sendet keine MQTT-Nachrichten. HA entscheidet anhand von Entität, Berechtigungen und Recorder-Konfiguration über verfügbare Dialogfunktionen.

Lovelace-Felder `grid_options`, `visibility`, `view_layout` bleiben erhalten. Zugangsdaten und Backend-/Broker-Adressen sind keine Kartenoptionen.
