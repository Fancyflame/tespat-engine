import { Box } from "@mantine/core";
import type React from "react";
import { useRef } from "react";
import { useEditor } from "../../EditorData";
import styles from "./ResizeBar.module.css";

export type ResizeDirection = "top" | "bottom" | "left" | "right";

export interface ResizeDelta {
    dx: number;
    dy: number;
}

export interface ResizeBarProps {
    direction: ResizeDirection;
    barThickness?: number;
    /** 拖拽过程中偏移变化回调 */
    onDeltaChange?: (delta: ResizeDelta) => void;
    className?: string;
}

export function ResizeBar({
    direction,
    barThickness = 5,
    onDeltaChange,
    className,
}: ResizeBarProps) {
    const { setEditor } = useEditor();
    const offset = "-20px";
    const isDraggingRef = useRef(false);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);

    const handlePointerMove = (event: PointerEvent) => {
        if (!isDraggingRef.current || !startPointRef.current) return;

        const dx = event.clientX - startPointRef.current.x;
        const dy = event.clientY - startPointRef.current.y;

        onDeltaChange?.({ dx, dy });
    };

    const handlePointerUp = () => {
        if (!isDraggingRef.current) return;

        isDraggingRef.current = false;
        startPointRef.current = null;

        // 结束拖拽时重新开启编辑
        setEditor((prev) => ({
            ...prev,
            enableEdit: true,
        }));

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();

        isDraggingRef.current = true;
        startPointRef.current = { x: event.clientX, y: event.clientY };

        // 开始拖拽时临时关闭编辑
        setEditor((prev) => ({
            ...prev,
            enableEdit: false,
        }));

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    let directionalStyle: React.CSSProperties;
    switch (direction) {
        case "top":
            directionalStyle = {
                top: offset,
                left: barThickness,
                right: barThickness,
                height: barThickness,
                cursor: "ns-resize",
            };
            break;
        case "bottom":
            directionalStyle = {
                bottom: offset,
                left: barThickness,
                right: barThickness,
                height: barThickness,
                cursor: "ns-resize",
            };
            break;
        case "left":
            directionalStyle = {
                top: barThickness,
                bottom: barThickness,
                left: offset,
                width: barThickness,
                cursor: "ew-resize",
            };
            break;
        case "right":
            directionalStyle = {
                top: barThickness,
                bottom: barThickness,
                right: offset,
                width: barThickness,
                cursor: "ew-resize",
            };
            break;
    }

    return (
        <Box
            className={`${styles.resizeBar} ${className}`}
            onPointerDown={handlePointerDown}
            style={directionalStyle}
        />
    );
}
