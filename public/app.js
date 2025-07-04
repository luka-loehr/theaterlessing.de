class Soundboard {
    constructor() {
        this.audioContext = null;
        this.sounds = new Map();
        this.currentlyPlaying = null;
        this.fadeTime = 1.5;
        this.debugMode = window.location.search.includes('debug=true') || 
                        window.location.hostname === 'localhost';
        this.statusText = null;
        this.init();
    }

    log(message, type = 'info') {
        if (!this.debugMode) return;
        
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const logMessage = `[${timestamp}] ${message}`;
        console.log(`[${type.toUpperCase()}] ${logMessage}`);
    }

    async init() {
        this.log('Initializing soundboard...');
        
        this.statusText = document.querySelector('.status-text');
        this.updateStatus('Initializing...');
        
        try {
            this.createAudioContext();
            const soundFiles = await this.fetchSoundList();
            await this.preloadSounds(soundFiles);
            this.createButtons(soundFiles);
            this.log('Soundboard initialized successfully');
            this.updateStatus('Ready');
        } catch (error) {
            this.log(`Initialization error: ${error.message}`, 'error');
            this.updateStatus('Error');
        }
    }

    createAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.log(`AudioContext created. State: ${this.audioContext.state}`);
            
            // Handle Safari's auto-play policy
            if (this.audioContext.state === 'suspended') {
                document.addEventListener('click', () => {
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume().then(() => {
                            this.log('AudioContext resumed after user interaction');
                        });
                    }
                }, { once: true });
            }
        } catch (error) {
            this.log(`Failed to create AudioContext: ${error.message}`, 'error');
            throw error;
        }
    }

    async fetchSoundList() {
        this.log('Fetching sound list from server...');
        try {
            const response = await fetch('/api/sounds');
            const soundFiles = await response.json();
            this.log(`Received ${soundFiles.length} sound files from server`);
            soundFiles.forEach(file => this.log(`Found: ${file}`));
            return soundFiles;
        } catch (error) {
            this.log(`Failed to fetch sound list: ${error.message}`, 'error');
            throw error;
        }
    }

    async preloadSounds(soundFiles) {
        this.log('Starting sound preload...');
        const loadPromises = soundFiles.map(async (filename) => {
            try {
                this.log(`Loading: ${filename}`);
                const response = await fetch(`/sounds/${filename}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                this.log(`Downloaded ${filename} (${arrayBuffer.byteLength} bytes)`);
                
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.log(`Decoded ${filename} - Duration: ${audioBuffer.duration.toFixed(2)}s, Sample rate: ${audioBuffer.sampleRate}Hz`);
                
                this.sounds.set(filename, {
                    buffer: audioBuffer,
                    source: null,
                    gainNode: null,
                    isPlaying: false,
                    startTime: 0
                });
                
                return { filename, status: 'success' };
            } catch (error) {
                this.log(`Failed to load ${filename}: ${error.message}`, 'error');
                return { filename, status: 'failed', error: error.message };
            }
        });

        const results = await Promise.all(loadPromises);
        const successful = results.filter(r => r.status === 'success').length;
        this.log(`Preload complete: ${successful}/${soundFiles.length} sounds loaded successfully`);
    }

    updateStatus(text) {
        if (this.statusText) {
            this.statusText.textContent = text;
        }
    }

    createButtons(soundFiles) {
        this.log('Creating sound buttons...');
        const soundboard = document.getElementById('soundboard');
        
        soundFiles.forEach(filename => {
            if (!this.sounds.has(filename)) {
                this.log(`Skipping button for failed sound: ${filename}`, 'warn');
                return;
            }
            
            const button = document.createElement('button');
            button.className = 'sound-button';
            
            // German display names
            const displayNames = {
                'Desert Eagle Gunshot Sound Effect.mp3': 'Waffe',
                'Die Feldlerche Vogel des Jahres 2019.mp3': 'Lerche',
                'Human Whistling Sound Effect 10.mp3': 'Pfeifen',
                'Love Me Tender Elvis Presley.mp3': 'Love Me Tender',
                'Mendelssohn Wedding March.mp3': 'Hochzeit',
                'Nightingale Songs.mp3': 'Nachtigall',
                'Old Phone Ringtone.mp3': 'Telefon',
                'Pausenmusik.mp3': 'Pausenmusik'
            };
            
            button.textContent = displayNames[filename] || filename.replace(/\.[^/.]+$/, '');
            button.dataset.filename = filename;
            
            button.addEventListener('click', () => this.toggleSound(filename, button));
            
            soundboard.appendChild(button);
            this.log(`Created button for: ${filename}`);
        });
    }

    async toggleSound(filename, button) {
        const sound = this.sounds.get(filename);
        
        if (!sound) {
            this.log(`Sound not found: ${filename}`, 'error');
            return;
        }

        this.log(`Toggle sound: ${filename} (currently ${sound.isPlaying ? 'playing' : 'stopped'})`);

        // Resume audio context if needed
        if (this.audioContext.state === 'suspended') {
            this.log('AudioContext suspended, attempting to resume...');
            await this.audioContext.resume();
            this.log(`AudioContext state: ${this.audioContext.state}`);
        }

        if (sound.isPlaying && this.currentlyPlaying === filename) {
            this.log(`Stopping: ${filename}`);
            this.fadeOut(filename, button);
        } else {
            if (this.currentlyPlaying && this.currentlyPlaying !== filename) {
                this.log(`Stopping current sound: ${this.currentlyPlaying}`);
                const currentButton = document.querySelector(`[data-filename="${this.currentlyPlaying}"]`);
                await this.fadeOut(this.currentlyPlaying, currentButton);
            }
            this.log(`Starting: ${filename}`);
            this.fadeIn(filename, button);
        }
    }

    fadeIn(filename, button) {
        const sound = this.sounds.get(filename);
        
        try {
            // Create new source
            sound.source = this.audioContext.createBufferSource();
            sound.source.buffer = sound.buffer;
            
            // Create gain node for fade
            sound.gainNode = this.audioContext.createGain();
            sound.gainNode.gain.value = 0;
            
            // Connect nodes
            sound.source.connect(sound.gainNode);
            sound.gainNode.connect(this.audioContext.destination);
            
            // Start playback
            if (filename === 'Human Whistling Sound Effect 10.mp3') {
                // For whistling sound, only play first 1.4 seconds
                sound.source.start(0, 0, 1.4);
                this.log(`Playing ${filename} - limited to 1.4 seconds`);
            } else if (filename === 'Nightingale Songs.mp3') {
                // For nightingale, skip first 6 seconds
                sound.source.start(0, 6);
                this.log(`Playing ${filename} - starting from 6 seconds`);
            } else if (filename === 'Desert Eagle Gunshot Sound Effect.mp3') {
                // For desert eagle, skip first 1 second
                sound.source.start(0, 1);
                this.log(`Playing ${filename} - starting from 1 second`);
            } else if (filename === 'Mendelssohn Wedding March.mp3') {
                // For wedding march, skip first 3 seconds
                sound.source.start(0, 3);
                this.log(`Playing ${filename} - starting from 3 seconds`);
            } else if (filename === 'Love Me Tender Elvis Presley.mp3') {
                // For Love Me Tender, play normally
                sound.source.start(0);
                this.log(`Playing ${filename} - will start fade at 1:41`);
                
                // Schedule automatic fade out starting at 1:41 (101 seconds)
                const fadeStartTime = 101; // 1 minute 41 seconds
                const fadeOutDuration = 10; // 10 second fade
                
                // Start fade out at 1:41
                setTimeout(() => {
                    if (sound.isPlaying && this.currentlyPlaying === filename) {
                        this.log(`Starting automatic 10s fade out for ${filename}`);
                        
                        // Cancel any ongoing ramps and set current value to 1
                        sound.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
                        sound.gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
                        
                        // Start fade out to 0 over 10 seconds
                        sound.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + fadeOutDuration);
                        
                        // Stop after fade completes (at 1:51)
                        setTimeout(() => {
                            if (sound.source && sound.isPlaying) {
                                sound.source.stop();
                                sound.isPlaying = false;
                                button.classList.remove('playing');
                                if (this.currentlyPlaying === filename) {
                                    this.currentlyPlaying = null;
                                    this.updateStatus('Ready');
                                }
                            }
                        }, fadeOutDuration * 1000);
                    }
                }, fadeStartTime * 1000);
            } else {
                sound.source.start(0);
            }
            sound.startTime = this.audioContext.currentTime;
            
            // Fade in
            sound.gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + this.fadeTime);
            
            // Update state
            sound.isPlaying = true;
            this.currentlyPlaying = filename;
            button.classList.add('playing');
            
            this.log(`Started fade in: ${filename}, duration: ${this.fadeTime}s`);
            this.updateStatus(`Playing: ${filename.replace(/\.[^/.]+$/, '')}`);
            
            // Handle end of playback
            sound.source.onended = () => {
                this.log(`Sound ended naturally: ${filename}`);
                if (sound.isPlaying) {
                    sound.isPlaying = false;
                    button.classList.remove('playing');
                    if (this.currentlyPlaying === filename) {
                        this.currentlyPlaying = null;
                        this.updateStatus('Ready');
                    }
                }
            };
        } catch (error) {
            this.log(`Error starting sound ${filename}: ${error.message}`, 'error');
            sound.isPlaying = false;
            button.classList.remove('playing');
        }
    }

    fadeOut(filename, button) {
        return new Promise((resolve) => {
            const sound = this.sounds.get(filename);
            
            if (!sound || !sound.source || !sound.isPlaying) {
                this.log(`Cannot fade out ${filename} - not playing`, 'warn');
                resolve();
                return;
            }
            
            try {
                // Immediately remove playing class to shrink button
                button.classList.remove('playing');
                
                // Check if this is the phone ringtone - if so, stop immediately without fade
                if (filename === 'Old Phone Ringtone.mp3') {
                    this.log(`Stopping ${filename} immediately without fade`);
                    
                    if (sound.source) {
                        try {
                            sound.source.stop();
                            sound.source.disconnect();
                            sound.gainNode.disconnect();
                        } catch (e) {
                            this.log(`Error stopping ${filename}: ${e.message}`, 'warn');
                        }
                    }
                    
                    sound.isPlaying = false;
                    sound.source = null;
                    sound.gainNode = null;
                    
                    if (this.currentlyPlaying === filename) {
                        this.currentlyPlaying = null;
                        this.updateStatus('Ready');
                    }
                    
                    resolve();
                    return;
                }
                
                // For all other sounds, do the normal fade out
                button.classList.add('fading');
                
                // Custom fade duration for specific sounds
                let fadeDuration = this.fadeTime; // Default 1.5 seconds
                if (filename === 'Mendelssohn Wedding March.mp3') {
                    fadeDuration = 5; // 5 second fade for wedding march
                } else if (filename === 'Pausenmusik.mp3') {
                    fadeDuration = 5; // 5 second fade for Pausenmusik
                }
                
                const currentTime = this.audioContext.currentTime;
                sound.gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeDuration);
                
                this.log(`Started fade out: ${filename}, duration: ${fadeDuration}s`);
                
                // Update status immediately
                if (this.currentlyPlaying === filename) {
                    this.currentlyPlaying = null;
                    this.updateStatus('Ready');
                }
                
                setTimeout(() => {
                    if (sound.source) {
                        try {
                            sound.source.stop();
                            sound.source.disconnect();
                            sound.gainNode.disconnect();
                            this.log(`Stopped and disconnected: ${filename}`);
                        } catch (e) {
                            this.log(`Error stopping ${filename}: ${e.message}`, 'warn');
                        }
                    }
                    
                    sound.isPlaying = false;
                    sound.source = null;
                    sound.gainNode = null;
                    button.classList.remove('fading');
                    
                    resolve();
                }, fadeDuration * 1000);
            } catch (error) {
                this.log(`Error during fade out ${filename}: ${error.message}`, 'error');
                button.classList.remove('playing', 'fading');
                resolve();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Soundboard();
});