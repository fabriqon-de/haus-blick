# Roadmap

Die erste HACS-Karte stellt vorhandene HA-Entitäten in rechteckigen Räumen mit niedrigen Schnittwänden dar. Vollständige Gebäudehüllen, Dächer, Zeichnungsimport und Außenbereiche sind weitere Vorhaben, keine bereits ausgelieferten Funktionen.

1. Erste Karte in einer tatsächlichen HA-/HACS-Instanz abnehmen und Bedienung verbessern.
2. [Grundriss importieren und Wände/Räume übernehmen (#2)](https://github.com/fabriqon-de/haus-blick/issues/2): wiederhergestellte Idee aus dem gelöschten früheren Issue #7. Zunächst begrenzte vorbereitete DXF-/Modellformate, Einheiten-/Geometrieprüfung und Vorschau; vorhandene Entitätszuordnungen bei Reimport erhalten. Nicht rechteckige Räume benötigen eine bewusste Erweiterung des aktuellen Kartenformats.
3. [Vollständiges 3D-Haus mit Dach (#3)](https://github.com/fabriqon-de/haus-blick/issues/3): echte Wand-/Geschosshöhen, Türen, Fenster und zunächst einfache Dachformen. Außenansicht, offene Innenansicht und Grundriss umschalten; Dach und verdeckende Wände ausblendbar halten. Mehrere Etagen vorbereiten.
4. [Terrasse und Garten mit Pflanzen (#4)](https://github.com/fabriqon-de/haus-blick/issues/4): Grundstück, Terrasse, Beete, Bäume, Sträucher und Topfpflanzen als leichte 3D-Objekte. Bestehende HA-Entitäten wie Bodenfeuchte, Außentemperatur und Bewässerungszustand zuordnen.

Gebäudestruktur, dekorative Objekte und Messpunkte bleiben getrennt. Mobile Leistung, verständliche Beschriftungen und der Zugriff auf Sensoren auch bei sichtbarem Dach gehören zur Abnahme. Konfiguration bleibt im HA-Dashboard; ein zusätzlicher Server wird erst bei einem konkreten, vom Frontend nicht abgedeckten Bedarf erwogen.

Eine eigene MCP-Anbindung für Haus Blick ist nicht vorgesehen. Eine etwaige MCP-Bereitstellung liegt bei Home Assistant beziehungsweise dessen Integration. Eine eigene MQTT-Anbindung ist für vorhandene HA-Entitäten ebenfalls nicht erforderlich.
