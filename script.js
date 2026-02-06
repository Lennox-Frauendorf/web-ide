// --- KONFIGURATION & STATE ---
const STORAGE_KEY_USERS = 'gimgm_users';
const STORAGE_KEY_CURRENT = 'gimgm_current_user';
const STORAGE_KEY_CODE = 'gimgm_saved_code_'; // + username

let currentUser = null;
let currentMode = 'login'; // login oder register

// --- DOM ELEMENTE ---
const authContainer = document.getElementById('auth-container');
const ideContainer = document.getElementById('ide-container');
const statusBar = document.getElementById('status-bar');
const codeHTML = document.getElementById('code-html');
const codeCSS = document.getElementById('code-css');
const codeJS = document.getElementById('code-js');
const previewFrame = document.getElementById('preview-frame');

// --- INITIALISIERUNG ---
window.onload = () => {
    checkLogin();
};

// --- AUTH SYSTEM ---
function switchAuth(mode) {
    currentMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-register').classList.toggle('active', mode === 'register');
    document.getElementById('auth-btn').innerText = mode === 'login' ? 'Anmelden' : 'Registrieren';
    document.getElementById('auth-msg').innerText = '';
}

document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');

    if (currentMode === 'register') {
        if (users.find(u => u.user === user)) {
            showMsg('Benutzername vergeben!', 'red');
        } else {
            users.push({ user, pass });
            localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
            showMsg('Registriert! Bitte anmelden.', 'green');
            switchAuth('login');
        }
    } else {
        const found = users.find(u => u.user === user && u.pass === pass);
        if (found) {
            loginUser(found.user);
        } else {
            showMsg('Falsche Daten!', 'red');
        }
    }
});

function loginUser(username) {
    currentUser = username;
    localStorage.setItem(STORAGE_KEY_CURRENT, username);
    authContainer.style.display = 'none';
    ideContainer.style.display = 'flex';
    statusBar.style.display = 'flex';
    loadCode();
    updatePreview();
}

function checkLogin() {
    const savedUser = localStorage.getItem(STORAGE_KEY_CURRENT);
    if (savedUser) loginUser(savedUser);
}

function logout() {
    localStorage.removeItem(STORAGE_KEY_CURRENT);
    location.reload();
}

function showMsg(text, color) {
    const msg = document.getElementById('auth-msg');
    msg.style.color = color;
    msg.innerText = text;
}

// --- IDE FUNKTIONEN ---

// Tab Switching
function switchTab(type) {
    // Hide all textareas
    document.querySelectorAll('.code-input').forEach(el => el.classList.remove('active'));
    // Deactivate all headers
    document.querySelectorAll('.editor-tabs .tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.file').forEach(el => el.classList.remove('active'));

    // Activate selected
    document.getElementById(`code-${type}`).classList.add('active');
    document.getElementById(`tab-header-${type}`).classList.add('active');
    
    // Highlight sidebar file (optional, simple logic)
    const files = document.querySelectorAll('.file');
    if(type === 'html') files[0].classList.add('active');
    if(type === 'css') files[1].classList.add('active');
    if(type === 'js') files[2].classList.add('active');
}

// Live Preview Logic
function updatePreview() {
    const html = codeHTML.value;
    const css = `<style>${codeCSS.value}</style>`;
    const js = `<script>${codeJS.value}<\/script>`; // Escape slash

    const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            ${css}
        </head>
        <body>
            ${html}
            ${js}
        </body>
        </html>
    `;

    const doc = previewFrame.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();
    
    saveCode(); // Auto-Save trigger
}

// Auto-Save im LocalStorage
function saveCode() {
    if (!currentUser) return;
    const data = {
        html: codeHTML.value,
        css: codeCSS.value,
        js: codeJS.value
    };
    localStorage.setItem(STORAGE_KEY_CODE + currentUser, JSON.stringify(data));
}

function loadCode() {
    if (!currentUser) return;
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY_CODE + currentUser));
    if (data) {
        codeHTML.value = data.html;
        codeCSS.value = data.css;
        codeJS.value = data.js;
    } else {
        // Default Template
        codeHTML.value = '<h1>Hallo GimGm-Code!</h1>\n<p>Bearbeite mich...</p>';
        codeCSS.value = 'body { font-family: sans-serif; padding: 20px; }\nh1 { color: #007acc; }';
        codeJS.value = 'console.log("Willkommen bei GimGm-Code");';
    }
}

// Event Listeners für Live Update
codeHTML.addEventListener('input', updatePreview);
codeCSS.addEventListener('input', updatePreview);
codeJS.addEventListener('input', updatePreview);

// Download Feature
function downloadCode() {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>${codeCSS.value}</style>
</head>
<body>
    ${codeHTML.value}
    <script>${codeJS.value}</script>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'GimGm_Projekt.html';
    a.click();
}

function runCode() {
    updatePreview(); // Manuelles Neuladen
}
