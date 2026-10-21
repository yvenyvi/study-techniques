import Document from "@tiptap/extension-document";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";

const StudyDocument = Document.extend({
  addAttributes() {
    return { columns: { default: 1 } };
  },
});

export const documentColumns = (value: unknown): number =>
  value === 2 || value === 3 ? value : 1;

export const editorExtensions = () => [
  StarterKit.configure({ document: false, link: { openOnClick: false } }),
  StudyDocument,
  Placeholder.configure({ placeholder: "Explain it in your own words…" }),
  Highlight.configure({ multicolor: true }),
  TextStyleKit,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TableKit.configure({ table: { resizable: true, cellMinWidth: 60 } }),
];
