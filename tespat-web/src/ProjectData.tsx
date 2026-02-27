import React, {
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

    // 根据单元格id显示对应颜色
    cellDisplay: Map<string, string>;

    // 当前选中的单元格id，用于绘制
    selectedCell: string | null;
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
            ["Eat Apple", {
                name: "Eat Apple",
                width: 2,
                height: 1,
                pattern: [
                    "Slime", "Apple",
                ]
            }],
        ]),
        cellDisplay: new Map([
            ["Apple", "#ef4444"],
            ["Slime", "#22c55e"],
            ["Empty", "#1f2937"],
            ["SatiatedSlime", "#facc15"],
        ]),
        selectedCell: null,
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
