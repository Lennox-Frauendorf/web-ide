// --- Globale Variablen ---
let editor;
let currentDirHandle;
let openTabs = []; // Array von Objekten: { id, handle, content, model, viewState }
let activeTabId = null;

// DOM Elemente
const fileTreeEl = document.getElementById('fileTree');
const tabsContainer = document.getElementById('tabsContainer');
const previewFrame = document.getElementById('previewFrame');
const statusLeft = document.getElementById('statusLeft');
const btnSave = document.getElementById('btnSave');

// --- 1. Monaco Editor Setup ---
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs' }});

require(['vs/editor/editor.main'], function() {
    // Editor initialisieren (erstmal leer)
    editor = monaco.editor.create(document.getElementById('monaco-container'), {
        value: '// Öffne einen Ordner oder eine Datei...',
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 14,
        padding: { top: 15 }
    });

    // Event: Inhalt geändert -> Preview Update & Dirty Flag
    editor.onDidChangeModelContent(() => {
        if (activeTabId) {
            const tab = openTabs.find(t => t.id === activeTabId);
            if (tab) {
                tab.isDirty = true;
                updateTabUI(tab.id);
                // Debounce Preview
                clearTimeout(window.previewTimeout);
                window.previewTimeout = setTimeout(updatePreview, 1000);
            }
        }
    });

    // Tastenkürzel: Speichern
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
        await saveCurrentFile();
    });
});

// --- 2. File System Logic ---

document.getElementById('btnOpenFolder').addEventListener('click', async () => {
    try {
        currentDirHandle = await window.showDirectoryPicker();
        document.getElementById('projectTitle').textContent = currentDirHandle.name.toUpperCase();
        fileTreeEl.innerHTML = ''; // Tree leeren
        await renderTree(currentDirHandle, fileTreeEl, 0);
        statusLeft.textContent = `Ordner geladen: ${currentDirHandle.name}`;
    } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
    }
});

// Rekursive Funktion zum Rendern des Dateibaums
async function renderTree(dirHandle, parentElement, depth) {
    for await (const entry of dirHandle.values()) {
        const div = document.createElement('div');
        div.className = 'tree-item ' + (entry.kind === 'directory' ? 'folder' : 'file');
        div.style.paddingLeft = `${10 + (depth * 15)}px`;
        
        // Icons
        const icon = entry.kind === 'directory' ? '📁' : getFileIcon(entry.name);
        div.innerHTML = `<span style="margin-right:5px">${icon}</span> ${entry.name}`;

        parentElement.appendChild(div);

        if (entry.kind === 'directory') {
            const subContainer = document.createElement('div');
            subContainer.style.display = 'none'; // Standardmäßig zugeklappt
            parentElement.appendChild(subContainer);
            
            // Klick auf Ordner -> Auf/Zuklappen und Nachladen wenn leer
            let loaded = false;
            div.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!loaded) {
                    await renderTree(entry, subContainer, depth + 1);
                    loaded = true;
                }
                subContainer.style.display = subContainer.style.display === 'none' ? 'block' : 'none';
            });
        } else {
            // Klick auf Datei -> Öffnen
            div.addEventListener('click', () => openFile(entry));
        }
    }
}

function getFileIcon(name) {
    if (name.endsWith('.html')) return '🌐';
    if (name.endsWith('.css')) return '🎨';
    if (name.endsWith('.js')) return '📜';
    if (name.endsWith('.json')) return '⚙️';
    if (name.endsWith('.png') || name.endsWith('.jpg')) return '🖼️';
    return '📄';
}

// --- 3. Tab System & File Opening ---

async function openFile(fileHandle) {
    // Check ob schon offen
    const existingTab = openTabs.find(t => t.handle.name === fileHandle.name); // Einfacher Check über Name
    if (existingTab) {
        activateTab(existingTab.id);
        return;
    }

    const file = await fileHandle.getFile();
    const content = await file.text();
    const language = getLanguage(file.name);

    // Neuen Tab erstellen
    const tabId = Date.now().toString();
    
    // Monaco Model erstellen (ermöglicht Tab-Switch ohne Statusverlust)
    const model = monaco.editor.createModel(content, language);

    const newTab = {
        id: tabId,
        handle: fileHandle,
        model: model,
        name: file.name,
        isDirty: false
    };

    openTabs.push(newTab);
    renderTabInHeader(newTab);
    activateTab(tabId);
}

