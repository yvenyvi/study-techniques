import { useId } from "react";
import { CustomSelect } from "./custom-select";

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
  const common = {
    id,
    "aria-label": label,
    "aria-describedby": `${id}-help`,
    options,
    placeholder: "Choose PDFs or reviewers",
    emptyMessage:
      "No PDFs or reviewers yet. Add them in Library or Reviewers, or leave this blank.",
  };
  return (
    <div className="goal-dropdown">
      <label htmlFor={id}>{label}</label>
      {multiple ? (
        <CustomSelect
          {...common}
          multiple
          value={selected}
          onChange={onChange}
        />
      ) : (
        <CustomSelect
          {...common}
          value={selected[0] || ""}
          onChange={(value) => onChange([value])}
        />
      )}
      <p id={`${id}-help`} className="goal-help">
        {help}
      </p>
    </div>
  );
}
