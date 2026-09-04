// Study Techniques Hub - Main JavaScript File
// Using modular approach with reusable functions and classes

class StudyTechniquesApp {
    constructor() {
        this.currentTechnique = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSavedData();
    }

    setupEventListeners() {
        // Technique selector buttons
        document.querySelectorAll('.technique-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const technique = e.currentTarget.dataset.technique;
                this.switchTechnique(technique);
            });
        });
    }

    switchTechnique(technique) {
        // Hide all panels
        document.querySelectorAll('.technique-panel').forEach(panel => {
            panel.classList.add('hidden');
        });

        // Remove active class from all buttons
        document.querySelectorAll('.technique-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected panel and activate button
        const panel = document.getElementById(technique);
        const button = document.querySelector(`[data-technique="${technique}"]`);
        
        if (panel && button) {
            panel.classList.remove('hidden');
            button.classList.add('active');
            this.currentTechnique = technique;
        }
    }

    loadSavedData() {
        // Load any saved data from localStorage
        const savedTechnique = localStorage.getItem('lastTechnique');
        if (savedTechnique) {
            this.switchTechnique(savedTechnique);
        }
    }

    saveTechnique() {
        if (this.currentTechnique) {
            localStorage.setItem('lastTechnique', this.currentTechnique);
        }
    }
}

// Pomodoro Timer Class
class PomodoroTimer {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.currentTime = 25 * 60; // 25 minutes in seconds
        this.workTime = Math.max(5, 25) * 60; // Minimum 5 minutes
        this.breakTime = Math.max(5, 5) * 60; // Minimum 5 minutes
        this.isBreakTime = false;
        this.sessionCount = 1;
        this.intervalId = null;
        
