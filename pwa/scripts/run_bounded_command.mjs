#!/usr/bin/env node
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const separator = args.indexOf("--");
const timeoutIndex = args.indexOf("--timeout-seconds");
if (separator < 0 || timeoutIndex < 0 || timeoutIndex + 1 >= separator || separator === args.length - 1) {
  console.error("usage: run_bounded_command.mjs --timeout-seconds <seconds> -- <command> [args...]");
  process.exit(64);
}

const timeoutSeconds = Number(args[timeoutIndex + 1]);
if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600) {
  console.error("timeout must be between 1 and 3600 seconds");
  process.exit(64);
}

const command = args[separator + 1];
const commandArgs = args.slice(separator + 2);
const child = spawn(command, commandArgs, { stdio: "inherit", env: process.env });
let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
}, timeoutSeconds * 1000);

child.on("error", (error) => {
  clearTimeout(timer);
  console.error(error.message);
  process.exit(127);
});
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  if (timedOut) {
    console.error(`command timed out after ${timeoutSeconds}s`);
    process.exit(124);
  }
  if (signal) {
    console.error(`command terminated by ${signal}`);
    process.exit(128);
  }
  process.exit(code ?? 1);
});
