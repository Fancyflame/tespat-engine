import { Box } from "@mantine/core";
import type { ReactNode } from "react";
import { useRef } from "react";
import { ResizeBar, type ResizeDirection, type ResizeDelta } from "./ResizeBar";

// GridEditResizer 的输入参数
export interface GridEditResizerProps {
    children: ReactNode;
    onResize: (direction: ResizeDirection, deltaUnits: number) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
}

// GridEditResizer 负责把像素拖拽换算成网格单位增量
export function GridEditResizer({
    children,
    onResize,
    onResizeStart,
    onResizeEnd,
}: GridEditResizerProps) {
    const appliedDeltaRef = useRef(0);

    const handleDragStart = () => {
        appliedDeltaRef.current = 0;
        onResizeStart?.();
    };

    const handleDragEnd = () => {
        appliedDeltaRef.current = 0;
        onResizeEnd?.();
    };

    const handleDeltaChange =
        (direction: ResizeDirection) =>
        ({ dx, dy }: ResizeDelta) => {
            const PX_PER_CELL = 32;

            let rawUnits = 0;
            if (direction === "left" || direction === "right") {
                const sign = direction === "right" ? 1 : -1;
                rawUnits = Math.trunc((dx * sign) / PX_PER_CELL);
            } else {
                const sign = direction === "bottom" ? 1 : -1;
                rawUnits = Math.trunc((dy * sign) / PX_PER_CELL);
            }

            const previousUnits = appliedDeltaRef.current;
            if (rawUnits === previousUnits) {
                return;
            }

            appliedDeltaRef.current = rawUnits;
            onResize(direction, rawUnits - previousUnits);
        };

    return (
        <Box
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Box
                style={{
                    width: "100%",
                    height: "100%",
                }}
            >
                {children}
            </Box>

            <ResizeBar
                direction="top"
                onDragStart={handleDragStart}
                onDeltaChange={handleDeltaChange("top")}
                onDragEnd={handleDragEnd}
            />
            <ResizeBar
                direction="bottom"
                onDragStart={handleDragStart}
                onDeltaChange={handleDeltaChange("bottom")}
                onDragEnd={handleDragEnd}
            />
            <ResizeBar
                direction="left"
                onDragStart={handleDragStart}
                onDeltaChange={handleDeltaChange("left")}
                onDragEnd={handleDragEnd}
            />
            <ResizeBar
                direction="right"
                onDragStart={handleDragStart}
                onDeltaChange={handleDeltaChange("right")}
                onDragEnd={handleDragEnd}
            />
        </Box>
    );
}