        this.setupEventListeners();
        this.updateDisplay();
        this.initializeSounds();
    }

    initializeSounds() {
        // Create audio objects for sound cues
        this.startSound = new Audio();
        this.startSound.volume = 0.7;
        
        this.endSound = new Audio();
        this.endSound.volume = 0.8;
        
        // Using Web Audio API to generate simple tones
        this.createStartSound();
        this.createEndSound();
    }

    createStartSound() {
        // Create a bell-like "ting!" sound for start
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const duration = 0.8;
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate bell-like sound with harmonics
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-4 * t); // Quick decay for bell effect
            
            // Bell harmonics - multiple frequencies for rich sound
            const fundamental = Math.sin(2 * Math.PI * 880 * t); // A5
            const harmonic2 = Math.sin(2 * Math.PI * 1760 * t) * 0.5; // A6
            const harmonic3 = Math.sin(2 * Math.PI * 2640 * t) * 0.25; // E7
            const harmonic4 = Math.sin(2 * Math.PI * 3520 * t) * 0.125; // A7
            
            data[i] = (fundamental + harmonic2 + harmonic3 + harmonic4) * envelope * 0.4;
        }
        
        // Convert to blob URL
        this.bufferToWav(buffer).then(blob => {
            this.startSound.src = URL.createObjectURL(blob);
        });
    }

    createEndSound() {
        // Create a triple bell "ting-ting-ting!" sound for completion
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const duration = 2.0;
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate triple bell sound
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            let signal = 0;
            
            // First bell at t=0
            if (t < 0.6) {
                const envelope1 = Math.exp(-6 * t);
                const bell1 = Math.sin(2 * Math.PI * 880 * t) + 
                             Math.sin(2 * Math.PI * 1760 * t) * 0.5 + 
                             Math.sin(2 * Math.PI * 2640 * t) * 0.25;
                signal += bell1 * envelope1;
            }
            
            // Second bell at t=0.4
            if (t >= 0.4 && t < 1.0) {
                const t2 = t - 0.4;
                const envelope2 = Math.exp(-6 * t2);
                const bell2 = Math.sin(2 * Math.PI * 1046.5 * t2) + // C6
                             Math.sin(2 * Math.PI * 2093 * t2) * 0.5 + 
                             Math.sin(2 * Math.PI * 3139.5 * t2) * 0.25;
                signal += bell2 * envelope2 * 0.8;
            }
            
            // Third bell at t=0.8
            if (t >= 0.8) {
                const t3 = t - 0.8;
                const envelope3 = Math.exp(-6 * t3);
                const bell3 = Math.sin(2 * Math.PI * 1174.7 * t3) + // D6
                             Math.sin(2 * Math.PI * 2349.3 * t3) * 0.5 + 
                             Math.sin(2 * Math.PI * 3524 * t3) * 0.25;
                signal += bell3 * envelope3 * 0.6;
            }
            
            data[i] = signal * 0.3;
        }
        
        this.bufferToWav(buffer).then(blob => {
            this.endSound.src = URL.createObjectURL(blob);
        });
    }

    async bufferToWav(buffer) {
        const length = buffer.length;
        const arrayBuffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(arrayBuffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, buffer.sampleRate, true);
        view.setUint32(28, buffer.sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * 2, true);
        
        // Convert audio data
        const data = buffer.getChannelData(0);
        let offset = 44;
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    playStartSound() {
        try {
            this.startSound.currentTime = 0;
            this.startSound.play().catch(e => console.log('Could not play start sound:', e));
        } catch (e) {
            console.log('Start sound not available:', e);
        }
    }

    playEndSound() {
        try {
            this.endSound.currentTime = 0;
            this.endSound.play().catch(e => console.log('Could not play end sound:', e));
        } catch (e) {
            console.log('End sound not available:', e);
        }
    }

    setupEventListeners() {
        document.getElementById('start-timer').addEventListener('click', () => this.start());
        document.getElementById('pause-timer').addEventListener('click', () => this.pause());
        document.getElementById('reset-timer').addEventListener('click', () => this.reset());
        
        document.getElementById('work-minutes').addEventListener('change', (e) => {
            const minutes = Math.max(5, parseInt(e.target.value)); // Minimum 5 minutes
            e.target.value = minutes; // Update the input field to reflect the minimum
            this.workTime = minutes * 60;
            if (!this.isBreakTime) {
                this.currentTime = this.workTime;
                this.updateDisplay();
            }
        });

        document.getElementById('break-minutes').addEventListener('change', (e) => {
            const minutes = Math.max(5, parseInt(e.target.value)); // Minimum 5 minutes
            e.target.value = minutes; // Update the input field to reflect the minimum
            this.breakTime = minutes * 60;
            if (this.isBreakTime) {
                this.currentTime = this.breakTime;
                this.updateDisplay();
            }
        });
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.isPaused = false;
            this.playStartSound(); // Play start sound
            this.intervalId = setInterval(() => this.tick(), 1000);
            
            // Show SweetAlert notification
            CustomModal.fire({
                title: 'Timer Started!',
                text: this.isBreakTime ? 'Break time has begun' : 'Focus time has begun',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
    }

    pause() {
        if (this.isRunning) {
            this.isRunning = false;
            this.isPaused = true;
            clearInterval(this.intervalId);
            
            // Show pause notification
            CustomModal.fire({
                title: 'Timer Paused',
                text: 'Take your time, click resume when ready',
                icon: 'warning',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else if (this.isPaused) {
            this.start();
        }
    }

    reset() {
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this.intervalId);
        this.currentTime = this.isBreakTime ? this.breakTime : this.workTime;
        this.updateDisplay();
        
        // Show reset notification
        CustomModal.fire({
            title: 'Timer Reset',
            text: 'Timer has been reset to initial time',
            icon: 'info',
            timer: 1500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    tick() {
        this.currentTime--;
        this.updateDisplay();

        if (this.currentTime <= 0) {
            this.sessionComplete();
        }
    }

    sessionComplete() {
        this.isRunning = false;
        clearInterval(this.intervalId);
        
        // Play completion sound
        this.playEndSound();
        
        // Show notification with SweetAlert
        this.showNotification();
        
        // Switch between work and break
        this.isBreakTime = !this.isBreakTime;
        
        if (!this.isBreakTime) {
            this.sessionCount++;
        }
        
        this.currentTime = this.isBreakTime ? this.breakTime : this.workTime;
        this.updateSessionInfo();
        this.updateDisplay();
    }

    showNotification() {
        const isWorkComplete = !this.isBreakTime; // About to switch to break
        
        if (isWorkComplete) {
            // Work session completed
            CustomModal.fire({
                title: '🎉 Work Session Complete!',
                text: 'Great job! Time for a well-deserved break.',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Start Break',
                cancelButtonText: 'Skip Break',
                confirmButtonColor: '#48bb78',
                cancelButtonColor: '#667eea'
            }).then((result) => {
                if (result.isConfirmed) {
                    this.start();
                }
            });
        } else {
            // Break session completed
            CustomModal.fire({
                title: '⚡ Break Time Over!',
                text: 'Ready to focus again? Let\'s get back to work!',
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Start Work',
                cancelButtonText: 'Take More Break',
                confirmButtonColor: '#667eea',
                cancelButtonColor: '#f6ad55'
            }).then((result) => {
                if (result.isConfirmed) {
                    this.start();
                }
            });
        }
        
        // Browser notification if permission granted
        if (Notification.permission === "granted") {
            const message = isWorkComplete ? 
                "Work session complete! Time for a break!" : 
                "Break time is over! Ready to focus?";
            new Notification("Pomodoro Timer", { 
                body: message,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍅</text></svg>'
            });
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = this.currentTime % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('timer-text').textContent = timeString;
    }

    updateSessionInfo() {
        document.getElementById('session-count').textContent = this.sessionCount;
        document.getElementById('session-type').textContent = this.isBreakTime ? 'Break' : 'Work';
    }

    // Request notification permission
    static requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}

class CustomModal {
    static fire(arg1, arg2, arg3) {
        let options = arg1;
        if (typeof arg1 === 'string') {
            options = { title: arg1, text: arg2, icon: arg3 };
        }
        if (options.toast) {
            return this.showToast(options);
        }
        return new Promise((resolve) => {
            const overlay = document.getElementById('custom-modal');
            document.getElementById('modal-title').textContent = options.title || '';
            document.getElementById('modal-text').innerHTML = options.text || '';
            const btnContainer = document.getElementById('modal-buttons');
            btnContainer.innerHTML = '';
            if (options.showCancelButton) {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'btn-secondary';
                cancelBtn.textContent = options.cancelButtonText || 'Cancel';
                cancelBtn.onclick = () => { overlay.classList.add('hidden'); resolve({ isConfirmed: false }); };
                btnContainer.appendChild(cancelBtn);
            }
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'btn-primary';
            confirmBtn.textContent = options.confirmButtonText || 'OK';
            confirmBtn.onclick = () => { overlay.classList.add('hidden'); resolve({ isConfirmed: true }); };
            btnContainer.appendChild(confirmBtn);
            overlay.classList.remove('hidden');
        });
    }
    static showToast(options) {
        const toast = document.getElementById('custom-toast');
        document.getElementById('toast-text').textContent = options.title || options.text || '';
        toast.classList.remove('hidden');
        const iconSpan = document.getElementById('toast-icon');
        if (options.icon === 'success') iconSpan.textContent = '✅';
        else if (options.icon === 'warning') iconSpan.textContent = '⚠️';
        else if (options.icon === 'info') iconSpan.textContent = 'ℹ️';
        else if (options.icon === 'error') iconSpan.textContent = '❌';
        else iconSpan.textContent = '';
        setTimeout(() => { toast.classList.add('hidden'); }, options.timer || 3000);
        return Promise.resolve({ isConfirmed: true });
    }
}

// Utility Functions
class Utils {
    static formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    static shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    static loadFromLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return defaultValue;
        }
    }
}

// PDF Notes System
class PdfNotesSystem {
    constructor() {
        this.fileInput = document.getElementById('pdf-file-input');
        this.uploadBox = document.querySelector('.upload-box');
        this.loadingState = document.getElementById('pdf-loading-state');
        this.notesResult = document.getElementById('pdf-notes-result');
        this.notesContent = document.getElementById('generated-notes-content');
        this.resetBtn = document.getElementById('reset-pdf-btn');
        this.exportBtn = document.getElementById('export-pdf-btn');

        this.supabaseUrl = 'https://kcwlzexmmjbbarltxfvv.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjd2x6ZXhtbWpiYmFybHR4ZnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MTczODIsImV4cCI6MjEwNDA5MzM4Mn0.RO_ZbiG1R1ycstSidkeMz11Bml3-hn35GGfHfVAtEjU';
        
        if (window.supabase) {
            this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
        }

        if (this.fileInput && this.uploadBox) {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.resetBtn.addEventListener('click', () => this.resetState());
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportAsPdf());
        }

        this.uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadBox.style.borderColor = '#3b82f6';
            this.uploadBox.style.background = '#eff6ff';
        });

        this.uploadBox.addEventListener('dragleave', () => {
            this.uploadBox.style.borderColor = '#d1d5db';
            this.uploadBox.style.background = '#f9fafb';
        });

        this.uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadBox.style.borderColor = '#d1d5db';
            this.uploadBox.style.background = '#f9fafb';
            
            if (e.dataTransfer.files.length) {
                this.fileInput.files = e.dataTransfer.files;
                this.handleFileUpload({ target: this.fileInput });
            }
        });
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.type !== 'application/pdf') {
            CustomModal.fire('Error', 'Please select a valid PDF file.', 'error');
            return;
        }

        this.uploadBox.classList.add('hidden');
        this.loadingState.classList.remove('hidden');

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            const { error: uploadError } = await this.supabase.storage
                .from('pdfs')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data, error: functionError } = await this.supabase.functions.invoke('process-pdf', {
                body: { filePath: filePath }
            });

            if (functionError) {
                const errDetails = await functionError.context?.json().catch(() => null);
                console.error("Edge Function Error Details:", JSON.stringify(errDetails, null, 2));
                throw functionError;
            }

            this.displayNotes(data.notesHtml);

        } catch (error) {
            console.error('Error processing PDF:', error);
            CustomModal.fire('Error', 'Failed to process the PDF. Please try again.', 'error');
            this.resetState();
        }
    }

    displayNotes(htmlContent) {
        this.loadingState.classList.add('hidden');
        this.notesResult.classList.remove('hidden');
        this.notesContent.innerHTML = htmlContent;
    }

    resetState() {
        this.fileInput.value = '';
        this.uploadBox.classList.remove('hidden');
        this.loadingState.classList.add('hidden');
        this.notesResult.classList.add('hidden');
        this.notesContent.innerHTML = '';
    }

    exportAsPdf() {
        const content = this.notesContent;
        if (!content || !content.innerHTML.trim()) {
            CustomModal.fire('No Notes', 'There are no notes to export yet.', 'warning');
            return;
        }

        const clone = document.createElement('div');
        clone.innerHTML = content.innerHTML;
        clone.style.cssText = 'font-family: Inter, sans-serif; color: #1a1a1a; padding: 20px; line-height: 1.6; column-count: 2; column-gap: 24px; column-rule: 1px solid #ddd; font-size: 11px;';

        clone.querySelectorAll('.slide-section').forEach(el => {
            el.style.cssText = 'break-inside: avoid; margin-bottom: 10px; padding-bottom: 6px;';
        });
        clone.querySelectorAll('hr').forEach(el => {
            el.style.cssText = 'border: none; border-top: 1px dashed #ccc; margin: 8px 0;';
        });
        clone.querySelectorAll('h3').forEach(el => {
            el.style.cssText = 'font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #2d2d2d; border-bottom: 1.5px solid #7a9a7e; padding-bottom: 4px; break-after: avoid;';
        });
        clone.querySelectorAll('h4').forEach(el => {
            el.style.cssText = 'font-size: 12px; font-weight: 600; margin-top: 8px; margin-bottom: 4px; color: #3a5a3e; break-after: avoid;';
        });
        clone.querySelectorAll('ul, ol').forEach(el => {
            el.style.cssText = 'margin-left: 14px; margin-bottom: 6px;';
        });
        clone.querySelectorAll('li').forEach(el => {
            el.style.cssText = 'margin-bottom: 3px; font-size: 11px;';
        });
        clone.querySelectorAll('strong').forEach(el => {
            el.style.cssText = 'color: #2d4a31;';
        });

        const opt = {
            margin: [10, 12, 10, 12],
            filename: 'study-notes.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        clone.style.position = 'absolute';
        clone.style.left = '-9999px';
        clone.style.width = '770px';
        document.body.appendChild(clone);

        html2pdf().set(opt).from(clone).save().then(() => {
            document.body.removeChild(clone);
            CustomModal.showToast({ title: 'PDF exported successfully!', icon: 'success', timer: 3000 });
        }).catch(err => {
            document.body.removeChild(clone);
            console.error('Export error:', err);
            CustomModal.fire('Export Failed', 'Could not export the PDF. Please try again.', 'error');
        });
    }
}

