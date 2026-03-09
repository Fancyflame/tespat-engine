import type { ProjectData, PatternRule } from "./ProjectData";

/** JSON 可序列化的 ProjectData 格式 */
interface ProjectDataJson {
    patterns?: Record<string, PatternRule>;
    patternOrder?: string[];
    colors?: Record<string, string>;
}

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

export function jsonToProject(json: string): ProjectData {
    const parsed = JSON.parse(json) as ProjectDataJson;
    const patterns = parsed.patterns ?? {};
    const patternOrder = normalizePatternOrder(parsed.patternOrder, patterns);

    return {
        patterns: new Map(
            patternOrder.map((id) => [id, patterns[id]] as const),
        ),
        patternOrder,
        colors: new Map(Object.entries(parsed.colors ?? {})),
    };
}
