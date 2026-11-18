import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const payload = JSON.parse(readFileSync(0, "utf-8"));
const patch = payload.tool_input?.command;

if (payload.tool_name === "apply_patch" && typeof patch === "string") {
  // Codex paths are relative to the session, while Ultracite runs in frontend.
  payload.tool_input.command = patch.replaceAll(
    /^(?<prefix>\*\*\* (?:Add File|Update File|Move to): )(?<file>.+)$/gmu,
    (_, prefix, file) => `${prefix}${path.resolve(payload.cwd, file)}`
  );

  const result = spawnSync("pnpm", ["exec", "ultracite", "fix", "--hook"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    input: JSON.stringify(payload),
    shell: process.platform === "win32",
    stdio: ["pipe", "inherit", "inherit"],
  });

  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}
