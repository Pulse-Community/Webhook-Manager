// Monaco Editor Konfiguration
require.config({
    paths: {
        'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'
    }
});

let requestEditor, responseEditor;
let savedRequests = JSON.parse(localStorage.getItem('savedRequests') || '[]');
let lastRequestTime = 0;
const COOLDOWN_TIME = 5000; // 5 Sekunden in Millisekunden

// Toast-Benachrichtigungen
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-accent-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };

    toast.className = `${colors[type]} text-white p-4 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-full`;
    toast.innerHTML = `
        <div class="flex-shrink-0">
            ${type === 'success' ? `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
            ` : type === 'error' ? `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            ` : `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            `}
        </div>
        <p class="flex-1">${message}</p>
    `;

    document.getElementById('toastContainer').appendChild(toast);
    
    // Animation
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full');
    });

    // Automatisch entfernen nach 3 Sekunden
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Monaco Editor initialisieren
require(['vs/editor/editor.main'], function () {
    // Request Editor
    requestEditor = monaco.editor.create(document.getElementById('requestEditor'), {
        value: '{\n  \n}',
        language: 'json',
        theme: 'vs',
        minimap: { enabled: false },
        automaticLayout: true
    });

    // Response Editor
    responseEditor = monaco.editor.create(document.getElementById('responseEditor'), {
        value: '',
        language: 'text',
        theme: 'vs',
        minimap: { enabled: false },
        readOnly: true,
        automaticLayout: true
    });

    // Gespeicherte Anfragen laden
    updateSavedRequestsList();

    // Initial den Request Editor Status setzen
    updateRequestEditorState();

    // Event Listener für HTTP-Methoden-Änderungen
    document.getElementById('httpMethod').addEventListener('change', updateRequestEditorState);
});

// Request Editor Status aktualisieren
function updateRequestEditorState() {
    const method = document.getElementById('httpMethod').value;
    const isGetMethod = method === 'GET';
    
    // Editor aktivieren/deaktivieren
    requestEditor.updateOptions({ readOnly: isGetMethod });
    
    // Visuelles Feedback
    const editorElement = document.getElementById('requestEditor');
    if (isGetMethod) {
        editorElement.style.opacity = '0.5';
        requestEditor.setValue(''); // Request Body bei GET leeren
    } else {
        editorElement.style.opacity = '1';
        if (!requestEditor.getValue().trim()) {
            requestEditor.setValue('{\n  \n}');
        }
    }
}

// Antwortformat erkennen und formatieren
async function formatResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();

    // Versuche JSON zu erkennen und zu formatieren
    if (contentType.includes('application/json')) {
        try {
            const jsonData = JSON.parse(responseText);
            responseEditor.getModel().setLanguage('json');
            return JSON.stringify(jsonData, null, 2);
        } catch (e) {
            // Wenn JSON-Parsing fehlschlägt, zeige den Rohtext
            responseEditor.getModel().setLanguage('text');
            return responseText;
        }
    }
    
    // HTML-Erkennung und Formatierung
    else if (contentType.includes('text/html')) {
        responseEditor.getModel().setLanguage('html');
        return responseText;
    }
    
    // XML-Erkennung und Formatierung
    else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        responseEditor.getModel().setLanguage('xml');
        return responseText;
    }
    
    // Plaintext und andere Formate
    else {
        responseEditor.getModel().setLanguage('text');
        return responseText;
    }
}

