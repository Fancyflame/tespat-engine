import { Stack, Button, Group, Divider, ScrollArea, Box } from "@mantine/core";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import { useWorkspaceActions } from "../../Workspace";
import { PatternRulesSection } from "./PatternRulesSection";
import { PaletteSection } from "./PaletteSection";

export const Sidebar = () => {
    const actions = useWorkspaceActions();

    return (
        <Stack p="md" h="100%" style={{ minHeight: 0 }}>
            <Box style={{ flex: 1, minHeight: 0 }}>
                <ScrollArea h="100%" type="auto" offsetScrollbars="y">
                    <Stack gap="md">
                        <PaletteSection />
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
                    onClick={actions.openPlayback}
                >
                    回放录制
                </Button>
            </Group>
        </Stack>
    );
};
