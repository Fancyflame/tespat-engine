import { IconBinaryTree2, IconEdit, IconVideo } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceActions } from "../../Workspace";
import { SidebarEditorTab } from "./SidebarEditorTab";
import { SidebarNamespacesTab } from "./SidebarNamespacesTab";

// SidebarTab 约束侧边栏工具区可切换的页签
type SidebarTab = "tree" | "editor";

export const Sidebar = () => {
    const actions = useWorkspaceActions();
    const [activeSidebarTab, setActiveSidebarTab] =
        useState<SidebarTab>("editor");

    return (
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-2 p-4">
            <div className="flex min-h-0 shrink-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <Button
                        variant={
                            activeSidebarTab === "tree" ? "subtle" : "ghost"
                        }
                        size="icon"
                        aria-label="结构树"
                        title="结构树"
                        className={cn(
                            "rounded-xl transition-colors",
                            activeSidebarTab === "tree"
                                ? "text-white"
                                : "text-slate-300",
                        )}
                        onClick={() => setActiveSidebarTab("tree")}
                    >
                        <IconBinaryTree2 size={14} />
                    </Button>
                    <Button
                        variant={
                            activeSidebarTab === "editor"
                                ? "subtle"
                                : "ghost"
                        }
                        size="icon"
                        aria-label="编辑器"
                        title="编辑器"
                        className={cn(
                            "rounded-xl transition-colors",
                            activeSidebarTab === "editor"
                                ? "text-white"
                                : "text-slate-300",
                        )}
                        onClick={() => setActiveSidebarTab("editor")}
                    >
                        <IconEdit size={14} />
                    </Button>
                </div>

                <Button
                    variant="subtle"
                    size="icon"
                    className="rounded-xl"
                    aria-label="回放录制"
                    title="回放录制"
                    onClick={actions.openPlayback}
                >
                    <IconVideo size={14} />
                </Button>
            </div>
            <div className="flex min-h-0 w-full min-w-0 flex-1">
                {activeSidebarTab === "editor" ? (
                    <SidebarEditorTab />
                ) : (
                    <SidebarNamespacesTab />
                )}
            </div>
        </div>
    );
};
