import { Box } from "@mantine/core";
import { CtrlDragPannable } from "../components/CtrlDragPannable/CtrlDragPannable";
import { GridEditResizer } from "../components/GridEditResizer/GridEditResizer";
import { GridDisplay2D } from "../components/GridDisplay2D/GridDisplay2D";
import { useEditor } from "../EditorData";
import styles from "../App.module.css";

/** 主舞台 - 编辑模式：可拖拽、可调整尺寸的网格编辑器 */
export function EditorStage() {
    const { editor, setEditor } = useEditor();

    return (
        <Box className={styles.UIStack}>
            <Box className={styles.canvasStage}>
                <CtrlDragPannable className={styles.canvasPlaceholder}>
                    <GridEditResizer>
                        <GridDisplay2D
                            width={editor.editingGrid.width}
                            data={editor.editingGrid.data}
                            enableEdit={editor.enableEdit}
                            onChangeData={(nextData) =>
                                setEditor((prev) => ({
                                    ...prev,
                                    editingGrid: {
                                        ...prev.editingGrid,
                                        data: nextData,
                                    },
                                }))
                            }
                        />
                    </GridEditResizer>
                </CtrlDragPannable>
            </Box>
        </Box>
    );
}
