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
    patternOrder: string[];

    // 根据颜色名显示对应颜色值
    colors: Map<string, string>;
}

/** 新建项目时的默认数据 */
export const DEFAULT_PROJECT: ProjectData = {
    patterns: new Map([
        [
            "BlackAndWhite",
            {
                width: 2,
                pattern: ["Black", "White", "White", "Black"],
            },
        ],
    ]),
    patternOrder: ["BlackAndWhite"],
    colors: new Map([
        ["Black", "#000000"],
        ["White", "#ffffff"],
    ]),
};

export function cloneProject(project: ProjectData): ProjectData {
    return {
        patterns: new Map(project.patterns),
        patternOrder: [...project.patternOrder],
        colors: new Map(project.colors),
    };
}

// Context 类型：只暴露数据本身和原生的 setState
interface ProjectContextType {
    project: ProjectData;
    setProject: Dispatch<SetStateAction<ProjectData>>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
    const [project, setProject] = useState<ProjectData>(() =>
        cloneProject(DEFAULT_PROJECT),
    );

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
