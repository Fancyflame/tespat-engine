import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
    forwardRef,
    type ComponentPropsWithoutRef,
    type ElementRef,
} from "react";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

// PopoverContent 封装统一的深色弹层外观
export const PopoverContent = forwardRef<
    ElementRef<typeof PopoverPrimitive.Content>,
    ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ align = "center", className, sideOffset = 10, ...props }, ref) => {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                ref={ref}
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    "z-50 rounded-2xl border border-app-border bg-slate-900/95 p-4 text-slate-100 shadow-2xl outline-none backdrop-blur-sm",
                    className,
                )}
                {...props}
            />
        </PopoverPrimitive.Portal>
    );
});

PopoverContent.displayName = PopoverPrimitive.Content.displayName;
