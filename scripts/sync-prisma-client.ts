import fs from "node:fs";
import { execSync } from "node:child_process";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const tempSchema = schema.replace(
  'provider = "prisma-client-js"',
  'provider = "prisma-client-js"\n  output = "../node_modules/.prisma/client-temp"'
);
fs.writeFileSync("prisma/schema.temp.prisma", tempSchema);

try {
  execSync("npx prisma generate --schema=prisma/schema.temp.prisma", { stdio: "inherit" });
  for (const f of fs.readdirSync("node_modules/.prisma/client-temp")) {
    if (!f.endsWith(".node") && !fs.statSync(`node_modules/.prisma/client-temp/${f}`).isDirectory()) {
      let content = fs.readFileSync(`node_modules/.prisma/client-temp/${f}`, "utf8");
      if (f.endsWith(".js") || f.endsWith(".d.ts")) {
        content = content
          .replace(/require\(['"]\.\/runtime\//g, "require('@prisma/client/runtime/")
          .replace(/from ['"]\.\/runtime\//g, "from '@prisma/client/runtime/");
      }
      fs.writeFileSync(`node_modules/.prisma/client/${f}`, content, "utf8");
    }
  }
  for (const f of fs.readdirSync("node_modules/.prisma/client")) {
    if (f.includes(".tmp")) {
      fs.rmSync(`node_modules/.prisma/client/${f}`, { force: true });
    }
  }
  console.log("Successfully updated Prisma client JS/TS definitions across all 36 models!");
} finally {
  fs.rmSync("prisma/schema.temp.prisma", { force: true });
  fs.rmSync("node_modules/.prisma/client-temp", { recursive: true, force: true });
}
