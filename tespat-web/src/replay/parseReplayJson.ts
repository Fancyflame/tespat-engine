export type ReplayData = {
    width: number;
    frames: string[][];
};

export type ReplayParseResult =
    | { ok: true; data: ReplayData }
    | { ok: false; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseReplayJson(text: string): ReplayParseResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, message: "JSON 解析失败，请检查文件格式" };
    }

    if (!isObject(parsed)) {
        return { ok: false, message: "回放数据必须是对象结构" };
    }

    const width = parsed.width;
    const frames = parsed.frames;

    if (!Number.isInteger(width) || (width as number) < 0) {
        return { ok: false, message: "width 必须是大于等于 0 的整数" };
    }

    if (!Array.isArray(frames)) {
        return { ok: false, message: "frames 必须是数组" };
    }

    let expectedFrameLength: number | null = null;
    const normalizedFrames: string[][] = [];

    for (let i = 0; i < frames.length; i += 1) {
        const frame = frames[i];
        if (!Array.isArray(frame)) {
            return { ok: false, message: `frames[${i}] 必须是字符串数组` };
        }

        const normalizedFrame: string[] = [];

        for (let j = 0; j < frame.length; j += 1) {
            if (typeof frame[j] !== "string") {
                return {
                    ok: false,
                    message: `frames[${i}][${j}] 必须是字符串`,
                };
            }

            normalizedFrame.push(frame[j]);
        }

        if (expectedFrameLength == null) {
            expectedFrameLength = normalizedFrame.length;
        } else if (expectedFrameLength !== normalizedFrame.length) {
            return { ok: false, message: "所有帧的长度必须一致" };
        }

        normalizedFrames.push(normalizedFrame);
    }

    const frameLength = expectedFrameLength ?? 0;
    const numericWidth = width as number;

    if (numericWidth === 0 && frameLength !== 0) {
        return { ok: false, message: "width 为 0 时，所有帧必须是空数组" };
    }

    if (numericWidth > 0 && frameLength % numericWidth !== 0) {
        return {
            ok: false,
            message: "帧长度必须是 width 的整数倍",
        };
    }

    return {
        ok: true,
        data: {
            width: numericWidth,
            frames: normalizedFrames,
        },
    };
}
