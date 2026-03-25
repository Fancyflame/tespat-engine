import { Box } from "@mantine/core";
import type React from "react";
import { useRef } from "react";
import styles from "./ResizeBar.module.css";

// 可拖拽的四个尺寸方向
export type ResizeDirection = "top" | "bottom" | "left" | "right";

// 单次拖拽的像素偏移量
export interface ResizeDelta {
    dx: number;
    dy: number;
}

// 单条 resize bar 的输入参数
export interface ResizeBarProps {
    direction: ResizeDirection;
    barThickness?: number;
    onDragStart?: () => void;
    onDeltaChange?: (delta: ResizeDelta) => void;
    onDragEnd?: () => void;
    className?: string;
}

// ResizeBar 只负责抛出拖拽交互，不直接修改业务状态
export function ResizeBar({
    direction,
    barThickness = 5,
    onDragStart,
    onDeltaChange,
    onDragEnd,
    className,
}: ResizeBarProps) {
    const offset = "-20px";
    const isDraggingRef = useRef(false);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);

    const handlePointerMove = (event: PointerEvent) => {
        if (!isDraggingRef.current || !startPointRef.current) {
            return;
        }

        const dx = event.clientX - startPointRef.current.x;
        const dy = event.clientY - startPointRef.current.y;

        onDeltaChange?.({ dx, dy });
    };

    const handlePointerUp = () => {
        if (!isDraggingRef.current) {
            return;
        }

        isDraggingRef.current = false;
        startPointRef.current = null;
        onDragEnd?.();

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();

        isDraggingRef.current = true;
        startPointRef.current = { x: event.clientX, y: event.clientY };
        onDragStart?.();

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
            className={`${styles.resizeBar} ${className ?? ""}`}
            onPointerDown={handlePointerDown}
            style={directionalStyle}
        />
    );
}
