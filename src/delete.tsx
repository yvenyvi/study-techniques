import { useEffect, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { report } from "./shared";

type DeleteProps = {
  kind: "note" | "PDF";
  title: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
};

export function DeleteButton({ kind, title, onDelete, disabled }: DeleteProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="danger delete-button"
        aria-label={`Delete ${kind} “${title}”`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={16} aria-hidden="true" />
        Delete {kind}
      </button>
      {open && (
        <DeleteDialog
          kind={kind}
          title={title}
          onDelete={onDelete}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DeleteDialog({
  kind,
  title,
  onDelete,
  onClose,
}: DeleteProps & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const headingId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  function close() {
    dialog.current?.close();
    onClose();
  }
  return (
    <dialog
      ref={dialog}
      className="delete-dialog"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      aria-busy={deleting}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy.current) close();
      }}
    >
      <div className="delete-dialog-icon" aria-hidden="true">
        <Trash2 size={23} />
      </div>
      <h2 id={headingId}>Delete {kind}?</h2>
      <div id={descriptionId}>
        <p className="delete-item-title">“{title}”</p>
        <p>
          {kind === "PDF"
            ? "This uploaded PDF will be permanently removed from this device. Its notes and reviewers will stay in your library."
            : "This note will be permanently removed from this device. Your PDFs and reviewers will stay in your library."}
        </p>
        <p className="small muted">This cannot be undone.</p>
      </div>
      {error && (
        <p className="delete-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="secondary"
          autoFocus
          disabled={deleting}
          onClick={close}
        >
          Cancel
        </button>
        <button
          type="button"
          className="delete-confirm"
          disabled={deleting}
          onClick={async () => {
            if (busy.current) return;
            busy.current = true;
            setDeleting(true);
            setError("");
            try {
              await onDelete();
              report(`${kind === "PDF" ? "PDF" : "Note"} deleted.`);
              close();
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Deletion failed. Please try again.",
              );
              busy.current = false;
              setDeleting(false);
            }
          }}
        >
          {deleting ? "Deleting…" : `Delete ${kind}`}
        </button>
      </div>
    </dialog>
  );
}
