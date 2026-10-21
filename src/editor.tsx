import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Table2,
  Link2,
  Unlink,
  RemoveFormatting,
  Columns3,
} from "lucide-react";
import type { Ref } from "./data";
import { report } from "./shared";
import { documentColumns, editorExtensions } from "./editor-schema";
import "./editor.css";

function ToolButton({
  label,
  children,
  active,
  disabled,
  onClick,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={active ? "active" : ""}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EditorDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="editor-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}

function DocumentToolbar({
  editor,
  disabled,
  onExcerpt,
}: {
  editor: Editor;
  disabled: boolean;
  onExcerpt?: (v: string, refs: Ref[]) => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      table: e.isActive("table"),
      link: e.isActive("link"),
      undo: e.can().undo(),
      redo: e.can().redo(),
      heading: e.isActive("heading")
        ? String(e.getAttributes("heading").level)
        : "paragraph",
      font: e.getAttributes("textStyle").fontFamily || "",
      size: e.getAttributes("textStyle").fontSize || "",
      color: e.getAttributes("textStyle").color || "#45583e",
      highlightColor: e.getAttributes("highlight").color || "#fff2a8",
      align:
        e.getAttributes("paragraph").textAlign ||
        e.getAttributes("heading").textAlign ||
        "left",
      columns: documentColumns(e.state.doc.attrs.columns),
      merge: e.can().mergeCells(),
      split: e.can().splitCell(),
    }),
  });
  const [dialog, setDialog] = useState<"table" | "link" | null>(null);
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [href, setHref] = useState("");
  const closeDialog = () => {
    setDialog(null);
    editor.commands.focus();
  };
  const iconSize = 16;
  const tableAction = () =>
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        closeHistory(tr);
        return true;
      });
  function copySelection() {
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, " ");
    if (!selected) return report("Select some note text first.");
    const refs: Ref[] = [];
    editor.state.doc.nodesBetween(from, to, (node) => {
      for (const mark of node.marks) {
        const match = String(mark.attrs.href || "").match(
          /^\/(?:app\/)?study\/([^?]+)\?page=(\d+)/,
        );
        if (
          match &&
          !refs.some(
            (r) => r.documentId === match[1] && r.page === Number(match[2]),
          )
        )
          refs.push({
            documentId: match[1],
            page: Number(match[2]),
            quote: selected,
          });
      }
    });
    onExcerpt?.(selected, refs);
  }
  return (
    <>
      <fieldset
        className="document-toolbar editor-tools"
        disabled={disabled}
        aria-label="Document formatting"
      >
        <legend className="sr-only">Document formatting</legend>
        <div className="editor-toolbar-row">
          <div className="editor-tool-group" role="group" aria-label="History">
            <ToolButton
              label="Undo"
              disabled={!state.undo}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 size={iconSize} />
            </ToolButton>
            <ToolButton
              label="Redo"
              disabled={!state.redo}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 size={iconSize} />
            </ToolButton>
          </div>
          <div
            className="editor-tool-group"
            role="group"
            aria-label="Font and paragraph style"
          >
            <select
              aria-label="Paragraph style"
              value={state.heading}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "paragraph")
                  editor.chain().focus().setParagraph().run();
                else
                  editor
                    .chain()
                    .focus()
                    .setHeading({ level: Number(value) as 1 | 2 | 3 })
                    .run();
              }}
            >
              <option value="paragraph">Normal text</option>
              {[1, 2, 3].map((level) => (
                <option value={level} key={level}>
                  Heading {level}
                </option>
              ))}
            </select>
            <select
              aria-label="Font family"
              value={state.font}
              onChange={(e) => {
                const chain = editor.chain().focus();
                if (e.target.value) chain.setFontFamily(e.target.value).run();
                else chain.unsetFontFamily().run();
              }}
            >
              <option value="">Default font</option>
              {["Arial", "Georgia", "Times New Roman", "Courier New"].map(
                (font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ),
              )}
            </select>
            <select
              aria-label="Font size"
              value={state.size}
              onChange={(e) => {
                const chain = editor.chain().focus();
                if (e.target.value) chain.setFontSize(e.target.value).run();
                else chain.unsetFontSize().run();
              }}
            >
              <option value="">11 pt</option>
              {[8, 10, 12, 14, 16, 18, 24, 32, 48].map((size) => (
                <option key={size} value={`${size}pt`}>
                  {size} pt
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="editor-toolbar-row">
          <div
            className="editor-tool-group"
            role="group"
            aria-label="Text formatting"
          >
            <ToolButton
              label="Bold"
              active={state.bold}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold size={iconSize} />
            </ToolButton>
            <ToolButton
              label="Italic"
              active={state.italic}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic size={iconSize} />
            </ToolButton>
            <ToolButton
              label="Underline"
              active={state.underline}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <Underline size={iconSize} />
            </ToolButton>
            <ToolButton
              label="Strikethrough"
              active={state.strike}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough size={iconSize} />
            </ToolButton>
            <ToolButton
              label="Highlight"
              active={state.highlight}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHighlight({ color: state.highlightColor })
                  .run()
              }
            >
              <Highlighter size={iconSize} />
            </ToolButton>
            <label className="editor-color-label" title="Highlight color">
              <span className="sr-only">Highlight color</span>
              <select
                aria-label="Highlight color"
                value={state.highlightColor}
                onChange={(e) =>
                  editor
                    .chain()
                    .focus()
                    .setHighlight({ color: e.target.value })
                    .run()
                }
              >
                <option value="#fff2a8">Yellow</option>
                <option value="#c9efd4">Green</option>
                <option value="#cfe7fa">Blue</option>
                <option value="#f8d3e3">Pink</option>
                <option value="#e5d7fa">Purple</option>
              </select>
            </label>
            <label className="editor-color-label" title="Text color">
              A
              <input
                type="color"
                aria-label="Text color"
                value={
                  /^#[\da-f]{6}$/i.test(state.color) ? state.color : "#45583e"
                }
                onChange={(e) =>
                  editor.chain().focus().setColor(e.target.value).run()
                }
              />
            </label>
            <ToolButton
              label="Clear text formatting"
              onClick={() =>
                editor.chain().focus().unsetAllMarks().clearNodes().run()
              }
            >
              <RemoveFormatting size={iconSize} />
            </ToolButton>
          </div>
          <div
            className="editor-tool-group"
            role="group"
            aria-label="Text alignment"
          >
            {(
              [
                ["left", AlignLeft],
                ["center", AlignCenter],
                ["right", AlignRight],
                ["justify", AlignJustify],
              ] as const
            ).map(([align, Icon]) => (
              <ToolButton
                key={align}
                label={`Align ${align}`}
                active={state.align === align}
                onClick={() => editor.chain().focus().setTextAlign(align).run()}
              >
                <Icon size={iconSize} />
              </ToolButton>
            ))}
          </div>
          <div
            className="editor-tool-group"
            role="group"
            aria-label="Lists and quotations"
          >
            <ToolButton
              label="Bullet list"
              active={state.bullet}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List size={iconSize} />
            </ToolButton>
            <ToolButton
              label="Numbered list"
              active={state.ordered}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={iconSize} />
            </ToolButton>
            <ToolButton
              label="Block quote"
              active={state.quote}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote size={iconSize} />
            </ToolButton>
          </div>
        </div>
        <div className="editor-toolbar-row">
          <div className="editor-tool-group" role="group" aria-label="Insert">
            <ToolButton
              label="Insert table"
              disabled={state.table}
              onClick={() => setDialog("table")}
            >
              <Table2 size={iconSize} /> Table
            </ToolButton>
            <ToolButton
              label="Insert or edit link"
              active={state.link}
              onClick={() => {
                setHref(editor.getAttributes("link").href || "");
                setDialog("link");
              }}
            >
              <Link2 size={iconSize} /> Link
            </ToolButton>
            <ToolButton
              label="Remove link"
              disabled={!state.link}
              onClick={() =>
                editor.chain().focus().extendMarkRange("link").unsetLink().run()
              }
            >
              <Unlink size={iconSize} />
            </ToolButton>
          </div>
          <div className="editor-tool-group">
            <label className="editor-columns">
              <Columns3 size={iconSize} />
              <span>Columns</span>
              <select
                aria-label="Document columns"
                value={state.columns}
                onChange={(e) => {
                  const count = documentColumns(Number(e.target.value));
                  editor
                    .chain()
                    .focus()
                    .command(({ tr }) => {
                      tr.setDocAttribute("columns", count);
                      return true;
                    })
                    .run();
                }}
              >
                <option value="1">One</option>
                <option value="2">Two</option>
                <option value="3">Three</option>
              </select>
            </label>
          </div>
          {onExcerpt && (
            <button
              type="button"
              className="editor-reviewer-action"
              onMouseDown={(e) => e.preventDefault()}
              onClick={copySelection}
            >
              Add selection to reviewer
            </button>
          )}
        </div>
        {state.table && (
          <div
            className="editor-table-tools"
            role="group"
            aria-label="Table editing"
          >
            <span>Table</span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().addRowBefore().run()}
            >
              Row above
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().addRowAfter().run()}
            >
              Row below
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().addColumnBefore().run()}
            >
              Column before
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().addColumnAfter().run()}
            >
              Column after
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().deleteRow().run()}
            >
              Delete row
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().deleteColumn().run()}
            >
              Delete column
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().toggleHeaderRow().run()}
            >
              Header row
            </button>
            <button
              type="button"
              disabled={!state.merge}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().mergeCells().run()}
            >
              Merge cells
            </button>
            <button
              type="button"
              disabled={!state.split}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().splitCell().run()}
            >
              Split cell
            </button>
            <button
              type="button"
              className="editor-delete-table"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableAction().deleteTable().run()}
            >
              Delete table
            </button>
          </div>
        )}
        <p className="editor-layout-hint">
          Columns flow across the whole note. Narrow screens show a single
          column.
        </p>
      </fieldset>
      {dialog === "table" && (
        <EditorDialog title="Insert table" onClose={closeDialog}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                disabled ||
                !Number.isInteger(rows) ||
                rows < 1 ||
                rows > 10 ||
                !Number.isInteger(columns) ||
                columns < 1 ||
                columns > 8
              )
                return;
              setDialog(null);
              editor
                .chain()
                .focus()
                .insertTable({ rows, cols: columns, withHeaderRow: true })
                .run();
            }}
          >
            <p>A header row is included. Use Tab to move between cells.</p>
            <div className="editor-table-size">
              <label>
                Rows
                <input
                  autoFocus
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={rows}
                  onChange={(e) => setRows(Number(e.target.value))}
                />
              </label>
              <label>
                Columns
                <input
                  type="number"
                  min="1"
                  max="8"
                  required
                  value={columns}
                  onChange={(e) => setColumns(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="actions">
              <button type="button" className="secondary" onClick={closeDialog}>
                Cancel
              </button>
              <button type="submit" disabled={disabled}>
                Insert table
              </button>
            </div>
          </form>
        </EditorDialog>
      )}
      {dialog === "link" && (
        <EditorDialog title="Insert or edit link" onClose={closeDialog}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const url = href.trim();
              if (disabled) return;
              if (!/^(https?:\/\/|mailto:|\/(?:app\/)?study\/)/i.test(url))
                return report(
                  "Use an http, https, email, or study source link.",
                );
              setDialog(null);
              if (editor.state.selection.empty && !state.link)
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: "text",
                    text: url,
                    marks: [{ type: "link", attrs: { href: url } }],
                  })
                  .run();
              else
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href: url })
                  .run();
            }}
          >
            <label>
              Link address
              <input
                autoFocus
                required
                type="text"
                inputMode="url"
                placeholder="https://example.com"
                value={href}
                onChange={(e) => setHref(e.target.value)}
              />
            </label>
            <div className="actions">
              <button type="button" className="secondary" onClick={closeDialog}>
                Cancel
              </button>
              <button type="submit" disabled={disabled}>
                Save link
              </button>
            </div>
          </form>
        </EditorDialog>
      )}
    </>
  );
}

