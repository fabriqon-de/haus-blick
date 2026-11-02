# Konfiguration

Editor und YAML verwenden dasselbe validierte Format; Home Assistant speichert es im Dashboard.

| Feld | Bedeutung |
| --- | --- |
| `type` | `custom:haus-blick-card` |
| `title` | Überschrift, Standard Haus Blick |
| `height` | 240–900 Pixel für die 3D-Ansicht, Standard 420 |
| `rooms` | 1–50 Räume / Außenflächen; ohne Angabe wird ein Beispielgrundriss verwendet |
| `entities` | Bis zu 200 Zuordnungen, Standard leer |

Räume: `id`, `name`, `x`, `z`, `width`, `depth`. X/Z sind die Raumecke im gemeinsamen Hauskoordinatensystem, Maße in Metern, Breite/Tiefe 0,5–100. Optional: `polygon` (absolute X/Z-Kontur, maximal 128 Punkte), `elevation` (0–30 m) und `kind` (`interior`, `garden`, `terrace`). Konturpunkte müssen innerhalb der angegebenen Raummaße liegen. Sensoren müssen innerhalb der tatsächlichen Kontur liegen. Bei L-förmigen Räumen ist nicht jede Stelle im umschließenden Rechteck gültig.

`building`: `wall_height` (Standard 2,7 m, 1–6 m), `roof` (`flat`, `gable`, `none`), `roof_height` (Standard 1,2 m). In der Außenansicht erscheinen volle Wände und Dächer; innen werden Wände bei 0,7 m abgeschnitten und Dächer ausgeblendet, im Grundriss bleiben 6 cm hohe Wandlinien. Die Geschossauswahl zeigt eine Elevation oder alle. Die Liste bleibt auch bei sichtbarem Dach vollständig bedienbar.

`building.openings`: Liste aus `wall`, `offset`, `width`, `height`, `sill`. Alle Maße in Metern; `offset` ab dem angezeigten Wandanfang, `sill: 0` ergibt eine Türöffnung, positive Brüstung ergibt ein Fenster mit Glasfläche. Öffnungen dürfen sich nicht überschneiden und müssen vollständig in eine existierende Wand passen. Wand-IDs und ihre Start-/Endpunkte zeigt der Editor. Bei manuellen Räumen werden sie aus der Raumreihenfolge erzeugt: Nach Umordnen oder Entfernen von Räumen Zuordnung prüfen. Importierte Wand-IDs bleiben im gespeicherten `drawing` erhalten.

`plants`: maximal 100 Objekte mit `id`, `kind` (`tree`, `shrub`, `pot`, `bed`), absoluten `x`, `z`, `size` (0,2–5 m) und optional `elevation`. Garten-/Terrassenflächen sind Räume mit entsprechendem `kind`; sie bekommen keine Hauswände oder Dächer. Entitäten wie Bodenfeuchte, Außentemperatur und Bewässerung werden diesen Flächen genauso wie Innenräumen zugeordnet. Pflanzen sind dekorative Modelle; ihre Gesundheit wird nicht automatisch abgeleitet. Sensorzustände und native HA-Details sind getrennt davon.

Dächer werden je Innenraum aus der genauen Kontur erzeugt, Satteldächer haben den First entlang der Z-Achse. Sie ersetzen keine architektonische Dachplanung. Gemeinsame Wände werden bei exakt gleichen Endpunkten und gleicher Elevation dedupliziert; teilweise überlappende Kanten werden nicht automatisch geteilt. Die Karte korrigiert weder Raumüberlappungen noch falsche Geschoss-/Wandpläne. Bei mehreren Geschossen für die offene Innenansicht ein einzelnes Geschoss auswählen.

Bis zu 500 Wände und 100 Öffnungen sind erlaubt. Importierte Pläne liegen auf Elevation 0; neue manuelle Räume können andere Geschosse bilden. Importierte IDs/Konturen werden über einen erneuten Import geändert. [Importanleitung](import.md) und [vollständiges Beispiel](../examples/house-garden.json).

Zuordnung: `entity`, `room`, optional `name`, `x`, `z`. X/Z sind relativ zur Raumecke und müssen innerhalb der Raummaße liegen; Standard Raummitte. Jede Entität wird einmal zugeordnet. Vor dem Löschen eines belegten Raums Zuordnungen umhängen oder entfernen.

Die Karte liest vorhandene Entitäten über `hass.states`. Namen kommen aus `friendly_name`, sofern nicht überschrieben. HA formatiert Werte, wenn sein Helfer vorhanden ist; sonst lokale Zahlenformatierung und Einheit. Unbekannte, nicht verfügbare und fehlende Zustände bleiben unterscheidbar. Aktive Lichter/Kontakte sind hervorgehoben, offene Tür-/Fensterkontakte rot; Text ergänzt jede Farbe.

Ein Klick sendet `hass-more-info` für die entsprechende Entität. Die Karte schaltet keine Geräte und sendet keine MQTT-Nachrichten. HA entscheidet anhand von Entität, Berechtigungen und Recorder-Konfiguration über verfügbare Dialogfunktionen.

Lovelace-Felder `grid_options`, `visibility`, `view_layout` bleiben erhalten. Zugangsdaten und Backend-/Broker-Adressen sind keine Kartenoptionen.
