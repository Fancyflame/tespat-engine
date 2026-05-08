import * as SliderPrimitive from "@radix-ui/react-slider";
import {
    forwardRef,
    type ComponentPropsWithoutRef,
    type ElementRef,
} from "react";
import { cn } from "@/lib/utils";

// Slider 封装时间轴等单值滑杆的统一外观
export const Slider = forwardRef<
    ElementRef<typeof SliderPrimitive.Root>,
    ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
    return (
        <SliderPrimitive.Root
            ref={ref}
            className={cn(
                "relative flex w-full touch-none select-none items-center",
                className,
            )}
            {...props}
        >
            <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/10">
                <SliderPrimitive.Range className="absolute h-full bg-app-accent" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="block size-4 rounded-full border-2 border-slate-950 bg-blue-300 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg disabled:pointer-events-none disabled:opacity-50" />
        </SliderPrimitive.Root>
    );
});

Slider.displayName = SliderPrimitive.Root.displayName;
