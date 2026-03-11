import { Box, Center, Stack, Title, Text } from "@mantine/core";
import { IconGridPattern } from "@tabler/icons-react";
import styles from "../App.module.css";

/** 主舞台 - 欢迎模式：无可拖拽的欢迎页 */
export function WelcomeStage() {
    return (
        <Box className={styles.UIStack}>
            <Box className={styles.canvasStage}>
                <Box className={styles.canvasPlaceholder}>
                    <Welcome />
                </Box>
            </Box>
        </Box>
    );
}

function Welcome() {
    return (
        <Center h="100%" w="100%">
            <Stack align="center" gap="md">
                <IconGridPattern
                    size={64}
                    stroke={1.5}
                    color="var(--mantine-color-gray-5)"
                />
                <Title order={2} c="gray.4" fw={500}>
                    欢迎使用 TESPAT 编辑器
                </Title>
                <Text size="sm" c="gray.5" ta="center" maw={320}>
                    从左侧选择一个规则，选择一个颜色，即刻开始编辑捕获与替换
                </Text>
            </Stack>
        </Center>
    );
}
