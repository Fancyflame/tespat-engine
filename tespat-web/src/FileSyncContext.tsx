import {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
} from "react";
import { useProject } from "./ProjectData";
import { DEFAULT_PROJECT } from "./ProjectData";
import { projectToJson, jsonToProject } from "./projectSerialization";

interface FileSyncContextType {
    /** 当前打开的文件句柄，用于写入 */
    fileHandle: FileSystemFileHandle | null;
    /** 当前打开的文件名（用于显示） */
    fileName: string | null;
    /** 是否支持 File System Access API */
    isSupported: boolean;
    /** 通过系统文件选择器打开文件 */
    openWithFilePicker: () => Promise<void>;
    /** 新建文件：选择保存位置，写入默认数据并打开 */
    createNewFile: () => Promise<void>;
    /** 关闭当前文件，停止同步 */
    closeFile: () => void;
    /** 将内容写入当前打开的文件 */
    syncToFile: (content: string) => Promise<void>;
}

const FileSyncContext = createContext<FileSyncContextType | undefined>(
    undefined,
);

export const FileSyncProvider = ({ children }: { children: ReactNode }) => {
    const { setProject } = useProject();
    const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(
        null,
    );
    const [fileName, setFileName] = useState<string | null>(null);

    const isSupported =
        typeof window !== "undefined" &&
        "showOpenFilePicker" in window &&
        "showSaveFilePicker" in window;

    const openWithFilePicker = useCallback(async () => {
        if (!isSupported) return;
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: "TESPAT 项目文件",
                        accept: {
                            "application/json": [".tsp", ".json"],
                        },
                    },
                ],
            });
            const file = await handle.getFile();
            const text = await file.text();
            const project = jsonToProject(text);
            setProject(project);
            const permission = await handle.requestPermission({
                mode: "readwrite",
            });
            if (permission === "granted") {
                setFileHandle(handle);
                setFileName(handle.name);
            }
        } catch (err) {
            if ((err as Error).name !== "AbortError") {
                console.error("打开文件失败:", err);
            }
        }
    }, [isSupported, setProject]);

    const createNewFile = useCallback(async () => {
        if (!isSupported) return;
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: "untitled.tsp",
                types: [
                    {
                        description: "TESPAT 项目文件",
                        accept: {
                            "application/json": [".tsp", ".json"],
                        },
                    },
                ],
            });
            const defaultProject: typeof DEFAULT_PROJECT = {
                ...DEFAULT_PROJECT,
                patterns: new Map(DEFAULT_PROJECT.patterns),
                colors: new Map(DEFAULT_PROJECT.colors),
            };
            const content = projectToJson(defaultProject);
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            setProject(defaultProject);
            setFileHandle(handle);
            setFileName(handle.name);
        } catch (err) {
            if ((err as Error).name !== "AbortError") {
                console.error("新建文件失败:", err);
            }
        }
    }, [isSupported, setProject]);

    const closeFile = useCallback(() => {
        setFileHandle(null);
        setFileName(null);
    }, []);

    const syncToFile = useCallback(
        async (content: string) => {
            if (!fileHandle) return;
            try {
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
            } catch (err) {
                console.error("同步到文件失败:", err);
            }
        },
        [fileHandle],
    );

    return (
        <FileSyncContext.Provider
            value={{
                fileHandle,
                fileName,
                isSupported,
                openWithFilePicker,
                createNewFile,
                closeFile,
                syncToFile,
            }}
        >
            {children}
        </FileSyncContext.Provider>
    );
};

export const useFileSync = () => {
    const context = useContext(FileSyncContext);
    if (!context)
        throw new Error("useFileSync must be used within FileSyncProvider");
    return context;
};
