import type {
    NamespaceData,
    PaletteEntry,
    PatternRule,
    ProjectData,
} from "./ProjectData";
import {
    ROOT_NAMESPACE_ID,
    getNamespaceParentId,
    getOrderedPatternIds,
    isNamespacePathValid,
} from "./ProjectData";

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
    public?: boolean;
}

// JSON 中的 namespace 结构
interface NamespaceDataJson {
    patterns?: Record<string, PatternRuleJson>;
    patternOrder?: string[];
    palette?: Record<string, PaletteEntryJson>;
}

// 项目文件的 JSON 结构
interface ProjectDataJson {
    namespaces?: Record<string, NamespaceDataJson>;
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

// 生成 namespace 的路径标签，便于错误定位
function getNamespacePathLabel(namespaceId: string) {
    return namespaceId === ROOT_NAMESPACE_ID
        ? 'namespaces[""]'
        : `namespaces.${namespaceId}`;
}

// 校验并转换单条 pattern 配置
function parsePatternRuleJson(path: string, value: unknown): PatternRule {
    if (!isRecord(value)) {
        throw new Error(`${path} 必须是对象`);
    }

    const { width, capture, replace } = value;
    if (!Number.isInteger(width)) {
        throw new Error(`${path}.width 必须是整数`);
    }

    if (!Array.isArray(capture) || !capture.every((cell) => typeof cell === "string")) {
        throw new Error(`${path}.capture 必须是字符串数组`);
    }

    if (!Array.isArray(replace) || !replace.every((cell) => typeof cell === "string")) {
        throw new Error(`${path}.replace 必须是字符串数组`);
    }

    return normalizeRuleShape(width as number, capture, replace);
}

// 校验并转换单条 palette 配置
function parsePaletteEntryJson(path: string, value: unknown): PaletteEntry {
    if (!isRecord(value)) {
        throw new Error(`${path} 必须是对象`);
    }

    const { color, icon, public: isPublic } = value;
    if (typeof color !== "string") {
        throw new Error(`${path}.color 必须是字符串`);
    }

    if (icon !== null && typeof icon !== "string") {
        throw new Error(`${path}.icon 必须是字符串或 null`);
    }

    const normalizedPublic = isPublic === undefined ? false : isPublic;
    if (typeof normalizedPublic !== "boolean") {
        throw new Error(`${path}.public 必须是布尔值`);
    }

    return {
        color,
        icon,
        public: normalizedPublic,
    };
}

// 解析单个 namespace 的数据结构
function parseNamespaceDataJson(
    namespaceId: string,
    value: unknown,
): NamespaceData {
    if (!isRecord(value)) {
        throw new Error(`${getNamespacePathLabel(namespaceId)} 必须是对象`);
    }

    if (!isRecord(value.palette)) {
        throw new Error(`${getNamespacePathLabel(namespaceId)}.palette 缺失或格式错误`);
    }

    const patternsRecord = isRecord(value.patterns) ? value.patterns : {};
    const normalizedPatterns = Object.fromEntries(
        Object.entries(patternsRecord).map(([patternId, rule]) => [
            patternId,
            parsePatternRuleJson(
                `${getNamespacePathLabel(namespaceId)}.patterns.${patternId}`,
                rule,
            ),
        ]),
    );
    const patternMap = new Map(
        Object.entries(normalizedPatterns).map(([id, rule]) => [id, rule] as const),
    );
    const patternOrder = getOrderedPatternIds(
        Array.isArray(value.patternOrder)
            ? value.patternOrder.filter(
                  (patternId): patternId is string =>
                      typeof patternId === "string",
              )
            : [],
        patternMap,
    );
    const palette = new Map(
        Object.entries(value.palette).map(([paletteId, entry]) => [
            paletteId,
            parsePaletteEntryJson(
                `${getNamespacePathLabel(namespaceId)}.palette.${paletteId}`,
                entry,
            ),
        ]),
    );

    return {
        patterns: new Map(patternOrder.map((id) => [id, normalizedPatterns[id]] as const)),
        patternOrder,
        palette,
    };
}

// 读取新格式 namespaces 结构
function parseProjectWithNamespaces(
    namespacesRecord: Record<string, unknown>,
): ProjectData {
    const namespaces = new Map<string, NamespaceData>();

    for (const [namespaceId, namespaceData] of Object.entries(namespacesRecord)) {
        if (!isNamespacePathValid(namespaceId)) {
            throw new Error(`非法 namespace 路径: ${namespaceId}`);
        }

        namespaces.set(namespaceId, parseNamespaceDataJson(namespaceId, namespaceData));
    }

    if (!namespaces.has(ROOT_NAMESPACE_ID)) {
        throw new Error('namespaces 必须包含根命名空间 ""');
    }

    for (const namespaceId of namespaces.keys()) {
        if (namespaceId === ROOT_NAMESPACE_ID) {
            continue;
        }

        const parentId = getNamespaceParentId(namespaceId);
        if (parentId === null || !namespaces.has(parentId)) {
            throw new Error(`namespace ${namespaceId} 缺少父级 ${parentId ?? ""}`);
        }
    }

    return { namespaces };
}

// 读取旧格式并迁移到根 namespace
function parseLegacyProject(parsed: Record<string, unknown>): ProjectData {
    if (!isRecord(parsed.palette)) {
        throw new Error("项目文件缺少 palette 对象");
    }

    const rootNamespace = parseNamespaceDataJson(ROOT_NAMESPACE_ID, {
        patterns: parsed.patterns,
        patternOrder: parsed.patternOrder,
        palette: parsed.palette,
    });

    return {
        namespaces: new Map([[ROOT_NAMESPACE_ID, rootNamespace]]),
    };
}

// 将当前 ProjectData 序列化为可持久化保存的 JSON 字符串
export function projectToJson(project: ProjectData): string {
    if (!project.namespaces.has(ROOT_NAMESPACE_ID)) {
        throw new Error('项目数据缺少根命名空间 ""');
    }

    const namespaceEntries = Array.from(project.namespaces.keys())
        .sort((left, right) => {
            if (left === ROOT_NAMESPACE_ID) return -1;
            if (right === ROOT_NAMESPACE_ID) return 1;
            return left.localeCompare(right, undefined, {
                sensitivity: "accent",
            });
        })
        .map((namespaceId) => {
            const namespace = project.namespaces.get(namespaceId);
            if (!namespace) {
                return null;
            }

            const orderedPatternIds = getOrderedPatternIds(
                namespace.patternOrder,
                namespace.patterns,
            );
            const orderedPatterns = Object.fromEntries(
                orderedPatternIds
                    .map((id) => {
                        const rule = namespace.patterns.get(id);
                        return rule ? ([id, rule] as const) : null;
                    })
                    .filter(
                        (
                            entry,
                        ): entry is readonly [string, PatternRule] => entry !== null,
                    ),
            );

            return [
                namespaceId,
                {
                    patterns: orderedPatterns,
                    patternOrder: orderedPatternIds,
                    palette: Object.fromEntries(namespace.palette),
                } satisfies NamespaceDataJson,
            ] as const;
        })
        .filter(
            (
                entry,
            ): entry is readonly [string, NamespaceDataJson] => entry !== null,
        );

    const json: ProjectDataJson = {
        namespaces: Object.fromEntries(namespaceEntries),
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

    if (isRecord(parsed.namespaces)) {
        return parseProjectWithNamespaces(parsed.namespaces);
    }

    return parseLegacyProject(parsed);
}
