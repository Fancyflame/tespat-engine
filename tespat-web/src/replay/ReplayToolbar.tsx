import { Button, Group, Text } from "@mantine/core";
import { IconFileImport, IconRefresh } from "@tabler/icons-react";
import type { ChangeEvent, RefObject } from "react";

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
        <Group gap="xs" py="sm">
            <Button
                leftSection={<IconFileImport size={16} />}
                onClick={() => void onOpenReplayFile()}
            >
                {isFilePickerSupported ? "打开回放 JSON" : "上传回放 JSON"}
            </Button>
            <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => void onRefreshFile()}
                disabled={!canRefresh}
                loading={isRefreshingFile}
            >
                刷新
            </Button>
            <Text size="xs" c="dimmed">
                {fileStatusText}
            </Text>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(event) => void onUploadReplayFile(event)}
            />
        </Group>
    );
}
