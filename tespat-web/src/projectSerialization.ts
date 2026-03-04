import type { ProjectData, PatternRule } from "./ProjectData";

/** JSON 可序列化的 ProjectData 格式 */
interface ProjectDataJson {
    patterns: Record<string, PatternRule>;
    colorDisplay: Record<string, string>;
}

export function projectToJson(project: ProjectData): string {
    const json: ProjectDataJson = {
        patterns: Object.fromEntries(project.patterns),
        colorDisplay: Object.fromEntries(project.colors),
    };
    return JSON.stringify(json, null, 2);
}

export function jsonToProject(json: string): ProjectData {
    const parsed = JSON.parse(json) as ProjectDataJson;
    return {
        patterns: new Map(Object.entries(parsed.patterns ?? {})),
        colors: new Map(Object.entries(parsed.colorDisplay ?? {})),
    };
}
