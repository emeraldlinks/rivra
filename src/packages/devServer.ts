import { StartServer } from "../../packages/server";

export async function startDevServer() {
  console.log("🔧 Starting Rivra dev server...");
  await StartServer({ dev: true });
}
