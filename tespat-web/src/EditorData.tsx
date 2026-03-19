import {
    createContext,
    useContext,
    useState,
    type ReactNode,
    Dispatch,
    SetStateAction,
} from "react";
import type { PatternRule } from "./ProjectData";

export type DisplayMode =
    | {
          mode: "welcome" | "playback";
      }
    | {
          mode: "editor";
          /** 当前选中的规则 id */
          selectedPatternId: string;
      };

/** 从 displayMode 中获取当前选中的规则 id（仅 editor 模式时有值） */
export function getSelectedPatternId(displayMode: DisplayMode): string | null {
    return displayMode.mode === "editor" ? displayMode.selectedPatternId : null;
}

export interface EditorData {
    /** 当前选中的颜色名（用于绘制） */
    selectedColor: string | null;
    /** 主编辑器当前正在编辑的网格对象 */
    editingRule: PatternRule;
    /** 是否允许编辑（拖拽、调整尺寸等会临时关闭） */
    enableEdit: boolean;
    /** 当前显示模式：编辑 or 回放 */
    displayMode: DisplayMode;
}

interface EditorContextType {
    editor: EditorData;
    setEditor: Dispatch<SetStateAction<EditorData>>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

/** 创建编辑器初始状态，便于在切换工程时完整重置。 */
export function createInitialEditorData(): EditorData {
    return {
        selectedColor: null,
        editingRule: {
            width: 0,
            capture: [],
            replace: [],
        },
        enableEdit: false,
        displayMode: { mode: "welcome" },
    };
}

export const EditorProvider = ({ children }: { children: ReactNode }) => {
    const [editor, setEditor] = useState<EditorData>(createInitialEditorData);

    return (
        <EditorContext.Provider value={{ editor, setEditor }}>
            {children}
        </EditorContext.Provider>
    );
};

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (!context)
        throw new Error("useEditor must be used within EditorProvider");
    return context;
};
