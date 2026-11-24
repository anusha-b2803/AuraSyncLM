import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

window.API_CONFIG = { port: 8000, token: '' };

async function init() {
    if (window.electron && window.electron.getApiConfig) {
        try {
            window.API_CONFIG = await window.electron.getApiConfig();
        } catch (e) {
            console.error("Failed to get API config", e);
        }
    }
    
    ReactDOM.createRoot(document.getElementById('root')).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

init();
