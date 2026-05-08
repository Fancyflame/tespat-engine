import type { ReactNode } from "react";
import { toast } from "sonner";

// 对齐原 Mantine notifications.show 的最小可用接口
type NotificationPayload = {
    title: string;
    message?: string;
    color?: string;
    icon?: ReactNode;
};

export const notifications = {
    show({ title, message, color, icon }: NotificationPayload) {
        const options = {
            description: message,
            icon,
        };

        if (color === "red") {
            toast.error(title, options);
            return;
        }

        if (color === "blue") {
            toast.info(title, options);
            return;
        }

        toast(title, options);
    },
};
