import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  check_sandbox,
  opam,
  opam_root,
  project_root,
  repository_url,
  run,
  tool_environment,
} from "./opam.mjs";

const package_manifest = JSON.parse(
  readFileSync(resolve(project_root, "package.json"), "utf8"),
);
if (process.versions.node !== package_manifest.engines.node) {
  throw new Error(
    `Use Node ${package_manifest.engines.node}; received ${process.versions.node}`,
  );
}
if (run("npm", ["--version"], true) !== package_manifest.engines.npm) {
  throw new Error(
    `Use npm ${package_manifest.engines.npm}, bundled with the pinned Node release`,
  );
}
if (run("opam", ["--version"], true) !== "2.6.1") {
  throw new Error("Install opam 2.6.1 before bootstrapping");
}
if (!["darwin", "linux"].includes(process.platform)) {
  throw new Error(
    "This bootstrap supports macOS and Linux with the default opam sandbox",
  );
}
for (const command of [
  "git",
  "cc",
  "make",
  "curl",
  "tar",
  "unzip",
  "patch",
  "pkg-config",
  "rsync",
  process.platform === "darwin" ? "sandbox-exec" : "bwrap",
]) {
  run("which", [command], true);
}
if (
  !/^git\+https:\/\/github\.com\/ocaml\/opam-repository\.git#[0-9a-f]{40}$/.test(
    repository_url,
  )
) {
  throw new Error("Expected an immutable official opam repository revision");
}
const lock_files = [
  "package-lock.json",
  "city_of_vice.opam.locked",
  "toolchain/opam-repository.rev",
];
const identities = lock_files.map((file) => {
  const content = readFileSync(resolve(project_root, file));
  if (content.length === 0) throw new Error(`Empty lock input: ${file}`);
  return createHash("sha256").update(content).digest("hex");
});
if (
  /pin-depends:/.test(
    readFileSync(resolve(project_root, "city_of_vice.opam.locked"), "utf8"),
  )
) {
  throw new Error("The dependency lock must not contain machine-local pins");
}

mkdirSync(tool_environment.TMPDIR, { recursive: true });
if (!existsSync(resolve(opam_root, "config"))) {
  // Refuse confirmations so a failed sandbox probe can never auto-disable it.
  opam([
    "init",
    "--bare",
    "--no-setup",
    "--no-opamrc",
    "--confirm-level=no",
    "default",
    repository_url,
  ]);
}
check_sandbox();
// opam init can keep a failed sandbox enabled and still return success.
// Require its default hook to launch before creating a switch or building.
run("env", [
  `OPAM_SWITCH_PREFIX=${resolve(project_root, "_opam")}`,
  resolve(opam_root, "opam-init/hooks/sandbox.sh"),
  "build",
  "true",
]);
// Report missing system dependencies; never invoke a system package installer.
opam(["option", "--global", "depext-run-installs=false"]);
if (!existsSync(resolve(project_root, "_opam/.opam-switch/switch-config"))) {
  opam(["switch", "create", project_root, "--empty", "--no-install", "--yes"]);
}
opam([
  "install",
  "./city_of_vice.opam",
  "--deps-only",
  "--locked",
  "--yes",
  "--jobs=1",
  "--require-checksums",
  "--working-dir",
]);
run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
check_sandbox();
for (const [index, file] of lock_files.entries()) {
  const actual = createHash("sha256")
    .update(readFileSync(resolve(project_root, file)))
    .digest("hex");
  if (actual !== identities[index])
    throw new Error(`Bootstrap changed lock input: ${file}`);
}
console.log(
  "Locked development dependencies installed; browser installation is a separate command.",
);
