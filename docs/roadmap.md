# Roadmap

Version 0.2.0 implementiert die ersten Ausbaustufen von [Grundrissimport (#2)](https://github.com/fabriqon-de/haus-blick/issues/2), [3D-Haus (#3)](https://github.com/fabriqon-de/haus-blick/issues/3) und [Garten (#4)](https://github.com/fabriqon-de/haus-blick/issues/4): vorbereitete DXF-/JSON-Pläne mit echten Konturen und Zuordnungsprüfung, Wandöffnungen, einfache Dächer, Ansichten und Geschosshöhen sowie Garten-/Terrassenflächen und Pflanzen mit getrennten HA-Messpunkten.

Als Nächstes reale HA-/HACS- und Companion-App-Abnahme mit eigenen Grundrissen. Danach anhand dieser Erfahrungen weitere Importformate, zusammenhängende Dächer über mehrere Räume und ein komfortabler Zeichen-/Platzierungseditor bewerten. Noch keine automatische Rekonstruktion aus Fotos oder beliebigen Bauplänen.

Keine eigene MCP- oder MQTT-Anbindung. Home Assistant liefert vorhandene Entitäten und gegebenenfalls seine eigene MCP-Funktion. Haus Blick bleibt eine Frontend-Karte ohne Zusatzdienst.
