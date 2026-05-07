import { memo, useEffect, useMemo, useState } from "react";
import {
    IconEye,
    IconEyeOff,
    IconPencil,
    IconPlus,
    IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PaletteEntry } from "../../ProjectData";
import {
    useWorkspace,
    useWorkspaceActions,
    useWorkspaceNamespace,
} from "../../Workspace";
import { PalettePreview } from "../GridDisplay2D/GridDisplay2D";
import { SidebarPanel } from "./SidebarPanel";

type PaletteListItemProps = {
    id: string;
    entry: PaletteEntry;
    selected: boolean;
    onSelect: (paletteId: string) => void;
    onRename: (paletteId: string, nextName: string) => boolean;
    onDelete: (paletteId: string) => boolean;
    onChangeColor: (paletteId: string, nextColor: string) => void;
    onChangePublic: (paletteId: string, nextPublic: boolean) => void;
    onChangeIcon: (paletteId: string, nextIcon: string | null) => void;
};

// 标准化 HEX 颜色，允许用户输入时省略井号
function normalizeHexColor(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (!/^#([0-9a-fA-F]{6})$/.test(prefixed)) {
        return null;
    }

    return prefixed.toLowerCase();
}

// PaletteSection 负责管理 palette 条目
export function PaletteSection() {
    const workspace = useWorkspace();
    const namespace = useWorkspaceNamespace();
    const actions = useWorkspaceActions();

    const paletteItems = useMemo(
        () =>
            Array.from(namespace.palette.entries()).sort((left, right) =>
                left[0].localeCompare(right[0], undefined, {
                    sensitivity: "accent",
                }),
            ),
        [namespace.palette],
    );

    return (
        <SidebarPanel
            title="PALETTE"
            rightAction={
                <Button
                    variant="subtle"
                    size="icon-sm"
                    className="rounded-lg"
                    onClick={(event) => {
                        event.stopPropagation();
                        actions.createPalette();
                    }}
                >
                    <IconPlus size={14} />
                </Button>
            }
        >
            <div className="w-full min-w-0 space-y-1.5">
                {paletteItems.length === 0 ? (
                    <p className="text-xs text-slate-400">暂无 palette</p>
                ) : (
                    <div className="w-full min-w-0 divide-y divide-white/6 rounded-xl border border-white/6 bg-slate-900/40 overflow-hidden">
                        {paletteItems.map(([id, entry]) => (
                            <div key={id}>
                                <PaletteListItem
                                    id={id}
                                    entry={entry}
                                    selected={
                                        workspace.selectedPaletteId === id
                                    }
                                    onSelect={actions.setSelectedPaletteId}
                                    onRename={actions.renamePalette}
                                    onDelete={actions.deletePalette}
                                    onChangeColor={actions.updatePaletteColor}
                                    onChangePublic={actions.updatePalettePublic}
                                    onChangeIcon={actions.updatePaletteIcon}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </SidebarPanel>
    );
}

// PaletteListItem 负责展示并编辑单条 palette
const PaletteListItem = memo(function PaletteListItem({
    id,
    entry,
    selected,
    onSelect,
    onRename,
    onDelete,
    onChangeColor,
    onChangePublic,
    onChangeIcon,
}: PaletteListItemProps) {
    const [draftName, setDraftName] = useState(id);
    const [draftColor, setDraftColor] = useState(entry.color);
    const [draftIcon, setDraftIcon] = useState(entry.icon ?? "");

    useEffect(() => {
        setDraftName(id);
    }, [id]);

    useEffect(() => {
        setDraftColor(entry.color);
    }, [entry.color]);

    useEffect(() => {
        setDraftIcon(entry.icon ?? "");
    }, [entry.icon]);

    const commitName = () => {
        const succeeded = onRename(id, draftName);
        if (!succeeded) {
            setDraftName(id);
        }
    };

    const commitColor = () => {
        const normalized = normalizeHexColor(draftColor);
        if (!normalized) {
            setDraftColor(entry.color);
            return;
        }

        setDraftColor(normalized);
        onChangeColor(id, normalized);
    };

    const commitIcon = () => {
        onChangeIcon(id, draftIcon.trim() || null);
    };

    const handleDelete = () => {
        const confirmed = window.confirm(`确认删除 palette「${id}」吗？`);
        if (!confirmed) {
            return;
        }

        onDelete(id);
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            onClick={() => onSelect(id)}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) {
                    return;
                }

                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(id);
                }
            }}
            className={cn(
                "group flex w-full items-center gap-1.5 px-2.5 py-1.5 transition-colors outline-none select-none hover:bg-blue-400/24 focus-visible:ring-2 focus-visible:ring-blue-400/55",
                selected ? "bg-app-accent-soft" : "",
            )}
        >
            <div className="flex shrink-0 items-center justify-center">
                <PalettePreview entry={entry} size={16} borderRadius={4} />
            </div>
            <span
                className={cn(
                    "min-w-0 flex-1 truncate text-[11px] font-semibold leading-4",
                    selected ? "text-white" : "text-slate-300",
                )}
            >
                {id}
            </span>
            <div className="relative shrink-0">
                {entry.public ? (
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center opacity-100 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
                        <span className="flex size-6 items-center justify-center rounded-md text-slate-300/85">
                            <IconEye size={11} />
                        </span>
                    </div>
                ) : null}
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
                    <Popover
                        onOpenChange={(open) => {
                            if (!open) {
                                commitName();
                                commitColor();
                                commitIcon();
                            }
                        }}
                    >
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-6 rounded-md"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <IconPencil size={11} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            className="w-[280px]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-slate-300">
                                        名称
                                    </p>
                                    <Input
                                        value={draftName}
                                        onChange={(event) =>
                                            setDraftName(event.currentTarget.value)
                                        }
                                        onBlur={commitName}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                commitName();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-slate-300">
                                        颜色
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            className="h-10 w-14 cursor-pointer rounded-md border border-app-border bg-transparent p-1"
                                            value={
                                                normalizeHexColor(draftColor) ??
                                                entry.color
                                            }
                                            onChange={(event) => {
                                                const nextColor =
                                                    event.currentTarget.value;
                                                setDraftColor(nextColor);
                                                onChangeColor(id, nextColor);
                                            }}
                                        />
                                        <Input
                                            value={draftColor}
                                            onChange={(event) =>
                                                setDraftColor(
                                                    event.currentTarget.value,
                                                )
                                            }
                                            onBlur={commitColor}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    commitColor();
                                                }
                                            }}
                                            placeholder="#ffffff"
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-xs font-semibold text-slate-300">
                                        Icon
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        使用 Tabler icon 的 kebab-case 名称
                                    </p>
                                    <Input
                                        placeholder="e.g. door, tree, arrow-right"
                                        value={draftIcon}
                                        onChange={(event) =>
                                            setDraftIcon(event.currentTarget.value)
                                        }
                                        onBlur={commitIcon}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                commitIcon();
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 rounded-md"
                        aria-label={entry.public ? "公开" : "私有"}
                        title={entry.public ? "公开" : "私有"}
                        onClick={(event) => {
                            event.stopPropagation();
                            onChangePublic(id, !entry.public);
                        }}
                    >
                        {entry.public ? (
                            <IconEye size={11} />
                        ) : (
                            <IconEyeOff size={11} />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 rounded-md text-red-200 hover:bg-red-500/16"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleDelete();
                        }}
                    >
                        <IconTrash size={11} />
                    </Button>
                </div>
            </div>
        </div>
    );
});
