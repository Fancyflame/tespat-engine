// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css"; // 必须引入 Mantine 的核心样式
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import App from "./App";
import "./index.css";
import { ProjectProvider } from "./ProjectData";
import { EditorProvider } from "./EditorData";
import { FileSyncProvider } from "./FileSyncContext";

const theme = createTheme({
    primaryColor: "blue",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <MantineProvider theme={theme} defaultColorScheme="dark">
            <Notifications position="top-right" zIndex={2000} />
            <ProjectProvider>
                <EditorProvider>
                    <FileSyncProvider>
                        <App />
                    </FileSyncProvider>
                </EditorProvider>
            </ProjectProvider>
        </MantineProvider>
    </React.StrictMode>,
);
