import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

export function GoalDropdown({
  label,
  help,
  options,
  selected,
  onChange,
  multiple = false,
}: {
  label: string;
  help: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const names = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);
  const summary = names.length
    ? names.length > 1
      ? `${names.length} materials selected`
      : names[0]
    : "Choose PDFs or reviewers";
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      className="goal-dropdown"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <label id={`${id}-label`} htmlFor={`${id}-trigger`}>
        {label}
      </label>
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type="button"
        className="goal-dropdown-trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-describedby={`${id}-help`}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => setOpen(!open)}
      >
        <span id={`${id}-value`}>{summary}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <p id={`${id}-help`} className="goal-help">
        {help}
      </p>
      {open && (
        <div
          id={`${id}-options`}
          className="goal-dropdown-menu"
          role="group"
          aria-labelledby={`${id}-label`}
        >
          {options.length ? (
            options.map((option) => (
              <label key={option.value} className="goal-material-option">
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={id}
                  checked={selected.includes(option.value)}
                  onChange={(event) => {
                    onChange(
                      multiple
                        ? event.target.checked
                          ? [...selected, option.value]
                          : selected.filter((value) => value !== option.value)
                        : [option.value],
                    );
                    if (!multiple) {
                      setOpen(false);
                      trigger.current?.focus();
                    }
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))
          ) : (
            <p className="goal-help">
              No PDFs or reviewers yet. Add them in Library or Reviewers, or
              leave this blank.
            </p>
          )}
          {multiple && (
            <button
              type="button"
              className="secondary goal-dropdown-done"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
