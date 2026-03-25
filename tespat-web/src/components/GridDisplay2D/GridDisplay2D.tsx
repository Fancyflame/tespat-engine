import { Box, Text } from "@mantine/core";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
} from "react";
import type { PaletteEntry } from "../../ProjectData";

const ICON_CACHE = new Map<string, HTMLImageElement | null>();
const ICON_LOADING = new Set<string>();
const ICON_LISTENERS = new Map<string, Set<() => void>>();

// 网格显示组件的显式输入
export interface GridDisplay2DProps {
    width: number;
    data: string[];
    palette: ReadonlyMap<string, PaletteEntry>;
    editable?: boolean;
    paintPaletteId?: string | null;
    onChangeData?: (nextData: string[]) => void;
}

// 通知订阅者某个 icon 已完成加载
function notifyIconListeners(iconUrl: string) {
    ICON_LISTENERS.get(iconUrl)?.forEach((listener) => listener());
}

// 订阅某个 icon 的加载完成事件
function subscribeIconListener(iconUrl: string, listener: () => void) {
    const listeners = ICON_LISTENERS.get(iconUrl) ?? new Set<() => void>();
    listeners.add(listener);
    ICON_LISTENERS.set(iconUrl, listeners);

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            ICON_LISTENERS.delete(iconUrl);
        }
    };
}

// 确保某个 icon 资源开始加载
function ensureIconLoaded(iconUrl: string) {
    if (!iconUrl || ICON_CACHE.has(iconUrl) || ICON_LOADING.has(iconUrl)) {
        return;
    }

    ICON_LOADING.add(iconUrl);

    const image = new Image();
    image.onload = () => {
        ICON_LOADING.delete(iconUrl);
        ICON_CACHE.set(iconUrl, image);
        notifyIconListeners(iconUrl);
    };
    image.onerror = () => {
        ICON_LOADING.delete(iconUrl);
        ICON_CACHE.set(iconUrl, null);
        notifyIconListeners(iconUrl);
    };
    image.src = iconUrl;
}

// 收集并监听当前 palette 需要的 icon
function useResolvedPaletteIcons(palette: ReadonlyMap<string, PaletteEntry>) {
    const [iconVersion, setIconVersion] = useState(0);

    useEffect(() => {
        const unsubscribes: Array<() => void> = [];
        const forceRefresh = () => {
            setIconVersion((prev) => prev + 1);
        };

        for (const entry of palette.values()) {
            if (!entry.icon) {
                continue;
            }

            ensureIconLoaded(entry.icon);

            if (!ICON_CACHE.has(entry.icon)) {
                unsubscribes.push(
                    subscribeIconListener(entry.icon, forceRefresh),
                );
            }
        }

        return () => {
            unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
    }, [palette]);

    return {
        resolvedIcons: ICON_CACHE,
        iconVersion,
    };
}

// 按 contain 规则在单元格中绘制 icon
function drawContainedImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    box: { x: number; y: number; width: number; height: number },
) {
    if (image.width <= 0 || image.height <= 0) {
        return;
    }

    const padding = Math.min(box.width, box.height) * 0.18;
    const maxWidth = Math.max(box.width - padding * 2, 0);
    const maxHeight = Math.max(box.height - padding * 2, 0);
    if (maxWidth <= 0 || maxHeight <= 0) {
        return;
    }

    const imageRatio = image.width / image.height;
    const boxRatio = maxWidth / maxHeight;
    const drawWidth =
        imageRatio > boxRatio ? maxWidth : maxHeight * imageRatio;
    const drawHeight =
        imageRatio > boxRatio ? maxWidth / imageRatio : maxHeight;
    const drawX = box.x + (box.width - drawWidth) / 2;
    const drawY = box.y + (box.height - drawHeight) / 2;

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
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
            const entry = palette.get(cellId);
            const px = x * tileWidth;
            const py = y * tileHeight;

            ctx.fillStyle =
                entry?.color ?? (cellId === "Empty" ? "#111827" : "#4b5563");
            ctx.fillRect(px, py, tileWidth, tileHeight);

            if (entry?.icon) {
                const iconImage = resolvedIcons.get(entry.icon);
                if (iconImage) {
                    drawContainedImage(ctx, iconImage, {
                        x: px,
                        y: py,
                        width: tileWidth,
                        height: tileHeight,
                    });
                }
            }

            ctx.strokeStyle = "rgba(15,23,42,0.6)";
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, tileWidth - 1, tileHeight - 1);
        }
    }
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
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
                return null;
            }

            const col = Math.floor((x / rect.width) * width);
            const row = Math.floor((y / rect.height) * gridHeight);

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
