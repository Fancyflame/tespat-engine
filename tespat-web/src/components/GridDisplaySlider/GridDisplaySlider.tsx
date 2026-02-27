import {
    ActionIcon,
    Box,
    Center,
    Group,
    Paper,
    Slider,
    Stack,
    Text,
} from "@mantine/core";
import {
    IconPlayerPlay,
    IconPlayerSkipBack,
    IconPlayerSkipForward,
} from "@tabler/icons-react";
import styles from "./GridDisplaySlider.module.css";

export default function GridDisplaySlider() {
    return (
        <Paper
            radius="lg"
            p="lg"
            mx="xl"
            my="sm"
            shadow="sm"
            className={styles.gridDisplaySlider}
        >
            <Group gap="xl" align="center" pos="relative">
                <Group gap="xs">
                    <ActionIcon
                        size="lg"
                        radius="xl"
                        color="green"
                        variant="filled"
                    >
                        <IconPlayerPlay size={18} fill="currentColor" />
                    </ActionIcon>
                    <ActionIcon size="md" radius="xl" variant="default">
                        <IconPlayerSkipBack size={18} />
                    </ActionIcon>
                    <ActionIcon size="md" radius="xl" variant="default">
                        <IconPlayerSkipForward size={18} />
                    </ActionIcon>
                </Group>
                <Stack align="stretch" justify="center" gap={0} flex={1}>
                    <Group justify="space-between" mb={4}>
                        <Text size="10px" fw={700} c="dimmed">
                            EVOLUTION TIMELINE
                        </Text>
                        <Text size="10px" ff="monospace">
                            STEP: 000 / 256
                        </Text>
                    </Group>
                    <Slider size="sm" radius="xl" defaultValue={100} />
                </Stack>
            </Group>
        </Paper>
    );
}