// Initialize the application when DOM is loaded

class FlashcardSystem {
    constructor() {
        this.cards = [];
        this.currentIndex = 0;
        
        // DOM Elements
        this.emptyState = document.getElementById('flashcard-empty-state');
        this.player = document.getElementById('flashcard-player');
        this.cardElement = document.getElementById('flashcard-card');
        this.sceneElement = document.getElementById('flashcard-scene');
        this.frontText = document.getElementById('flashcard-front-text');
        this.backText = document.getElementById('flashcard-back-text');
        this.currentIdxEl = document.getElementById('current-card-idx');
        this.totalCardsEl = document.getElementById('total-cards');
        
        this.prevBtn = document.getElementById('prev-card-btn');
        this.nextBtn = document.getElementById('next-card-btn');
        this.convertBtn = document.getElementById('convert-flashcards-btn');
        
        if (this.sceneElement) {
            this.setupEventListeners();
        }
    }
    
    setupEventListeners() {
        this.sceneElement.addEventListener('click', () => {
            if (this.cards.length > 0) {
                this.cardElement.classList.toggle('is-flipped');
            }
        });
        
        this.prevBtn.addEventListener('click', () => this.navigate(-1));
        this.nextBtn.addEventListener('click', () => this.navigate(1));
        
        if (this.convertBtn) {
            this.convertBtn.addEventListener('click', () => this.extractFromNotes());
        }
    }
    
