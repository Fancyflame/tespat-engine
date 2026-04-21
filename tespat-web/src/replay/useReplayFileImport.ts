import { notifications } from "@mantine/notifications";
import {
    useCallback,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type RefObject,
} from "react";
import { parseReplayJson, type ReplayData } from "./parseReplayJson";
import { useWorkspace, useWorkspaceActions } from "../Workspace";

// 回放文件导入时的附加元信息
type ReplayFileImportOptions = {
    fileHandle?: FileSystemFileHandle | null;
    fileName?: string | null;
};

// 回放文件导入 hook 对外暴露的状态与动作
export interface ReplayFileImportState {
    replayData: ReplayData | null;
    canRefresh: boolean;
    fileInputRef: RefObject<HTMLInputElement | null>;
    fileStatusText: string;
    importDroppedFile: (file: File) => Promise<void>;
    isFilePickerSupported: boolean;
    isRefreshingFile: boolean;
    openReplayFile: () => Promise<void>;
    refreshReplayFile: () => Promise<void>;
    uploadReplayFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

// 管理回放文件导入、刷新与状态文案
export function useReplayFileImport(): ReplayFileImportState {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const isFilePickerSupported =
        typeof window !== "undefined" && "showOpenFilePicker" in window;
    const workspace = useWorkspace();
    const actions = useWorkspaceActions();

    const [isRefreshingFile, setIsRefreshingFile] = useState(false);

    const fileStatusText = useMemo(() => {
        if (workspace.replayFileHandle) {
            return `当前已打开：${workspace.replayFileName}`;
        }

        if (workspace.replayFileName) {
            return `当前文件：${workspace.replayFileName}（刷新不可用）`;
        }

        return "支持拖拽到画布";
    }, [workspace.replayFileHandle, workspace.replayFileName]);

    // 将文本内容解析为回放数据并写入状态
    const applyReplayText = useCallback(
        (text: string, options?: ReplayFileImportOptions) => {
            const result = parseReplayJson(text);
            if (!result.ok) {
                notifications.show({
                    title: "导入失败",
                    message: result.message,
                    color: "red",
                });
                return false;
            }

            actions.setReplayImportResult({
                replayData: result.data,
                fileHandle: options?.fileHandle ?? null,
                fileName: options?.fileName ?? null,
            });
            return true;
        },
        [actions],
    );

    // 从 File 对象导入回放
    const importReplayFile = useCallback(
        async (file: File, options?: ReplayFileImportOptions) => {
            try {
                const text = await file.text();
                const isImported = applyReplayText(text, {
                    fileHandle: options?.fileHandle ?? null,
                    fileName: options?.fileName ?? file.name,
                });
                if (!isImported) {
                    return false;
                }

                return true;
            } catch {
                notifications.show({
                    title: "导入失败",
                    message: "读取文件失败，请重试",
                    color: "red",
                });
                return false;
            }
        },
        [applyReplayText],
    );

    // 打开本地回放文件
    const openReplayFile = useCallback(async () => {
        if (!isFilePickerSupported) {
            fileInputRef.current?.click();
            return;
        }

        try {
            const [handle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: "回放 JSON",
                        accept: {
                            "application/json": [".json"],
                        },
                    },
                ],
            });
            const file = await handle.getFile();
            await importReplayFile(file, {
                fileHandle: handle,
                fileName: handle.name,
            });
        } catch (error) {
            if ((error as Error).name !== "AbortError") {
                notifications.show({
                    title: "打开失败",
                    message: "打开本地文件失败，请重试",
                    color: "red",
                });
            }
        }
    }, [importReplayFile, isFilePickerSupported]);

    // 刷新当前已打开的回放文件
    const refreshReplayFile = useCallback(async () => {
        if (!workspace.replayFileHandle) {
            return;
        }

        setIsRefreshingFile(true);
        try {
            const file = await workspace.replayFileHandle.getFile();
            await importReplayFile(file, {
                fileHandle: workspace.replayFileHandle,
                fileName: workspace.replayFileHandle.name,
            });
        } catch {
            notifications.show({
                title: "刷新失败",
                message: "重新读取本地文件失败，请重新打开文件",
                color: "red",
            });
        } finally {
            setIsRefreshingFile(false);
        }
    }, [importReplayFile, workspace.replayFileHandle]);

    // 处理隐藏文件输入框的上传结果
    const uploadReplayFile = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.currentTarget.files?.[0];
            if (!file) {
                return;
            }

            await importReplayFile(file, {
                fileHandle: null,
                fileName: file.name,
            });
            event.currentTarget.value = "";
        },
        [importReplayFile],
    );

    // 处理拖拽导入的文件
    const importDroppedFile = useCallback(
        async (file: File) => {
            await importReplayFile(file, {
                fileHandle: null,
                fileName: file.name,
            });
        },
        [importReplayFile],
    );

    return {
        replayData: workspace.replayData,
        canRefresh: workspace.replayFileHandle !== null,
        fileInputRef,
        fileStatusText,
        importDroppedFile,
        isFilePickerSupported,
        isRefreshingFile,
        openReplayFile,
        refreshReplayFile,
        uploadReplayFile,
    };
}
