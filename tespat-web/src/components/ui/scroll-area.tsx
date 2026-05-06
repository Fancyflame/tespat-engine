import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import {
    forwardRef,
    type ComponentPropsWithoutRef,
    type ElementRef,
} from "react";
import { cn } from "@/lib/utils";

export const ScrollArea = forwardRef<
    ElementRef<typeof ScrollAreaPrimitive.Root>,
    ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => {
    return (
        <ScrollAreaPrimitive.Root
            ref={ref}
            className={cn("relative overflow-hidden", className)}
            {...props}
        >
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
                {children}
            </ScrollAreaPrimitive.Viewport>
            <ScrollBar />
            <ScrollAreaPrimitive.Corner className="bg-transparent" />
        </ScrollAreaPrimitive.Root>
    );
});

ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

// ScrollBar 统一滚动条视觉，替代 Mantine ScrollArea
const ScrollBar = forwardRef<
    ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
    ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => {
    return (
        <ScrollAreaPrimitive.ScrollAreaScrollbar
            ref={ref}
            orientation={orientation}
            className={cn(
                "flex touch-none select-none p-0.5 transition-colors",
                orientation === "vertical"
                    ? "h-full w-2.5 border-l border-l-transparent"
                    : "h-2.5 flex-col border-t border-t-transparent",
                className,
            )}
            {...props}
        >
            <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-slate-600/70 hover:bg-slate-500/80" />
        </ScrollAreaPrimitive.ScrollAreaScrollbar>
    );
});

ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;
