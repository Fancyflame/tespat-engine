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
    name: string;
    width: number;
    height: number;
    pattern: string[];
}

export interface ProjectData {
    name: string;
    patterns: Map<string, PatternRule>;

    // 根据颜色名显示对应颜色值
    colorDisplay: Map<string, string>;
}

// Context 类型：只暴露数据本身和原生的 setState
interface ProjectContextType {
    project: ProjectData;
    setProject: Dispatch<SetStateAction<ProjectData>>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
    const [project, setProject] = useState<ProjectData>({
        name: "Markov Project",
        patterns: new Map([
            [
                "Eat Apple",
                {
                    name: "Eat Apple",
                    width: 2,
                    height: 1,
                    pattern: ["Slime", "Apple"],
                },
            ],
        ]),
        colorDisplay: new Map([
            ["Apple", "#ef4444"],
            ["Slime", "#22c55e"],
            ["Empty", "#1f2937"],
            ["SatiatedSlime", "#facc15"],
        ]),
    });

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
