import { ResizeDirection } from "./ResizeBar";

export type ResizeGridParams = {
    direction: ResizeDirection;
    deltaUnits: number;
    fillColor: string;
    width: number;
    data: string[];
};

export type ResizeGridResult = {
    width: number;
    data: string[];
};

/** 纯函数：根据方向和单元格增量，返回新的网格宽度与数据
 * 这部分是AI生成，如果需要改动直接删除重新生成。
 */
export function applyResizeGrid({
    direction,
    deltaUnits,
    fillColor,
    width,
    data,
}: ResizeGridParams): ResizeGridResult {
    if (deltaUnits === 0) {
        return { width, data };
    }

    const height = width > 0 ? Math.max(1, Math.ceil(data.length / width)) : 1;

    let newWidth = width;
    let newHeight = height;
    let newData = [...data];

    // 统一成完整的 width * height 网格
    if (newData.length !== width * height) {
        const fixed = new Array<string>(width * height);
        for (let i = 0; i < fixed.length; i++) {
            fixed[i] = newData[i] ?? "Empty";
        }
        newData = fixed;
    }

    const ensureMin = (value: number) => (value < 1 ? 1 : value);

    if (direction === "left" || direction === "right") {
        // 水平方向调整宽度
        const change = deltaUnits;
        if (change === 0) {
            return { width, data };
        }

        if (change > 0) {
            // 扩展宽度
            newWidth = width + change;
            const rows: string[][] = [];
            for (let y = 0; y < height; y++) {
                const row: string[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(newData[y * width + x] ?? "Empty");
                }
                const padding = new Array<string>(change).fill(fillColor);
                if (direction === "right") {
                    rows.push([...row, ...padding]);
                } else {
                    rows.push([...padding, ...row]);
                }
            }
            newData = rows.flat();
        } else {
            // 收缩宽度
            const shrink = Math.min(-change, width - 1);
            if (shrink <= 0) {
                return { width, data };
            }
            newWidth = ensureMin(width - shrink);

            const rows: string[][] = [];
            for (let y = 0; y < height; y++) {
                const row: string[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(newData[y * width + x] ?? "Empty");
                }

                let sliced: string[];
                if (direction === "right") {
                    sliced = row.slice(0, newWidth);
                } else {
                    // 从左侧裁掉 shrink 列
                    sliced = row.slice(shrink, shrink + newWidth);
                }
                rows.push(sliced);
            }
            newData = rows.flat();
        }
    } else {
        // 垂直方向调整高度
        const change = deltaUnits;
        if (change === 0) {
            return { width, data };
        }

        if (change > 0) {
            // 扩展高度
            newHeight = height + change;
            const rows: string[][] = [];
            for (let y = 0; y < height; y++) {
                const row: string[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(newData[y * width + x] ?? "Empty");
                }
                rows.push(row);
            }

            const paddingRow = new Array<string>(width).fill(fillColor);
            const paddingRows: string[][] = new Array(change)
                .fill(null)
                .map(() => [...paddingRow]);

            if (direction === "bottom") {
                newData = [...rows.flat(), ...paddingRows.flat()];
            } else {
                newData = [...paddingRows.flat(), ...rows.flat()];
            }
        } else {
            // 收缩高度
            const shrink = Math.min(-change, height - 1);
            if (shrink <= 0) {
                return { width, data };
            }
            newHeight = ensureMin(height - shrink);

            const rows: string[][] = [];
            for (let y = 0; y < height; y++) {
                const row: string[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(newData[y * width + x] ?? "Empty");
                }
                rows.push(row);
            }

            let slicedRows: string[][];
            if (direction === "bottom") {
                slicedRows = rows.slice(0, newHeight);
            } else {
                // 从顶部裁掉 shrink 行
                slicedRows = rows.slice(shrink, shrink + newHeight);
            }
            newData = slicedRows.flat();
        }
    }

    return {
        width: newWidth,
        data: newData,
    };
}
