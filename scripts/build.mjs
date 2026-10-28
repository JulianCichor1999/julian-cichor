import { mkdir, cp, copyFile, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await copyFile("index.html", "dist/index.html");
await cp("assets", "dist/assets", { recursive: true });
await copyFile("_routes.json", "dist/_routes.json");
await writeFile(
  "dist/_headers",
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n",
);
console.log("Gotowe: dist/ zawiera wyłącznie publiczne pliki strony.");
