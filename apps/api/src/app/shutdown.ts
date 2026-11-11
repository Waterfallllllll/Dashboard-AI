import type { Server } from "node:http";

import type { Logger } from "../infrastructure/logging/logger.js";

export function installShutdown(input: {
  server: Server;
  closeStorage: () => Promise<void>;
  logger: Logger;
}): void {
  let closing = false;

  const shutdown = (signal: string): void => {
    if (closing) {
      return;
    }

    closing = true;
    input.logger.info({ signal }, "Останавливаем API");
    input.server.close(() => {
      void input.closeStorage().then(
        () => {
          process.exit(0);
        },
        () => {
          process.exit(1);
        }
      );
    });
  };

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
}
