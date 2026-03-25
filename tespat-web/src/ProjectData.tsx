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
}

// 项目结构定义
export interface ProjectData {
    patterns: Map<string, PatternRule>;
    patternOrder: string[];
    palette: Map<string, PaletteEntry>;
}

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
    };
}

// 新建项目时的默认数据
export const DEFAULT_PROJECT: ProjectData = {
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
    patternOrder: ["BlackAndWhite"],
    palette: new Map([
        [
            "Black",
            {
                color: "#000000",
                icon: null,
            },
        ],
        [
            "White",
            {
                color: "#ffffff",
                icon: null,
            },
        ],
    ]),
};

// 深复制整个项目对象
export function cloneProject(project: ProjectData): ProjectData {
    return {
        patterns: new Map(
            Array.from(project.patterns.entries()).map(([id, rule]) => [
                id,
                clonePatternRule(rule),
            ]),
        ),
        patternOrder: [...project.patternOrder],
        palette: new Map(
            Array.from(project.palette.entries()).map(([id, entry]) => [
                id,
                clonePaletteEntry(entry),
            ]),
        ),
    };
}

// 结合排序字段与实际集合，得到稳定且去重的 pattern 顺序
export function getOrderedPatternIds(
    patternOrder: string[],
    patterns: Map<string, PatternRule>,
) {
    const orderedIds: string[] = [];
    const seen = new Set<string>();

    for (const id of patternOrder) {
        if (!patterns.has(id) || seen.has(id)) continue;
        seen.add(id);
        orderedIds.push(id);
    }

    for (const id of patterns.keys()) {
        if (seen.has(id)) continue;
        seen.add(id);
        orderedIds.push(id);
    }

    return orderedIds;
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

// 统计某个 palette 在所有 pattern 中被引用的次数
export function countPaletteReferences(
    project: ProjectData,
    paletteId: string,
) {
    let count = 0;

    for (const rule of project.patterns.values()) {
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
