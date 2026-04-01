import {
    createElement,
    useEffect,
    useState,
    type ComponentType,
} from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import * as TablerIcons from "@tabler/icons-react";
import type { PaletteEntry } from "../../ProjectData";

type IconTone = "light" | "dark";
type ResolvedIconMap = ReadonlyMap<string, HTMLImageElement | null>;
type TablerIconComponent = ComponentType<{
    color?: string;
    size?: string | number;
    stroke?: string | number;
}>;

export type PaletteCellBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type DrawPaletteCellParams = {
    ctx: CanvasRenderingContext2D;
    box: PaletteCellBox;
    entry: PaletteEntry | null;
    fallbackColor: string;
    resolvedIcons: ResolvedIconMap;
    drawBorder?: boolean;
};

const TABLER_STROKE_COLORS: Record<IconTone, string> = {
    light: "#f8fafc",
    dark: "#0f172a",
};
const SVG_ICON_CACHE = new Map<string, HTMLImageElement | null>();
const SVG_ICON_LOADING = new Set<string>();
const SVG_ICON_LISTENERS = new Map<string, Set<() => void>>();

// 计算十六进制颜色的相对亮度
function getHexColorLuminance(hexColor: string) {
    const normalized = hexColor.trim().replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return 0;
    }

    const channels = [0, 2, 4].map((offset) => {
        const value = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
        return value <= 0.03928
            ? value / 12.92
            : Math.pow((value + 0.055) / 1.055, 2.4);
    });

    const [r, g, b] = channels;
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

// 根据底色自动选择 icon 的深浅描边色
function getIconStrokeColor(backgroundHex: string) {
    const luminance = getHexColorLuminance(backgroundHex);
    return luminance < 0.3
        ? TABLER_STROKE_COLORS.light
        : TABLER_STROKE_COLORS.dark;
}

// 通知订阅者某个 SVG icon 已完成加载
function notifySvgIconListeners(cacheKey: string) {
    SVG_ICON_LISTENERS.get(cacheKey)?.forEach((listener) => listener());
}

// 订阅某个 SVG icon 的加载完成事件
function subscribeSvgIconListener(cacheKey: string, listener: () => void) {
    const listeners = SVG_ICON_LISTENERS.get(cacheKey) ?? new Set<() => void>();
    listeners.add(listener);
    SVG_ICON_LISTENERS.set(cacheKey, listeners);

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            SVG_ICON_LISTENERS.delete(cacheKey);
        }
    };
}

// 将 kebab-case 的 icon 名称转换为 Tabler React 导出名
function toTablerExportName(iconName: string) {
    const normalized = iconName.trim();
    if (!normalized) {
        return null;
    }

    const pascalName = normalized
        .split("-")
        .filter((segment) => segment.length > 0)
        .map((segment) => segment[0].toUpperCase() + segment.slice(1))
        .join("");

    if (!pascalName) {
        return null;
    }

    return `Icon${pascalName}`;
}

// 根据 kebab-case 名称获取对应的 Tabler React 图标组件
function getTablerIconComponent(iconName: string) {
    const exportName = toTablerExportName(iconName);
    if (!exportName) {
        return null;
    }

    const candidate = (TablerIcons as Record<string, unknown>)[exportName];
    if (!candidate) {
        return null;
    }

    return candidate as TablerIconComponent;
}

// 由 Tabler React 图标组件构造 SVG 字符串
function buildTablerIconSvg(iconName: string, strokeColor: string) {
    const IconComponent = getTablerIconComponent(iconName);
    if (!IconComponent) {
        return null;
    }

    return renderToStaticMarkup(
        createElement(IconComponent, {
            color: strokeColor,
            size: 24,
            stroke: 2,
        }),
    );
}

// 将 SVG 字符串转换为 data URL
function svgToDataUrl(svg: string) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// 为指定 iconName 和描边色确保缓存图像已准备好
function ensureTablerIconLoaded(iconName: string, strokeColor: string) {
    const cacheKey = `${iconName}::${strokeColor}`;
    if (
        !iconName ||
        SVG_ICON_CACHE.has(cacheKey) ||
        SVG_ICON_LOADING.has(cacheKey)
    ) {
        return cacheKey;
    }

    const svg = buildTablerIconSvg(iconName, strokeColor);
    if (!svg) {
        SVG_ICON_CACHE.set(cacheKey, null);
        return cacheKey;
    }

    SVG_ICON_LOADING.add(cacheKey);

    const image = new Image();
    image.onload = () => {
        SVG_ICON_LOADING.delete(cacheKey);
        SVG_ICON_CACHE.set(cacheKey, image);
        notifySvgIconListeners(cacheKey);
    };
    image.onerror = () => {
        SVG_ICON_LOADING.delete(cacheKey);
        SVG_ICON_CACHE.set(cacheKey, null);
        notifySvgIconListeners(cacheKey);
    };
    image.src = svgToDataUrl(svg);

    return cacheKey;
}

// 收集并监听当前 palette 需要的 Tabler icon
export function useResolvedPaletteIcons(palette: ReadonlyMap<string, PaletteEntry>) {
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

            const strokeColor = getIconStrokeColor(entry.color);
            const cacheKey = ensureTablerIconLoaded(entry.icon, strokeColor);

            if (!SVG_ICON_CACHE.has(cacheKey)) {
                unsubscribes.push(
                    subscribeSvgIconListener(cacheKey, forceRefresh),
                );
            }
        }

        return () => {
            unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
    }, [palette]);

    return {
        resolvedIcons: SVG_ICON_CACHE,
        iconVersion,
    };
}

// 按 contain 规则在单元格中绘制 icon
function drawContainedImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    box: PaletteCellBox,
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
    const drawWidth = imageRatio > boxRatio ? maxWidth : maxHeight * imageRatio;
    const drawHeight =
        imageRatio > boxRatio ? maxWidth / imageRatio : maxHeight;
    const drawX = box.x + (box.width - drawWidth) / 2;
    const drawY = box.y + (box.height - drawHeight) / 2;

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

// 统一绘制一个 palette 单元格：底色 + Tabler icon + 边框
export function drawPaletteCell({
    ctx,
    box,
    entry,
    fallbackColor,
    resolvedIcons,
    drawBorder = true,
}: DrawPaletteCellParams) {
    const backgroundColor = entry?.color ?? fallbackColor;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(box.x, box.y, box.width, box.height);

    if (entry?.icon) {
        const strokeColor = getIconStrokeColor(backgroundColor);
        const cacheKey = `${entry.icon}::${strokeColor}`;
        const iconImage = resolvedIcons.get(cacheKey) ?? null;

        if (iconImage) {
            drawContainedImage(ctx, iconImage, box);
        }
    }

    if (drawBorder) {
        ctx.strokeStyle = "rgba(15,23,42,0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(
            box.x + 0.5,
            box.y + 0.5,
            Math.max(box.width - 1, 0),
            Math.max(box.height - 1, 0),
        );
    }
}