// Funktion zum Aktualisieren des Button-Texts mit Countdown
function updateButtonText(remainingSeconds) {
    const button = document.getElementById('sendRequest');
    if (remainingSeconds > 0) {
        button.innerHTML = `
            <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Warte ${remainingSeconds}s...
        `;
    } else {
        button.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
            Anfrage senden
        `;
    }
}

// Funktion zum Aktivieren/Deaktivieren des Buttons mit Countdown
function handleButtonCooldown() {
    const button = document.getElementById('sendRequest');
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < COOLDOWN_TIME) {
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
        
        // Countdown starten
        const remainingTime = Math.ceil((COOLDOWN_TIME - timeSinceLastRequest) / 1000);
        updateButtonText(remainingTime);
        
        const countdownInterval = setInterval(() => {
            const remaining = Math.ceil((COOLDOWN_TIME - (Date.now() - lastRequestTime)) / 1000);
            if (remaining <= 0) {
                clearInterval(countdownInterval);
                button.disabled = false;
                button.classList.remove('opacity-50', 'cursor-not-allowed');
                updateButtonText(0);
            } else {
                updateButtonText(remaining);
            }
        }, 1000);
    } else {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        updateButtonText(0);
    }
}

// Anfrage senden
async function sendWebhookRequest(url, method, body, isResend = false) {
    try {
        lastRequestTime = Date.now();
        handleButtonCooldown();
        showToast('Sende Anfrage...', 'info');
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (method !== 'GET' && body && body.trim()) {
            options.body = body;
        }

        const response = await fetch(url, options);
        const formattedResponse = await formatResponse(response);
        
        responseEditor.setValue(formattedResponse);
        
        if (!isResend) {
            saveRequest(url, method, body);
        }
        
        showToast('Anfrage erfolgreich abgeschlossen', 'success');
    } catch (error) {
        showToast(`Fehler: ${error.message}`, 'error');
        responseEditor.setValue('Error: ' + error.message);
    }
}

// Anfrage speichern
function saveRequest(url, method, body) {
    const request = {
        id: Date.now(),
        url,
        method,
        body,
        timestamp: new Date().toLocaleString('de-DE')
    };
    
    savedRequests.unshift(request);
    if (savedRequests.length > 10) {
        savedRequests.pop();
    }
    
    localStorage.setItem('savedRequests', JSON.stringify(savedRequests));
    updateSavedRequestsList();
}

// Liste der gespeicherten Anfragen aktualisieren
function updateSavedRequestsList() {
    const container = document.getElementById('savedRequests');
    container.innerHTML = '';
    
    savedRequests.forEach(request => {
        const requestElement = document.createElement('div');
        requestElement.className = 'bg-white rounded-lg shadow p-3 hover:shadow-md transition-shadow';
        requestElement.innerHTML = `
            <div class="space-y-2">
                <div class="font-medium text-gray-800 truncate" title="${request.url}">
                    ${request.url}
                </div>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 text-xs font-medium rounded-full ${
                            request.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                            request.method === 'POST' ? 'bg-accent-100 text-accent-700' :
                            request.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }">
                            ${request.method}
                        </span>
                        <span class="text-xs text-gray-500">${request.timestamp}</span>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="loadRequest(${request.id})" 
                                class="text-accent-600 hover:text-accent-700 p-1 rounded-full hover:bg-accent-50 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                        </button>
                        <button onclick="deleteRequest(${request.id})" 
                                class="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(requestElement);
    });
}

// Gespeicherte Anfrage laden
function loadRequest(id) {
    const request = savedRequests.find(r => r.id === id);
    if (request) {
        document.getElementById('webhookUrl').value = request.url;
        document.getElementById('httpMethod').value = request.method;
        requestEditor.setValue(request.body || '{\n  \n}');
        updateRequestEditorState();
        
        showToast('Request geladen', 'success');
    }
}

// Gespeicherte Anfrage löschen
function deleteRequest(id) {
    savedRequests = savedRequests.filter(r => r.id !== id);
    localStorage.setItem('savedRequests', JSON.stringify(savedRequests));
    updateSavedRequestsList();
    showToast('Request gelöscht', 'info');
}

// Event Listener für den Send-Button
document.getElementById('sendRequest').addEventListener('click', () => {
    const url = document.getElementById('webhookUrl').value;
    const method = document.getElementById('httpMethod').value;
    const body = requestEditor.getValue();
    
    if (!url) {
        showToast('Bitte geben Sie eine URL ein', 'error');
        return;
    }
    
    sendWebhookRequest(url, method, body);
}); 