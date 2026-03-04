/** File System Access API 类型声明（非所有浏览器支持） */
interface FileSystemFileHandle {
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
    requestPermission(descriptor?: {
        mode?: "read" | "readwrite";
    }): Promise<PermissionState>;
    readonly name: string;
}

interface OpenFilePickerOptions {
    types?: Array<{
        description?: string;
        accept?: Record<string, string[]>;
    }>;
    multiple?: boolean;
}

interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: Array<{
        description?: string;
        accept?: Record<string, string[]>;
    }>;
}

interface Window {
    showOpenFilePicker(
        options?: OpenFilePickerOptions,
    ): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(
        options?: SaveFilePickerOptions,
    ): Promise<FileSystemFileHandle>;
}
