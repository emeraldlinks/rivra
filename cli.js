#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

if (args[0] === "init") {
  const foldersToCopy = ["rcomponents", "pages"]; // folders to copy
  const srcDir = path.join(__dirname, "src"); // package src folder
  const targetDir = path.join(process.cwd(), "src"); // user project src folder

  foldersToCopy.forEach((folder) => {
    const from = path.join(srcDir, folder);
    const to = path.join(targetDir, folder);

    // Make sure target folder exists
    fs.mkdirSync(to, { recursive: true });

    // Copy all files recursively
    function copyRecursive(src, dest) {
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destPath);
        } else if (entry.isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    copyRecursive(from, to);
    console.log(`${folder} copied to src/${folder}`);
  });
} else {
  console.log("Unknown command. Use `ripple-tooling init`");
}
