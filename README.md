# Study Techniques Hub

A comprehensive web application that provides various study techniques to enhance learning efficiency and retention.

## Features

### 🍅 Pomodoro Timer
- Customizable work and break intervals
- Session tracking
- Browser notifications
- Background sound alerts

### 📚 Digital Flashcards
- Create custom flashcards
- Spaced repetition algorithm
- Progress tracking
- Difficulty-based sorting

### 📅 Spaced Repetition System
- SM-2 algorithm implementation
- Automatic scheduling
- Long-term retention optimization
- Review queue management

### 🧠 Active Recall
- Self-testing sessions
- Question-answer format
- Progress tracking
- Session summaries

### 🗺️ Mind Mapping
- Interactive mind map creation
- Draggable nodes
- Visual concept connections
- Exportable maps

### 📝 Cornell Notes
- Traditional Cornell note-taking format
- Auto-save functionality
- Export to text files
- Organized layout (cues, notes, summary)

## File Structure

```
study-techniques/
├── index.html          # Main HTML file
├── includes/
│   ├── styles.css      # All CSS styles
│   └── app.js          # JavaScript functionality
└── pages/              # Future additional pages
```

## Technical Implementation

### Modular JavaScript Architecture
- **Object-Oriented Design**: Each study technique is implemented as a separate class
- **Reusable Functions**: Common utilities in Utils class
- **Event-Driven**: Proper event handling and user interactions
- **Local Storage**: Data persistence across sessions

### Key Classes
- `StudyTechniquesApp`: Main application controller
- `PomodoroTimer`: Timer functionality with notifications
- `FlashcardsSystem`: Card creation and study sessions
- `SpacedRepetitionSystem`: SM-2 algorithm implementation
- `ActiveRecallSystem`: Self-testing functionality
- `MindMapSystem`: Interactive mind mapping
- `CornellNotesSystem`: Note-taking with auto-save
- `Utils`: Shared utility functions

### Features
- **Responsive Design**: Works on desktop and mobile devices
- **Data Persistence**: Local storage for all user data
- **Accessibility**: Keyboard navigation and screen reader support
- **Progressive Enhancement**: Works without JavaScript (basic functionality)

## Usage

1. Open `index.html` in your web browser
2. Select a study technique from the main menu
3. Follow the on-screen instructions for each technique
4. Your progress and data are automatically saved

## Browser Compatibility

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 80+

## Future Enhancements

- [ ] Export/Import functionality
- [ ] Study statistics and analytics
- [ ] Collaborative study features
- [ ] Mobile app version
- [ ] Advanced theming options
- [ ] Integration with external services

## Development

The application uses vanilla JavaScript, HTML5, and CSS3 with no external dependencies, making it lightweight and fast.

### Code Organization
- Modular class-based architecture
- Separation of concerns
- Reusable utility functions
- Clean, maintainable code structure

---

Built with ❤️ for effective learning
