import {
    IconDeviceFloppy,
    IconFileImport,
    IconFilePlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { ROOT_NAMESPACE_ID } from "./ProjectData";
import { EditorStage } from "./stages/EditorStage";
import { PlaybackStage } from "./stages/PlaybackStage";
import { WelcomeStage } from "./stages/WelcomeStage";
import { useWorkspace, useWorkspaceActions } from "./Workspace";

// 去除文件名后缀，作为工程展示名
function getProjectDisplayName(fileName: string | null) {
    if (!fileName) {
        return "Untitled";
    }

    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex <= 0) {
        return fileName;
    }

    return fileName.slice(0, lastDotIndex);
}

// 应用壳层负责切换主舞台与顶部工具栏动作
export default function App() {
    const workspace = useWorkspace();
    const actions = useWorkspaceActions();
    const projectDisplayName = getProjectDisplayName(workspace.fileName);
    const namespaceSuffix =
        workspace.selectedNamespaceId === ROOT_NAMESPACE_ID
            ? ""
            : ` - ${workspace.selectedNamespaceId}`;

    return (
        <div className="flex h-screen w-screen min-w-0 flex-col overflow-hidden bg-app-bg text-slate-100">
            <header className="h-10 shrink-0 border-b border-app-border bg-slate-950/95 backdrop-blur-sm">
                <div className="flex h-full items-center justify-between gap-4 px-6">
                    <div className="flex min-w-0 items-center gap-6">
                        <button
                            type="button"
                            className="cursor-pointer select-none bg-transparent p-0 text-left text-lg font-black tracking-[-0.08em] text-slate-100 transition-colors hover:text-blue-200"
                            onClick={actions.goToWelcome}
                        >
                            TESPAT EDITOR
                        </button>
                        <p className="truncate font-mono text-xs text-slate-400">
                            {`${projectDisplayName}${namespaceSuffix}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {actions.isFileSystemAccessSupported ? (
                            <>
                                <Button
                                    size="icon"
                                    variant="subtle"
                                    className="rounded-xl"
                                    aria-label="新建文件"
                                    title="新建文件"
                                    onClick={() => void actions.createNewFile()}
                                >
                                    <IconFilePlus size={16} />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="subtle"
                                    className="rounded-xl"
                                    aria-label="打开文件"
                                    title="打开文件"
                                    onClick={() =>
                                        void actions.openWithFilePicker()
                                    }
                                >
                                    <IconFileImport size={16} />
                                </Button>
                            </>
                        ) : null}
                        <Button
                            size="icon"
                            variant="subtle"
                            className="rounded-xl"
                            aria-label="下载项目"
                            title="下载项目"
                            onClick={actions.downloadProject}
                        >
                            <IconDeviceFloppy size={16} />
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex min-h-0 flex-1">
                <aside className="w-80 shrink-0 border-r border-app-border bg-slate-900/80 backdrop-blur-sm">
                    <Sidebar />
                </aside>

                <main className="min-h-0 min-w-0 flex-1 bg-app-bg">
                    {workspace.viewMode === "editor" && <EditorStage />}
                    {workspace.viewMode === "playback" && <PlaybackStage />}
                    {workspace.viewMode === "welcome" && <WelcomeStage />}
                </main>
            </div>
        </div>
    );
}
