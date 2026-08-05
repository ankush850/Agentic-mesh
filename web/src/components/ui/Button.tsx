import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const buttonStyles = cva(
  "inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition duration-200 active:translate-y-px focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-on-accent shadow-sm hover:bg-accent-strong hover:text-on-accent-strong hover:shadow-md disabled:bg-surface-3 disabled:text-muted disabled:opacity-100 disabled:shadow-none",
        secondary:
          "border border-btn-secondary-border bg-btn-secondary-bg text-btn-secondary-fg hover:border-line-strong hover:bg-btn-secondary-bg-hover hover:text-btn-secondary-fg-hover",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
        outline: "border border-line text-fg hover:border-line-strong hover:bg-surface-2",
        success: "border border-passed/40 bg-passed/15 text-passed hover:bg-passed/25",
        danger: "border border-failed/40 bg-failed/15 text-failed hover:bg-failed/25",
        link: "text-accent underline-offset-4 hover:text-accent-strong hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading = false, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonStyles({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
});