    extractFromNotes() {
        const notesContent = document.getElementById('generated-notes-content');
        if (!notesContent || !notesContent.innerHTML.trim()) {
            CustomModal.fire('No Notes', 'Generate notes from a PDF first!', 'warning');
            return;
        }
        
        this.cards = [];
        
        // Parse the notes structure
        // We look for h3/h4 as Front, and everything up to the next h3/h4/hr as Back.
        const children = Array.from(notesContent.children);
        let currentCard = null;
        
        for (let i = 0; i < children.length; i++) {
            const el = children[i];
            const tagName = el.tagName.toLowerCase();
            
            if (tagName === 'h3' || tagName === 'h4') {
                // Save previous card if it has front and back
                if (currentCard && currentCard.front && currentCard.backHtml.trim()) {
                    this.cards.push(currentCard);
                }
                
                // Start a new card
                currentCard = {
                    front: el.innerText.trim(),
                    backHtml: ''
                };
            } else if (tagName !== 'hr') {
                if (currentCard) {
                    currentCard.backHtml += el.outerHTML;
                }
            }
        }
        
        // Push the last card
        if (currentCard && currentCard.front && currentCard.backHtml.trim()) {
            this.cards.push(currentCard);
        }
        
        if (this.cards.length === 0) {
            CustomModal.fire('Extraction Failed', 'Could not find proper structure in the notes to create flashcards.', 'error');
            return;
        }
        
        CustomModal.fire('Success', `Created ${this.cards.length} flashcards from your notes!`, 'success').then(() => {
            // Switch to Flashcards tab
            document.getElementById('flashcards-btn').click();
            this.startSession();
        });
    }
    
