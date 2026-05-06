import { IconFileImport, IconRefresh } from "@tabler/icons-react";
import type { ChangeEvent, RefObject } from "react";
import { Button } from "@/components/ui/button";

// 回放工具栏的显式输入
interface ReplayToolbarProps {
    canRefresh: boolean;
    fileInputRef: RefObject<HTMLInputElement | null>;
    fileStatusText: string;
    isFilePickerSupported: boolean;
    isRefreshingFile: boolean;
    onOpenReplayFile: () => Promise<void>;
    onRefreshFile: () => Promise<void>;
    onUploadReplayFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

// 回放工具栏负责文件打开、刷新与状态展示
export function ReplayToolbar({
    canRefresh,
    fileInputRef,
    fileStatusText,
    isFilePickerSupported,
    isRefreshingFile,
    onOpenReplayFile,
    onRefreshFile,
    onUploadReplayFile,
}: ReplayToolbarProps) {
    return (
        <div className="z-10 flex shrink-0 items-center gap-2 px-6 py-4">
            <Button
                variant="default"
                onClick={() => void onOpenReplayFile()}
            >
                <IconFileImport size={16} />
                {isFilePickerSupported ? "打开回放 JSON" : "上传回放 JSON"}
            </Button>
            <Button
                variant="subtle"
                onClick={() => void onRefreshFile()}
                disabled={!canRefresh}
                loading={isRefreshingFile}
            >
                <IconRefresh
                    size={16}
                    className={isRefreshingFile ? "animate-spin" : undefined}
                />
                刷新
            </Button>
            <p className="text-xs text-slate-400">
                {fileStatusText}
            </p>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(event) => void onUploadReplayFile(event)}
            />
        </div>
    );
}
