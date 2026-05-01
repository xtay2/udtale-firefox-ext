// Content Script für die Übersetzung von Phonetik-Blöcken
// Konvertiert DDO zu Kiel,SchwaTilgung

// Type definitions for Firefox WebExtensions API
declare const browser: {
    runtime: {
        getURL(path: string): string;
    };
};

interface TranslationTable {
    [systemName: string]: string[];
}

const translationTable: TranslationTable = {};
let ddoSystem: string[] = [];
let kielSystem: string[] = [];

/**
 * Lädt die CSV-Übersetzungstabelle
 */
async function loadTranslationTable(): Promise<void> {
    try {
        const url = browser.runtime.getURL('src/translationTable.csv');
        const response = await fetch(url);
        const csv = await response.text();
        parseTranslationTable(csv);
    } catch (error) {
        console.error('Fehler beim Laden der Übersetzungstabelle:', error);
    }
}

/**
 * Parst die CSV-Übersetzungstabelle
 */
function parseTranslationTable(csv: string): void {
    const lines = csv.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Ignoriere Kommentare und leere Zeilen
        if (!line || line.startsWith('#')) {
            continue;
        }

        // Parse CSV-Zeile (mit Unterstützung für kommagetrennte Werte in Anführungszeichen)
        const fields = parseCSVLine(line);

        if (fields.length < 5) {
            continue;
        }

        const systemName = fields[0] + fields[1];
        const characters = fields.slice(4);

        // Speichere alle Systeme
        translationTable[systemName] = characters;

        // Speichere spezifisch DDO und Kiel,SchwaTilgung
        if (fields[0] === 'DDO') {
            ddoSystem = characters;
        }
        if (fields[0] === 'Kiel' && fields[1] === 'SchwaTilgung') {
            kielSystem = characters;
        }
    }

    console.log('Übersetzungstabelle geladen. DDO-System hat', ddoSystem.length, 'Zeichen');
    console.log('Kiel,SchwaTilgung-System hat', kielSystem.length, 'Zeichen');
}

/**
 * Parst eine CSV-Zeile unter Berücksichtigung von Anführungszeichen
 */
function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            fields.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }

    // Letztesfeld hinzufügen
    fields.push(current.trim().replace(/^"|"$/g, ''));

    return fields;
}

/**
 * Übersetzt einen Text von DDO zu Kiel,SchwaTilgung
 */
function translateDDOToKiel(text: string): string {
    if (ddoSystem.length === 0 || kielSystem.length === 0) {
        console.warn('Translations-Systeme nicht geladen');
        return text;
    }

    let result = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Suche Zeichen in DDO-System
        let found = false;
        for (let j = 0; j < ddoSystem.length; j++) {
            if (ddoSystem[j] === char) {
                // Ersetze mit entsprechendem Zeichen aus Kiel,SchwaTilgung
                result += kielSystem[j] || char;
                found = true;
                break;
            }
        }

        if (!found) {
            // Wenn Zeichen nicht gefunden, behalte es unverändert
            result += char;
        }
    }

    return result;
}

/**
 * Ersetzt die Lautschrift in den lydskrift-Spans
 */
function replaceLydskriftText(): void {
    const lydskriftSpans = document.querySelectorAll('.lydskrift');
    let replacedCount = 0;

    lydskriftSpans.forEach((span) => {
        // Das Structure ist normalerweise:
        // <span class="lydskrift">
        //   <span class="diskret">[</span>
        //   PHONETIC_TEXT
        //   <span class="diskret">]</span>
        //   ... rest of content (audio, img, etc.)
        // </span>

        // Iteriere durch die Kindknoten
        const childNodes = Array.from(span.childNodes);
        let textWasReplaced = false;

        for (let i = 0; i < childNodes.length; i++) {
            const node = childNodes[i];

            // Prüfe ob es ein Textknoten ist
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                // Überspringe reine Whitespace-Knoten
                if (text.trim().length > 0) {
                    node.textContent = translateDDOToKiel(text);
                    textWasReplaced = true;
                }
            }
        }

        // Füge CSS-Klasse hinzu, wenn Text ersetzt wurde
        if (textWasReplaced) {
            span.classList.add('ext-replaced');
            replacedCount++;
        }
    });

    console.log(`Phonetik-Spans wurden aktualisiert. ${replacedCount} Elemente wurden markiert.`);
}

/**
 * Hauptfunktion - wird beim Laden des Inhalts ausgeführt
 */
async function init(): Promise<void> {
    console.log('Content Script für Phonetik-Übersetzung gestartet');

    // Lade die Übersetzungstabelle
    await loadTranslationTable();

    // Ersetze die Lautschrift
    replaceLydskriftText();
}

// Starte bei document_end (Manifest gibt document_end an)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

