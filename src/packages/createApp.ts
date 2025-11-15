import fs from "fs";
import path from "path";

export async function createApp(name: string) {
  const dest = path.resolve(process.cwd(), name);

  if (fs.existsSync(dest)) {
    console.log(`❌ Folder '${name}' already exists.`);
    return;
  }

  fs.mkdirSync(dest);

  // Copy template (you can adjust this)
  const templateDir = path.resolve(__dirname, "../../templates/app");

  if (fs.existsSync(templateDir)) {
    for (const file of fs.readdirSync(templateDir)) {
      fs.copyFileSync(
        path.join(templateDir, file),
        path.join(dest, file)
      );
    }
  }

  console.log(`🎉 Rivra project '${name}' created.`);
}
