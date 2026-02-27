import { useState, type ReactNode } from "react";
import { Box, Group, Text, ActionIcon, Collapse } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";

type CollapsibleSectionProps = {
    title: ReactNode;
    rightAction?: ReactNode;
    children: ReactNode;
    defaultOpened?: boolean;
};

export const CollapsibleSection = ({
    title,
    rightAction,
    children,
    defaultOpened = true,
}: CollapsibleSectionProps) => {
    const [opened, setOpened] = useState(defaultOpened);

    const toggle = () => setOpened((prev) => !prev);

    return (
        <Box>
            <Group
                justify="space-between"
                gap="xs"
                onClick={toggle}
                style={{ cursor: "pointer" }}
            >
                <Group gap="xs">
                    <ActionIcon variant="subtle" size="sm">
                        {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    </ActionIcon>
                    <Text size="xs" fw={900} c="dimmed" lts="0.1em" style={{ userSelect: "none" }}  >
                        {title}
                    </Text>
                </Group>
                {rightAction}
            </Group>
            <Collapse in={opened} mt="xs">{children}</Collapse>
        </Box>
    );
};

