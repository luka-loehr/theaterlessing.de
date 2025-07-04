const express = require('express');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV === 'development';

// Middleware for logging in dev mode
if (isDev) {
    app.use(morgan('dev'));
    console.log('[DEBUG] Starting server in DEVELOPMENT mode');
    console.log('[DEBUG] Extensive logging enabled');
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/sounds', express.static(path.join(__dirname, 'sounds')));

// API endpoint to get available sounds
app.get('/api/sounds', (req, res) => {
    if (isDev) console.log('[DEBUG] GET /api/sounds - Fetching sound files');
    
    const soundsDir = path.join(__dirname, 'sounds');
    
    fs.readdir(soundsDir, (err, files) => {
        if (err) {
            if (isDev) console.error('[DEBUG] Error reading sounds directory:', err);
            return res.status(500).json({ error: 'Could not read sounds directory' });
        }
        
        const soundFiles = files.filter(file => {
            const isSound = file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.ogg');
            if (isDev && isSound) console.log(`[DEBUG] Found sound file: ${file}`);
            return isSound;
        });
        
        if (isDev) console.log(`[DEBUG] Total sound files found: ${soundFiles.length}`);
        res.json(soundFiles);
    });
});

// Debug middleware for development
if (isDev) {
    app.use((req, res, next) => {
        console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
        console.log('[DEBUG] Headers:', req.headers);
        next();
    });
}

// Serve index.html for root
app.get('/', (req, res) => {
    if (isDev) console.log('[DEBUG] Serving index.html');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
    const url = `http://localhost:${PORT}`;
    console.log(`[SERVER] Soundboard server running on ${url}`);
    if (isDev) {
        console.log('[DEBUG] Available routes:');
        console.log('[DEBUG]   GET / - Main soundboard page');
        console.log('[DEBUG]   GET /api/sounds - List of available sounds');
        console.log('[DEBUG]   GET /sounds/* - Sound files');
    }
    
    // Automatically open browser
    console.log('[SERVER] Opening browser...');
    try {
        const open = (await import('open')).default;
        await open(url);
    } catch (err) {
        console.error('[SERVER] Failed to open browser:', err.message);
    }
});