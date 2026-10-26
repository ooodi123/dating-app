// Точка входа для хостинга (Bothost и др.): `npm install` собирает всё через postinstall,
// затем запускается этот файл.
const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`Нужен Node.js 20 или новее, сейчас ${process.version}. Выберите версию Node в настройках хостинга.`);
  process.exit(1);
}

const { builtHash, sourceHash } = await import("./build-stamp.js");
const version = sourceHash();
if (builtHash() !== version) {
  // Сборки нет или она от старого кода (хостинг не запустил npm install) — собираем сами, займёт пару минут
  console.log("Сборка приложения…");
  const { execSync } = await import("node:child_process");
  execSync("npm run setup", { stdio: "inherit", cwd: new URL(".", import.meta.url) });
}
console.log(`Версия кода: ${version}`);

await import("./server/dist/index.js");
