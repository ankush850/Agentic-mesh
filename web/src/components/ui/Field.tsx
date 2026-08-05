import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";

const controlBase =
  "w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-muted/70 transition-colors hover:border-line-strong focus:border-accent focus:outline-none disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(controlBase, "h-10", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(controlBase, "min-h-24 py-2 leading-relaxed", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(controlBase, "h-10 cursor-pointer pr-8", className)}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
  className?: string;
}

/** Label + hint + error wiring; the control is injected so any input type works. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error) || undefined,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-failed">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors",
          checked
            ? "border-accent bg-accent hover:bg-accent-strong"
            : "border-line-strong bg-surface-3 hover:border-muted",
          disabled && "opacity-50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            // The left inset has to be explicit. Without it the knob falls back
            // to its static position, which the button's user-agent
            // `text-align: center` puts in the *middle* of the track — so the
            // 22px of travel drove it clean out of the right-hand end.
            // Geometry: 44px track - 2px borders = 42px inner; 18px knob; 2px
            // inset each side leaves 42 - 2 - 18 = 22px of travel, of which we
            // use 20px so the knob stops 2px short of the far edge.
            "absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full shadow-sm transition-transform duration-200 ease-out",
            checked ? "translate-x-5 bg-white" : "translate-x-0 bg-fg",
          )}
        />
      </button>
    </div>
  );
}
