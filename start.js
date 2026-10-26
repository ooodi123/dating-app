// Точка входа для хостинга (Bothost и др.): `npm install` собирает всё через postinstall,
// затем запускается этот файл.
const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`Нужен Node.js 20 или новее, сейчас ${process.version}. Выберите версию Node в настройках хостинга.`);
  process.exit(1);
}

const { existsSync } = await import("node:fs");
if (!existsSync(new URL("./server/dist/index.js", import.meta.url))) {
  // Хостинг не запустил npm install в корне — собираем сами (один раз, займёт пару минут)
  console.log("Сборка приложения…");
  const { execSync } = await import("node:child_process");
  execSync("npm run setup", { stdio: "inherit", cwd: new URL(".", import.meta.url) });
}

await import("./server/dist/index.js");
