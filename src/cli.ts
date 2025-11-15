#!/usr/bin/env node
import { Command } from "commander";
import { createApp } from "./packages/createApp";
import { startDevServer } from "./packages/devServer";
import { buildProject } from "./packages/build";
import pkg from "../package.json" assert { type: "json" };

const program = new Command();

program
  .name("rivra")
  .description("Rivra — Full-stack Ripple framework CLI")
  .version(pkg.version);

// -----------------------
// rivra create <name>
// -----------------------
program
  .command("create")
  .argument("<name>")
  .description("Create a new Rivra project")
  .action(async (name: string) => {
    await createApp(name);
  });

// -----------------------
// rivra dev
// -----------------------
program
  .command("dev")
  .description("Start Rivra dev server")
  .action(async () => {
    await startDevServer();
  });

// -----------------------
// rivra build
// -----------------------
program
  .command("build")
  .description("Build production bundle")
  .action(async () => {
    await buildProject();
  });

program.parse(process.argv);
