import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "./custom-select.css";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  color?: string;
};
type Base = {
  options: SelectOption[];
  "aria-label": string;
  "aria-describedby"?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  emptyMessage?: string;
};
type Props = Base &
  (
    | {
        multiple?: false;
        value: string | number;
        onChange: (value: string) => void;
      }
    | { multiple: true; value: string[]; onChange: (value: string[]) => void }
  );

export function CustomSelect(props: Props) {
  const {
    options,
    disabled,
    multiple,
    className = "",
    placeholder = "Choose an option",
    emptyMessage = "No options available",
  } = props;
  const generatedId = useId();
  const id = props.id || generatedId;
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 200,
    maxHeight: 280,
  });
  const typeahead = useRef({ text: "", time: 0 });
  const selected = multiple ? props.value : [String(props.value)];
  const selectedOptions = options.filter((option) =>
    selected.includes(option.value),
  );
  const summary =
    selectedOptions.length > 1
      ? `${selectedOptions.length} materials selected`
      : selectedOptions[0]?.label ||
        (!multiple && props.value ? String(props.value) : placeholder);
  const blocked = () => !!disabled || !!trigger.current?.matches(":disabled");
  const initialIndex = () =>
    Math.max(
      0,
      options.findIndex(
        (option) => !option.disabled && selected.includes(option.value),
      ) >= 0
        ? options.findIndex(
            (option) => !option.disabled && selected.includes(option.value),
          )
        : options.findIndex((option) => !option.disabled),
    );
  const show = () => {
    if (!blocked()) {
      setActive(initialIndex());
      setOpen(true);
    }
  };
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  const choose = (index: number) => {
    if (blocked()) {
      close();
      return;
    }
    const option = options[index];
    if (!option || option.disabled) return;
    if (props.multiple)
      props.onChange(
        selected.includes(option.value)
          ? selected.filter((value) => value !== option.value)
          : [...selected, option.value],
      );
    else {
      close();
      props.onChange(option.value);
    }
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target))
        close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    if (blocked()) {
      setOpen(false);
      return;
    }
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(
        Math.max(anchor.width, 210),
        window.innerWidth - 16,
      );
      const below = window.innerHeight - anchor.bottom - 12;
      const above = anchor.top - 12;
      const contentHeight = menu.current?.scrollHeight || 280;
      const upwards = below < Math.min(contentHeight, 280) && above > below;
      const maxHeight = Math.max(44, Math.min(320, upwards ? above : below));
      const height = Math.min(contentHeight, maxHeight);
      const next = {
        width,
        maxHeight,
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
        top: upwards ? Math.max(8, anchor.top - height - 6) : anchor.bottom + 6,
      };
      setPosition((previous) =>
        Object.keys(next).every(
          (key) =>
            previous[key as keyof typeof next] ===
            next[key as keyof typeof next],
        )
          ? previous
          : next,
      );
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const observer = new ResizeObserver(place);
    if (trigger.current) observer.observe(trigger.current);
    if (menu.current) observer.observe(menu.current);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      observer.disconnect();
    };
  }, [open, disabled, options.length]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);
  useEffect(() => {
    if (open && blocked()) setOpen(false);
  });
  const navigate = (direction: number) => {
    for (let step = 1; step <= options.length; step++) {
      const index =
        (active + direction * step + options.length) % options.length;
      if (!options[index].disabled) {
        setActive(index);
        break;
      }
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (blocked()) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) show();
      if (event.key === "Home")
        setActive(
          Math.max(
            0,
            options.findIndex((option) => !option.disabled),
          ),
        );
      else if (event.key === "End")
        setActive(
          Math.max(
            0,
            options.map((option) => !option.disabled).lastIndexOf(true),
          ),
        );
      else if (open) navigate(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") close();
    else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const previous = typeahead.current;
      const text =
        (Date.now() - previous.time > 800 ? "" : previous.text) +
        event.key.toLocaleLowerCase();
      typeahead.current = { text, time: Date.now() };
      const needle = [...text].every((letter) => letter === text[0])
        ? text[0]
        : text;
      const start =
        text.length === 1 || needle.length === 1 ? active + 1 : active;
      for (let step = 0; step < options.length; step++) {
        const index = (start + step) % options.length;
        if (
          !options[index].disabled &&
          options[index].label.toLocaleLowerCase().startsWith(needle)
        ) {
          setActive(index);
          setOpen(true);
          break;
        }
      }
    }
  };
  return (
    <span
      className={`custom-select ${className}`}
      ref={root}
      onBlur={(event) => {
        const target = event.relatedTarget as Node | null;
        if (!root.current?.contains(target) && !menu.current?.contains(target))
          close();
      }}
    >
      <button
        id={id}
        ref={trigger}
        type="button"
        role="combobox"
        className="custom-select-trigger"
        disabled={disabled}
        aria-label={props["aria-label"]}
        aria-describedby={props["aria-describedby"]}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-activedescendant={
          open && options[active] ? `${id}-option-${active}` : undefined
        }
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
      >
        <span className="custom-select-value">{summary}</span>
        <ChevronDown
          className="custom-select-chevron"
          size={16}
          aria-hidden="true"
        />
      </button>
      {open &&
        createPortal(
          <div
            className="custom-select-menu"
            style={position}
            ref={menu}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                close(true);
              }
            }}
          >
            <div
              id={`${id}-listbox`}
              role="listbox"
              aria-label={props["aria-label"]}
              aria-multiselectable={multiple || undefined}
            >
              {options.length ? (
                options.map((option, index) => (
                  <div
                    key={option.value}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={selected.includes(option.value)}
                    aria-disabled={option.disabled || undefined}
                    className={`custom-select-option ${active === index ? "highlighted" : ""}`}
                    onPointerMove={() => !option.disabled && setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(index)}
                  >
                    {option.color && (
                      <span
                        className="custom-select-swatch"
                        style={{ backgroundColor: option.color }}
                        aria-hidden="true"
                      />
                    )}
                    <span>{option.label}</span>
                    <span className="custom-select-mark" aria-hidden="true">
                      {selected.includes(option.value) && <Check size={16} />}
                    </span>
                  </div>
                ))
              ) : (
                <p className="custom-select-empty">{emptyMessage}</p>
              )}
            </div>
            {multiple && (
              <button
                className="secondary custom-select-done"
                type="button"
                onClick={() => close(true)}
              >
                Done
              </button>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}
