import {
    createContext,
    useContext,
    useState,
    ReactNode,
    Dispatch,
    SetStateAction,
} from "react";

export interface EditingGrid {
    width: number;
    data: string[];
}

export interface EditorData {
    /** 当前选中的颜色名（用于绘制） */
    selectedColor: string | null;
    /** 当前选中的 pattern id（null 表示未选中） */
    selectedPatternId: string | null;
    /** 主编辑器当前正在编辑的网格对象 */
    editingGrid: EditingGrid;
    /** 是否允许编辑（拖拽、调整尺寸等会临时关闭） */
    enableEdit: boolean;
    /** 当前显示模式：编辑 or 回放 */
    displayMode: "playback" | "editor";
}

interface EditorContextType {
    editor: EditorData;
    setEditor: Dispatch<SetStateAction<EditorData>>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider = ({ children }: { children: ReactNode }) => {
    const [editor, setEditor] = useState<EditorData>({
        selectedColor: null,
        selectedPatternId: null,
        editingGrid: {
            width: 0,
            data: [],
        },
        enableEdit: false,
        displayMode: "editor",
    });

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
