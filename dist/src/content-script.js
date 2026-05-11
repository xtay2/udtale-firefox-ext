"use strict";
// Content Script für die Übersetzung von Phonetik-Blöcken
// Konvertiert DDO zu Kiel,SchwaTilgung
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const translationTable = {};
let ddoSystem = [];
let kielSystem = [];
let sourceTokens = [];
let sourceTokenLookup = new Map();
let translationsReady = false;
const DETECTED_CLASS = 'ext-detected';
const REPLACED_CLASS = 'ext-replaced';
const ERROR_CLASS = 'ext-error';
const COPIED_CLASS = 'ext-copied';
/**
 * Lädt die CSV-Übersetzungstabelle
 */
function loadTranslationTable() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            translationsReady = false;
            ddoSystem = [];
            kielSystem = [];
            sourceTokens = [];
            sourceTokenLookup = new Map();
            for (const key of Object.keys(translationTable)) {
                delete translationTable[key];
            }
            const url = browser.runtime.getURL('src/translationTable.csv');
            const response = yield fetch(url);
            const csv = yield response.text();
            parseTranslationTable(csv);
            buildTranslationIndex();
            translationsReady = ddoSystem.length > 0 && kielSystem.length > 0;
        }
        catch (error) {
            translationsReady = false;
            console.error('Fehler beim Laden der Übersetzungstabelle:', error);
        }
    });
}
/**
 * Parst die CSV-Übersetzungstabelle
 */
function parseTranslationTable(csv) {
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
function buildTranslationIndex() {
    sourceTokenLookup = new Map();
    const firstOccurrence = new Map();
    const limit = Math.min(ddoSystem.length, kielSystem.length);
    for (let i = 0; i < limit; i++) {
        const source = ddoSystem[i];
        const destination = kielSystem[i];
        if (!source) {
            continue;
        }
        if (!sourceTokenLookup.has(source)) {
            sourceTokenLookup.set(source, destination !== null && destination !== void 0 ? destination : source);
            firstOccurrence.set(source, i);
        }
    }
    sourceTokens = Array.from(sourceTokenLookup.keys()).sort((a, b) => {
        var _a, _b;
        const lengthDiff = b.length - a.length;
        if (lengthDiff !== 0) {
            return lengthDiff;
        }
        const aIndex = (_a = firstOccurrence.get(a)) !== null && _a !== void 0 ? _a : Number.MAX_SAFE_INTEGER;
        const bIndex = (_b = firstOccurrence.get(b)) !== null && _b !== void 0 ? _b : Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
    });
}
/**
 * Parst eine CSV-Zeile unter Berücksichtigung von Anführungszeichen
 */
function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        }
        else if (char === ',' && !inQuotes) {
            fields.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        }
        else {
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
function translateDDOToKiel(text) {
    var _a;
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
                matchedDestination = (_a = sourceTokenLookup.get(source)) !== null && _a !== void 0 ? _a : source;
                break;
            }
        }
        if (matchedSource !== '') {
            matchedAny = true;
            result += matchedDestination;
            i += matchedSource.length;
        }
        else {
            result += text[i];
            i += 1;
        }
    }
    if (!matchedAny) {
        return null;
    }
    return result;
}
function collectTranslatableTextNodes(root) {
    const textNodes = [];
    function visit(node) {
        var _a;
        if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node;
            const parentElement = textNode.parentElement;
            const text = (_a = textNode.textContent) !== null && _a !== void 0 ? _a : '';
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
        const element = node;
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
function setLydskriftState(element, state) {
    element.classList.add(DETECTED_CLASS);
    element.classList.remove(REPLACED_CLASS, ERROR_CLASS);
    if (state === 'replaced') {
        element.classList.add(REPLACED_CLASS);
    }
    else if (state === 'error') {
        element.classList.add(ERROR_CLASS);
    }
}
/**
 * Fügt einem ersetzten Element einen Click-Handler hinzu,
 * der den Text in die Zwischenablage kopiert und kurz grün aufleuchtet.
 */
function addClickToCopy(element) {
    if (element.dataset.copyListenerAttached) {
        return;
    }
    element.dataset.copyListenerAttached = 'true';
    element.addEventListener('click', () => {
        const text = element.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
            element.classList.add(COPIED_CLASS);
            setTimeout(() => {
                element.classList.remove(COPIED_CLASS);
            }, 1000);
        }).catch((error) => {
            console.error('Fehler beim Kopieren in die Zwischenablage:', error);
        });
    });
}
/**
 * Ersetzt die Lautschrift in den lydskrift-Spans
 */
function replaceLydskriftText() {
    const lydskriftElements = document.querySelectorAll('.lydskrift');
    let replacedCount = 0;
    let errorCount = 0;
    lydskriftElements.forEach((element) => {
        var _a;
        const textNodes = collectTranslatableTextNodes(element);
        if (textNodes.length === 0) {
            setLydskriftState(element, 'error');
            errorCount++;
            return;
        }
        let matchedAny = false;
        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            const originalText = (_a = node.textContent) !== null && _a !== void 0 ? _a : '';
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
        addClickToCopy(element);
        replacedCount++;
    });
    console.log(`Phonetik-Spans wurden aktualisiert. ${replacedCount} Elemente wurden erfolgreich übersetzt, ${errorCount} Elemente markiert.`);
}
/**
 * Hauptfunktion - wird beim Laden des Inhalts ausgeführt
 */
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Content Script für Phonetik-Übersetzung gestartet');
        // Lade die Übersetzungstabelle
        yield loadTranslationTable();
        // Ersetze die Lautschrift
        replaceLydskriftText();
    });
}
// Starte bei document_end (Manifest gibt document_end an)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
