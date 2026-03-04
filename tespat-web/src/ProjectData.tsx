import {
    createContext,
    useContext,
    useState,
    ReactNode,
    Dispatch,
    SetStateAction,
} from "react";

// 数据结构定义
export interface PatternRule {
    width: number;
    pattern: string[];
}

export interface ProjectData {
    patterns: Map<string, PatternRule>;

    // 根据颜色名显示对应颜色值
    colorDisplay: Map<string, string>;
}

/** 新建项目时的默认数据 */
export const DEFAULT_PROJECT: ProjectData = {
    patterns: new Map([
        [
            "Eat Apple",
            {
                width: 2,
                pattern: [
                    "Slime",
                    "Apple",
                    "Apple",
                    "Empty",
                    "SatiatedSlime",
                    "Empty",
                ],
            },
        ],
    ]),
    colorDisplay: new Map([
        ["Apple", "#ef4444"],
        ["Slime", "#22c55e"],
        ["Empty", "#1f2937"],
        ["SatiatedSlime", "#facc15"],
    ]),
};

// Context 类型：只暴露数据本身和原生的 setState
interface ProjectContextType {
    project: ProjectData;
    setProject: Dispatch<SetStateAction<ProjectData>>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
    const [project, setProject] = useState<ProjectData>(DEFAULT_PROJECT);

    return (
        <ProjectContext.Provider value={{ project, setProject }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context)
        throw new Error("useProject must be used within ProjectProvider");
    return context;
};
