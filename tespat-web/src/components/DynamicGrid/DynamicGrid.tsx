import React from "react";
import { Box } from "@mantine/core";
import styles from "./DynamicGrid.module.css";

export type CellState =
    | "Wildcard"
    | "Empty"
    | "Slime"
    | "Apple"
    | "SatiatedSlime";

interface Props {
    width: number;
    height: number;
    data: string[];
    onCellClick?: (index: number) => void;
    cellSize?: number;
}

export const DynamicGrid: React.FC<Props> = ({
    width,
    height,
    data,
    onCellClick,
    cellSize = 28,
}) => {
    return (
        <Box
            className={styles.grid}
            style={{
                gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
                gap: "4px",
            }}
        >
            {data.map((state, i) => (
                <div
                    key={i}
                    onClick={() => onCellClick?.(i)}
                    className={`${styles.cell} ${styles[`state-${state}`]}`}
                    style={{ width: cellSize, height: cellSize }}
                />
            ))}
        </Box>
    );
};
