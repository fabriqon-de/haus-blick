# Grundriss lokal importieren

Im Karteneditor eine Datei auswählen, DXF-Einheit, Drehung (0/90/180/270°) und zusätzlichen Maßstab setzen, dann **Vorschau erstellen**. Angezeigt werden Konturen, Wände, Raum-/Wandanzahl und Gesamtmaße in Metern. Die Datei wird ausschließlich im Browser gelesen und nicht hochgeladen.

Unterstützt werden vorbereitete **ASCII DXF** und das versionierte **Fabriqon DrawingPlan JSON** (`schemaVersion: 1`, `unit: m`). JSON ist immer in Metern; das Einheitenfeld betrifft DXF. Ein zusätzlicher Maßstab skaliert auch Wandhöhen/-dicken, deshalb danach Plausibilität prüfen. Standard: 1. DXF-X bleibt X, DXF-Y wird zu -Z. Die Vorschau zeigt X nach rechts und Z nach unten; Rotation erfolgt um den Ursprung.

DXF: Wände als LINE oder gerade LWPOLYLINE auf `WALL`, `WALLS` oder `MAUERN`; geschlossene Raumkonturen als LWPOLYLINE auf `ROOM`, `ROOMS`, `RAUM`, `RAEUME` oder `ROOM:Wohnzimmer`. Ohne explizite Wände werden Konturkanten als Wände erzeugt. JSON ohne Wände erzeugt ebenfalls Konturkanten. Ohne geschlossene Räume wird der Import abgelehnt. Andere DXF-Layer liefern Warnungen; Kurven, nicht ebene Geometrie und nicht unterstützte Elemente auf relevanten Layern werden abgelehnt. Keine stillen Rechteck-Ersatzkonturen für L-förmige Räume.

[JSON-Beispiel](../examples/floor-plan.json) herunterladen. Kein IFC/BIM, DWG, PDF, Foto oder GLTF-Import in dieser Version. Maximal 2 MB, 50 Räume, 500 Wände und 128 Konturpunkte pro Raum; räumliche Grenzen wie in der Kartenkonfiguration. Die erste Importversion ersetzt den Innenraumplan mit einer Ebene auf 0 m. Bereits konfigurierte Garten-/Terrassenflächen und Pflanzen bleiben erhalten.

Vorhandene Entitäten bleiben erhalten. In der Vorschau Zielraum und relative X/Z-Position jeder Entität prüfen, bei geänderten IDs zuordnen. Ungültige Raumreferenzen, Positionen außerhalb der Kontur und nicht passende vorhandene Tür-/Fensteröffnungen sperren die Übernahme. Öffnungen gegebenenfalls vor dem Import ausdrücklich im Editor anpassen. **Verwerfen** ändert die Karte nicht. Erst **Grundriss übernehmen** sendet die validierte Konfiguration an HA; anschließend das Dashboard speichern.

DXF-Raum-IDs entstehen aus der Reihenfolge im Plan. Nach Änderung der Reihenfolge oder größerer Geometrieänderung müssen Zuordnungen deshalb bewusst geprüft werden. Ein Neuimport verschiebt Sensoren nicht automatisch anhand von Namen. Neutralem JSON stabile IDs geben.
