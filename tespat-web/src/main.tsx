// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css"; // 必须引入 Mantine 的核心样式
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";
import App from "./App";
import "./index.css";
import { WorkspaceProvider } from "./Workspace";

const theme = createTheme({
    primaryColor: "blue",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <MantineProvider theme={theme} defaultColorScheme="dark">
            <Notifications position="top-right" zIndex={2000} />
            <WorkspaceProvider>
                <App />
            </WorkspaceProvider>
        </MantineProvider>
    </React.StrictMode>,
);
