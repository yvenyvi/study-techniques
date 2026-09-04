const fs = require('fs');

let js = fs.readFileSync('includes/app.js', 'utf8');
js = js.replace(/\r\n/g, '\n');

const targetStr = `        if (this.convertBtn) {
            this.convertBtn.addEventListener('click', () => this.extractFromNotes());
        }`;

const replacementStr = `        if (this.convertBtn) {
            this.convertBtn.addEventListener('click', () => this.extractFromNotes());
        }
        
        const manualBtn = document.getElementById('generate-manual-flashcards-btn');
        if (manualBtn) {
            manualBtn.addEventListener('click', () => this.extractFromText());
        }`;

js = js.replace(targetStr, replacementStr);

const methodTargetStr = `    startSession() {`;
const methodReplacementStr = `    extractFromText() {
        const textInput = document.getElementById('manual-flashcard-text');
        if (!textInput || !textInput.value.trim()) {
            CustomModal.fire('No Text', 'Please paste some notes into the text area first!', 'warning');
            return;
        }
        
        const text = textInput.value;
        const lines = text.split('\\n');
        this.cards = [];
        let currentCard = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('Q:') || line.startsWith('#')) {
                // Save previous card
                if (currentCard && currentCard.front && currentCard.backHtml.trim()) {
                    // Convert newlines in backHtml to <br> for display
                    currentCard.backHtml = currentCard.backHtml.trim().replace(/\\n/g, '<br>');
                    this.cards.push(currentCard);
                }
                
                let frontText = line.substring(line.indexOf(':') > 0 && line.startsWith('Q:') ? 2 : 1).trim();
                currentCard = {
                    front: frontText,
                    backHtml: ''
                };
            } else if (line.length > 0) {
                if (currentCard) {
                    currentCard.backHtml += (currentCard.backHtml ? '\\n' : '') + line;
                }
            }
        }
        
        // Push the last card
        if (currentCard && currentCard.front && currentCard.backHtml.trim()) {
            currentCard.backHtml = currentCard.backHtml.trim().replace(/\\n/g, '<br>');
            this.cards.push(currentCard);
        }
        
        if (this.cards.length === 0) {
            CustomModal.fire('Extraction Failed', "Could not find any flashcards. Make sure your questions start with 'Q:' or '#'", 'error');
            return;
        }
        
        CustomModal.fire('Success', \`Created \${this.cards.length} flashcards from your text!\`, 'success').then(() => {
            textInput.value = ''; // clear input
            this.startSession();
        });
    }
    
    startSession() {`;

js = js.replace(methodTargetStr, methodReplacementStr);

fs.writeFileSync('includes/app.js', js);
console.log('Modified app.js successfully!');
