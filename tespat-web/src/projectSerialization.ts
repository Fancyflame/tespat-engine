import type {
    PaletteEntry,
    PatternRule,
    ProjectData,
} from "./ProjectData";
import { getOrderedPatternIds } from "./ProjectData";

// JSON 中的 pattern 结构
interface PatternRuleJson {
    width: number;
    capture: string[];
    replace: string[];
}

// JSON 中的 palette 条目结构
interface PaletteEntryJson {
    color: string;
    icon: string | null;
}

// 项目文件的 JSON 结构
interface ProjectDataJson {
    patterns?: Record<string, PatternRuleJson>;
    patternOrder?: string[];
    palette?: Record<string, PaletteEntryJson>;
}

// 判断值是否为普通对象
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 将单个网格数据补齐到指定长度
function padCells(cells: string[], targetLength: number) {
    if (cells.length === targetLength) {
        return cells;
    }

    return Array.from({ length: targetLength }, (_, index) => {
        return cells[index] ?? "Empty";
    });
}

// 将 capture/replace 归一化为统一尺寸的 pattern
function normalizeRuleShape(
    width: number,
    capture: string[],
    replace: string[],
): PatternRule {
    if (width <= 0) {
        return {
            width: 0,
            capture: [],
            replace: [],
        };
    }

    const rawLength = Math.max(capture.length, replace.length);
    if (rawLength === 0) {
        return {
            width,
            capture: [],
            replace: [],
        };
    }

    const targetLength = Math.ceil(rawLength / width) * width;
    return {
        width,
        capture: padCells(capture, targetLength),
        replace: padCells(replace, targetLength),
    };
}

// 校验并转换单条 pattern 配置
function parsePatternRuleJson(id: string, value: unknown): PatternRule {
    if (!isRecord(value)) {
        throw new Error(`patterns.${id} 必须是对象`);
    }

    const { width, capture, replace } = value;
    if (!Number.isInteger(width)) {
        throw new Error(`patterns.${id}.width 必须是整数`);
    }

    if (!Array.isArray(capture) || !capture.every((cell) => typeof cell === "string")) {
        throw new Error(`patterns.${id}.capture 必须是字符串数组`);
    }

    if (!Array.isArray(replace) || !replace.every((cell) => typeof cell === "string")) {
        throw new Error(`patterns.${id}.replace 必须是字符串数组`);
    }

    return normalizeRuleShape(width, capture, replace);
}

// 校验并转换单条 palette 配置
function parsePaletteEntryJson(id: string, value: unknown): PaletteEntry {
    if (!isRecord(value)) {
        throw new Error(`palette.${id} 必须是对象`);
    }

    const { color, icon } = value;
    if (typeof color !== "string") {
        throw new Error(`palette.${id}.color 必须是字符串`);
    }

    if (icon !== null && typeof icon !== "string") {
        throw new Error(`palette.${id}.icon 必须是字符串或 null`);
    }

    return {
        color,
        icon,
    };
}

// 将当前 ProjectData 序列化为可持久化保存的 JSON 字符串
export function projectToJson(project: ProjectData): string {
    const orderedPatternIds = getOrderedPatternIds(
        project.patternOrder,
        project.patterns,
    );
    const orderedPatterns = Object.fromEntries(
        orderedPatternIds
            .map((id) => {
                const rule = project.patterns.get(id);
                return rule ? ([id, rule] as const) : null;
            })
            .filter((entry): entry is readonly [string, PatternRule] => entry !== null),
    );

    const json: ProjectDataJson = {
        patterns: orderedPatterns,
        patternOrder: orderedPatternIds,
        palette: Object.fromEntries(project.palette),
    };

    return JSON.stringify(json, null, 2);
}

// 将项目 JSON 反序列化为前端内部使用的 ProjectData
export function jsonToProject(json: string): ProjectData {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error("JSON 解析失败，请检查项目文件格式");
    }

    if (!isRecord(parsed)) {
        throw new Error("项目文件必须是对象结构");
    }

    if (!isRecord(parsed.palette)) {
        throw new Error("项目文件缺少 palette 对象");
    }

    const patternsRecord = isRecord(parsed.patterns) ? parsed.patterns : {};
    const normalizedPatterns = Object.fromEntries(
        Object.entries(patternsRecord).map(([id, rule]) => [
            id,
            parsePatternRuleJson(id, rule),
        ]),
    );
    const patternOrder = getOrderedPatternIds(
        Array.isArray(parsed.patternOrder)
            ? parsed.patternOrder.filter((id): id is string => typeof id === "string")
            : [],
        new Map(
            Object.entries(normalizedPatterns).map(([id, rule]) => [id, rule] as const),
        ),
    );
    const palette = new Map(
        Object.entries(parsed.palette).map(([id, entry]) => [
            id,
            parsePaletteEntryJson(id, entry),
        ]),
    );

    return {
        patterns: new Map(
            patternOrder.map((id) => [id, normalizedPatterns[id]] as const),
        ),
        patternOrder,
        palette,
    };
}
