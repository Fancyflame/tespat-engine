import { Stack, Button, Group, Divider } from "@mantine/core";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import { useProject } from "../../ProjectData";
import { PatternRulesSection } from "./PatternRulesSection";
import { CellSection } from "./CellSection";

export const Sidebar = () => {
    const { project, setProject } = useProject();

    return (
        <Stack p="md" h="100%">
            <CellSection />
            <PatternRulesSection />

            <Divider />
            <Group gap="xs" mt="auto">
                <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconPlayerPlayFilled size={14} />}
                >
                    播放生成
                </Button>
            </Group>
        </Stack>
    );
};
