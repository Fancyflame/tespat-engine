import type {
    NamespaceData,
    PaletteEntry,
    PatternRule,
    ProjectData,
} from "./ProjectData";
import {
    ROOT_NAMESPACE_ID,
    createNamespaceId,
    isNamespaceSegmentValid,
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

// JSON 中的递归 namespace 结构
interface NamespaceNodeJson {
    name?: string;
    patterns?: PatternRuleJson[];
    palette?: Record<string, PaletteEntryJson>;
    children?: unknown[];
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

// 构造 namespace 的错误定位标签
function getNamespacePathLabel(namespaceId: string) {
    return namespaceId === ROOT_NAMESPACE_ID ? "root" : `namespace ${namespaceId}`;
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

// 解析单个 namespace 节点内容
function parseNamespaceContent(path: string, value: unknown): NamespaceData {
    if (!isRecord(value)) {
        throw new Error(`${path} 必须是对象`);
    }

    if (!isRecord(value.palette)) {
        throw new Error(`${path}.palette 缺失或格式错误`);
    }

    if (!Array.isArray(value.patterns)) {
        if (isRecord(value.patterns)) {
            throw new Error(`${path}.patterns 必须是数组，当前对象格式已不支持`);
        }
        throw new Error(`${path}.patterns 缺失或格式错误`);
    }

    if (!Array.isArray(value.children)) {
        throw new Error(`${path}.children 缺失或格式错误`);
    }

    const patterns = new Map<string, PatternRule>();
    for (let index = 0; index < value.patterns.length; index += 1) {
        const [name, rule] = parseNamedPatternRuleJson(
            `${path}.patterns[${index}]`,
            value.patterns[index],
        );
        if (patterns.has(name)) {
            throw new Error(`${path}.patterns[${index}].name 重复: ${name}`);
        }
        patterns.set(name, rule);
    }

    const palette = new Map(
        Object.entries(value.palette).map(([paletteId, entry]) => [
            paletteId,
            parsePaletteEntryJson(`${path}.palette.${paletteId}`, entry),
        ]),
    );

    return {
        patterns,
        palette,
        children: [],
    };
}

// 递归解析命名空间树
function parseNamespaceNode(
    namespaceId: string,
    value: unknown,
    namespaces: Map<string, NamespaceData>,
    path: string,
    isRoot: boolean,
) {
    if (!isRecord(value)) {
        throw new Error(`${path} 必须是对象`);
    }

    if (!isRoot) {
        const rawName = value.name;
        if (typeof rawName !== "string" || rawName.trim() === "") {
            throw new Error(`${path}.name 必须是非空字符串`);
        }

        const trimmedName = rawName.trim();
        if (!isNamespaceSegmentValid(trimmedName)) {
            throw new Error(`${path}.name 非法: ${trimmedName}`);
        }
    }

    const namespace = parseNamespaceContent(path, value);
    if (namespaces.has(namespaceId)) {
        throw new Error(`${getNamespacePathLabel(namespaceId)} 重复定义`);
    }
    namespaces.set(namespaceId, namespace);

    const childNames = new Set<string>();
    const children = value.children as unknown[];
    for (let index = 0; index < children.length; index += 1) {
        const childValue = children[index];
        if (!isRecord(childValue)) {
            throw new Error(`${path}.children[${index}] 必须是对象`);
        }

        const rawName = childValue.name;
        if (typeof rawName !== "string" || rawName.trim() === "") {
            throw new Error(`${path}.children[${index}].name 必须是非空字符串`);
        }

        const trimmedName = rawName.trim();
        if (!isNamespaceSegmentValid(trimmedName)) {
            throw new Error(`${path}.children[${index}].name 非法: ${trimmedName}`);
        }

        if (childNames.has(trimmedName)) {
            throw new Error(`${path}.children[${index}].name 重复: ${trimmedName}`);
        }
        childNames.add(trimmedName);

        const childId = createNamespaceId(namespaceId, trimmedName);
        namespace.children.push(childId);
        parseNamespaceNode(
            childId,
            childValue,
            namespaces,
            `${path}.children[${index}]`,
            false,
        );
    }
}

// 序列化单个 namespace 节点
function namespaceToJson(
    project: ProjectData,
    namespaceId: string,
    isRoot: boolean,
): NamespaceNodeJson {
    const namespace = project.namespaces.get(namespaceId);
    if (!namespace) {
        throw new Error(`项目数据缺少命名空间: ${namespaceId}`);
    }

    const orderedPatterns = Array.from(namespace.patterns.entries()).map(
        ([name, rule]) => ({
            name,
            width: rule.width,
            capture: rule.capture,
            replace: rule.replace,
        }),
    );

    const children = namespace.children.map((childId) =>
        namespaceToJson(project, childId, false),
    );

    return {
        ...(isRoot
            ? {}
            : {
                  name:
                      namespaceId.slice(
                          namespaceId.lastIndexOf(".") + 1,
                      ) || namespaceId,
              }),
        patterns: orderedPatterns,
        palette: Object.fromEntries(namespace.palette),
        children,
    };
}

// 将当前 ProjectData 序列化为可持久化保存的 JSON 字符串
export function projectToJson(project: ProjectData): string {
    if (!project.namespaces.has(ROOT_NAMESPACE_ID)) {
        throw new Error('项目数据缺少根命名空间 "."');
    }

    const json = namespaceToJson(project, ROOT_NAMESPACE_ID, true);
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

    const namespaces = new Map<string, NamespaceData>();
    parseNamespaceNode(ROOT_NAMESPACE_ID, parsed, namespaces, "root", true);

    if (!namespaces.has(ROOT_NAMESPACE_ID)) {
        throw new Error('项目数据缺少根命名空间 "."');
    }

    return { namespaces };
}
