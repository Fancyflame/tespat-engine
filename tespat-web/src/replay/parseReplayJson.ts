import type { PaletteEntry } from "../ProjectData";

// 前端回放视图使用的归一化数据
export type ReplayData = {
    width: number;
    frames: string[][];
    palette: ReadonlyMap<string, PaletteEntry>;
};

// 校验完成但尚未归一化的回放载荷
type ReplayPayload = {
    width: number;
    frames: number[][];
    palettes: PaletteEntry[];
};

// 回放 JSON 解析结果
export type ReplayParseResult =
    | { ok: true; data: ReplayData }
    | { ok: false; message: string };

// 判断值是否为普通对象
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 将 unknown 错误收敛为可展示文案
function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "回放数据格式无效";
}

// 解析单条 palette 配置
function parseReplayPalette(index: number, value: unknown): PaletteEntry {
    if (!isObject(value)) {
        throw new Error(`palettes[${index}] 必须是对象`);
    }

    const { color, icon } = value;

    if (typeof color !== "string") {
        throw new Error(`palettes[${index}].color 必须是字符串`);
    }

    if (icon !== null && typeof icon !== "string") {
        throw new Error(`palettes[${index}].icon 必须是字符串或 null`);
    }

    return {
        color,
        icon,
    };
}

// 解析并校验单帧网格数据
function parseReplayFrame(
    frameIndex: number,
    value: unknown,
    paletteCount: number,
): number[] {
    if (!Array.isArray(value)) {
        throw new Error(`frames[${frameIndex}] 必须是整数数组`);
    }

    return value.map((cell, cellIndex) => {
        if (!Number.isInteger(cell)) {
            throw new Error(
                `frames[${frameIndex}][${cellIndex}] 必须是整数`,
            );
        }

        const paletteIndex = cell as number;
        if (paletteIndex < 0 || paletteIndex >= paletteCount) {
            throw new Error(
                `frames[${frameIndex}][${cellIndex}] 引用了不存在的 palette 索引`,
            );
        }

        return paletteIndex;
    });
}

// 将原始 JSON 结构校验为回放载荷
function parseReplayPayload(parsed: unknown): ReplayPayload {
    if (!isObject(parsed)) {
        throw new Error("回放数据必须是对象结构");
    }

    const { width, frames, palettes } = parsed;

    if (!Number.isInteger(width) || (width as number) < 0) {
        throw new Error("width 必须是大于等于 0 的整数");
    }

    if (!Array.isArray(palettes)) {
        throw new Error("palettes 必须是数组");
    }

    const normalizedPalettes = palettes.map((entry, index) =>
        parseReplayPalette(index, entry),
    );

    if (!Array.isArray(frames)) {
        throw new Error("frames 必须是数组");
    }

    let expectedFrameLength: number | null = null;
    const normalizedFrames = frames.map((frame, index) => {
        const normalizedFrame = parseReplayFrame(
            index,
            frame,
            normalizedPalettes.length,
        );

        if (expectedFrameLength == null) {
            expectedFrameLength = normalizedFrame.length;
        } else if (expectedFrameLength !== normalizedFrame.length) {
            throw new Error("所有帧的长度必须一致");
        }

        return normalizedFrame;
    });

    const frameLength = expectedFrameLength ?? 0;
    const numericWidth = width as number;

    if (numericWidth === 0 && frameLength !== 0) {
        throw new Error("width 为 0 时，所有帧必须是空数组");
    }

    if (numericWidth > 0 && frameLength % numericWidth !== 0) {
        throw new Error("帧长度必须是 width 的整数倍");
    }

    return {
        width: numericWidth,
        frames: normalizedFrames,
        palettes: normalizedPalettes,
    };
}

// 将已校验的回放载荷归一化为前端渲染模型
function normalizeReplayPayload(payload: ReplayPayload): ReplayData {
    return {
        width: payload.width,
        frames: payload.frames.map((frame) =>
            frame.map((cellId) => String(cellId)),
        ),
        palette: new Map(
            payload.palettes.map((entry, index) => [String(index), entry] as const),
        ),
    };
}

// 解析回放 JSON 并转换为前端使用的回放数据
export function parseReplayJson(text: string): ReplayParseResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, message: "JSON 解析失败，请检查文件格式" };
    }

    try {
        const payload = parseReplayPayload(parsed);
        return {
            ok: true,
            data: normalizeReplayPayload(payload),
        };
    } catch (error) {
        return {
            ok: false,
            message: getErrorMessage(error),
        };
    }
}
