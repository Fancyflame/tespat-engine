import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";
import { WorkspaceProvider } from "./Workspace";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <WorkspaceProvider>
            <App />
            <Toaster
                position="top-right"
                theme="dark"
                richColors
                toastOptions={{
                    classNames: {
                        toast: "border border-white/10 bg-slate-900 text-slate-50 shadow-2xl",
                        title: "text-slate-50",
                        description: "text-slate-300",
                    },
                }}
            />
        </WorkspaceProvider>
    </React.StrictMode>,
);