function renderTabInHeader(tab) {
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.id = `tab-${tab.id}`;
    tabEl.innerHTML = `
        <span class="tab-name">${tab.name}</span>
        <span class="tab-close" onclick="closeTab('${tab.id}', event)">×</span>
    `;
    tabEl.addEventListener('click', () => activateTab(tab.id));
    tabsContainer.appendChild(tabEl);
}

function activateTab(id) {
    activeTabId = id;
    
    // UI Update
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${id}`)?.classList.add('active');

    // Editor Model setzen
    const tab = openTabs.find(t => t.id === id);
    if (tab && editor) {
        editor.setModel(tab.model);
        editor.focus();
        statusLeft.textContent = `Bearbeite: ${tab.name}`;
        updatePreview(); // Vorschau aktualisieren wenn Tab wechselt
    }
}

function closeTab(id, event) {
    if(event) event.stopPropagation();
    
    const index = openTabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const tab = openTabs[index];
    
    // Warnung bei ungespeicherten Änderungen? (Hier vereinfacht weggelassen)
    tab.model.dispose(); // Speicher freigeben

    openTabs.splice(index, 1);
    document.getElementById(`tab-${id}`).remove();

    if (activeTabId === id) {
        activeTabId = null;
        if (openTabs.length > 0) {
            activateTab(openTabs[openTabs.length - 1].id);
        } else {
            // Kein Tab mehr offen
            editor.setModel(null);
            statusLeft.textContent = 'Bereit';
        }
    }
}

// --- 4. Speichern & Preview ---

async function saveCurrentFile() {
    if (!activeTabId) return;
    const tab = openTabs.find(t => t.id === activeTabId);
    
    try {
        const writable = await tab.handle.createWritable();
        await writable.write(tab.model.getValue());
        await writable.close();
        
        tab.isDirty = false;
        updateTabUI(tab.id);
        statusLeft.textContent = `${tab.name} gespeichert!`;
        
        // Nach Speichern sofort Preview updaten
        updatePreview();
    } catch (err) {
        console.error('Fehler beim Speichern:', err);
        alert('Fehler beim Speichern (Rechte?)');
    }
}

function updateTabUI(id) {
    const tab = openTabs.find(t => t.id === id);
    const tabEl = document.getElementById(`tab-${id}`);
    if (tab && tabEl) {
        const nameSpan = tabEl.querySelector('.tab-name');
        nameSpan.textContent = tab.name + (tab.isDirty ? ' ●' : '');
    }
}

// Einfache Live Preview Logik
// HINWEIS: Für echte Projekte mit mehreren Dateien müsste man die Abhängigkeiten parsen.
// Hier injizieren wir den aktuellen Editor-Inhalt einfach, wenn es HTML ist.
function updatePreview() {
    if (!activeTabId) return;
    const tab = openTabs.find(t => t.id === activeTabId);
    
    if (tab.name.endsWith('.html')) {
        const content = tab.model.getValue();
        // Wir schreiben direkt ins iframe document
        const doc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        doc.open();
        doc.write(content);
        doc.close();
    } else {
        // Wenn CSS/JS bearbeitet wird, und wir eine index.html in den Tabs haben, könnte man diese refreshen.
        // Für dieses Beispiel lassen wir die Vorschau so wie sie ist, wenn keine HTML Datei aktiv ist.
    }
}

document.getElementById('refreshPreview').addEventListener('click', updatePreview);

// --- Helpers ---
function getLanguage(filename) {
    const ext = filename.split('.').pop();
    switch(ext) {
        case 'html': return 'html';
        case 'css': return 'css';
        case 'js': return 'javascript';
        case 'json': return 'json';
        default: return 'plaintext';
    }
}

// --- Resizer Logik (Drag & Drop) ---
const resizer = document.getElementById('resizer');
const editorPane = document.querySelector('.editor-pane');
const previewPane = document.getElementById('previewPane');

resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
});

function resize(e) {
    const width = document.body.clientWidth - e.clientX;
    previewPane.style.width = width + 'px';
}

function stopResize() {
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    if(editor) editor.layout(); // Monaco Resize triggern
}
