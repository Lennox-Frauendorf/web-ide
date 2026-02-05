let editor;
let openTabs = [];
let activeTabId = null;

// Initialisierung mit Emmet
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs' }});

require(['vs/editor/editor.main'], function() {
    // Emmet registrieren
    emmetMonaco.emmetHTML(monaco);

    editor = monaco.editor.create(document.getElementById('monaco-container'), {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 16, // Größer für Mobile
        wordWrap: "on",
        minimap: { enabled: false }, // Platz sparen auf Mobile
        unicodeHighlight: { ambiguousCharacters: false }
    });

    // Custom Commands
    editor.addCommand(monaco.KeyCode.US_IT_FRONT_SLASH, () => {
        // Beispiel für Kommentar-Shortcut
        editor.trigger('keyboard', 'editor.action.commentLine', null);
    });

    // Emmet "!" für HTML Boilerplate manuell verstärken
    editor.onKeyDown((e) => {
        if (e.browserEvent.key === '!' && editor.getModel().getLanguageId() === 'html') {
            // Wir lassen Monaco's Autocomplete den Rest machen oder fügen Logik ein
        }
    });
});

// Datei öffnen Funktion (erweitert für Boilerplate)
async function openFile(fileHandle) {
    const file = await fileHandle.getFile();
    let content = await file.text();

    // Falls Datei leer ist und HTML: Boilerplate anbieten
    if (content.trim() === "" && file.name.endsWith('.html')) {
        content = `<!DOCTYPE html>\n<html lang="de">\n<head>\n    <meta charset="UTF-8">\n    <title>Document</title>\n</head>\n<body>\n    \n</body>\n</html>`;
    }

    const tabId = Date.now().toString();
    const model = monaco.editor.createModel(content, getLanguage(file.name));
    
    const newTab = { id: tabId, handle: fileHandle, model, name: file.name };
    openTabs.push(newTab);
    renderTab(newTab);
    activateTab(tabId);
}

// Mobile Sidebar Steuerung
document.getElementById('toggleSidebar').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
};

document.getElementById('closeSidebar').onclick = () => {
    document.getElementById('sidebar').classList.remove('open');
};

// Preview Steuerung (Mobile Overlay)
document.getElementById('togglePreview').onclick = () => {
    const pane = document.getElementById('previewPane');
    pane.classList.toggle('open');
    if(pane.classList.contains('open')) updatePreview();
};

document.getElementById('closePreview').onclick = () => {
    document.getElementById('previewPane').classList.remove('open');
};

// Helper für mobile Symbolleiste
function insertText(text) {
    const selection = editor.getSelection();
    const range = new monaco.Range(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn);
    editor.executeEdits("mobile-toolbar", [{ range: range, text: text, forceMoveMarkers: true }]);
    editor.focus();
}

// Preview Logik (Index.html sucht autom. CSS/JS im gleichen Ordner)
function updatePreview() {
    const tab = openTabs.find(t => t.id === activeTabId);
    if (!tab || !tab.name.endsWith('.html')) return;

    const blob = new Blob([tab.model.getValue()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    document.getElementById('previewFrame').src = url;
}

// ... Restliche Funktionen (renderTree, saveFile) wie zuvor ...
