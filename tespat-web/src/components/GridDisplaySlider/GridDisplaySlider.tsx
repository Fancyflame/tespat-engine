import {
    ActionIcon,
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

interface GridDisplaySliderProps {
    currentStep: number;
    totalSteps: number;
    onStepChange: (step: number) => void;
    onPrev: () => void;
    onNext: () => void;
    disabled?: boolean;
}

export default function GridDisplaySlider({
    currentStep,
    totalSteps,
    onStepChange,
    onPrev,
    onNext,
    disabled = false,
}: GridDisplaySliderProps) {
    const hasSteps = totalSteps > 0;
    const sliderMax = Math.max(totalSteps - 1, 0);
    const safeStep = hasSteps
        ? Math.min(Math.max(currentStep, 0), sliderMax)
        : 0;
    const displayCurrentStep = hasSteps ? safeStep + 1 : 0;
    const disableStepControls = disabled || sliderMax === 0;

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
                        disabled
                    >
                        <IconPlayerPlay size={18} fill="currentColor" />
                    </ActionIcon>
                    <ActionIcon
                        size="md"
                        radius="xl"
                        variant="default"
                        onClick={onPrev}
                        disabled={disableStepControls}
                    >
                        <IconPlayerSkipBack size={18} />
                    </ActionIcon>
                    <ActionIcon
                        size="md"
                        radius="xl"
                        variant="default"
                        onClick={onNext}
                        disabled={disableStepControls}
                    >
                        <IconPlayerSkipForward size={18} />
                    </ActionIcon>
                </Group>
                <Stack align="stretch" justify="center" gap={0} flex={1}>
                    <Group justify="space-between" mb={4}>
                        <Text size="10px" fw={700} c="dimmed">
                            EVOLUTION TIMELINE
                        </Text>
                        <Text size="10px" ff="monospace">
                            STEP: {displayCurrentStep} / {totalSteps}
                        </Text>
                    </Group>
                    <Slider
                        size="sm"
                        radius="xl"
                        min={0}
                        max={sliderMax}
                        value={safeStep}
                        onChange={onStepChange}
                        disabled={disableStepControls}
                    />
                </Stack>
            </Group>
        </Paper>
    );
}
