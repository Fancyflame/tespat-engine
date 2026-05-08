import {
    useEffect,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const DEFAULT_TOP_RATIO = 0.35;
const SPLITTER_HEIGHT = 8;
const MIN_TOP_HEIGHT = 120;
const MIN_BOTTOM_HEIGHT = 160;

type SidebarSplitPaneProps = {
    top: ReactNode;
    bottom: ReactNode;
    defaultTopRatio?: number;
};

// SidebarSplitPane 只负责上下分栏的尺寸和拖拽
export function SidebarSplitPane({
    top,
    bottom,
    defaultTopRatio = DEFAULT_TOP_RATIO,
}: SidebarSplitPaneProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const cleanupDragRef = useRef<(() => void) | null>(null);
    const [topRatio, setTopRatio] = useState(defaultTopRatio);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        return () => {
            cleanupDragRef.current?.();
        };
    }, []);

    const updateRatioFromClientY = (clientY: number) => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const bounds = container.getBoundingClientRect();
        const usableHeight = bounds.height - SPLITTER_HEIGHT;
        if (usableHeight <= 0) {
            return;
        }

        const rawRatio =
            (clientY - bounds.top - SPLITTER_HEIGHT / 2) / usableHeight;

        let nextRatio = Math.min(1, Math.max(0, rawRatio));
        if (usableHeight >= MIN_TOP_HEIGHT + MIN_BOTTOM_HEIGHT) {
            const minRatio = MIN_TOP_HEIGHT / usableHeight;
            const maxRatio = 1 - MIN_BOTTOM_HEIGHT / usableHeight;
            nextRatio = Math.min(maxRatio, Math.max(minRatio, nextRatio));
        }

        setTopRatio(nextRatio);
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        cleanupDragRef.current?.();

        const previousUserSelect = document.body.style.userSelect;
        const previousCursor = document.body.style.cursor;

        setIsDragging(true);
        updateRatioFromClientY(event.clientY);

        const handlePointerMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            updateRatioFromClientY(moveEvent.clientY);
        };

        const finishDrag = () => {
            setIsDragging(false);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", finishDrag);
            window.removeEventListener("pointercancel", finishDrag);
            document.body.style.userSelect = previousUserSelect;
            document.body.style.cursor = previousCursor;
            cleanupDragRef.current = null;
        };

        cleanupDragRef.current = () => {
            finishDrag();
        };

        document.body.style.userSelect = "none";
        document.body.style.cursor = "row-resize";
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", finishDrag);
        window.addEventListener("pointercancel", finishDrag);
    };

    return (
        <div
            ref={containerRef}
            className="flex h-full min-h-0 w-full min-w-0 flex-col"
        >
            <div
                className="min-h-0 w-full min-w-0"
                style={{
                    flex: `0 0 calc((100% - ${SPLITTER_HEIGHT}px) * ${topRatio})`,
                }}
            >
                {top}
            </div>

            <div
                role="separator"
                aria-label="调整 Palette 和 Patterns 面板高度"
                aria-orientation="horizontal"
                className="group relative flex h-2 shrink-0 cursor-row-resize items-center justify-center select-none touch-none"
                onPointerDown={handlePointerDown}
            >
                <span
                    className={cn(
                        "pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-500/26 transition-colors group-hover:bg-blue-400/70",
                        isDragging && "bg-blue-400/70",
                    )}
                />
                <span
                    className={cn(
                        "pointer-events-none absolute h-1 w-14 rounded-full bg-slate-400/55 transition-all group-hover:scale-x-105 group-hover:bg-blue-100",
                        isDragging && "scale-x-105 bg-blue-100",
                    )}
                />
            </div>

            <div className="min-h-0 w-full min-w-0 flex-1">
                {bottom}
            </div>
        </div>
    );
}