export function RichEditor({
  content,
  onChange,
  disabled = false,
  onExcerpt,
}: {
  content: any;
  onChange: (v: any) => void;
  disabled?: boolean;
  onExcerpt?: (v: string, refs: Ref[]) => void;
}) {
  const navigate = useNavigate();
  const [extensions] = useState(editorExtensions);
  const editor = useEditor({
    extensions,
    shouldRerenderOnTransaction: false,
    content,
    editable: !disabled,
    editorProps: {
      attributes: (state) => ({
        "aria-label": "Note content",
        "aria-multiline": "true",
        role: "textbox",
        "data-columns": String(documentColumns(state.doc.attrs.columns)),
      }),
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [disabled, editor]);
  return (
    <div className="document-editor">
      {editor && (
        <DocumentToolbar
          editor={editor}
          disabled={disabled}
          onExcerpt={onExcerpt}
        />
      )}
      <div className="document-paper">
        <EditorContent
          editor={editor}
          onClick={(event) => {
            const anchor = (event.target as HTMLElement).closest("a");
            const href = anchor?.getAttribute("href") || "";
            if (/^\/(?:app\/)?study\//.test(href)) {
              event.preventDefault();
              navigate(href.replace(/^\/app/, ""));
            }
          }}
        />
      </div>
    </div>
  );
}
