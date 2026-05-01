// Globale Deklarationen für WebExtension-APIs
// Damit TypeScript keine Fehler für browser/chrome wirft
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const browser: any;
declare const chrome: any;

// Hilfsfunktion zum Parsen von CSV (ignoriert Kommentare und leere Zeilen)
function parseCSV(csv: string): string[][] {
  return csv
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split(','));
}

// CSV-Dateien als Strings importieren (werden per Webpack/Vite als raw importiert, hier simuliert per fetch)
function getRuntimeUrl(path: string): string {
  if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
    return browser.runtime.getURL(path);
  } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    return chrome.runtime.getURL(path);
  }
  throw new Error('Weder browser noch chrome runtime API gefunden');
}

async function loadLocalCSV(path: string): Promise<string> {
  const url = getRuntimeUrl(path);
  const res = await fetch(url);
  return res.text();
}

// Mapping-Tabellen
let ddoSymbols: string[] = [];
let kielSymbols: string[] = [];

async function prepareMappings() {
  // CSVs lokal laden
  const [kielCSV, ddoCSV] = await Promise.all([
    loadLocalCSV('src/kielSchwaTilgungUrl.csv'),
    loadLocalCSV('src/ddo.csv')
  ]);
  const kielRows = parseCSV(kielCSV);
  const ddoRows = parseCSV(ddoCSV);
  // Die relevanten Zeilen sind die letzten beiden (Konsonanten und Vokale)
  kielSymbols = [...(kielRows[1] || []), ...(kielRows[2] || [])];
  ddoSymbols = [...(ddoRows[1] || []), ...(ddoRows[2] || [])];
}

function mapDdoToKiel(text: string): string {
  // Zeichenweise ersetzen
  return text.split('').map(char => {
    const idx = ddoSymbols.indexOf(char);
    return idx !== -1 ? kielSymbols[idx] || char : char;
  }).join('');
}

// Neue Funktion: Ersetzt Lautschrift in .lydskrift-Elementen DOM-basiert
function replaceLydskriftSpans() {
  const lydskriftSpans = document.querySelectorAll('.lydskrift');
  lydskriftSpans.forEach(lyd => {
    // Suche alle direkten Kindknoten
    const children = Array.from(lyd.childNodes);
    for (let i = 0; i < children.length - 2; i++) {
      const left = children[i];
      const text = children[i + 1];
      const right = children[i + 2];
      // Prüfe auf Struktur: <span class="diskret">[</span> TEXT <span class="diskret">]</span>
      if (
        left.nodeType === Node.ELEMENT_NODE &&
        (left as Element).classList.contains('diskret') &&
        (left as Element).textContent === '[' &&
        text.nodeType === Node.TEXT_NODE &&
        right.nodeType === Node.ELEMENT_NODE &&
        (right as Element).classList.contains('diskret') &&
        (right as Element).textContent === ']'
      ) {
        // Ersetze nur den Textknoten
        text.textContent = mapDdoToKiel(text.textContent || '');
        // i erhöhen, um Überschneidungen zu vermeiden
        i += 2;
      }
    }
  });
}

// Hauptfunktion
prepareMappings().then(() => {
  replaceLydskriftSpans();
});
