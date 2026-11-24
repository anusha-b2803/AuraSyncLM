const { app, BrowserWindow, session, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// Fix for Chromium network_service_instance_impl crash on Windows
app.disableHardwareAcceleration();

// Suppress security warnings in development
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const crypto = require('crypto');
const net = require('net');

let mainWindow;

function createWindow() {
    console.log('[Electron] Creating window...');
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        frame: true,
        title: 'AuraSync LM',
        backgroundColor: '#0a0a0a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load the app: check if Vite dev server is running, otherwise load dist/index.html
    const http = require('http');
    const fs = require('fs');
    const distPath = path.join(__dirname, '../dist/index.html');

    const checkVite = http.get('http://localhost:5173', (res) => {
        console.log('[Electron] Connected to Vite server on http://localhost:5173');
        if (mainWindow) mainWindow.loadURL('http://localhost:5173');
    });

    checkVite.on('error', () => {
        if (fs.existsSync(distPath)) {
            console.log('[Electron] Loading pre-built desktop interface from dist/index.html...');
            if (mainWindow) mainWindow.loadFile(distPath);
        } else {
            console.log('[Electron] dist/index.html not found, waiting for Vite dev server...');
            if (mainWindow) mainWindow.loadURL('http://localhost:5173');
        }
    });

    mainWindow.webContents.on('did-fail-load', () => {
        if (fs.existsSync(distPath)) {
            console.log('[Electron] Failed to reach Vite. Falling back to local dist/index.html');
            if (mainWindow) mainWindow.loadFile(distPath);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

let pythonBackend;

// Secure API Config
const API_CONFIG = {
    port: 8000,
    token: crypto.randomBytes(16).toString('hex')
};

// Function to find a free port
function getFreePort() {
    return new Promise((resolve) => {
        const srv = net.createServer();
        srv.listen(0, () => {
            const port = srv.address().port;
            srv.close((err) => resolve(port));
        });
    });
}

// Polls until the FastAPI backend responds on the dynamic port
async function waitForBackend(maxWaitMs = 60000) {
    const http = require('http');
    const start = Date.now();
    console.log(`[Electron] Waiting for backend at http://127.0.0.1:${API_CONFIG.port}/health...`);
    
    while (Date.now() - start < maxWaitMs) {
        try {
            await new Promise((resolve, reject) => {
                const req = http.get(`http://127.0.0.1:${API_CONFIG.port}/health`, {
                    headers: { 'Authorization': `Bearer ${API_CONFIG.token}` }
                }, (res) => {
                    res.resume();
                    if (res.statusCode === 200) resolve();
                    else reject(new Error(`Status ${res.statusCode}`));
                });
                req.on('error', reject);
                req.setTimeout(1000, () => { req.destroy(); reject(new Error('timeout')); });
            });
            console.log('[Electron] Backend is ready!');
            return true;
        } catch (e) {
            // console.log(`[Electron] Backend not ready yet... (${e.message})`);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    console.log('[Electron] Backend wait timeout, opening window anyway.');
    return false;
}

function startBackend() {
    console.log('[Electron] Starting backend process...');
    const fs = require('fs');
    const logFile = path.join(app.getPath('userData'), 'backend.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    let backendProcess;
    const isDev = !app.isPackaged;
    
    logStream.write(`\n[${new Date().toISOString()}] Starting backend... Dev: ${isDev}\n`);

    if (isDev) {
        const backendPath = path.join(__dirname, '../../backend/api.py');
        const cmds = ['python', 'py', 'python3'];
        let started = false;

        for (const cmd of cmds) {
            try {
                backendProcess = spawn(cmd, [backendPath, '--port', API_CONFIG.port, '--token', API_CONFIG.token], {
                    cwd: path.join(__dirname, '../../backend'),
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
                });
                started = true;
                console.log(`[Electron] Backend started with command: ${cmd}`);
                break;
            } catch (e) {
                logStream.write(`Failed to start with ${cmd}: ${e.message}\n`);
            }
        }

        if (!started) {
            console.error(`[Electron] CRITICAL: Could not find any python command.`);
            return;
        }
    } else {
        const backendPath = path.join(process.resourcesPath, 'backend', 'aurasync-backend.exe');
        backendProcess = spawn(backendPath, ['--port', API_CONFIG.port, '--token', API_CONFIG.token]);
    }

    backendProcess.stdout.on('data', (data) => {
        console.log(`[Backend]: ${data}`);
        logStream.write(`[STDOUT]: ${data}\n`);
    });

    backendProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error]: ${data}`);
        logStream.write(`[STDERR]: ${data}\n`);
    });

    backendProcess.on('close', (code) => {
        console.log(`[Electron] Backend process exited with code ${code}`);
    });
    
    pythonBackend = backendProcess;
}

app.whenReady().then(async () => {
    console.log('[Electron] App ready, initializing...');
    
    // Register API config handler immediately (before any awaits)
    ipcMain.handle('get-api-config', () => API_CONFIG);
    
    // Check if a backend instance is already running on port 8000 (e.g. dev terminal)
    const http = require('http');
    const isPort8000Alive = await new Promise(resolve => {
        const req = http.get('http://127.0.0.1:8000/', (res) => resolve(res.statusCode === 200));
        req.on('error', () => resolve(false));
        req.setTimeout(600, () => { req.destroy(); resolve(false); });
    });

    if (isPort8000Alive) {
        console.log('[Electron] Reusing existing backend on http://127.0.0.1:8000');
        API_CONFIG.port = 8000;
        API_CONFIG.token = '';
    } else {
        API_CONFIG.port = await getFreePort();
        startBackend();
    }
    
    // Start window immediately
    createWindow();
    
    // IPC: scan all drives A-Z except C
    ipcMain.handle('organizer:get-default-roots', () => {
        const fs = require('fs');
        const os = require('os');
        const drives = [];
        
        // On Windows, check drives A-Z
        if (process.platform === 'win32') {
            for (let i = 65; i <= 90; i++) { // A to Z
                const drive = String.fromCharCode(i) + ':\\';
                if (drive === 'C:\\') continue;
                try {
                    if (fs.existsSync(drive)) {
                        if (!drives.includes(drive)) drives.push(drive);
                    }
                } catch (e) {}
            }
        }
        return drives;
    });

    // IPC: file opening
    ipcMain.handle('file:open', async (event, filePath) => {
        const { shell } = require('electron');
        try {
            await shell.openPath(filePath);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // IPC: organizer start (optional fallback)
    ipcMain.handle('organizer:start', async (event, opts) => {
        return { success: true, message: 'IPC start received' };
    });

    // We still wait for backend for other IPC initializations
    waitForBackend();
});

app.on('window-all-closed', () => {
    if (pythonBackend) pythonBackend.kill();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    if (pythonBackend) pythonBackend.kill();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
