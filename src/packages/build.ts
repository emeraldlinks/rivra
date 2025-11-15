import { build } from "vite";

export async function buildProject() {
  console.log("📦 Building Rivra project...");
  await build();
  console.log("✅ Build completed.");
}
