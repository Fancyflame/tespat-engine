import { useEffect, useState } from "react";
import type { PaletteEntry } from "../../ProjectData";

type IconTone = "light" | "dark";
type ResolvedIconMap = ReadonlyMap<string, HTMLImageElement | null>;

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
const SVG_ICON_RETRY_DELAY_MS = 5000;
const RAW_SVG_CACHE = new Map<string, string | null>();
const RAW_SVG_LOADING = new Map<string, Promise<string | null>>();
const SVG_DATA_URL_CACHE = new Map<string, string | null>();
const SVG_ICON_CACHE = new Map<string, HTMLImageElement | null>();
const SVG_ICON_LOADING = new Set<string>();
const SVG_ICON_LISTENERS = new Map<string, Set<() => void>>();
const SVG_ICON_RETRY_TIMERS = new Map<string, ReturnType<typeof setTimeout>>();

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

// 当加载失败时，延迟触发一次重试，避免单次失败把图标永久锁死在空状态
function scheduleSvgIconRetry(cacheKey: string) {
    if (SVG_ICON_RETRY_TIMERS.has(cacheKey)) {
        return;
    }

    const timer = setTimeout(() => {
        SVG_ICON_RETRY_TIMERS.delete(cacheKey);
        notifySvgIconListeners(cacheKey);
    }, SVG_ICON_RETRY_DELAY_MS);

    SVG_ICON_RETRY_TIMERS.set(cacheKey, timer);
}

// 统一归一化用户输入的图标名
function normalizeIconName(iconName: string) {
    const normalized = iconName.trim().toLowerCase();
    return normalized || null;
}

// 生成某个 outline SVG 在 glob 映射中的键名
function getTablerIconAssetKey(iconName: string) {
    const normalized = normalizeIconName(iconName);
    if (!normalized) {
        return null;
    }

    return `tabler-icons/outline/${normalized}.svg`;
}

// 生成某个图标颜色变体对应的缓存键
function getTablerIconCacheKey(iconName: string, strokeColor: string) {
    const normalized = normalizeIconName(iconName);
    if (!normalized) {
        return null;
    }

    return `${normalized}::${strokeColor}`;
}

// 获取某个 outline SVG 在当前站点下的可访问 URL
function getTablerIconAssetUrl(iconName: string) {
    const assetPath = getTablerIconAssetKey(iconName);
    if (!assetPath) {
        return null;
    }

    return `${import.meta.env.BASE_URL}${assetPath}`;
}

// 按需拉取原始 SVG 文本，并缓存同名图标的结果
function loadRawTablerIconSvg(iconName: string) {
    const assetPath = getTablerIconAssetKey(iconName);
    if (!assetPath) {
        return Promise.resolve(null);
    }

    if (RAW_SVG_CACHE.has(assetPath)) {
        return Promise.resolve(RAW_SVG_CACHE.get(assetPath) ?? null);
    }

    const loading = RAW_SVG_LOADING.get(assetPath);
    if (loading) {
        return loading;
    }

    const assetUrl = getTablerIconAssetUrl(iconName);
    if (!assetUrl) {
        return Promise.resolve(null);
    }

    const nextLoading = fetch(assetUrl)
        .then((response) => (response.ok ? response.text() : null))
        .catch(() => null)
        .then((rawSvg) => {
            if (rawSvg) {
                RAW_SVG_CACHE.set(assetPath, rawSvg);
            }
            return rawSvg;
        })
        .finally(() => {
            RAW_SVG_LOADING.delete(assetPath);
        });

    RAW_SVG_LOADING.set(assetPath, nextLoading);
    return nextLoading;
}

// 仅替换描边色，保留 Tabler outline SVG 的原始结构
function colorizeTablerIconSvg(rawSvg: string, strokeColor: string) {
    return rawSvg.replace(
        /stroke="currentColor"/g,
        `stroke="${strokeColor}"`,
    );
}

// 将 SVG 字符串转换为 data URL
function svgToDataUrl(svg: string) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// 为指定图标色变体生成并缓存 data URL
function getTablerIconDataUrl(
    cacheKey: string,
    rawSvg: string,
    strokeColor: string,
) {
    if (SVG_DATA_URL_CACHE.has(cacheKey)) {
        return SVG_DATA_URL_CACHE.get(cacheKey) ?? null;
    }

    const dataUrl = svgToDataUrl(colorizeTablerIconSvg(rawSvg, strokeColor));
    SVG_DATA_URL_CACHE.set(cacheKey, dataUrl);
    return dataUrl;
}

// 结束某个图标色变体的加载过程并通知订阅者
function finishTablerIconLoading(
    cacheKey: string,
    image: HTMLImageElement | null,
) {
    SVG_ICON_LOADING.delete(cacheKey);
    if (image) {
        const retryTimer = SVG_ICON_RETRY_TIMERS.get(cacheKey);
        if (retryTimer) {
            clearTimeout(retryTimer);
            SVG_ICON_RETRY_TIMERS.delete(cacheKey);
        }
        SVG_ICON_CACHE.set(cacheKey, image);
        notifySvgIconListeners(cacheKey);
        return;
    }

    SVG_ICON_CACHE.delete(cacheKey);
    scheduleSvgIconRetry(cacheKey);
}

// 为指定 iconName 和描边色确保缓存图像已准备好
function ensureTablerIconLoaded(iconName: string, strokeColor: string) {
    const cacheKey = getTablerIconCacheKey(iconName, strokeColor);
    if (
        !cacheKey ||
        SVG_ICON_CACHE.has(cacheKey) ||
        SVG_ICON_LOADING.has(cacheKey)
    ) {
        return cacheKey;
    }

    SVG_ICON_LOADING.add(cacheKey);

    void loadRawTablerIconSvg(iconName)
        .then((rawSvg) => {
            if (!rawSvg) {
                finishTablerIconLoading(cacheKey, null);
                return;
            }

            const dataUrl = getTablerIconDataUrl(
                cacheKey,
                rawSvg,
                strokeColor,
            );
            if (!dataUrl) {
                finishTablerIconLoading(cacheKey, null);
                return;
            }

            const image = new Image();
            image.onload = () => {
                finishTablerIconLoading(cacheKey, image);
            };
            image.onerror = () => {
                finishTablerIconLoading(cacheKey, null);
            };
            image.src = dataUrl;
        })
        .catch(() => {
            finishTablerIconLoading(cacheKey, null);
        });

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
            if (!cacheKey) {
                continue;
            }

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
        const cacheKey = getTablerIconCacheKey(entry.icon, strokeColor);
        const iconImage = cacheKey ? (resolvedIcons.get(cacheKey) ?? null) : null;

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
