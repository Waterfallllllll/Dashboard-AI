import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const entry = process.argv[2];

if (!entry) {
  process.stderr.write("Нужен путь к файлу.\n");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve("tsx/cli"), "watch", entry], {
  // На Windows tsx watch вместе с concurrently держит чтение stdin.
  // Общий pipe блокирует импорт googleapis, и процесс не доходит до listen.
  stdio: ["ignore", "inherit", "inherit"]
});

child.on("error", () => {
  process.stderr.write("Не удалось запустить tsx.\n");
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 1);
});
