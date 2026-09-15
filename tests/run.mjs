import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
const jiti = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
  fsCache: false,
});
await jiti.import("./core.test.ts");
