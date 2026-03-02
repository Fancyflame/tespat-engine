import { Box } from "@mantine/core";
import type { ReactNode } from "react";
import { ResizeBar, type ResizeDirection, type ResizeDelta } from "./ResizeBar";

export interface GridEditResizerProps {
    children: ReactNode;
}

export function GridEditResizer({ children }: GridEditResizerProps) {
    const handleDeltaChange =
        (direction: ResizeDirection) =>
        ({ dx, dy }: ResizeDelta) => {
            console.log("GridEditResizer drag", {
                direction,
                dx,
                dy,
            });
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

            {/* 顶部拖拽条 */}
            <ResizeBar
                direction="top"
                onDeltaChange={handleDeltaChange("top")}
            />

            {/* 底部拖拽条 */}
            <ResizeBar
                direction="bottom"
                onDeltaChange={handleDeltaChange("bottom")}
            />

            {/* 左侧拖拽条 */}
            <ResizeBar
                direction="left"
                onDeltaChange={handleDeltaChange("left")}
            />

            {/* 右侧拖拽条 */}
            <ResizeBar
                direction="right"
                onDeltaChange={handleDeltaChange("right")}
            />
        </Box>
    );
}
