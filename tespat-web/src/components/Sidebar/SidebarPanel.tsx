import { Box, Group, ScrollArea, Text } from "@mantine/core";
import type { ReactNode } from "react";
import styles from "./SidebarLayout.module.css";

type SidebarPanelProps = {
    title: ReactNode;
    rightAction?: ReactNode;
    children: ReactNode;
};

// SidebarPanel 负责固定标题区与独立滚动的内容区
export function SidebarPanel({
    title,
    rightAction,
    children,
}: SidebarPanelProps) {
    return (
        <Box className={styles.panel}>
            <Group
                justify="space-between"
                align="center"
                wrap="nowrap"
                gap="xs"
                className={styles.panelHeader}
                mt="xs"
            >
                <Text
                    size="xs"
                    fw={900}
                    c="dimmed"
                    className={styles.panelTitle}
                >
                    {title}
                </Text>
                {rightAction}
            </Group>

            <Box className={styles.panelBody}>
                <ScrollArea h="100%" type="auto" offsetScrollbars="y">
                    <Box className={styles.panelScrollContent}>{children}</Box>
                </ScrollArea>
            </Box>
        </Box>
    );
}
