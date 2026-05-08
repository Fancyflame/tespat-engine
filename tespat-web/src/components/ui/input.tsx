import {
    forwardRef,
    type InputHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

// 基础输入框原语，替代 Mantine TextInput
export const Input = forwardRef<
    HTMLInputElement,
    InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => {
    return (
        <input
            ref={ref}
            type={type}
            className={cn(
                "flex h-9 w-full rounded-md border border-app-border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none placeholder:text-slate-500 focus:border-blue-400/70 focus:ring-2 focus:ring-blue-400/20 disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
});

Input.displayName = "Input";
