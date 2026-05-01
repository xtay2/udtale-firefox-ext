# DTU Lautschrift-Übersetzer - Firefox-Erweiterung

## Übersicht

Diese Firefox-Erweiterung ersetzt automatisch alle Phonetik-Blöcke (Lautschrift-Spans) auf Webseiten. Sie konvertiert die Lautschrift von DDO (Danish Dictionary Online) zum Kiel,SchwaTilgung-System.

## Implementierung

### 1. manifest.json
- **Name**: DTU Lautschrift-Übersetzer
- **Beschreibung**: Ersetzt Phonetik-Blöcke von DDO zu Kiel,SchwaTilgung auf Webseiten
- **Content Script**: `dist/content-script.js` läuft am Ende des Dokumentladens (`document_end`)
- **Web Accessible Resources**: `src/translationTable.csv` ist als web-zugängliche Ressource registriert

### 2. Content Script (dist/content-script.js)

Das Skript führt die folgenden Schritte aus:

#### a) CSV-Tabelle laden und parsen
```
loadTranslationTable()
- Lädt `src/translationTable.csv` via browser.runtime.getURL()
- Parst die CSV-Zeilen und extrahiert die DDO- und Kiel,SchwaTilgung-Systeme
- Speichert die Zeichen-Arrays für beide Systeme
```

#### b) Übersetzungsmappings erstellen
```
parseTranslationTable(csv)
- Ignoriert Kommentarzeilen (starting with #)
- Nur nicht-leere Zeilen werden verarbeitet
- Für jede Zeile werden die Felder geparst:
  - Feld 1+2: Systemnamen (z.B. "Kiel" + "SchwaTilgung" = "KielSchwaTilgung")
  - Feld 3: Schriftartinformation (wird nicht verwendet)
  - Feld 4: Variationen (wird nicht verwendet)
  - Feld 5+: Die eigentlichen Zeichen der Lautschrift
```

#### c) Zeichen konvertieren
```
translateDDOToKiel(text)
- Iteriert durch jeden Buchstaben des Eingabetextes
- Sucht den Buchstaben im DDO-System
- Ersetzt ihn mit dem entsprechenden Zeichen aus dem Kiel,SchwaTilgung-System
- Falls nicht gefunden, behält das Original-Zeichen
```

#### d) DOM-Elemente ersetzen
```
replaceLydskriftText()
- Sucht alle Elemente mit der Klasse "lydskrift"
- Iteriert durch alle Kindknoten dieser Elemente
- Identifiziert Textknoten (Text-Inhalte zwischen HTML-Tags)
- Konvertiert diese Texte von DDO zu Kiel,SchwaTilgung
```

### 3. Übersetzungstabelle (src/translationTable.csv)

Die CSV-Datei enthält:
- **Zeile 15**: DDO-System mit allen phonetischen Zeichen
- **Zeile 12**: Kiel,SchwaTilgung-System mit entsprechenden Zeichen

Beispiel:
- DDO Zeichen: `ˈ ˌ ː ˀ  / [ ] . b p d t g k v f θ s j ɕ h ...`
- Kiel,SchwaTilgung: `ˈ ˌ ː ː  / [ ] . b p d t g k v f θ s j ɕ h ...`

### 4. Datenfluss

```
1. Seite wird geladen
   ↓
2. Content Script wird ausgeführt (document_end)
   ↓
3. Übersetzungstabelle wird geladen (async)
   ↓
4. DDO- und Kiel,SchwaTilgung-Systeme werden extrahiert
   ↓
5. Alle .lydskrift Elemente werden gefunden
   ↓
6. Jeder Textknoten wird von DDO zu Kiel,SchwaTilgung konvertiert
   ↓
7. Die Seite zeigt die neuen Zeichen an
```

## Beispiel

**HTML Input:**
```html
<span class="lydskrift">
  <span class="diskret">[</span>ˈdanˀsg<span class="diskret">]</span>
  <audio id="11008394_1" src="..."></audio>
</span>
```

**Konvertiert zu:**
```html
<span class="lydskrift">
  <span class="diskret">[</span>ˈdanːsg<span class="diskret">]</span>
  <audio id="11008394_1" src="..."></audio>
</span>
```

(Hinweis: `ˀ` wird zu `ː` gemäß der Kiel,SchwaTilgung-Mappings)

## Installation

1. Öffnen Sie `about:debugging#/runtime/this-firefox` in Firefox
2. Klicken Sie auf "Temporäres Add-on laden"
3. Wählen Sie die `manifest.json` Datei aus diesem Projekt

## Debugging

Die Erweiterung gibt Konsolenmeldungen aus:
- "Content Script für Phonetik-Übersetzung gestartet"
- "Übersetzungstabelle geladen. DDO-System hat X Zeichen"
- "Kiel,SchwaTilgung-System hat X Zeichen"
- "Phonetik-Spans wurden aktualisiert"

Öffnen Sie die Browser-Konsole (F12) um diese Meldungen zu sehen.

## Technische Details

- **Kompilierung**: TypeScript in `src/content-script.ts` wird in `dist/content-script.js` kompiliert
- **Browser-API**: Verwendet `browser.runtime.getURL()` für Dateizugriff
- **Async/Await**: Verwendet moderne async/await Syntax für Datei-Laden
- **DOM-Manipulation**: Direkte TextNode-Manipulation ohne jQuery oder andere Abhängigkeiten

## Kompatibilität

- Firefox: Ja
- Chrome: Bedingt
- Edge: Bedingt


