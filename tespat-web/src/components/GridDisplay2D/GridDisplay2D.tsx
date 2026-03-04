import { Box, Text } from "@mantine/core";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type RefObject,
} from "react";
import { useProject } from "../../ProjectData";
import { useEditor } from "../../EditorData";

export interface GridDisplay2DProps {
    width: number;
    data: string[];
    enableEdit?: boolean;
    /** 当网格数据变化时回调（可选） */
    onChangeData?: (nextData: string[]) => void;
}

// 网格显示组件
export function GridDisplay2D({
    width: gridWidth,
    data,
    enableEdit = false,
    onChangeData,
}: GridDisplay2DProps) {
    const { project } = useProject();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { renderData, gridHeight } = useGridDisplay2DEditing({
        gridWidth,
        data,
        enableEdit,
        onChangeData,
        canvasRef,
    });
    const showEmptyPlaceholder = gridWidth === 0 || renderData.length === 0;
    const displayWidth = showEmptyPlaceholder ? 1 : gridWidth;
    const displayHeight = showEmptyPlaceholder ? 1 : gridHeight;

    // 绘制网格
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || showEmptyPlaceholder) return;

        renderWholeGrid({
            canvas,
            size: { w: gridWidth * 32, h: gridHeight * 32 },
            width: gridWidth,
            height: gridHeight,
            data: renderData,
            colorDisplay: project.colors,
        });
    }, [
        renderData,
        gridWidth,
        gridHeight,
        project.colors,
        showEmptyPlaceholder,
    ]);

    if (showEmptyPlaceholder) {
        return (
            <Box
                style={{
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
                        maxWidth: "32px",
                        maxHeight: "32px",
                        aspectRatio: "1 / 1",
                        borderRadius: 5,
                        background: "#111827",
                        border: "1px solid rgba(15,23,42,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                    }}
                >
                    <Text
                        c="gray.2"
                        ff="monospace"
                        size="8px"
                        fw={700}
                        lts="0.06em"
                    >
                        EMPTY
                    </Text>
                </Box>
            </Box>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "contain",
                aspectRatio: `${displayWidth} / ${displayHeight}`,
                maxWidth: "100%",
                maxHeight: "100%",
                borderRadius: 5,
                background: "transparent",
                imageRendering: "pixelated",
            }}
        />
    );
}

// 将网格数据绘制到 canvas 上
function renderWholeGrid({
    canvas,
    size,
    width,
    height,
    data,
    colorDisplay,
}: {
    canvas: HTMLCanvasElement;
    size: { w: number; h: number };
    width: number;
    height: number;
    data: string[];
    colorDisplay: ReadonlyMap<string, string>;
}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 清空
    ctx.clearRect(0, 0, size.w, size.h);

    const tileW = size.w / width;
    const tileH = size.h / height;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const state = data[index] ?? "Empty";
            const color =
                colorDisplay.get(state) ??
                (state === "Empty" ? "#111827" : "#4b5563");

            const px = x * tileW;
            const py = y * tileH;

            ctx.fillStyle = color;
            ctx.fillRect(px, py, tileW, tileH);

            // 细微网格线
            ctx.strokeStyle = "rgba(15,23,42,0.6)";
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, tileW - 1, tileH - 1);
        }
    }
}

// 用于编辑网格数据
function useGridDisplay2DEditing({
    gridWidth,
    data,
    enableEdit = false,
    onChangeData,
    canvasRef,
}: {
    gridWidth: number;
    data: string[];
    enableEdit?: boolean;
    onChangeData?: (nextData: string[]) => void;
    canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
    const { editor } = useEditor();
    const [renderData, setRenderData] = useState<string[]>(data);

    // 外部 data 变化时，同步到内部渲染数据
    useEffect(() => {
        setRenderData(data);
    }, [data]);

    const gridHeight = useMemo(
        () => (gridWidth > 0 ? Math.ceil(data.length / gridWidth) : 0),
        [data.length, gridWidth],
    );

    const paintColor = useCallback(
        (index: number) => {
            if (!enableEdit) return;
            const selected = editor.selectedColor;
            if (!selected) return;

            const prev = renderData[index];
            if (prev === selected) return;
            const next = Array.from(renderData);
            next[index] = selected;
            setRenderData(next);
            onChangeData?.(next);
        },
        [editor.selectedColor, enableEdit, onChangeData],
    );

    useEffect(() => {
        if (!enableEdit) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const pickColorIndex = (event: PointerEvent): number | null => {
            if (gridWidth === 0 || gridHeight === 0) return null;

            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            if (x < 0 || y < 0 || x >= rect.width || y >= rect.height)
                return null;

            const col = Math.floor((x / rect.width) * gridWidth);
            const row = Math.floor((y / rect.height) * gridHeight);

            if (col < 0 || row < 0 || col >= gridWidth || row >= gridHeight)
                return null;

            return row * gridWidth + col;
        };

        const handlePointerDown = (event: PointerEvent) => {
            // 仅允许左键开始绘制
            if (event.button !== 0) return;
            const index = pickColorIndex(event);
            if (index == null) return;
            paintColor(index);
        };

        const handlePointerMove = (event: PointerEvent) => {
            // 仅在左键按下时持续绘制
            if ((event.buttons & 1) === 0) return;
            const index = pickColorIndex(event);
            if (index == null) return;
            paintColor(index);
        };

        const handlePointerUp = (event: PointerEvent) => {
            // 仅响应左键抬起的绘制结束
            if (event.button !== 0) return;
            const index = pickColorIndex(event);
            if (index == null) return;
            paintColor(index);
        };

        canvas.addEventListener("pointerdown", handlePointerDown);
        canvas.addEventListener("pointermove", handlePointerMove);
        canvas.addEventListener("pointerup", handlePointerUp);

        return () => {
            canvas.removeEventListener("pointerdown", handlePointerDown);
            canvas.removeEventListener("pointermove", handlePointerMove);
            canvas.removeEventListener("pointerup", handlePointerUp);
        };
    }, [canvasRef, enableEdit, gridWidth, gridHeight, paintColor]);

    return {
        renderData,
        gridHeight,
    };
}
