import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    type MutableRefObject,
    type ReactNode,
} from "react";
import { IconX } from "@tabler/icons-react";
import { notifications } from "@/lib/notifications";
import {
    DEFAULT_PROJECT,
    ROOT_NAMESPACE_ID,
    type NamespaceData,
    getNamespaceLastSegment,
    type PaletteEntry,
    clonePaletteEntry,
    clonePatternRule,
    cloneProject,
    countPaletteReferences,
    createEmptyNamespaceData,
    createNamespaceId,
    createEmptyPatternRule,
    getNamespaceDescendantIds,
    getNamespaceParentId,
    getSortedNamespaceIds,
    isNamespaceDescendant,
    isNamespaceSegmentValid,
    replacePaletteNameInCells,
    type ProjectData,
} from "./ProjectData";
import { projectToJson, jsonToProject } from "./projectSerialization";
import { applyResizeGrid } from "./components/GridEditResizer/applyResizeGrid";
import type { ResizeDirection } from "./components/GridEditResizer/ResizeBar";
import type { ReplayData } from "./replay/parseReplayJson";

const SYNC_DEBOUNCE_MS = 1000;

// 当前主工作区可处于的页面模式
export type ViewMode = "welcome" | "editor" | "playback";
export type NamespaceDropPlacement = "after-sibling" | "first-child";

// 工作区的核心状态定义
export interface WorkspaceState {
    project: ProjectData;
    selectedNamespaceId: string;
    viewMode: ViewMode;
    selectedPatternId: string | null;
    selectedPaletteId: string | null;
    fileHandle: FileSystemFileHandle | null;
    fileName: string | null;
    replayData: ReplayData | null;
    replayFileHandle: FileSystemFileHandle | null;
    replayFileName: string | null;
    replayCurrentStep: number;
}

// 工作区 reducer 的更新动作
interface WorkspaceReducerAction {
    type: "update";
    updater: (state: WorkspaceState) => WorkspaceState;
}

// 工作区对外暴露的动作集合
interface WorkspaceActions {
    isFileSystemAccessSupported: boolean;
    goToWelcome: () => void;
    openPlayback: () => void;
    setReplayImportResult: (payload: {
        replayData: ReplayData;
        fileHandle: FileSystemFileHandle | null;
        fileName: string | null;
    }) => void;
    setReplayCurrentStep: (step: number) => void;
    clearReplayState: () => void;
    selectNamespace: (namespaceId: string) => void;
    createNamespace: (
        parentNamespaceId: string,
        segment: string,
    ) => boolean;
    renameNamespace: (namespaceId: string, segment: string) => boolean;
    deleteNamespace: (namespaceId: string) => boolean;
    moveNamespace: (
        sourceId: string,
        targetId: string,
        placement: NamespaceDropPlacement,
    ) => boolean;
    selectPattern: (patternId: string) => void;
    setSelectedPaletteId: (paletteId: string | null) => void;
    createPattern: () => void;
    renamePattern: (patternId: string, nextName: string) => boolean;
    deletePattern: (patternId: string) => void;
    movePattern: (
        sourceId: string,
        targetId: string,
        position: "before" | "after",
    ) => void;
    updatePatternCapture: (patternId: string, nextCapture: string[]) => void;
    updatePatternReplace: (patternId: string, nextReplace: string[]) => void;
    resizePattern: (
        patternId: string,
        direction: ResizeDirection,
        deltaUnits: number,
        fillPaletteId: string,
    ) => void;
    createPalette: () => void;
    renamePalette: (paletteId: string, nextName: string) => boolean;
    updatePaletteColor: (paletteId: string, nextColor: string) => void;
    updatePalettePublic: (paletteId: string, nextPublic: boolean) => void;
    updatePaletteIcon: (paletteId: string, nextIcon: string | null) => void;
    deletePalette: (paletteId: string) => boolean;
    openWithFilePicker: () => Promise<void>;
    createNewFile: () => Promise<void>;
    downloadProject: () => void;
    closeFile: () => void;
}

// 工作区状态 Context
const WorkspaceStateContext = createContext<WorkspaceState | undefined>(
    undefined,
);

// 工作区动作 Context
const WorkspaceActionsContext = createContext<WorkspaceActions | undefined>(
    undefined,
);

// 生成回放模式的初始状态
function createInitialReplayState() {
    return {
        replayData: null,
        replayFileHandle: null,
        replayFileName: null,
        replayCurrentStep: 0,
    };
}

