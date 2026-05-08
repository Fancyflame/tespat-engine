import {
    IconTrash,
    IconPencil,
    IconGripVertical,
    IconArrowRight,
} from "@tabler/icons-react";
import type { DragEventHandler } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaletteEntry, PatternRule } from "../../ProjectData";
import { GridDisplay2D } from "../GridDisplay2D/GridDisplay2D";

interface PatternCardProps {
    id: string;
    rule: PatternRule;
    palette: ReadonlyMap<string, PaletteEntry>;
    selected?: boolean;
    dragging?: boolean;
    dropIndicator?: "before" | "after" | null;
    onSelect?: () => void;
    onRename: (newName: string) => void;
    onDelete: () => void;
    onDragStart?: DragEventHandler<HTMLButtonElement>;
    onDragEnd?: DragEventHandler<HTMLButtonElement>;
    onDragOver?: DragEventHandler<HTMLDivElement>;
    onDrop?: DragEventHandler<HTMLDivElement>;
}

export const PatternCard = ({
    id,
    rule,
    palette,
    selected = false,
    dragging = false,
    dropIndicator = null,
    onSelect,
    onRename,
    onDelete,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
}: PatternCardProps) => {
    const handleRenameClick = () => {
        const newName = window.prompt("输入新的规则名称", id);
        if (!newName) return;
        const trimmed = newName.trim();
        if (!trimmed || trimmed === id) return;
        onRename(trimmed);
    };

    const handleDeleteClick = () => {
        const confirmed = window.confirm(`确认删除规则「${id}」吗？`);
        if (!confirmed) return;
        onDelete();
    };

    return (
        <div
            onClick={onSelect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cn(
                "rounded-xl border p-3 transition-[opacity,border-color,background-color] cursor-pointer",
                selected
                    ? "border-blue-400/70 bg-slate-800/90"
                    : "border-white/8 bg-slate-900/85 hover:border-blue-300/30 hover:bg-slate-900",
                dragging && "opacity-55",
            )}
            style={{
                borderTopColor:
                    dropIndicator === "before" ? "#60a5fa" : undefined,
                borderBottomColor:
                    dropIndicator === "after" ? "#60a5fa" : undefined,
                borderTopWidth: dropIndicator === "before" ? 2 : undefined,
                borderBottomWidth: dropIndicator === "after" ? 2 : undefined,
            }}
        >
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-md text-slate-400"
                            draggable={true}
                            title="拖拽调整顺序"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                        >
                            <IconGripVertical size={14} />
                        </Button>
                        <p
                            className={cn(
                                "min-w-0 break-all font-mono text-sm font-bold",
                                selected ? "text-blue-100" : "text-blue-300",
                            )}
                        >
                            {id}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-md"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleRenameClick();
                            }}
                        >
                            <IconPencil size={12} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-md text-red-200 hover:bg-red-500/16"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteClick();
                            }}
                        >
                            <IconTrash size={12} />
                        </Button>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                    <div className="flex size-14 shrink-0 items-center justify-center">
                        <GridDisplay2D
                            width={rule.width}
                            data={rule.capture}
                            palette={palette}
                        />
                    </div>
                    <div
                        className={cn(
                            "flex shrink-0 items-center justify-center",
                            selected ? "text-blue-100" : "text-slate-400",
                        )}
                    >
                        <IconArrowRight size={16} />
                    </div>
                    <div className="flex size-14 shrink-0 items-center justify-center">
                        <GridDisplay2D
                            width={rule.width}
                            data={rule.replace}
                            palette={palette}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
