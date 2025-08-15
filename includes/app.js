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
                const technique = e.target.dataset.technique;
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
        this.workTime = 25 * 60;
        this.breakTime = 5 * 60;
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
            this.workTime = parseInt(e.target.value) * 60;
            if (!this.isBreakTime) {
                this.currentTime = this.workTime;
                this.updateDisplay();
            }
        });

        document.getElementById('break-minutes').addEventListener('change', (e) => {
            this.breakTime = parseInt(e.target.value) * 60;
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
            Swal.fire({
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
            Swal.fire({
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
        Swal.fire({
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
            Swal.fire({
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
            Swal.fire({
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

// Flashcards System Class
class FlashcardsSystem {
    constructor() {
        this.cards = JSON.parse(localStorage.getItem('flashcards')) || [];
        this.currentCardIndex = 0;
        this.isStudying = false;
        this.showingFront = true;
        this.studyQueue = [];
        
        this.setupEventListeners();
        this.updateProgress();
    }

    setupEventListeners() {
        document.getElementById('add-card').addEventListener('click', () => this.addCard());
        document.getElementById('start-study').addEventListener('click', () => this.startStudy());
        document.getElementById('flip-card').addEventListener('click', () => this.flipCard());
        document.getElementById('know-card').addEventListener('click', () => this.markCard(true));
        document.getElementById('dont-know-card').addEventListener('click', () => this.markCard(false));
        document.getElementById('next-card').addEventListener('click', () => this.nextCard());
        
        // Allow Enter key to add cards
        document.getElementById('card-back').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.addCard();
            }
        });
    }

    addCard() {
        const front = document.getElementById('card-front').value.trim();
        const back = document.getElementById('card-back').value.trim();
        
        if (front && back) {
            const card = {
                id: Date.now(),
                front: front,
                back: back,
                difficulty: 0, // 0: new, 1: easy, 2: medium, 3: hard
                lastReviewed: null,
                correctCount: 0,
                incorrectCount: 0
            };
            
            this.cards.push(card);
            this.saveCards();
            this.clearForm();
            this.updateProgress();
            this.showFeedback('Card added successfully!');
        } else {
            Swal.fire({
                title: 'Missing Information',
                text: 'Please fill in both front and back of the card.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
        }
    }

    startStudy() {
        if (this.cards.length === 0) {
            Swal.fire({
                title: 'No Cards Available',
                text: 'Please add some cards first!',
                icon: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }
        
        this.studyQueue = [...this.cards];
        this.currentCardIndex = 0;
        this.isStudying = true;
        this.showingFront = true;
        
        this.showCurrentCard();
        this.toggleStudyMode(true);
        
        Swal.fire({
            title: 'Study Session Started!',
            text: `Ready to study ${this.cards.length} cards`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    showCurrentCard() {
        if (this.currentCardIndex >= this.studyQueue.length) {
            this.endStudySession();
            return;
        }
        
        const card = this.studyQueue[this.currentCardIndex];
        const cardText = this.showingFront ? card.front : card.back;
        
        document.getElementById('card-text').textContent = cardText;
        document.querySelector('.card-controls').classList.toggle('hidden', this.showingFront);
        
        this.updateProgress();
    }

    flipCard() {
        this.showingFront = !this.showingFront;
        this.showCurrentCard();
    }

    markCard(isCorrect) {
        const card = this.studyQueue[this.currentCardIndex];
        
        if (isCorrect) {
            card.correctCount++;
            card.difficulty = Math.max(0, card.difficulty - 1);
        } else {
            card.incorrectCount++;
            card.difficulty = Math.min(3, card.difficulty + 1);
        }
        
        card.lastReviewed = new Date().toISOString();
        this.saveCards();
        this.nextCard();
    }

    nextCard() {
        this.currentCardIndex++;
        this.showingFront = true;
        this.showCurrentCard();
    }

    endStudySession() {
        this.isStudying = false;
        this.toggleStudyMode(false);
        
        Swal.fire({
            title: '🎉 Study Session Complete!',
            text: 'Great job! You\'ve reviewed all your cards.',
            icon: 'success',
            confirmButtonText: 'Awesome!'
        });
    }

    toggleStudyMode(studying) {
        document.getElementById('flashcard-display').classList.toggle('hidden', !studying);
        document.getElementById('start-study').classList.toggle('hidden', studying);
        document.getElementById('next-card').classList.toggle('hidden', !studying);
    }

    clearForm() {
        document.getElementById('card-front').value = '';
        document.getElementById('card-back').value = '';
    }

    updateProgress() {
        const current = this.isStudying ? this.currentCardIndex + 1 : 0;
        const total = this.isStudying ? this.studyQueue.length : this.cards.length;
        document.getElementById('card-progress').textContent = `${current}/${total}`;
    }

    saveCards() {
        localStorage.setItem('flashcards', JSON.stringify(this.cards));
    }

    showFeedback(message) {
        Swal.fire({
            title: 'Success!',
            text: message,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }
}

// Spaced Repetition System Class
class SpacedRepetitionSystem {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('spacedRepetitionItems')) || [];
        this.setupEventListeners();
        this.updateItemsList();
    }

    setupEventListeners() {
        document.getElementById('add-sr-item').addEventListener('click', () => this.addItem());
        document.getElementById('start-sr-review').addEventListener('click', () => this.startReview());
    }

    addItem() {
        const topic = document.getElementById('sr-topic').value.trim();
        const content = document.getElementById('sr-content').value.trim();
        
        if (topic && content) {
            const item = {
                id: Date.now(),
                topic: topic,
                content: content,
                interval: 1, // days
                easeFactor: 2.5,
                repetitions: 0,
                nextReview: new Date(),
                lastReviewed: null
            };
            
            this.items.push(item);
            this.saveItems();
            this.clearForm();
            this.updateItemsList();
            
            Swal.fire({
                title: 'Item Added!',
                text: `"${topic}" has been added to your spaced repetition queue`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else {
            Swal.fire({
                title: 'Missing Information',
                text: 'Please fill in both topic and content.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
        }
    }

    updateItemsList() {
        const container = document.getElementById('sr-items');
        const dueItems = this.getDueItems();
        
        container.innerHTML = '';
        
        if (dueItems.length === 0) {
            container.innerHTML = '<p>No items due for review right now.</p>';
            return;
        }

        dueItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'sr-item';
            itemElement.innerHTML = `
                <h5>${item.topic}</h5>
                <p>${item.content.substring(0, 100)}...</p>
                <div class="due-date">Due: ${this.formatDate(item.nextReview)}</div>
            `;
            container.appendChild(itemElement);
        });
    }

    getDueItems() {
        const now = new Date();
        return this.items.filter(item => new Date(item.nextReview) <= now);
    }

    startReview() {
        const dueItems = this.getDueItems();
        if (dueItems.length === 0) {
            Swal.fire({
                title: 'No Reviews Due',
                text: 'No items are due for review right now! Check back later.',
                icon: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }
        
        // Enhanced review implementation with SweetAlert
        this.reviewItems(dueItems, 0);
    }

    async reviewItems(items, index) {
        if (index >= items.length) {
            // Review complete
            this.saveItems();
            this.updateItemsList();
            
            Swal.fire({
                title: '🎉 Review Complete!',
                text: `You've reviewed ${items.length} items. Great job!`,
                icon: 'success',
                confirmButtonText: 'Awesome!'
            });
            return;
        }

        const item = items[index];
        
        const { value: difficulty } = await Swal.fire({
            title: item.topic,
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>Content:</strong></p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                        ${item.content}
                    </div>
                </div>
            `,
            input: 'select',
            inputOptions: {
                '1': '😊 Easy - I knew this well',
                '2': '👍 Good - I remembered after thinking',
                '3': '😰 Hard - I struggled with this'
            },
            inputPlaceholder: 'How difficult was this?',
            showCancelButton: true,
            confirmButtonText: 'Next',
            cancelButtonText: 'Stop Review',
            inputValidator: (value) => {
                if (!value) {
                    return 'Please select a difficulty level!';
                }
            }
        });

        if (difficulty) {
            this.updateItemAfterReview(item, parseInt(difficulty));
            this.reviewItems(items, index + 1);
        }
    }

    updateItemAfterReview(item, difficulty) {
        item.lastReviewed = new Date();
        item.repetitions++;
        
        // SM-2 algorithm simplified
        if (difficulty >= 3) {
            item.repetitions = 0;
            item.interval = 1;
        } else {
            if (item.repetitions === 1) {
                item.interval = 1;
            } else if (item.repetitions === 2) {
                item.interval = 6;
            } else {
                item.interval = Math.round(item.interval * item.easeFactor);
            }
            
            item.easeFactor = item.easeFactor + (0.1 - (5 - difficulty) * (0.08 + (5 - difficulty) * 0.02));
            item.easeFactor = Math.max(1.3, item.easeFactor);
        }
        
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + item.interval);
        item.nextReview = nextReview;
    }

    clearForm() {
        document.getElementById('sr-topic').value = '';
        document.getElementById('sr-content').value = '';
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString();
    }

    saveItems() {
        localStorage.setItem('spacedRepetitionItems', JSON.stringify(this.items));
    }
}

// Active Recall System Class
class ActiveRecallSystem {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.answers = [];
        this.isSessionActive = false;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('start-recall').addEventListener('click', () => this.startSession());
        document.getElementById('next-question').addEventListener('click', () => this.nextQuestion());
        document.getElementById('finish-recall').addEventListener('click', () => this.finishSession());
    }

    startSession() {
        const topic = document.getElementById('recall-topic').value.trim();
        const questionsText = document.getElementById('recall-questions').value.trim();
        
        if (!topic || !questionsText) {
            Swal.fire({
                title: 'Missing Information',
                text: 'Please enter a topic and questions.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return;
        }
        
        this.questions = questionsText.split('\n').filter(q => q.trim());
        this.currentQuestionIndex = 0;
        this.answers = [];
        this.isSessionActive = true;
        
        this.showQuestion();
        this.toggleSessionMode(true);
        
        Swal.fire({
            title: 'Active Recall Started!',
            text: `Ready to answer ${this.questions.length} questions about ${topic}`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    showQuestion() {
        if (this.currentQuestionIndex >= this.questions.length) {
            this.finishSession();
            return;
        }
        
        const question = this.questions[this.currentQuestionIndex];
        document.getElementById('current-question').textContent = question;
        document.getElementById('recall-answer').value = '';
        document.getElementById('question-progress').textContent = 
            `${this.currentQuestionIndex + 1}/${this.questions.length}`;
    }

    nextQuestion() {
        const answer = document.getElementById('recall-answer').value.trim();
        this.answers.push({
            question: this.questions[this.currentQuestionIndex],
            answer: answer,
            timestamp: new Date()
        });
        
        this.currentQuestionIndex++;
        this.showQuestion();
    }

    finishSession() {
        this.isSessionActive = false;
        this.toggleSessionMode(false);
        this.showSessionSummary();
    }

    showSessionSummary() {
        const summaryHtml = this.answers.map((item, index) => 
            `<div style="text-align: left; margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <strong>Q${index + 1}:</strong> ${item.question}<br>
                <strong>Your Answer:</strong> ${item.answer || '<em>No answer provided</em>'}
            </div>`
        ).join('');
        
        Swal.fire({
            title: '🎉 Session Complete!',
            html: `
                <div style="max-height: 400px; overflow-y: auto;">
                    <p><strong>You answered ${this.answers.length} questions:</strong></p>
                    ${summaryHtml}
                </div>
            `,
            width: '600px',
            confirmButtonText: 'Great!'
        });
    }

    toggleSessionMode(active) {
        document.querySelector('.recall-setup').classList.toggle('hidden', active);
        document.getElementById('recall-session').classList.toggle('hidden', !active);
    }
}

// Mind Map System Class
class MindMapSystem {
    constructor() {
        this.nodes = [];
        this.connections = [];
        this.canvas = document.getElementById('mind-map-canvas');
        this.centralNode = null;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('create-map').addEventListener('click', () => this.createMap());
        document.getElementById('add-branch').addEventListener('click', () => this.addBranch());
        document.getElementById('clear-map').addEventListener('click', () => this.clearMap());
    }

    createMap() {
        const topic = document.getElementById('central-topic').value.trim();
        if (!topic) {
            Swal.fire({
                title: 'Missing Topic',
                text: 'Please enter a central topic.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return;
        }
        
        this.clearMap();
        this.centralNode = this.createNode(topic, 
            this.canvas.offsetWidth / 2, 
            this.canvas.offsetHeight / 2, 
            true
        );
        
        Swal.fire({
            title: 'Mind Map Created!',
            text: `Central topic "${topic}" has been created. Click "Add Branch" to expand your map.`,
            icon: 'success',
            timer: 3000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    }

    async addBranch() {
        if (!this.centralNode) {
            Swal.fire({
                title: 'No Central Topic',
                text: 'Please create a central topic first.',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            return;
        }
        
        const { value: text } = await Swal.fire({
            title: 'Add New Branch',
            input: 'text',
            inputLabel: 'Enter branch text:',
            inputPlaceholder: 'Type your idea here...',
            showCancelButton: true,
            confirmButtonText: 'Add Branch',
            inputValidator: (value) => {
                if (!value) {
                    return 'Please enter some text for the branch!';
                }
            }
        });

        if (text) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = 150;
            const x = this.centralNode.offsetLeft + Math.cos(angle) * radius;
            const y = this.centralNode.offsetTop + Math.sin(angle) * radius;
            
            this.createNode(text, x, y, false);
        }
    }

    createNode(text, x, y, isCentral = false) {
        const node = document.createElement('div');
        node.className = `mind-map-node ${isCentral ? 'central' : ''}`;
        node.textContent = text;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        this.makeDraggable(node);
        this.canvas.appendChild(node);
        this.nodes.push(node);
        
        return node;
    }

    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        element.onmousedown = dragMouseDown;
        
        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }
        
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    clearMap() {
        this.nodes.forEach(node => node.remove());
        this.nodes = [];
        this.connections = [];
        this.centralNode = null;
        
        const instruction = document.createElement('p');
        instruction.className = 'instruction';
        instruction.textContent = 'Enter a central topic and click "Create Mind Map" to begin';
        this.canvas.appendChild(instruction);
    }
}

// Cornell Notes System Class
class CornellNotesSystem {
    constructor() {
        this.setupEventListeners();
        this.loadSavedNotes();
    }

    setupEventListeners() {
        document.getElementById('save-cornell').addEventListener('click', () => this.saveNotes());
        document.getElementById('export-cornell').addEventListener('click', () => this.exportNotes());
        
        // Auto-save every 30 seconds
        setInterval(() => this.autoSave(), 30000);
    }

    saveNotes() {
        const notes = this.collectNotesData();
        const timestamp = new Date().toISOString();
        
        let savedNotes = JSON.parse(localStorage.getItem('cornellNotes')) || [];
        
        // Check if updating existing note or creating new one
        const existingIndex = savedNotes.findIndex(note => 
            note.title === notes.title && 
            note.date === notes.date
        );
        
        if (existingIndex !== -1) {
            savedNotes[existingIndex] = { ...notes, lastModified: timestamp };
        } else {
            savedNotes.push({ ...notes, created: timestamp, lastModified: timestamp });
        }
        
        localStorage.setItem('cornellNotes', JSON.stringify(savedNotes));
        this.showFeedback('Notes saved successfully!');
    }

    autoSave() {
        const notes = this.collectNotesData();
        if (notes.title || notes.cues || notes.notes || notes.summary) {
            localStorage.setItem('cornellNotesDraft', JSON.stringify(notes));
        }
    }

    loadSavedNotes() {
        const draft = localStorage.getItem('cornellNotesDraft');
        if (draft) {
            const notes = JSON.parse(draft);
            document.getElementById('cornell-title').value = notes.title || '';
            document.getElementById('cornell-date').value = notes.date || '';
            document.getElementById('cornell-cues-text').value = notes.cues || '';
            document.getElementById('cornell-notes-text').value = notes.notes || '';
            document.getElementById('cornell-summary-text').value = notes.summary || '';
        }
    }

    collectNotesData() {
        return {
            title: document.getElementById('cornell-title').value.trim(),
            date: document.getElementById('cornell-date').value,
            cues: document.getElementById('cornell-cues-text').value.trim(),
            notes: document.getElementById('cornell-notes-text').value.trim(),
            summary: document.getElementById('cornell-summary-text').value.trim()
        };
    }

    exportNotes() {
        const notes = this.collectNotesData();
        
        const exportText = `
CORNELL NOTES
=============

Title: ${notes.title}
Date: ${notes.date}

CUES/QUESTIONS:
${notes.cues}

NOTES:
${notes.notes}

SUMMARY:
${notes.summary}

Generated by Study Techniques Hub - ${new Date().toLocaleString()}
        `.trim();
        
        this.downloadTextFile(exportText, `cornell-notes-${notes.title || 'untitled'}.txt`);
    }

    downloadTextFile(content, filename) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    showFeedback(message) {
        Swal.fire({
            title: 'Success!',
            text: message,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
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

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize main app
    const app = new StudyTechniquesApp();
    
    // Initialize all technique systems
    const pomodoroTimer = new PomodoroTimer();
    const flashcardsSystem = new FlashcardsSystem();
    const spacedRepetitionSystem = new SpacedRepetitionSystem();
    const activeRecallSystem = new ActiveRecallSystem();
    const mindMapSystem = new MindMapSystem();
    const cornellNotesSystem = new CornellNotesSystem();
    
    // Request notification permission for Pomodoro timer
    PomodoroTimer.requestNotificationPermission();
    
    // Global error handling
    window.addEventListener('error', (event) => {
        console.error('Application error:', event.error);
    });
    
    // Prevent data loss on page unload
    window.addEventListener('beforeunload', (event) => {
        app.saveTechnique();
    });
    
    console.log('Study Techniques Hub initialized successfully!');
});
