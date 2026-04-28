import { Box, Text } from "@mantine/core";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type PointerEvent as ReactPointerEvent,
} from "react";
import type { PaletteEntry } from "../../ProjectData";
import { drawPaletteCell, useResolvedPaletteIcons } from "./paletteRendering";

// 网格显示组件的显式输入
export interface GridDisplay2DProps {
    width: number;
    data: string[];
    palette: ReadonlyMap<string, PaletteEntry>;
    editable?: boolean;
    paintPaletteId?: string | null;
    onChangeData?: (nextData: string[]) => void;
}

// 预览方块的渲染参数
export interface PalettePreviewProps {
    entry: PaletteEntry;
    size?: number;
    borderRadius?: number;
}

// 将网格数据绘制到 canvas 上
function renderWholeGrid({
    canvas,
    size,
    width,
    height,
    data,
    palette,
    resolvedIcons,
}: {
    canvas: HTMLCanvasElement;
    size: { w: number; h: number };
    width: number;
    height: number;
    data: string[];
    palette: ReadonlyMap<string, PaletteEntry>;
    resolvedIcons: ReadonlyMap<string, HTMLImageElement | null>;
}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const tileWidth = size.w / width;
    const tileHeight = size.h / height;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = y * width + x;
            const cellId = data[index] ?? "Empty";
            const entry = palette.get(cellId) ?? null;

            drawPaletteCell({
                ctx,
                box: {
                    x: x * tileWidth,
                    y: y * tileHeight,
                    width: tileWidth,
                    height: tileHeight,
                },
                entry,
                fallbackColor: cellId === "Empty" ? "#111827" : "#4b5563",
                resolvedIcons,
            });
        }
    }
}

// PalettePreview 负责在侧边栏中绘制与画布一致的小预览方块
export function PalettePreview({
    entry,
    size = 18,
    borderRadius = 4,
}: PalettePreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const palette = useMemo(
        () => new Map([["__preview__", entry] as const]),
        [entry],
    );
    const { resolvedIcons, iconVersion } = useResolvedPaletteIcons(palette);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);

        drawPaletteCell({
            ctx,
            box: {
                x: 0,
                y: 0,
                width: size,
                height: size,
            },
            entry,
            fallbackColor: "#111827",
            resolvedIcons,
        });
    }, [entry, iconVersion, resolvedIcons, size]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                display: "block",
                width: size,
                height: size,
                borderRadius,
                overflow: "hidden",
                imageRendering: "pixelated",
            }}
        />
    );
}

// 网格显示组件
export function GridDisplay2D({
    width,
    data,
    palette,
    editable = false,
    paintPaletteId = null,
    onChangeData,
}: GridDisplay2DProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const dataRef = useRef(data);
    const gridHeight = useMemo(
        () => (width > 0 ? Math.ceil(data.length / width) : 0),
        [data.length, width],
    );
    const showEmptyPlaceholder = width === 0 || data.length === 0;
    const displayWidth = showEmptyPlaceholder ? 1 : width;
    const displayHeight = showEmptyPlaceholder ? 1 : gridHeight;
    const { resolvedIcons, iconVersion } = useResolvedPaletteIcons(palette);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || showEmptyPlaceholder) {
            return;
        }

        renderWholeGrid({
            canvas,
            size: { w: width * 32, h: gridHeight * 32 },
            width,
            height: gridHeight,
            data,
            palette,
            resolvedIcons,
        });
    }, [
        data,
        gridHeight,
        iconVersion,
        palette,
        resolvedIcons,
        showEmptyPlaceholder,
        width,
    ]);

    const pickCellIndex = useCallback(
        (clientX: number, clientY: number) => {
            const canvas = canvasRef.current;
            if (!canvas || width === 0 || gridHeight === 0) {
                return null;
            }

            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                return null;
            }

            const gridAspect = width / gridHeight;
            const rectAspect = rect.width / rect.height;

            let contentWidth = rect.width;
            let contentHeight = rect.height;
            if (rectAspect > gridAspect) {
                contentWidth = rect.height * gridAspect;
            } else if (rectAspect < gridAspect) {
                contentHeight = rect.width / gridAspect;
            }

            const contentLeft = rect.left + (rect.width - contentWidth) / 2;
            const contentTop = rect.top + (rect.height - contentHeight) / 2;
            const localX = clientX - contentLeft;
            const localY = clientY - contentTop;

            if (
                localX < 0 ||
                localY < 0 ||
                localX >= contentWidth ||
                localY >= contentHeight
            ) {
                return null;
            }

            const col = Math.floor((localX / contentWidth) * width);
            const row = Math.floor((localY / contentHeight) * gridHeight);

            if (col < 0 || row < 0 || col >= width || row >= gridHeight) {
                return null;
            }

            return row * width + col;
        },
        [gridHeight, width],
    );

    const paintCell = useCallback(
        (index: number) => {
            if (!editable || !paintPaletteId || !onChangeData) {
                return;
            }

            const currentData = dataRef.current;
            if (index < 0 || index >= currentData.length) {
                return;
            }

            if (currentData[index] === paintPaletteId) {
                return;
            }

            const nextData = Array.from(currentData);
            nextData[index] = paintPaletteId;
            dataRef.current = nextData;
            onChangeData(nextData);
        },
        [editable, onChangeData, paintPaletteId],
    );

    const handlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLCanvasElement>) => {
            if (event.button !== 0) {
                return;
            }

            const index = pickCellIndex(event.clientX, event.clientY);
            if (index == null) {
                return;
            }

            paintCell(index);
        },
        [paintCell, pickCellIndex],
    );

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLCanvasElement>) => {
            if ((event.buttons & 1) === 0) {
                return;
            }

            const index = pickCellIndex(event.clientX, event.clientY);
            if (index == null) {
                return;
            }

            paintCell(index);
        },
        [paintCell, pickCellIndex],
    );

    const handlePointerUp = useCallback(
        (event: ReactPointerEvent<HTMLCanvasElement>) => {
            if (event.button !== 0) {
                return;
            }

            const index = pickCellIndex(event.clientX, event.clientY);
            if (index == null) {
                return;
            }

            paintCell(index);
        },
        [paintCell, pickCellIndex],
    );

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
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
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
                cursor: editable ? "crosshair" : "default",
            }}
        />
    );
}