    startSession() {
        if (this.cards.length === 0) {
            this.emptyState.classList.remove('hidden');
            this.player.classList.add('hidden');
            return;
        }
        
        this.currentIndex = 0;
        this.emptyState.classList.add('hidden');
        this.player.classList.remove('hidden');
        this.totalCardsEl.textContent = this.cards.length;
        this.showCard();
    }
    
    showCard() {
        const card = this.cards[this.currentIndex];
        this.cardElement.classList.remove('is-flipped');
        
        // Wait for unflip animation before changing content
        setTimeout(() => {
            this.frontText.textContent = card.front;
            this.backText.innerHTML = card.backHtml;
            this.currentIdxEl.textContent = this.currentIndex + 1;
            
            this.prevBtn.disabled = this.currentIndex === 0;
            this.nextBtn.disabled = this.currentIndex === this.cards.length - 1;
        }, 150);
    }
    
    navigate(dir) {
        const newIndex = this.currentIndex + dir;
        if (newIndex >= 0 && newIndex < this.cards.length) {
            this.currentIndex = newIndex;
            this.showCard();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new StudyTechniquesApp();
    const pomodoroTimer = new PomodoroTimer();
    const pdfNotesSystem = new PdfNotesSystem();
    const flashcardSystem = new FlashcardSystem();
    
    PomodoroTimer.requestNotificationPermission();
    
    window.addEventListener('error', (event) => {
        console.error('Application error:', event.error);
    });
    
    window.addEventListener('beforeunload', (event) => {
        app.saveTechnique();
    });
    
    console.log('Study Techniques Hub initialized successfully!');
});
