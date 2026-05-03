import { SidebarSplitPane } from "./SidebarSplitPane";
import { PaletteSection } from "./PaletteSection";
import { PatternRulesSection } from "./PatternRulesSection";

// SidebarEditorTab 承载编辑器页内容
export const SidebarEditorTab = () => {
    return (
        <SidebarSplitPane
            top={<PaletteSection />}
            bottom={<PatternRulesSection />}
        />
    );
};
