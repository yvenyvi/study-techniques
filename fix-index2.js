const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\r\n/g, '\n');

// 1. Add pdf.js to the header
const headerTarget = `    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>`;
const headerReplacement = `    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script>pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';</script>`;
html = html.replace(headerTarget, headerReplacement);

// 2. Change the manual input area to a PDF upload area
const panelTarget = `                        <div class="manual-flashcards-input" style="margin-top: 20px; text-align: left;">
                            <label style="display:block; margin-bottom: 10px; font-weight: 500; color: #4a5568;">Paste custom notes (use 'Q:' or '#' to start the Front of the card):</label>
                            <textarea id="manual-flashcard-text" style="width: 100%; height: 150px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e0; font-family: inherit; margin-bottom: 15px;" placeholder="Q: What is the powerhouse of the cell?\\nMitochondria\\n\\nQ: Who wrote Hamlet?\\nWilliam Shakespeare"></textarea>
                            <button class="btn-primary" id="generate-manual-flashcards-btn" style="width: 100%; justify-content: center; background-color: #f6ad55; border-color: #f6ad55;">Generate from Text</button>
                        </div>`;
const panelReplacement = `                        <div class="manual-flashcards-input" style="margin-top: 20px; text-align: left;">
                            <div class="pdf-upload-container">
                                <div class="upload-box" id="local-pdf-upload-box">
                                    <i data-lucide="upload-cloud" class="upload-icon"></i>
                                    <h4>Upload PDF for Offline Flashcards</h4>
                                    <p>Your file won't be sent to any server. Processed locally.</p>
                                    <input type="file" id="local-pdf-file-input" accept=".pdf" class="hidden">
                                    <button class="btn-primary" style="background-color: #f6ad55; border-color: #f6ad55;" onclick="document.getElementById('local-pdf-file-input').click()">Select PDF File</button>
                                </div>
                                <div id="local-pdf-loading-state" class="hidden" style="text-align: center; padding: 20px;">
                                    <i data-lucide="loader-2" class="spin-icon"></i>
                                    <p>Extracting text from PDF...</p>
                                </div>
                            </div>
                        </div>`;
html = html.replace(panelTarget, panelReplacement);

fs.writeFileSync('index.html', html);
console.log('Modified index.html successfully!');
