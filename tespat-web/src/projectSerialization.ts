import type { ProjectData, PatternRule } from "./ProjectData";

/** JSON 可序列化的 ProjectData 格式 */
interface PatternRuleJson {
    width: number;
    capture: string[];
    replace: string[];
}

interface ProjectDataJson {
    patterns?: Record<string, PatternRuleJson>;
    patternOrder?: string[];
    colors?: Record<string, string>;
}

/** 结合显式排序和实际规则集合，输出去重后的稳定规则顺序。 */
function normalizePatternOrder(
    patternOrder: string[] | undefined,
    patterns: Record<string, PatternRule>,
) {
    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const id of patternOrder ?? []) {
        if (!(id in patterns) || seen.has(id)) continue;
        seen.add(id);
        normalized.push(id);
    }

    for (const id of Object.keys(patterns)) {
        if (seen.has(id)) continue;
        seen.add(id);
        normalized.push(id);
    }

    return normalized;
}

/** 将单个网格数据补齐到指定长度，缺失位置统一填充为 "Empty"。 */
function padCells(cells: string[], targetLength: number) {
    if (cells.length === targetLength) return cells;
    return Array.from({ length: targetLength }, (_, index) => {
        return cells[index] ?? "Empty";
    });
}

/** 将 capture/replace 网格归一化为统一尺寸的 PatternRule。 */
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

/** 将 JSON 中的单条规则配置转换为前端内部使用的 PatternRule 结构。 */
function normalizeRuleJson(rule: PatternRuleJson): PatternRule {
    return normalizeRuleShape(rule.width, rule.capture, rule.replace);
}

/** 将当前 ProjectData 序列化为可持久化保存的 JSON 字符串。 */
export function projectToJson(project: ProjectData): string {
    const orderedPatternIds = normalizePatternOrder(
        project.patternOrder,
        Object.fromEntries(project.patterns),
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
        colors: Object.fromEntries(project.colors),
    };
    return JSON.stringify(json, null, 2);
}

/** 将项目 JSON 反序列化为前端内部使用的 ProjectData。 */
export function jsonToProject(json: string): ProjectData {
    const parsed = JSON.parse(json) as ProjectDataJson;
    const normalizedPatterns = Object.fromEntries(
        Object.entries(parsed.patterns ?? {}).map(([id, rule]) => [
            id,
            normalizeRuleJson(rule),
        ]),
    );
    const patternOrder = normalizePatternOrder(
        parsed.patternOrder,
        normalizedPatterns,
    );

    return {
        patterns: new Map(
            patternOrder.map((id) => [id, normalizedPatterns[id]] as const),
        ),
        patternOrder,
        colors: new Map(Object.entries(parsed.colors ?? {})),
    };
}
