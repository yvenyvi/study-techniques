export type GuideId =
  | "overview"
  | "library"
  | "course"
  | "workspace"
  | "note"
  | "reviewers"
  | "reviewer"
  | "practice"
  | "goals"
  | "settings";
export type GuideStep = {
  title: string;
  body: string;
  target: string;
  tryIt?: string;
  interaction?: "input" | "click";
  panel?: "pdf" | "notes";
};
export const guides: Record<GuideId, { title: string; steps: GuideStep[] }> = {
  overview: {
    title: "Overview",
    steps: [
      {
        title: "A small goal is a good start",
        body: "This is your study home. Start with one task you can finish, such as comparing two theories of memory.",
        target: ".hero",
      },
      {
        title: "Pick your next step",
        body: "Your unfinished goals appear here. Focus opens the timer for that goal. You decide when the goal is complete.",
        target: '[data-guide="overview-goals"]',
      },
      {
        title: "Continue your work",
        body: "Recent PDFs and reviewers help you return to where you stopped. If these areas are empty, bring in a PDF or create a reviewer from Library and Reviewers.",
        target: '[data-guide="overview-recent"]',
      },
      {
        title: "Keep the timer close",
        body: "The focus timer follows you between pages. Start or pause it here, or expand it to choose a goal. Replay any page’s guide with Page guide at the top.",
        target: ".focus-dock",
        tryIt: "Expand the timer to see its controls.",
        interaction: "click",
      },
    ],
  },
  library: {
    title: "Library",
    steps: [
      {
        title: "Bring your readings together",
        body: "Import lecture slides or readings as PDFs. They stay on this device. PDFs can be up to 50 MB; scans are readable, but selecting text needs a PDF with a text layer.",
        target: '[data-guide="import-pdf"]',
      },
      {
        title: "Organize by course",
        body: "Create courses such as Cognitive Psychology, then assign your PDFs and notes to them. Open a course to see its materials together.",
        target: '[data-guide="new-course"]',
      },
      {
        title: "Find an idea quickly",
        body: "Search PDF titles, topic tags, and note text. Use the course filter to narrow the list. Clear the search to see everything again.",
        target: '[data-guide="library-search"]',
        tryIt: "Type a topic in the search box.",
        interaction: "input",
      },
      {
        title: "Write without a PDF too",
        body: "New note creates a standalone note for lectures, definitions, or your own explanations. Open a PDF when you want reading and notes side by side.",
        target: '[data-guide="library-notes"]',
      },
    ],
  },
  course: {
    title: "Course",
    steps: [
      {
        title: "One subject, one place",
        body: "This page collects a course’s PDFs, notes, reviewers, and goals. It helps keep subjects such as Developmental and Cognitive Psychology separate.",
        target: '[data-guide="page-heading"]',
      },
      {
        title: "Add a course reading",
        body: "PDFs imported here are assigned to this course. You can search this course’s materials below.",
        target: '[data-guide="import-pdf"]',
      },
      {
        title: "Connect your understanding",
        body: "Reviewers and goals assigned to this course appear here. Create them from Reviewers or Goals & history, and choose this course.",
        target: '[data-guide="course-reviewers"]',
      },
      {
        title: "Keep course notes",
        body: "Use New note for class notes or a concept summary. Notes created here belong to this course. Deleting a course moves its materials to Unfiled.",
        target: '[data-guide="library-notes"]',
      },
    ],
  },
  workspace: {
    title: "PDF & notes",
    steps: [
      {
        title: "Read at your own pace",
        body: "Use the page and zoom controls to read your PDF. Your last page is saved. On a small screen, Reading and Notes switch between the two views.",
        target: '[data-guide="pdf-controls"], [data-guide="workspace-heading"]',
        panel: "pdf",
      },
      {
        title: "Explain it in your words",
        body: "Create or choose a note beside the PDF. For example, explain a theory, then add an example that makes sense to you.",
        target: '[data-guide="note-heading"]',
        panel: "notes",
      },
      {
        title: "Format and keep your work",
        body: "Select text to use bold, highlights, or other formatting. Add tables or change the note’s columns. Changes save automatically; wait for Saved before closing.",
        target: '[data-guide="editor-toolbar"], [data-guide="note-heading"]',
        panel: "notes",
        tryIt: "Try a formatting control after selecting some note text.",
        interaction: "click",
      },
      {
        title: "Keep a link to the source",
        body: "In Reading, select PDF text and choose Add excerpt. In Notes, Insert excerpt into note keeps the quotation and page link. Scanned pages may not support text selection.",
        target:
          '[data-guide="workspace-tabs"], [data-guide="workspace-heading"]',
        panel: "pdf",
      },
    ],
  },
  note: {
    title: "Notes editor",
    steps: [
      {
        title: "Make the note easy to find",
        body: "Give your note a clear title, such as Memory models — key differences. Choose a course if you want it filed with that subject.",
        target: '[data-guide="note-title"]',
        tryIt: "Give this note a useful title.",
        interaction: "input",
      },
      {
        title: "Shape your explanation",
        body: "Select text, then use bold, italic, underline, highlights, headings, or lists. Tables help compare theories; Columns changes the whole note’s layout.",
        target: '[data-guide="editor-toolbar"]',
        tryIt: "Select a few words in your note, then try a formatting button.",
        interaction: "click",
      },
      {
        title: "Your words save automatically",
        body: "Write in this space. The save indicator above it changes to Saved when the edit is stored. If saving fails, your draft stays visible so you can retry.",
        target: '[data-guide="note-save"]',
      },
      {
        title: "Turn notes into revision",
        body: "Select useful note text and choose Add selection to reviewer to make an independent copy. Print note / PDF below the editor lets you print or save a PDF.",
        target: '[data-guide="note-export"]',
      },
    ],
  },
  reviewers: {
    title: "Reviewers",
    steps: [
      {
        title: "Build a reviewer you understand",
        body: "A reviewer brings your own explanations, comparisons, and practice questions together. New reviewer starts an empty one for you to build.",
        target: '[data-guide="new-reviewer"]',
      },
      {
        title: "Find the right reviewer",
        body: "Search titles, tags, and written content. The course filter is useful when you are preparing for one subject.",
        target: '[data-guide="reviewer-search"]',
        tryIt: "Search for a topic, then clear the search when you’re done.",
        interaction: "input",
      },
      {
        title: "Return and practice",
        body: "Open a reviewer to edit it or use Practice. An empty list is a good place to begin: create one reviewer for your next study goal.",
        target: '[data-guide="reviewer-list"], [data-guide="new-reviewer"]',
      },
    ],
  },
  reviewer: {
    title: "Reviewer editor",
    steps: [
      {
        title: "Name the topic",
        body: "Give the reviewer a clear title, course, and topic tags. Your changes save automatically; the save indicator shows when they are stored.",
        target: '[data-guide="reviewer-details"]',
        tryIt: "Add a useful reviewer title or topic tag.",
        interaction: "input",
      },
      {
        title: "Choose a useful structure",
        body: "Add Key concepts for definitions, Theory comparison for similarities and differences, Research summary for studies, or Practice questions for recall.",
        target: '[data-guide="reviewer-templates"]',
      },
      {
        title: "Fill one section at a time",
        body: "Write simple explanations and concrete examples. Source links copied from notes stay with the section. You can add more sections as your understanding grows.",
        target:
          '[data-guide="reviewer-sections"], [data-guide="reviewer-templates"]',
      },
      {
        title: "Check what you remember",
        body: "Practice hides answers in Practice questions until you reveal them. Print / PDF makes a printable reviewer with answers included.",
        target: '[data-guide="reviewer-mode"]',
      },
    ],
  },
  practice: {
    title: "Practice",
    steps: [
      {
        title: "Try recalling before checking",
        body: "Read a question and try answering from memory. Other section types stay readable, so you can use them as references.",
        target: '[data-guide="reviewer-sections"], [data-guide="page-heading"]',
      },
      {
        title: "Reveal when you’re ready",
        body: "Reveal answer shows the answer you wrote. Compare it with your recall and notice what needs another look. If there are no questions yet, return to Edit reviewer and add Practice questions.",
        target:
          '[data-guide="reveal-answer"], [data-guide="reviewer-sections"], [data-guide="reviewer-mode"]',
        tryIt: "Reveal an answer after trying to recall it.",
        interaction: "click",
      },
      {
        title: "Improve the explanation",
        body: "Edit reviewer returns to your sections. Add an example, clarify an answer, or create a small goal for what to study next. Practice does not mark your goals complete.",
        target: '[data-guide="reviewer-mode"]',
      },
    ],
  },
  goals: {
    title: "Goals & history",
    steps: [
      {
        title: "Choose something finishable",
        body: "Write one study goal and say what finished looks like. For example: Compare two memory models; finished means writing three clear differences.",
        target: '[data-guide="goal-form"]',
        tryIt: "Draft a goal and a clear completion criterion.",
        interaction: "input",
      },
      {
        title: "Keep the right materials nearby",
        body: "Choose a course and link PDFs or reviewers to your goal. These links help you return to the work without searching again.",
        target: '[data-guide="goal-materials"]',
      },
      {
        title: "Work toward the goal",
        body: "Create the goal, then use Focus beside it to choose it for the timer. You can also use the timer for an independent session.",
        target: '[data-guide="goal-list"]',
      },
      {
        title: "Use time as a tool",
        body: "Start and pause the timer here. Expand it to end a focus session and write a short reflection. A finished countdown never completes a goal automatically.",
        target: ".focus-dock",
        tryIt: "Expand the timer to see its options.",
        interaction: "click",
      },
      {
        title: "Notice your progress",
        body: "Saved sessions and reflections appear in Focus history. Mark a goal complete when its criterion is met; you can reopen it if more work is needed.",
        target: '[data-guide="focus-history"]',
      },
    ],
  },
  settings: {
    title: "Settings & data",
    steps: [
      {
        title: "Find a rhythm that suits you",
        body: "Choose focus and break lengths, then Save preferences. Idle timers update immediately. A running or paused session keeps its remaining time until you start a new phase.",
        target: '[data-guide="focus-preferences"]',
      },
      {
        title: "Know where your work lives",
        body: "This section shows offline readiness and storage information for your device. On the web, open online once and wait for offline readiness. Windows installs the study tools for offline use.",
        target: '[data-guide="offline-storage"]',
      },
      {
        title: "Keep a copy somewhere safe",
        body: "Export backup saves PDFs, notes, reviewers, goals, settings, and history in a ZIP. Restore ZIP requires an empty workspace. Transfers between devices are manual.",
        target: '[data-guide="backup-tools"]',
      },
      {
        title: "Help is always nearby",
        body: "Every page has its own short guide. Replay it with Page guide at the top. Show all guides again resets only these introductions, leaving your study work intact.",
        target: '[data-guide="guide-settings"]',
      },
    ],
  },
};

export const guideIds = Object.keys(guides) as GuideId[];
