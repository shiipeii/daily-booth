export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** a row of mutually exclusive options (radio group) */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  dark,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`segmented ${dark ? "segmented--dark" : ""}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="segmented__option"
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
