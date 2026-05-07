import type {
    NamespaceData,
    PaletteEntry,
    PatternRule,
    ProjectData,
} from "./ProjectData";
import {
    ROOT_NAMESPACE_ID,
    getNamespaceParentId,
    isNamespacePathValid,
} from "./ProjectData";

// JSON 中的 pattern 结构
interface PatternRuleJson {
    name: string;
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
    patterns?: PatternRuleJson[];
    palette?: Record<string, PaletteEntryJson>;
}

// 项目文件的 JSON 结构
interface ProjectDataJson {
    namespaces?: Record<string, NamespaceDataJson>;
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
        ? 'namespaces["."]'
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

// 校验并转换单条具名 pattern 配置
function parseNamedPatternRuleJson(
    path: string,
    value: unknown,
): readonly [string, PatternRule] {
    if (!isRecord(value)) {
        throw new Error(`${path} 必须是对象`);
    }

    const { name } = value;
    if (typeof name !== "string" || name.trim() === "") {
        throw new Error(`${path}.name 必须是非空字符串`);
    }

    return [name, parsePatternRuleJson(path, value)] as const;
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

    if ("patternOrder" in value) {
        throw new Error(
            `${getNamespacePathLabel(namespaceId)}.patternOrder 已废弃，请使用 patterns 数组顺序`,
        );
    }

    if (!Array.isArray(value.patterns)) {
        if (isRecord(value.patterns)) {
            throw new Error(
                `${getNamespacePathLabel(namespaceId)}.patterns 必须是数组，当前对象格式已不支持`,
            );
        }
        throw new Error(`${getNamespacePathLabel(namespaceId)}.patterns 缺失或格式错误`);
    }

    const patterns = new Map<string, PatternRule>();
    for (let index = 0; index < value.patterns.length; index += 1) {
        const [name, rule] = parseNamedPatternRuleJson(
            `${getNamespacePathLabel(namespaceId)}.patterns[${index}]`,
            value.patterns[index],
        );
        if (patterns.has(name)) {
            throw new Error(
                `${getNamespacePathLabel(namespaceId)}.patterns[${index}].name 重复: ${name}`,
            );
        }
        patterns.set(name, rule);
    }

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
        patterns,
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
        throw new Error('namespaces 必须包含根命名空间 "."');
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

// 将当前 ProjectData 序列化为可持久化保存的 JSON 字符串
export function projectToJson(project: ProjectData): string {
    if (!project.namespaces.has(ROOT_NAMESPACE_ID)) {
        throw new Error('项目数据缺少根命名空间 "."');
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

            const orderedPatterns = Array.from(namespace.patterns.entries()).map(
                ([name, rule]) => ({
                    name,
                    width: rule.width,
                    capture: rule.capture,
                    replace: rule.replace,
                }),
            );

            return [
                namespaceId,
                {
                    patterns: orderedPatterns,
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

    if (!isRecord(parsed.namespaces)) {
        if ("patternOrder" in parsed || "patterns" in parsed || "palette" in parsed) {
            throw new Error(
                '旧项目格式已不支持。请使用包含 namespaces 且根命名空间为 "." 的新格式',
            );
        }
        throw new Error('项目文件缺少 namespaces 对象（且必须包含根命名空间 "."）');
    }

    return parseProjectWithNamespaces(parsed.namespaces);
}
