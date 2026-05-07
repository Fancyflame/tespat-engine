// 数据结构定义
export interface PatternRule {
    width: number;
    capture: string[];
    replace: string[];
}

// 调色板条目定义
export interface PaletteEntry {
    color: string;
    icon: string | null;
    public: boolean;
}

// 单个命名空间的数据结构
export interface NamespaceData {
    patterns: Map<string, PatternRule>;
    palette: Map<string, PaletteEntry>;
}

// 项目结构定义（按命名空间划分）
export interface ProjectData {
    namespaces: Map<string, NamespaceData>;
}

// 根命名空间常量
export const ROOT_NAMESPACE_ID = ".";

// 命名空间段名匹配规则
const NAMESPACE_SEGMENT_PATTERN = /^[A-Za-z0-9_]+$/;

// 新建 pattern 时的空规则
export function createEmptyPatternRule(): PatternRule {
    return {
        width: 0,
        capture: [],
        replace: [],
    };
}

// 复制单条 pattern 规则
export function clonePatternRule(rule: PatternRule): PatternRule {
    return {
        width: rule.width,
        capture: [...rule.capture],
        replace: [...rule.replace],
    };
}

// 复制单条调色板条目
export function clonePaletteEntry(entry: PaletteEntry): PaletteEntry {
    return {
        color: entry.color,
        icon: entry.icon,
        public: entry.public,
    };
}

// 创建空命名空间数据
export function createEmptyNamespaceData(): NamespaceData {
    return {
        patterns: new Map(),
        palette: new Map(),
    };
}

// 创建默认根命名空间数据
export function createDefaultRootNamespaceData(): NamespaceData {
    return {
        patterns: new Map([
            [
                "BlackAndWhite",
                {
                    width: 2,
                    capture: ["Black", "White", "White", "Black"],
                    replace: ["White", "Black", "Black", "White"],
                },
            ],
        ]),
        palette: new Map([
            [
                "Black",
                {
                    color: "#000000",
                    icon: null,
                    public: false,
                },
            ],
            [
                "White",
                {
                    color: "#ffffff",
                    icon: null,
                    public: false,
                },
            ],
        ]),
    };
}

// 复制命名空间对象
export function cloneNamespaceData(namespace: NamespaceData): NamespaceData {
    return {
        patterns: new Map(
            Array.from(namespace.patterns.entries()).map(([id, rule]) => [
                id,
                clonePatternRule(rule),
            ]),
        ),
        palette: new Map(
            Array.from(namespace.palette.entries()).map(([id, entry]) => [
                id,
                clonePaletteEntry(entry),
            ]),
        ),
    };
}

// 新建项目时的默认数据
export const DEFAULT_PROJECT: ProjectData = {
    namespaces: new Map([
        [ROOT_NAMESPACE_ID, createDefaultRootNamespaceData()],
    ]),
};

// 深复制整个项目对象
export function cloneProject(project: ProjectData): ProjectData {
    return {
        namespaces: new Map(
            Array.from(project.namespaces.entries()).map(
                ([namespaceId, namespace]) => [
                    namespaceId,
                    cloneNamespaceData(namespace),
                ],
            ),
        ),
    };
}

// 将某个 palette 名称在单元格数组中整体替换
export function replacePaletteNameInCells(
    cells: string[],
    oldName: string,
    newName: string,
) {
    let changed = false;
    const nextCells = cells.map((cell) => {
        if (cell !== oldName) return cell;
        changed = true;
        return newName;
    });

    return changed ? nextCells : cells;
}

// 统计某个 palette 在命名空间中的引用次数
export function countPaletteReferences(
    namespace: NamespaceData,
    paletteId: string,
) {
    let count = 0;

    for (const rule of namespace.patterns.values()) {
        for (const cell of rule.capture) {
            if (cell === paletteId) {
                count += 1;
            }
        }

        for (const cell of rule.replace) {
            if (cell === paletteId) {
                count += 1;
            }
        }
    }

    return count;
}

// 校验命名空间路径是否合法
export function isNamespacePathValid(namespaceId: string) {
    if (namespaceId === ROOT_NAMESPACE_ID) {
        return true;
    }

    const segments = namespaceId.split(".");
    return (
        segments.length > 0 &&
        segments.every((segment) => NAMESPACE_SEGMENT_PATTERN.test(segment))
    );
}

// 校验命名空间段名是否合法
export function isNamespaceSegmentValid(segment: string) {
    return NAMESPACE_SEGMENT_PATTERN.test(segment);
}

// 获取命名空间路径的父级路径
export function getNamespaceParentId(namespaceId: string): string | null {
    if (namespaceId === ROOT_NAMESPACE_ID) {
        return null;
    }

    const lastDotIndex = namespaceId.lastIndexOf(".");
    if (lastDotIndex < 0) {
        return ROOT_NAMESPACE_ID;
    }

    return namespaceId.slice(0, lastDotIndex);
}

// 拼接子命名空间完整路径
export function createNamespaceId(parentId: string, segment: string) {
    return parentId === ROOT_NAMESPACE_ID ? segment : `${parentId}.${segment}`;
}

// 判断 candidate 是否为 parent 的后代（不含自身）
export function isNamespaceDescendant(candidate: string, parent: string) {
    if (parent === ROOT_NAMESPACE_ID) {
        return candidate !== ROOT_NAMESPACE_ID;
    }

    return candidate.startsWith(`${parent}.`);
}

// 获取命名空间后代列表（可选含自身）
export function getNamespaceDescendantIds(
    namespaces: Map<string, NamespaceData>,
    parentId: string,
    includeSelf = false,
) {
    const descendants: string[] = [];

    for (const namespaceId of namespaces.keys()) {
        if (namespaceId === parentId) {
            if (includeSelf) {
                descendants.push(namespaceId);
            }
            continue;
        }

        if (isNamespaceDescendant(namespaceId, parentId)) {
            descendants.push(namespaceId);
        }
    }

    return descendants;
}

// 获取命名空间层级深度
export function getNamespaceDepth(namespaceId: string) {
    if (namespaceId === ROOT_NAMESPACE_ID) {
        return 0;
    }

    return namespaceId.split(".").length;
}

// 获取按树级排序后的命名空间 ID 列表
export function getSortedNamespaceIds(namespaces: Map<string, NamespaceData>) {
    return Array.from(namespaces.keys()).sort((left, right) => {
        if (left === ROOT_NAMESPACE_ID) return -1;
        if (right === ROOT_NAMESPACE_ID) return 1;

        const leftDepth = getNamespaceDepth(left);
        const rightDepth = getNamespaceDepth(right);
        if (leftDepth !== rightDepth) {
            return leftDepth - rightDepth;
        }

        return left.localeCompare(right, undefined, {
            sensitivity: "accent",
        });
    });
}

// 获取命名空间最后一段
export function getNamespaceLastSegment(namespaceId: string) {
    if (namespaceId === ROOT_NAMESPACE_ID) {
        return ROOT_NAMESPACE_ID;
    }

    const parentId = getNamespaceParentId(namespaceId);
    if (parentId === null || parentId === ROOT_NAMESPACE_ID) {
        return namespaceId;
    }

    return namespaceId.slice(parentId.length + 1);
}
