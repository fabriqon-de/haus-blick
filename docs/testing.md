# Tests und reale Abnahme

Unit-Tests prüfen Konfigurationsgrenzen, Dimensionen, Raumreferenzen, doppelte/ungültige Entitäten, getrennte Kopien, Ressourcengrenzen und unterschiedliche HA-Zustände.

Browser-Tests laden das echte Bundle und den echten WebGL-Viewer in einem synthetischen HA-Host. Sie prüfen Zustandsänderungen bei erhaltener Canvas, mehr-info-/Konfigurationsereignisse, Editorfehler, Textbehandlung, Fallback, GPU-Freigabe/Wiedereinfügen, Kontextverlust, mobile Bedienung und das Ausbleiben externer Requests. Keine echten Zugangsdaten oder Sensordaten.

CI prüft Node 22/24, Paket und reproduzierbare Distribution sowie die offizielle HACS-Validierung als Kategorie plugin.

Zusätzlich prüfen Tests konkave Importkonturen und fehlende Raumbereiche, DXF-Einheiten/Drehung, Dateigrenzen, Reimportkonflikte, Wandöffnungen, Dachfirste, Geschossfilter, Gartenmarker und wiederholte Modellwechsel ohne wachsenden GPU-Geometriebestand. Browsertests prüfen Vorschau, Verwerfen, bewusstes Übernehmen und Neu-Zuordnung von Entitäten.

## Auf echter HA-/HACS-Instanz noch prüfen

Versionsnummern von HA, HACS, Browser/Companion App und Ergebnis festhalten:

- Benutzerdefiniertes Repository herunterladen und Modul-Ressource prüfen.
- Karte im Kartenwähler hinzufügen, echte Temperatur-, Licht- und Kontaktentitäten auswählen.
- Raummaße/Positionen ändern, Dashboard speichern und nach vollständigem Neuladen prüfen.
- Echte Zustandsänderungen und unbekannte/nicht verfügbare Entitäten prüfen.
- Mehr-info und Verlauf mit Recorder sowie die vorhandenen HA-Bedienelemente prüfen.
- Mobile Touch-Bedienung und schmalen Dashboard-Abschnitt testen.
- Eigenen vorbereiteten Grundriss importieren, Maßstab/Drehung und Sensorzuordnung prüfen, speichern und HA neu laden.
- Dach, Türen/Fenster, einzelne Geschosse und Garten mit realen Außensensoren auf Desktop und Mobilgerät prüfen.
- Karte entfernen/wiedereinfügen, HACS-Update und HA-Sicherung/Wiederherstellung testen.

Ein grüner Browsertest oder HACS-Validator beweist keine erfolgreiche Installation in deiner tatsächlichen HA-Instanz.
