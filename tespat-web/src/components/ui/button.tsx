import {
    forwardRef,
    type ButtonHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "subtle"
    | "destructive";

type ButtonSize =
    | "default"
    | "sm"
    | "lg"
    | "icon-sm"
    | "icon"
    | "icon-lg";

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
}

const variantClassNames: Record<ButtonVariant, string> = {
    default:
        "bg-app-accent text-white hover:bg-blue-400",
    secondary:
        "bg-slate-800 text-slate-100 hover:bg-slate-700",
    outline:
        "border border-app-border bg-slate-900/70 text-slate-100 hover:bg-slate-800/80",
    ghost:
        "bg-transparent text-slate-200 hover:bg-white/6",
    subtle:
        "bg-app-accent-soft text-blue-100 hover:bg-app-accent-strong",
    destructive:
        "border border-red-400/20 bg-red-500/12 text-red-100 hover:bg-red-500/20",
};

const sizeClassNames: Record<ButtonSize, string> = {
    default: "h-10 px-4 text-sm font-semibold",
    sm: "h-8 px-3 text-xs font-semibold",
    lg: "h-11 px-5 text-sm font-semibold",
    "icon-sm": "size-7 p-0",
    icon: "size-8 p-0",
    "icon-lg": "size-10 p-0",
};

// 基础按钮原语，替代 Mantine Button/ActionIcon
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            children,
            disabled,
            loading = false,
            size = "default",
            type = "button",
            variant = "default",
            ...props
        },
        ref,
    ) => {
        return (
            <button
                ref={ref}
                type={type}
                className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg disabled:pointer-events-none disabled:opacity-50",
                    variantClassNames[variant],
                    sizeClassNames[size],
                    className,
                )}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                ) : null}
                {children}
            </button>
        );
    },
);

Button.displayName = "Button";
