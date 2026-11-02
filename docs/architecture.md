# Architektur

Ein ES-Modul registriert `haus-blick-card` und `haus-blick-card-editor`. HA ruft `setConfig` auf und setzt bei Zustandsänderungen `hass`. Der Editor sendet `config-changed`; bewusste Entitätsauswahl sendet ein zusammengesetztes/bubbelndes `hass-more-info`-Ereignis.

`config.ts` validiert getrennte Konfigurationskopien und erzeugt ein neutrales Fabriqon-SceneModel mit Räumen, Wänden und Markern. Es enthält keine industriellen Sicherheitszonen oder Bewertungsregeln. `house.ts` baut daraus eigene Gebäude-/Pflanzen-Assets für den SDK-Viewer; deren Geometrien und Materialien gehören dem Viewer und werden beim Modellwechsel entsorgt. Struktur-Assets lösen keine HA-Entitätsaktionen aus. Sichtwechsel dürfen Geometrie ändern, HA-Zustandsupdates nicht. `import.ts` verwendet den öffentlichen SDK-DXF-Parser und validiert Import und Zuordnung vor einem ausdrücklichen Editor-Commit. `state.ts` trennt die HA-Zustandsdarstellung davon.

Der SDK-Viewer startet für eine sichtbare, verbundene Karte. Zustandsänderungen aktualisieren Texte/Materialien, nicht Kamera oder Geometrie. Rendering ist auf 24 FPS begrenzt; unsichtbare Ansichten pausieren. Entfernen gibt Beobachter, Listener und GPU-Ressourcen frei, Wiedereinfügen erzeugt einen neuen Viewer. WebGL-Fehler und Kontextverlust führen zu einer weiterhin bedienbaren Entitätsliste.

Das öffentliche SDK ist als expliziter, checksummierter Runtime-Snapshot eingebunden. `scripts/update-sdk.mjs` erzeugt ihn aus einem sauberen, benannten SDK-Commit. Vite bündelt SDK, three.js, OrbitControls und Karte mit ihren MIT-Hinweisen in eine Datei. Keine externen Modelle, Schriften oder Programmteile werden nachgeladen.

Konfiguration liegt im HA-Dashboard. Kein eigener Server, Python-Add-on, separate Datenbank, Token-Speicher oder Broker-Client. Die private Fabriqon-App ist keine Abhängigkeit. Browserfixtures simulieren HA und ersetzen keine reale Plattformabnahme.
