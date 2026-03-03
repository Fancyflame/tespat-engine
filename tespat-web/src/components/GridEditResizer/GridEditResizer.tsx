import { Box } from "@mantine/core";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { notifications } from "@mantine/notifications";
import { IconInfoCircle, IconInfoSmall, IconX } from "@tabler/icons-react";
import { useEditor } from "../../EditorData";
import { ResizeBar, type ResizeDirection, type ResizeDelta } from "./ResizeBar";
import { applyResizeGrid } from "./applyResizeGrid";

export interface GridEditResizerProps {
    children: ReactNode;
}

export function GridEditResizer({ children }: GridEditResizerProps) {
    const { editor, setEditor } = useEditor();

    // 记录当前拖拽已经应用了多少「格子增量」
    const appliedDeltaRef = useRef(0);

    // 记录"当前拖拽周期"是否已经提示过未选择颜色，避免疯狂弹通知
    const noColorWarnedRef = useRef(false);

    // 当重新开启编辑（拖拽结束）时，重置累计偏移与提示状态
    useEffect(() => {
        if (!editor.enableEdit) return;

        appliedDeltaRef.current = 0;
        noColorWarnedRef.current = false;
    }, [editor.enableEdit]);

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

            const prevUnits = appliedDeltaRef.current;
            if (rawUnits === prevUnits) return;

            if (!editor.selectedColor) {
                if (!noColorWarnedRef.current) {
                    notifications.show({
                        title: "无法调整尺寸",
                        message:
                            "请先在左侧选择一个颜色后再拖拽调整尺寸，\
                            将使用选中的颜色填充增添的区域。",
                        icon: <IconInfoSmall size={48} />,
                        color: "blue",
                    });
                    noColorWarnedRef.current = true;
                }
                return;
            }

            const deltaUnits = rawUnits - prevUnits;
            appliedDeltaRef.current = rawUnits;

            const fillColor = editor.selectedColor;
            if (!fillColor) return;

            setEditor((prev) => {
                const { width, data } = prev.editingGrid;
                const result = applyResizeGrid({
                    direction,
                    deltaUnits,
                    fillColor,
                    width,
                    data,
                });

                if (result.width === width && result.data === data) {
                    return prev;
                }

                return {
                    ...prev,
                    editingGrid: {
                        ...prev.editingGrid,
                        width: result.width,
                        data: result.data,
                    },
                };
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