// 创建工作区的初始状态
function createInitialWorkspaceState(): WorkspaceState {
    return {
        project: cloneProject(DEFAULT_PROJECT),
        selectedNamespaceId: ROOT_NAMESPACE_ID,
        viewMode: "welcome",
        selectedPatternId: null,
        selectedPaletteId: null,
        fileHandle: null,
        fileName: null,
        ...createInitialReplayState(),
    };
}

// reducer 负责应用纯状态更新
function workspaceReducer(
    state: WorkspaceState,
    action: WorkspaceReducerAction,
) {
    switch (action.type) {
        case "update":
            return action.updater(state);
        default:
            return state;
    }
}

// 获取有效的当前命名空间 ID
function getActiveNamespaceId(state: WorkspaceState) {
    if (state.project.namespaces.has(state.selectedNamespaceId)) {
        return state.selectedNamespaceId;
    }

    return ROOT_NAMESPACE_ID;
}

// 获取当前命名空间数据
function getActiveNamespace(state: WorkspaceState): NamespaceData {
    const activeNamespaceId = getActiveNamespaceId(state);
    const activeNamespace = state.project.namespaces.get(activeNamespaceId);
    if (activeNamespace) {
        return activeNamespace;
    }

    return createEmptyNamespaceData();
}

// 生成新的 pattern 默认名称
function createNextPatternId(namespace: NamespaceData) {
    let index = 0;
    let newId = "_NewPattern";

    while (namespace.patterns.has(newId)) {
        index += 1;
        newId = `_NewPattern${index}`;
    }

    return newId;
}

// 生成新的 palette 默认名称
function createNextPaletteId(namespace: NamespaceData) {
    let index = 0;
    let newId = "_NewPalette";

    while (namespace.palette.has(newId)) {
        index += 1;
        newId = `_NewPalette${index}`;
    }

    return newId;
}

// 判断两份单元格数组是否完全一致
function areCellsEqual(left: string[], right: string[]) {
    return (
        left.length === right.length &&
        left.every((cell, index) => cell === right[index])
    );
}

