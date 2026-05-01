// Ersetzt alle 'a' durch 'b' im sichtbaren Text der Seite
function replaceAWithB(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    node.textContent = node.textContent.replace(/a/g, 'b').replace(/A/g, 'B');
  } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
    for (const child of node.childNodes) {
      replaceAWithB(child);
    }
  }
}

replaceAWithB(document.body);

