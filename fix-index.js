const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\r\n/g, '\n');

// 1. Add Flashcards button to menu
const menuButtonTarget = `                <button class="technique-btn" data-technique="pdf-notes" id="pdf-notes-btn">
                    <i data-lucide="file-text"></i>
                    <span>PDF to Notes</span>
                </button>`;
const menuButtonReplacement = `                <button class="technique-btn" data-technique="pdf-notes" id="pdf-notes-btn">
                    <i data-lucide="file-text"></i>
                    <span>PDF to Notes</span>
                </button>
                <!-- Flashcards Button -->
                <button class="technique-btn" data-technique="flashcards" id="flashcards-btn">
                    <i data-lucide="layers"></i>
                    <span>Flashcards</span>
                </button>`;
html = html.replace(menuButtonTarget, menuButtonReplacement);

// 2. Add Convert to Flashcards button
const convertButtonTarget = `                        <div class="notes-actions">
                            <button class="btn-primary" id="export-pdf-btn">
                                <i data-lucide="download"></i>
                                <span>Export as PDF</span>
                            </button>`;
const convertButtonReplacement = `                        <div class="notes-actions">
                            <button class="btn-primary" id="export-pdf-btn">
                                <i data-lucide="download"></i>
                                <span>Export as PDF</span>
                            </button>
                            <button class="btn-primary" id="convert-flashcards-btn" style="background-color: #f6ad55; border-color: #f6ad55; color: white;">
                                <i data-lucide="layers"></i>
                                <span>Make Flashcards</span>
                            </button>`;
html = html.replace(convertButtonTarget, convertButtonReplacement);

// 3. Add Flashcards Panel
const panelTarget = `            <!-- Pomodoro Timer -->
            <div id="pomodoro" class="technique-panel hidden">`;
const panelReplacement = `            <!-- Flashcards Panel -->
            <div id="flashcards" class="technique-panel hidden">
                <h3><i data-lucide="layers"></i> Flashcards</h3>
                <p>Review your notes through active recall.</p>
                <div id="flashcards-container">
                    <div class="empty-state" id="flashcard-empty-state">
                        <p>No flashcards generated yet. Generate notes from a PDF, or paste your own notes below.</p>
                        
                        <div class="manual-flashcards-input" style="margin-top: 20px; text-align: left;">
                            <label style="display:block; margin-bottom: 10px; font-weight: 500; color: #4a5568;">Paste custom notes (use 'Q:' or '#' to start the Front of the card):</label>
                            <textarea id="manual-flashcard-text" style="width: 100%; height: 150px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e0; font-family: inherit; margin-bottom: 15px;" placeholder="Q: What is the powerhouse of the cell?\nMitochondria\n\nQ: Who wrote Hamlet?\nWilliam Shakespeare"></textarea>
                            <button class="btn-primary" id="generate-manual-flashcards-btn" style="width: 100%; justify-content: center; background-color: #f6ad55; border-color: #f6ad55;">Generate from Text</button>
                        </div>
                    </div>
                    
                    <div class="flashcard-player hidden" id="flashcard-player">
                        <div class="flashcard-counter">
                            <span id="current-card-idx">1</span> / <span id="total-cards">0</span>
                        </div>
                        <div class="flashcard-scene" id="flashcard-scene">
                            <div class="flashcard" id="flashcard-card">
                                <div class="flashcard-face flashcard-front">
                                    <h4 id="flashcard-front-text">Question</h4>
                                    <span class="flip-hint">Click to reveal</span>
                                </div>
                                <div class="flashcard-face flashcard-back">
                                    <div id="flashcard-back-text">Answer</div>
                                </div>
                            </div>
                        </div>
                        <div class="flashcard-controls">
                            <button class="btn-secondary" id="prev-card-btn"><i data-lucide="chevron-left"></i> Previous</button>
                            <button class="btn-primary" id="next-card-btn">Next <i data-lucide="chevron-right"></i></button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Pomodoro Timer -->
            <div id="pomodoro" class="technique-panel hidden">`;
html = html.replace(panelTarget, panelReplacement);

fs.writeFileSync('index.html', html);
console.log('Modified index.html successfully!');