// 将文本内容下载为本地文件
function downloadTextFile(content: string, fileName: string) {
    const blob = new Blob([content], {
        type: "application/json;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);

    try {
        link.click();
    } finally {
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
    }
}

// 将错误对象转换为适合展示的消息
function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "操作失败，请重试";
}

// 返回 children 更新后的命名空间副本
function withNamespaceChildren(
    namespace: NamespaceData,
    updater: (children: string[]) => string[],
): NamespaceData {
    return {
        ...namespace,
        children: updater(namespace.children),
    };
}

// 构造命名空间子树的重命名映射
function buildNamespaceIdRemap(
    namespaces: Map<string, NamespaceData>,
    sourceId: string,
    nextSourceId: string,
) {
    const orderedIds = getSortedNamespaceIds(namespaces).filter(
        (id) => id === sourceId || isNamespaceDescendant(id, sourceId),
    );

    return new Map(
        orderedIds.map((id) => [
            id,
            id === sourceId
                ? nextSourceId
                : `${nextSourceId}${id.slice(sourceId.length)}`,
        ]),
    );
}

// 按映射重写整棵命名空间子树
function remapNamespaceProject(
    project: ProjectData,
    idRemap: Map<string, string>,
): ProjectData | null {
    const nextNamespaces = new Map<string, NamespaceData>();

    for (const [id, namespace] of project.namespaces.entries()) {
        const mappedId = idRemap.get(id) ?? id;
        if (nextNamespaces.has(mappedId)) {
            return null;
        }

        nextNamespaces.set(mappedId, {
            ...namespace,
            children: namespace.children.map((childId) => idRemap.get(childId) ?? childId),
        });
    }

    return {
        ...project,
        namespaces: nextNamespaces,
    };
}

// 根据移动语义计算目标父级与顺序锚点
function resolveNamespaceMoveTarget(
    project: ProjectData,
    sourceId: string,
    targetId: string,
    placement: NamespaceDropPlacement,
) {
    if (sourceId === ROOT_NAMESPACE_ID || sourceId === targetId) {
        return null;
    }

    if (
        !project.namespaces.has(sourceId) ||
        !project.namespaces.has(targetId) ||
        isNamespaceDescendant(targetId, sourceId)
    ) {
        return null;
    }

    if (placement === "first-child") {
        return {
            parentId: targetId,
            insertAfterId: null as string | null,
        };
    }

    const parentId = getNamespaceParentId(targetId);
    if (parentId === null) {
        return null;
    }

    if (targetId === ROOT_NAMESPACE_ID) {
        return null;
    }

    return {
        parentId,
        insertAfterId: targetId,
    };
}

// 重新排列父级 children 列表
function insertNamespaceChild(
    children: string[],
    childId: string,
    insertAfterId: string | null,
) {
    const nextChildren = children.filter((id) => id !== childId);

    if (insertAfterId === null) {
        nextChildren.unshift(childId);
        return nextChildren;
    }

    const insertIndex = nextChildren.indexOf(insertAfterId);
    if (insertIndex < 0) {
        return null;
    }

    nextChildren.splice(insertIndex + 1, 0, childId);
    return nextChildren;
}

// 显示命名空间操作失败通知
function showNamespaceError(title: string, message: string) {
    notifications.show({
        title,
        message,
        icon: <IconX size={16} />,
        color: "red",
    });
}

// 执行一次文件同步，并保留“首次打开跳过回写”的语义
async function syncProjectToFile(
    fileHandle: FileSystemFileHandle,
    project: ProjectData,
    skipNextSyncContentRef: MutableRefObject<string | null>,
) {
    const content = projectToJson(project);
    const loadedContent = skipNextSyncContentRef.current;

    if (loadedContent !== null) {
        skipNextSyncContentRef.current = null;
        if (content === loadedContent) {
            return;
        }
    }

    try {
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    } catch (error) {
        console.error("同步到文件失败:", error);
        notifications.show({
            title: "同步失败",
            message: "写入本地文件失败，请重新打开文件或下载导出",
            color: "red",
        });
    }
}

// WorkspaceProvider 负责聚合状态、动作与文件同步副作用
export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(
        workspaceReducer,
        createInitialWorkspaceState(),
    );
    const stateRef = useRef(state);
    const skipNextSyncContentRef = useRef<string | null>(null);
    const isFileSystemAccessSupported =
        typeof window !== "undefined" &&
        "showOpenFilePicker" in window &&
        "showSaveFilePicker" in window;

    stateRef.current = state;

    const updateState = useCallback(
        (updater: (prev: WorkspaceState) => WorkspaceState) => {
            dispatch({ type: "update", updater });
        },
        [],
    );

    const actions = useMemo<WorkspaceActions>(
        () => ({
            isFileSystemAccessSupported,
            goToWelcome() {
                updateState((prev) => ({
                    ...prev,
                    viewMode: "welcome",
                }));
            },
            openPlayback() {
                updateState((prev) => ({
                    ...prev,
                    viewMode: "playback",
                }));
            },
            setReplayImportResult({ replayData, fileHandle, fileName }) {
                updateState((prev) => ({
                    ...prev,
                    replayData,
                    replayFileHandle: fileHandle,
                    replayFileName: fileName,
                    replayCurrentStep:
                        replayData.frames.length > 0
                            ? replayData.frames.length - 1
                            : 0,
                }));
            },
            setReplayCurrentStep(step) {
                updateState((prev) => ({
                    ...prev,
                    replayCurrentStep: step,
                }));
            },
            clearReplayState() {
                updateState((prev) => ({
                    ...prev,
                    ...createInitialReplayState(),
                }));
            },
            selectNamespace(namespaceId) {
                updateState((prev) => {
                    if (!prev.project.namespaces.has(namespaceId)) {
                        return prev;
                    }

                    if (prev.selectedNamespaceId === namespaceId) {
                        return prev;
                    }

                    return {
                        ...prev,
                        selectedNamespaceId: namespaceId,
                        selectedPatternId: null,
                        selectedPaletteId: null,
                        viewMode: "welcome",
                    };
                });
            },
            createNamespace(parentNamespaceId, segment) {
                const trimmedSegment = segment.trim();
                if (!isNamespaceSegmentValid(trimmedSegment)) {
                    showNamespaceError(
                        "命名空间名称无效",
                        "名称段仅允许字母、数字和下划线",
                    );
                    return false;
                }

                const currentState = stateRef.current;
                if (!currentState.project.namespaces.has(parentNamespaceId)) {
                    return false;
                }

                const newNamespaceId = createNamespaceId(
                    parentNamespaceId,
                    trimmedSegment,
                );
                if (currentState.project.namespaces.has(newNamespaceId)) {
                    showNamespaceError("创建失败", "同名命名空间已存在");
                    return false;
                }

                updateState((prev) => {
                    const parentNamespace =
                        prev.project.namespaces.get(parentNamespaceId);
                    if (!parentNamespace || prev.project.namespaces.has(newNamespaceId)) {
                        return prev;
                    }

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(
                        parentNamespaceId,
                        withNamespaceChildren(parentNamespace, (children) => [
                            ...children,
                            newNamespaceId,
                        ]),
                    );
                    namespaces.set(newNamespaceId, createEmptyNamespaceData());

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: newNamespaceId,
                        selectedPatternId: null,
                        selectedPaletteId: null,
                        viewMode: "welcome",
                    };
                });

                return true;
            },
            renameNamespace(namespaceId, segment) {
                const trimmedSegment = segment.trim();
                if (namespaceId === ROOT_NAMESPACE_ID) {
                    showNamespaceError("无法重命名", "根命名空间不可重命名");
                    return false;
                }

                if (!isNamespaceSegmentValid(trimmedSegment)) {
                    showNamespaceError(
                        "命名空间名称无效",
                        "名称段仅允许字母、数字和下划线",
                    );
                    return false;
                }

                const currentState = stateRef.current;
                if (!currentState.project.namespaces.has(namespaceId)) {
                    return false;
                }

                const parentId = getNamespaceParentId(namespaceId);
                if (parentId === null) {
                    return false;
                }

                const nextNamespaceId = createNamespaceId(
                    parentId,
                    trimmedSegment,
                );
                if (nextNamespaceId === namespaceId) {
                    return true;
                }

                const idRemap = buildNamespaceIdRemap(
                    currentState.project.namespaces,
                    namespaceId,
                    nextNamespaceId,
                );
                const movingSet = new Set(idRemap.keys());
                for (const mappedId of idRemap.values()) {
                    if (
                        currentState.project.namespaces.has(mappedId) &&
                        !movingSet.has(mappedId)
                    ) {
                        showNamespaceError("无法重命名", "目标命名空间已存在");
                        return false;
                    }
                }

                updateState((prev) => {
                    const parentNamespace = prev.project.namespaces.get(parentId);
                    if (!parentNamespace || !prev.project.namespaces.has(namespaceId)) {
                        return prev;
                    }

                    const nextProject = remapNamespaceProject(prev.project, idRemap);
                    if (!nextProject) {
                        return prev;
                    }

                    const nextParentNamespace =
                        nextProject.namespaces.get(parentId);
                    if (!nextParentNamespace) {
                        return prev;
                    }

                    nextProject.namespaces.set(
                        parentId,
                        withNamespaceChildren(nextParentNamespace, (children) =>
                            children.map((childId) =>
                                childId === namespaceId ? nextNamespaceId : childId,
                            ),
                        ),
                    );

                    return {
                        ...prev,
                        project: nextProject,
                        selectedNamespaceId:
                            idRemap.get(prev.selectedNamespaceId) ??
                            prev.selectedNamespaceId,
                    };
                });

                return true;
            },
            deleteNamespace(namespaceId) {
                if (namespaceId === ROOT_NAMESPACE_ID) {
                    showNamespaceError("无法删除", "根命名空间不可删除");
                    return false;
                }

                const currentState = stateRef.current;
                if (!currentState.project.namespaces.has(namespaceId)) {
                    return false;
                }

                const parentId = getNamespaceParentId(namespaceId);
                if (parentId === null) {
                    return false;
                }

                updateState((prev) => {
                    const parentNamespace = prev.project.namespaces.get(parentId);
                    if (!prev.project.namespaces.has(namespaceId) || !parentNamespace) {
                        return prev;
                    }

                    const toDelete = getNamespaceDescendantIds(
                        prev.project.namespaces,
                        namespaceId,
                        true,
                    );
                    const deleteSet = new Set(toDelete);
                    const namespaces = new Map<string, NamespaceData>();

                    namespaces.set(
                        parentId,
                        withNamespaceChildren(parentNamespace, (children) =>
                            children.filter((childId) => childId !== namespaceId),
                        ),
                    );

                    for (const [id, namespace] of prev.project.namespaces.entries()) {
                        if (id === parentId || deleteSet.has(id)) {
                            continue;
                        }

                        namespaces.set(id, namespace);
                    }

                    const selectedNamespaceDeleted = deleteSet.has(
                        prev.selectedNamespaceId,
                    );
                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: selectedNamespaceDeleted
                            ? ROOT_NAMESPACE_ID
                            : prev.selectedNamespaceId,
                        selectedPatternId: selectedNamespaceDeleted
                            ? null
                            : prev.selectedPatternId,
                        selectedPaletteId: selectedNamespaceDeleted
                            ? null
                            : prev.selectedPaletteId,
                        viewMode:
                            selectedNamespaceDeleted &&
                            prev.viewMode === "editor"
                                ? "welcome"
                                : prev.viewMode,
                    };
                });

                return true;
            },
            moveNamespace(sourceId, targetId, placement) {
                const currentState = stateRef.current;
                const moveTarget = resolveNamespaceMoveTarget(
                    currentState.project,
                    sourceId,
                    targetId,
                    placement,
                );
                if (!moveTarget) {
                    return false;
                }

                const sourceParentId = getNamespaceParentId(sourceId);
                if (sourceParentId === null) {
                    return false;
                }

                const sourceSegment = getNamespaceLastSegment(sourceId);
                const nextSourceId = createNamespaceId(
                    moveTarget.parentId,
                    sourceSegment,
                );
                const idRemap = buildNamespaceIdRemap(
                    currentState.project.namespaces,
                    sourceId,
                    nextSourceId,
                );
                const movingSet = new Set(idRemap.keys());
                for (const mappedId of idRemap.values()) {
                    if (
                        currentState.project.namespaces.has(mappedId) &&
                        !movingSet.has(mappedId)
                    ) {
                        showNamespaceError(
                            "无法移动",
                            "目标位置已有同名命名空间",
                        );
                        return false;
                    }
                }

                updateState((prev) => {
                    const currentMoveTarget = resolveNamespaceMoveTarget(
                        prev.project,
                        sourceId,
                        targetId,
                        placement,
                    );
                    if (!currentMoveTarget) {
                        return prev;
                    }

                    const currentSourceParentId = getNamespaceParentId(sourceId);
                    if (currentSourceParentId === null) {
                        return prev;
                    }

                    const currentNextSourceId = createNamespaceId(
                        currentMoveTarget.parentId,
                        getNamespaceLastSegment(sourceId),
                    );
                    const currentIdRemap = buildNamespaceIdRemap(
                        prev.project.namespaces,
                        sourceId,
                        currentNextSourceId,
                    );
                    const nextProject = remapNamespaceProject(
                        prev.project,
                        currentIdRemap,
                    );
                    if (!nextProject) {
                        return prev;
                    }

                    const previousSourceParent =
                        prev.project.namespaces.get(currentSourceParentId);
                    const previousTargetParent = prev.project.namespaces.get(
                        currentMoveTarget.parentId,
                    );
                    const nextSourceParent =
                        nextProject.namespaces.get(currentSourceParentId);
                    const nextTargetParent = nextProject.namespaces.get(
                        currentMoveTarget.parentId,
                    );
                    if (
                        !previousSourceParent ||
                        !previousTargetParent ||
                        !nextSourceParent ||
                        !nextTargetParent
                    ) {
                        return prev;
                    }

                    const nextSourceChildren = previousSourceParent.children.filter(
                        (childId) => childId !== sourceId,
                    );
                    if (currentSourceParentId === currentMoveTarget.parentId) {
                        const reorderedChildren = insertNamespaceChild(
                            nextSourceChildren,
                            currentNextSourceId,
                            currentMoveTarget.insertAfterId,
                        );
                        if (!reorderedChildren) {
                            return prev;
                        }

                        nextProject.namespaces.set(currentSourceParentId, {
                            ...nextSourceParent,
                            children: reorderedChildren,
                        });
                    } else {
                        nextProject.namespaces.set(currentSourceParentId, {
                            ...nextSourceParent,
                            children: nextSourceChildren,
                        });

                        const reorderedChildren = insertNamespaceChild(
                            previousTargetParent.children,
                            currentNextSourceId,
                            currentMoveTarget.insertAfterId,
                        );
                        if (!reorderedChildren) {
                            return prev;
                        }

                        nextProject.namespaces.set(currentMoveTarget.parentId, {
                            ...nextTargetParent,
                            children: reorderedChildren,
                        });
                    }

                    return {
                        ...prev,
                        project: nextProject,
                        selectedNamespaceId:
                            currentIdRemap.get(prev.selectedNamespaceId) ??
                            prev.selectedNamespaceId,
                    };
                });

                return true;
            },
            selectPattern(patternId) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace?.patterns.has(patternId)) {
                        return prev;
                    }

                    return {
                        ...prev,
                        selectedNamespaceId: activeNamespaceId,
                        selectedPatternId: patternId,
                        viewMode: "editor",
                    };
                });
            },
            setSelectedPaletteId(paletteId) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    if (
                        paletteId !== null &&
                        !activeNamespace.palette.has(paletteId)
                    ) {
                        return prev;
                    }

                    return {
                        ...prev,
                        selectedNamespaceId: activeNamespaceId,
                        selectedPaletteId: paletteId,
                    };
                });
            },
            createPattern() {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const newId = createNextPatternId(activeNamespace);
                    const patterns = new Map(activeNamespace.patterns);

                    patterns.set(newId, createEmptyPatternRule());

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPatternId: newId,
                        viewMode: "editor",
                    };
                });
            },
            renamePattern(patternId, nextName) {
                const trimmed = nextName.trim();
                if (!trimmed || trimmed === patternId) {
                    return true;
                }

                const currentState = stateRef.current;
                const currentNamespace = getActiveNamespace(currentState);
                if (!currentNamespace.patterns.has(patternId)) {
                    return false;
                }

                if (currentNamespace.patterns.has(trimmed)) {
                    notifications.show({
                        title: "无法重命名",
                        message: "相同名字的规则已存在",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    const rule = patterns.get(patternId);
                    if (!rule) {
                        return prev;
                    }

                    const renamedPatterns = new Map<string, typeof rule>();
                    for (const [id, currentRule] of patterns.entries()) {
                        if (id === patternId) {
                            renamedPatterns.set(trimmed, clonePatternRule(rule));
                            continue;
                        }
                        renamedPatterns.set(id, currentRule);
                    }

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns: renamedPatterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPatternId:
                            prev.selectedPatternId === patternId
                                ? trimmed
                                : prev.selectedPatternId,
                    };
                });

                return true;
            },
            deletePattern(patternId) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    if (!patterns.has(patternId)) {
                        return prev;
                    }

                    patterns.delete(patternId);
                    const wasSelected = prev.selectedPatternId === patternId;
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPatternId: wasSelected
                            ? null
                            : prev.selectedPatternId,
                        viewMode:
                            wasSelected && prev.viewMode === "editor"
                                ? "welcome"
                                : prev.viewMode,
                    };
                });
            },
            movePattern(sourceId, targetId, position) {
                if (sourceId === targetId) {
                    return;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const orderedIds = Array.from(activeNamespace.patterns.keys());
                    if (
                        !orderedIds.includes(sourceId) ||
                        !orderedIds.includes(targetId)
                    ) {
                        return prev;
                    }

                    const nextPatternOrder = orderedIds.filter(
                        (id) => id !== sourceId,
                    );
                    const insertIndex = nextPatternOrder.indexOf(targetId);

                    if (insertIndex < 0) {
                        return prev;
                    }

                    nextPatternOrder.splice(
                        position === "before" ? insertIndex : insertIndex + 1,
                        0,
                        sourceId,
                    );

                    const unchanged =
                        nextPatternOrder.length === orderedIds.length &&
                        nextPatternOrder.every((id, index) => id === orderedIds[index]);

                    if (unchanged) {
                        return prev;
                    }

                    const reorderedPatterns = new Map(activeNamespace.patterns);
                    reorderedPatterns.clear();
                    for (const id of nextPatternOrder) {
                        const rule = activeNamespace.patterns.get(id);
                        if (!rule) {
                            return prev;
                        }
                        reorderedPatterns.set(id, rule);
                    }

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns: reorderedPatterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            updatePatternCapture(patternId, nextCapture) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const rule = activeNamespace.patterns.get(patternId);
                    if (!rule || areCellsEqual(rule.capture, nextCapture)) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    patterns.set(patternId, {
                        ...rule,
                        capture: [...nextCapture],
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            updatePatternReplace(patternId, nextReplace) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const rule = activeNamespace.patterns.get(patternId);
                    if (!rule || areCellsEqual(rule.replace, nextReplace)) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    patterns.set(patternId, {
                        ...rule,
                        replace: [...nextReplace],
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            resizePattern(patternId, direction, deltaUnits, fillPaletteId) {
                if (deltaUnits === 0) {
                    return;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const rule = activeNamespace.patterns.get(patternId);
                    if (!rule || !activeNamespace.palette.has(fillPaletteId)) {
                        return prev;
                    }

                    const nextCapture = applyResizeGrid({
                        direction,
                        deltaUnits,
                        fillColor: fillPaletteId,
                        width: rule.width,
                        data: rule.capture,
                    });
                    const nextReplace = applyResizeGrid({
                        direction,
                        deltaUnits,
                        fillColor: fillPaletteId,
                        width: rule.width,
                        data: rule.replace,
                    });

                    if (
                        nextCapture.width === rule.width &&
                        nextCapture.data === rule.capture &&
                        nextReplace.data === rule.replace
                    ) {
                        return prev;
                    }

                    const patterns = new Map(activeNamespace.patterns);
                    patterns.set(patternId, {
                        ...rule,
                        width: nextCapture.width,
                        capture: nextCapture.data,
                        replace: nextReplace.data,
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            createPalette() {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const newId = createNextPaletteId(activeNamespace);
                    const palette = new Map(activeNamespace.palette);

                    palette.set(newId, {
                        color: "#ffffff",
                        icon: null,
                        public: false,
                    });

                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPaletteId: newId,
                    };
                });
            },
            renamePalette(paletteId, nextName) {
                const trimmed = nextName.trim();
                if (!trimmed || trimmed === paletteId) {
                    return true;
                }

                const currentState = stateRef.current;
                const currentNamespace = getActiveNamespace(currentState);
                if (!currentNamespace.palette.has(paletteId)) {
                    return false;
                }

                if (currentNamespace.palette.has(trimmed)) {
                    notifications.show({
                        title: "无法重命名",
                        message: "相同名字的 palette 已存在",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace?.palette.has(paletteId)) {
                        return prev;
                    }

                    const palette = new Map<string, PaletteEntry>();
                    for (const [id, entry] of activeNamespace.palette.entries()) {
                        if (id === paletteId) {
                            palette.set(trimmed, clonePaletteEntry(entry));
                            continue;
                        }

                        palette.set(id, clonePaletteEntry(entry));
                    }

                    const patterns = new Map(
                        Array.from(activeNamespace.patterns.entries()).map(
                            ([id, rule]) => {
                                const nextCapture = replacePaletteNameInCells(
                                    rule.capture,
                                    paletteId,
                                    trimmed,
                                );
                                const nextReplace = replacePaletteNameInCells(
                                    rule.replace,
                                    paletteId,
                                    trimmed,
                                );

                                if (
                                    nextCapture === rule.capture &&
                                    nextReplace === rule.replace
                                ) {
                                    return [id, rule] as const;
                                }

                                return [
                                    id,
                                    {
                                        ...rule,
                                        capture: nextCapture,
                                        replace: nextReplace,
                                    },
                                ] as const;
                            },
                        ),
                    );
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                        patterns,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPaletteId:
                            prev.selectedPaletteId === paletteId
                                ? trimmed
                                : prev.selectedPaletteId,
                    };
                });

                return true;
            },
            updatePaletteColor(paletteId, nextColor) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const entry = activeNamespace.palette.get(paletteId);
                    if (!entry || entry.color === nextColor) {
                        return prev;
                    }

                    const palette = new Map(activeNamespace.palette);
                    palette.set(paletteId, {
                        ...entry,
                        color: nextColor,
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            updatePalettePublic(paletteId, nextPublic) {
                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const entry = activeNamespace.palette.get(paletteId);
                    if (!entry || entry.public === nextPublic) {
                        return prev;
                    }

                    const palette = new Map(activeNamespace.palette);
                    palette.set(paletteId, {
                        ...entry,
                        public: nextPublic,
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            updatePaletteIcon(paletteId, nextIcon) {
                const normalizedIcon = nextIcon?.trim() || null;

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const entry = activeNamespace.palette.get(paletteId);
                    if (!entry || entry.icon === normalizedIcon) {
                        return prev;
                    }

                    const palette = new Map(activeNamespace.palette);
                    palette.set(paletteId, {
                        ...entry,
                        icon: normalizedIcon,
                    });
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                    };
                });
            },
            deletePalette(paletteId) {
                const currentState = stateRef.current;
                const currentNamespace = getActiveNamespace(currentState);
                if (!currentNamespace.palette.has(paletteId)) {
                    return false;
                }

                if (countPaletteReferences(currentNamespace, paletteId) > 0) {
                    notifications.show({
                        title: "无法删除",
                        message:
                            "该 palette 仍被 pattern 引用，请先替换相关单元格后再删除",
                        icon: <IconX size={16} />,
                        color: "red",
                    });
                    return false;
                }

                updateState((prev) => {
                    const activeNamespaceId = getActiveNamespaceId(prev);
                    const activeNamespace =
                        prev.project.namespaces.get(activeNamespaceId);
                    if (!activeNamespace) {
                        return prev;
                    }

                    const palette = new Map(activeNamespace.palette);
                    palette.delete(paletteId);
                    const namespaces = new Map(prev.project.namespaces);
                    namespaces.set(activeNamespaceId, {
                        ...activeNamespace,
                        palette,
                    });

                    return {
                        ...prev,
                        project: {
                            ...prev.project,
                            namespaces,
                        },
                        selectedNamespaceId: activeNamespaceId,
                        selectedPaletteId:
                            prev.selectedPaletteId === paletteId
                                ? null
                                : prev.selectedPaletteId,
                    };
                });

                return true;
            },
            async openWithFilePicker() {
                if (!isFileSystemAccessSupported) {
                    return;
                }

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
                    const normalizedContent = projectToJson(project);
                    const permission = await handle.requestPermission({
                        mode: "readwrite",
                    });

                    if (permission !== "granted") {
                        return;
                    }

                    skipNextSyncContentRef.current = normalizedContent;
                    updateState((prev) => ({
                        ...prev,
                        project,
                        selectedNamespaceId: ROOT_NAMESPACE_ID,
                        viewMode: "welcome",
                        selectedPatternId: null,
                        selectedPaletteId: null,
                        fileHandle: handle,
                        fileName: handle.name,
                        ...createInitialReplayState(),
                    }));
                } catch (error) {
                    if ((error as Error).name !== "AbortError") {
                        console.error("打开文件失败:", error);
                        notifications.show({
                            title: "打开失败",
                            message: getErrorMessage(error),
                            color: "red",
                        });
                    }
                }
            },
            async createNewFile() {
                if (!isFileSystemAccessSupported) {
                    return;
                }

                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: "untitled.tsp",
                        types: [
                            {
                                description: "TESPAT 项目文件",
                                accept: {
                                    "application/json": [".json", ".tsp"],
                                },
                            },
                        ],
                    });
                    const defaultProject = cloneProject(DEFAULT_PROJECT);
                    const content = projectToJson(defaultProject);
                    const writable = await handle.createWritable();
                    await writable.write(content);
                    await writable.close();

                    skipNextSyncContentRef.current = null;
                    updateState((prev) => ({
                        ...prev,
                        project: defaultProject,
                        selectedNamespaceId: ROOT_NAMESPACE_ID,
                        viewMode: "welcome",
                        selectedPatternId: null,
                        selectedPaletteId: null,
                        fileHandle: handle,
                        fileName: handle.name,
                        ...createInitialReplayState(),
                    }));
                } catch (error) {
                    if ((error as Error).name !== "AbortError") {
                        console.error("新建文件失败:", error);
                        notifications.show({
                            title: "新建失败",
                            message: getErrorMessage(error),
                            color: "red",
                        });
                    }
                }
            },
            downloadProject() {
                const currentState = stateRef.current;
                const content = projectToJson(currentState.project);
                downloadTextFile(
                    content,
                    currentState.fileName ?? "untitled.tsp",
                );
            },
            closeFile() {
                skipNextSyncContentRef.current = null;
                updateState((prev) => ({
                    ...prev,
                    fileHandle: null,
                    fileName: null,
                }));
            },
        }),
        [isFileSystemAccessSupported, updateState],
    );

    useEffect(() => {
        const fileHandle = state.fileHandle;
        if (!fileHandle) {
            return;
        }

        const timer = window.setTimeout(() => {
            void syncProjectToFile(
                fileHandle,
                state.project,
                skipNextSyncContentRef,
            );
        }, SYNC_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [state.fileHandle, state.project]);

    return (
        <WorkspaceStateContext.Provider value={state}>
            <WorkspaceActionsContext.Provider value={actions}>
                {children}
            </WorkspaceActionsContext.Provider>
        </WorkspaceStateContext.Provider>
    );
}

// 读取工作区状态
export function useWorkspace() {
    const context = useContext(WorkspaceStateContext);
    if (!context) {
        throw new Error("useWorkspace must be used within WorkspaceProvider");
    }
    return context;
}

// 读取当前选中命名空间数据
export function useWorkspaceNamespace() {
    const workspace = useWorkspace();
    return getActiveNamespace(workspace);
}

// 读取工作区动作
export function useWorkspaceActions() {
    const context = useContext(WorkspaceActionsContext);
    if (!context) {
        throw new Error(
            "useWorkspaceActions must be used within WorkspaceProvider",
        );
    }
    return context;
}
