import { Box } from "@mantine/core";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Offset = { x: number; y: number };

type CtrlDragPannableProps = {
    className?: string;
    children: ReactNode;
    defaultOffset?: Offset;
    /** 归一化缩放下限，例如 0.1 表示 10% */
    minScale?: number;
    /** 归一化缩放上限，例如 5 表示 500% */
    maxScale?: number;
};

export function CtrlDragPannable({
    className,
    children,
    defaultOffset = { x: 0, y: 0 },
    minScale = 0.1,
    maxScale = 5,
}: CtrlDragPannableProps) {
    const [offset, setOffset] = useState<Offset>(defaultOffset);
    const [scale, setScale] = useState(1);
    const [enableDrag, setEnableDrag] = useState(false);
    const [dragging, setDragging] = useState(false);

    const startPointRef = useRef<{ x: number; y: number } | null>(null);
    const startOffsetRef = useRef<Offset>(defaultOffset);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Alt") setEnableDrag(true);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Alt") setEnableDrag(false);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    return (
        <Box
            className={className}
            onWheel={(e) => {
                e.stopPropagation();

                const zoomStep = e.deltaY < 0 ? 1.1 : 0.9;

                setScale((prevScale) => {
                    const unclamped = prevScale * zoomStep;
                    const newScale = Math.min(
                        maxScale,
                        Math.max(minScale, unclamped),
                    );

                    return newScale;
                });
            }}
            onPointerDown={(e) => {
                // 只有 Alt + 左键 或 中键 才能拖动
                const isAltLeftButton = e.button === 0 && e.altKey;
                const isMiddleButton = e.button === 1;
                if (!isAltLeftButton && !isMiddleButton) return;

                e.preventDefault();
                e.stopPropagation();

                setDragging(true);
                startPointRef.current = { x: e.clientX, y: e.clientY };
                startOffsetRef.current = offset;
                e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
                if (!dragging) return;
                const start = startPointRef.current;
                if (!start) return;
                const dx = e.clientX - start.x;
                const dy = e.clientY - start.y;
                setOffset({
                    x: startOffsetRef.current.x + dx,
                    y: startOffsetRef.current.y + dy,
                });
            }}
            onPointerUp={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.stopPropagation();
                setDragging(false);
                startPointRef.current = null;
                try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                    // ignore
                }
            }}
            onPointerCancel={() => {
                setDragging(false);
                startPointRef.current = null;
            }}
            style={{
                // transform: `translate(${offset.x}px, ${offset.y}px)`,
                overflow: "hidden",
                cursor: dragging ? "grabbing" : enableDrag ? "grab" : undefined,
                userSelect: "none",
                touchAction: "none",
                position: "relative",
            }}
        >
            <Box
                style={{
                    transform: ` translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: "50% 50%",
                    position: "absolute",
                    pointerEvents: enableDrag ? "none" : "auto",
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
