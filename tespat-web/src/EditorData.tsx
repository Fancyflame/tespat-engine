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
    /** 当前选中的单元格 id（用于绘制） */
    selectedCell: string | null;
    /** 主编辑器当前正在编辑的网格对象 */
    editingGrid: EditingGrid;
}

interface EditorContextType {
    editor: EditorData;
    setEditor: Dispatch<SetStateAction<EditorData>>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider = ({ children }: { children: ReactNode }) => {
    const [editor, setEditor] = useState<EditorData>({
        selectedCell: null,
        editingGrid: {
            width: 2,
            data: ["Apple", "Slime", "Empty", "SatiatedSlime"],
        },
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
