import {
    IconPlayerPlay,
    IconPlayerSkipBack,
    IconPlayerSkipForward,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 w-[min(600px,calc(100%-3rem))] -translate-x-1/2">
            <div className="pointer-events-auto rounded-[20px] border border-slate-700 bg-slate-900/85 px-6 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <div className="relative flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Button
                            size="icon-lg"
                            variant="subtle"
                            className="rounded-full text-emerald-100"
                            disabled
                        >
                            <IconPlayerPlay size={18} fill="currentColor" />
                        </Button>
                        <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full"
                            onClick={onPrev}
                            disabled={disableStepControls}
                        >
                            <IconPlayerSkipBack size={18} />
                        </Button>
                        <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full"
                            onClick={onNext}
                            disabled={disableStepControls}
                        >
                            <IconPlayerSkipForward size={18} />
                        </Button>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <div className="mb-1 flex items-center justify-between gap-3">
                            <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400">
                            EVOLUTION TIMELINE
                            </p>
                            <p className="font-mono text-[10px] text-slate-200">
                            STEP: {displayCurrentStep} / {totalSteps}
                            </p>
                        </div>
                        <Slider
                            min={0}
                            max={sliderMax}
                            step={1}
                            value={[safeStep]}
                            onValueChange={(values) =>
                                onStepChange(values[0] ?? 0)
                            }
                            disabled={disableStepControls}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
