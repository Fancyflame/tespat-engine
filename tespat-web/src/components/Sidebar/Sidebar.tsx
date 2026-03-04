import { Stack, Button, Group, Divider, ScrollArea, Box } from "@mantine/core";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import { useProject } from "../../ProjectData";
import { PatternRulesSection } from "./PatternRulesSection";
import { ColorSection } from "./ColorSection";

export const Sidebar = () => {
    return (
        <Stack p="md" h="100%" style={{ minHeight: 0 }}>
            <Box style={{ flex: 1, minHeight: 0 }}>
                <ScrollArea h="100%" type="auto" offsetScrollbars="y">
                    <Stack gap="md">
                        <ColorSection />
                        <PatternRulesSection />
                    </Stack>
                </ScrollArea>
            </Box>

            <Divider style={{ flexShrink: 0 }} />
            <Group gap="xs" style={{ flexShrink: 0 }}>
                <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconPlayerPlayFilled size={14} />}
                >
                    回放录制
                </Button>
            </Group>
        </Stack>
    );
};
