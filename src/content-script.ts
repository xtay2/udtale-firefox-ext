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
let sourceTokens: string[] = [];
let sourceTokenLookup = new Map<string, string>();
let translationsReady = false;

const DETECTED_CLASS = 'ext-detected';
const REPLACED_CLASS = 'ext-replaced';
const ERROR_CLASS = 'ext-error';

/**
 * Lädt die CSV-Übersetzungstabelle
 */
async function loadTranslationTable(): Promise<void> {
    try {
        translationsReady = false;
        ddoSystem = [];
        kielSystem = [];
        sourceTokens = [];
        sourceTokenLookup = new Map<string, string>();

        for (const key of Object.keys(translationTable)) {
            delete translationTable[key];
        }

        const url = browser.runtime.getURL('src/translationTable.csv');
        const response = await fetch(url);
        const csv = await response.text();
        parseTranslationTable(csv);
        buildTranslationIndex();
        translationsReady = ddoSystem.length > 0 && kielSystem.length > 0;
    } catch (error) {
        translationsReady = false;
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

    console.log('Übersetzungstabelle geladen. DDO-System hat', ddoSystem.length, 'Einträge');
    console.log('Kiel,SchwaTilgung-System hat', kielSystem.length, 'Einträge');
}

/**
 * Baut den lokalen DDO→Kiel-Lookup auf Basis der Tabellenreihenfolge auf.
 */
function buildTranslationIndex(): void {
    sourceTokenLookup = new Map<string, string>();
    const firstOccurrence = new Map<string, number>();

    const limit = Math.min(ddoSystem.length, kielSystem.length);
    for (let i = 0; i < limit; i++) {
        const source = ddoSystem[i];
        const destination = kielSystem[i];

        if (!source) {
            continue;
        }

        if (!sourceTokenLookup.has(source)) {
            sourceTokenLookup.set(source, destination ?? source);
            firstOccurrence.set(source, i);
        }
    }

    sourceTokens = Array.from(sourceTokenLookup.keys()).sort((a, b) => {
        const lengthDiff = b.length - a.length;
        if (lengthDiff !== 0) {
            return lengthDiff;
        }

        const aIndex = firstOccurrence.get(a) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = firstOccurrence.get(b) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
    });
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

    // Letztes Feld hinzufügen
    fields.push(current.trim().replace(/^"|"$/g, ''));

    return fields;
}

/**
 * Übersetzt einen Text von DDO zu Kiel,SchwaTilgung
 */
function translateDDOToKiel(text: string): string | null {
    if (!translationsReady || sourceTokens.length === 0) {
        return null;
    }

    let result = '';
    let matchedAny = false;

    for (let i = 0; i < text.length;) {
        let matchedSource = '';
        let matchedDestination = '';

        for (let j = 0; j < sourceTokens.length; j++) {
            const source = sourceTokens[j];

            if (source.length > 0 && text.startsWith(source, i)) {
                matchedSource = source;
                matchedDestination = sourceTokenLookup.get(source) ?? source;
                break;
            }
        }

        if (matchedSource !== '') {
            matchedAny = true;
            result += matchedDestination;
            i += matchedSource.length;
        } else {
            result += text[i];
            i += 1;
        }
    }

    if (!matchedAny) {
        return null;
    }

    return result;
}

function collectTranslatableTextNodes(root: Node): Text[] {
    const textNodes: Text[] = [];

    function visit(node: Node): void {
        if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            const parentElement = textNode.parentElement;
            const text = textNode.textContent ?? '';

            if (parentElement === null || parentElement.classList.contains('diskret')) {
                return;
            }

            if (text.trim().length === 0) {
                return;
            }

            textNodes.push(textNode);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        const element = node as Element;
        if (element.classList.contains('diskret')) {
            return;
        }

        const children = Array.from(node.childNodes);
        for (let i = 0; i < children.length; i++) {
            visit(children[i]);
        }
    }

    visit(root);
    return textNodes;
}

function setLydskriftState(element: Element, state: 'replaced' | 'error' | 'none'): void {
    element.classList.add(DETECTED_CLASS);
    element.classList.remove(REPLACED_CLASS, ERROR_CLASS);

    if (state === 'replaced') {
        element.classList.add(REPLACED_CLASS);
    } else if (state === 'error') {
        element.classList.add(ERROR_CLASS);
    }
}

/**
 * Ersetzt die Lautschrift in den lydskrift-Spans
 */
function replaceLydskriftText(): void {
    const lydskriftElements = document.querySelectorAll<HTMLElement>('.lydskrift');
    let replacedCount = 0;
    let errorCount = 0;

    lydskriftElements.forEach((element) => {
        const textNodes = collectTranslatableTextNodes(element);

        if (textNodes.length === 0) {
            setLydskriftState(element, 'error');
            errorCount++;
            return;
        }

        let matchedAny = false;

        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            const originalText = node.textContent ?? '';
            const translated = translateDDOToKiel(originalText);

            if (translated === null) {
                continue;
            }

            node.textContent = translated;
            matchedAny = true;
        }

        if (!matchedAny) {
            setLydskriftState(element, 'error');
            errorCount++;
            return;
        }

        setLydskriftState(element, 'replaced');
        replacedCount++;
    });

    console.log(`Phonetik-Spans wurden aktualisiert. ${replacedCount} Elemente wurden erfolgreich übersetzt, ${errorCount} Elemente markiert.`);
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

