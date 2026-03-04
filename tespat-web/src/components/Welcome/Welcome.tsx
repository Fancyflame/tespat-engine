import { Center, Stack, Text, Title } from "@mantine/core";
import { IconGridPattern } from "@tabler/icons-react";

export default function Welcome() {
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
                    从左侧选择一个 pattern ，选择一个颜色，即刻开始编辑
                </Text>
            </Stack>
        </Center>
    );
}
