import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

type SidebarPanelProps = {
    title: ReactNode;
    rightAction?: ReactNode;
    children: ReactNode;
};

// SidebarPanel 负责固定标题区与独立滚动的内容区
export function SidebarPanel({
    title,
    rightAction,
    children,
}: SidebarPanelProps) {
    return (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3">
            <div className="mt-1 flex w-full min-w-0 shrink-0 items-center justify-between gap-2">
                <p className="text-[11px] font-black tracking-[0.18em] text-slate-400">
                    {title}
                </p>
                {rightAction}
            </div>

            <div className="min-h-0 w-full min-w-0 flex-1">
                <ScrollArea className="h-full w-full">
                    <div className="min-h-full w-full min-w-0 pt-1">{children}</div>
                </ScrollArea>
            </div>
        </div>
    );
}
