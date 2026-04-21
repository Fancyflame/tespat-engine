import { Stack, Button, Group, Divider } from "@mantine/core";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import { useWorkspaceActions } from "../../Workspace";
import { PatternRulesSection } from "./PatternRulesSection";
import { PaletteSection } from "./PaletteSection";
import { SidebarSplitPane } from "./SidebarSplitPane";
import styles from "./SidebarLayout.module.css";

export const Sidebar = () => {
    const actions = useWorkspaceActions();

    return (
        <Stack p="md" h="100%" gap="md" className={styles.sidebarRoot}>
            <SidebarSplitPane
                top={<PaletteSection />}
                bottom={<PatternRulesSection />}
            />

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
