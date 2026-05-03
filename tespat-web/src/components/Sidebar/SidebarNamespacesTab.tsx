import { Box, Text } from "@mantine/core";
import styles from "./SidebarLayout.module.css";

// SidebarNamespacesTab 承载命名空间结构树页
export const SidebarNamespacesTab = () => {
    return (
        <Box className={styles.treePlaceholder}>
            <Text size="xs" fw={900} c="dimmed" lts="0.1em">
                结构树
            </Text>
            <Text size="sm" c="dimmed">
                暂未配置命名空间
            </Text>
        </Box>
    );
};
