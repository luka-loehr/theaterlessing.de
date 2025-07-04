class Soundboard {
    constructor() {
        this.audioContext = null;
        this.sounds = new Map();
        this.currentlyPlaying = null;
        this.fadeTime = 1.5;
        this.soundFiles = [
            'Desert Eagle Gunshot Sound Effect.mp3',
            'Die Feldlerche Vogel des Jahres 2019.mp3',
            'Human Whistling Sound Effect 10.mp3',
            'Mendelssohn Wedding March.mp3',
            'Nightingale Songs.mp3',
            'Old Phone Ringtone.mp3'
        ];
        this.init();
    }

    async init() {
        this.createAudioContext();
        await this.preloadSounds();
        this.createButtons();
    }

    createAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    async preloadSounds() {
        const loadPromises = this.soundFiles.map(async (filename) => {
            try {
                const response = await fetch(`sounds/${filename}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                this.sounds.set(filename, {
                    buffer: audioBuffer,
                    source: null,
                    gainNode: null,
                    isPlaying: false,
                    startTime: 0,
                    pausedAt: 0
                });
            } catch (error) {
                console.error(`Failed to load ${filename}:`, error);
            }
        });

        await Promise.all(loadPromises);
    }

    createButtons() {
        const soundboard = document.getElementById('soundboard');
        
        this.soundFiles.forEach(filename => {
            const button = document.createElement('button');
            button.className = 'sound-button';
            button.textContent = filename.replace(/\.[^/.]+$/, '');
            button.dataset.filename = filename;
            
            button.addEventListener('click', () => this.toggleSound(filename, button));
            
            soundboard.appendChild(button);
        });
    }

    async toggleSound(filename, button) {
        const sound = this.sounds.get(filename);
        
        if (!sound) return;

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        if (sound.isPlaying && this.currentlyPlaying === filename) {
            this.fadeOut(filename, button);
        } else {
            if (this.currentlyPlaying && this.currentlyPlaying !== filename) {
                const currentButton = document.querySelector(`[data-filename="${this.currentlyPlaying}"]`);
                await this.fadeOut(this.currentlyPlaying, currentButton);
            }
            this.fadeIn(filename, button);
        }
    }

    fadeIn(filename, button) {
        const sound = this.sounds.get(filename);
        
        sound.source = this.audioContext.createBufferSource();
        sound.source.buffer = sound.buffer;
        
        sound.gainNode = this.audioContext.createGain();
        sound.gainNode.gain.value = 0;
        
        sound.source.connect(sound.gainNode);
        sound.gainNode.connect(this.audioContext.destination);
        
        // Start playback with specific offsets for certain sounds
        if (filename === 'Desert Eagle Gunshot Sound Effect.mp3') {
            sound.source.start(0, 1);
        } else if (filename === 'Mendelssohn Wedding March.mp3') {
            sound.source.start(0, 5);
        } else {
            sound.source.start(0);
        }
        sound.startTime = this.audioContext.currentTime;
        
        sound.gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + this.fadeTime);
        
        sound.isPlaying = true;
        this.currentlyPlaying = filename;
        button.classList.add('playing');
        
        sound.source.onended = () => {
            if (sound.isPlaying) {
                sound.isPlaying = false;
                button.classList.remove('playing');
                if (this.currentlyPlaying === filename) {
                    this.currentlyPlaying = null;
                }
            }
        };
    }

    fadeOut(filename, button) {
        return new Promise((resolve) => {
            const sound = this.sounds.get(filename);
            
            if (!sound || !sound.source || !sound.isPlaying) {
                resolve();
                return;
            }
            
            const currentTime = this.audioContext.currentTime;
            sound.gainNode.gain.linearRampToValueAtTime(0, currentTime + this.fadeTime);
            
            setTimeout(() => {
                if (sound.source) {
                    sound.source.stop();
                    sound.source.disconnect();
                    sound.gainNode.disconnect();
                }
                
                sound.isPlaying = false;
                sound.source = null;
                sound.gainNode = null;
                button.classList.remove('playing');
                
                if (this.currentlyPlaying === filename) {
                    this.currentlyPlaying = null;
                }
                
                resolve();
            }, this.fadeTime * 1000);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Soundboard();
});