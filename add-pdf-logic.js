const fs = require('fs');

let js = fs.readFileSync('includes/app.js', 'utf8');
js = js.replace(/\r\n/g, '\n');

const methodTargetStr = `    extractFromText() {
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
    }`;

const methodReplacementStr = `    async extractFromLocalPdf(file) {
        const loadingState = document.getElementById('local-pdf-loading-state');
        const uploadBox = document.getElementById('local-pdf-upload-box');
        
        uploadBox.classList.add('hidden');
        loadingState.classList.remove('hidden');
        
        try {
            const fileReader = new FileReader();
            
            fileReader.onload = async (e) => {
                const typedarray = new Uint8Array(e.target.result);
                
                try {
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    this.cards = [];
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        
                        // Extract text items
                        const strings = textContent.items.map(item => item.str.trim()).filter(str => str.length > 0);
                        
                        if (strings.length > 0) {
                            // Rule: First non-empty string is the title (Front)
                            // The rest is the back
                            const frontText = strings[0];
                            const backText = strings.slice(1).join(' <br><br> ');
                            
                            if (frontText && backText) {
                                this.cards.push({
                                    front: frontText,
                                    backHtml: backText
                                });
                            }
                        }
                    }
                    
                    if (this.cards.length === 0) {
                        CustomModal.fire('Extraction Failed', "Could not extract any text from the PDF.", 'error');
                        uploadBox.classList.remove('hidden');
                        loadingState.classList.add('hidden');
                        return;
                    }
                    
                    CustomModal.fire('Success', \`Created \${this.cards.length} flashcards from your PDF!\`, 'success').then(() => {
                        this.startSession();
                    });
                } catch (pdfErr) {
                    console.error(pdfErr);
                    CustomModal.fire('Error', 'Failed to parse PDF.', 'error');
                    uploadBox.classList.remove('hidden');
                    loadingState.classList.add('hidden');
                }
            };
            
            fileReader.readAsArrayBuffer(file);
        } catch (err) {
            console.error(err);
            CustomModal.fire('Error', 'An error occurred while reading the file.', 'error');
            uploadBox.classList.remove('hidden');
            loadingState.classList.add('hidden');
        }
    }`;
js = js.replace(methodTargetStr, methodReplacementStr);

const listenerTargetStr = `        const manualBtn = document.getElementById('generate-manual-flashcards-btn');
        if (manualBtn) {
            manualBtn.addEventListener('click', () => this.extractFromText());
        }`;
const listenerReplacementStr = `        const localPdfInput = document.getElementById('local-pdf-file-input');
        if (localPdfInput) {
            localPdfInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.extractFromLocalPdf(e.target.files[0]);
                    e.target.value = ''; // Reset input
                }
            });
        }`;
js = js.replace(listenerTargetStr, listenerReplacementStr);

fs.writeFileSync('includes/app.js', js);
console.log('Modified app.js successfully for local pdf!');
