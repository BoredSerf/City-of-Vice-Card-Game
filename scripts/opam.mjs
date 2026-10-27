import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const project_root = fileURLToPath(new URL("..", import.meta.url));
export const opam_root = resolve(project_root, ".tools/opam-root");
export const repository_url =
  "git+https://github.com/ocaml/opam-repository.git#" +
  readFileSync(
    resolve(project_root, "toolchain/opam-repository.rev"),
    "utf8",
  ).trim();

// Do not inherit an unrelated switch, custom downloader, or checksum override.
export const tool_environment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("OPAM")),
);
Object.assign(tool_environment, {
  OPAMROOT: opam_root,
  OPAMSWITCH: project_root,
  OPAMJOBS: "1",
  OPAMNOSELFUPGRADE: "1",
  OPAMREQUIRECHECKSUMS: "1",
  DUNEJOBS: "1",
  DUNE_CACHE_ROOT: resolve(project_root, ".cache/dune"),
  XDG_CACHE_HOME: resolve(project_root, ".cache"),
  npm_config_cache: resolve(project_root, ".cache/npm"),
  TMPDIR: resolve(project_root, ".cache/tmp"),
});

export function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: project_root,
    env: tool_environment,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr ?? "");
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
  }
  return result.stdout?.trim();
}

export function opam(args, capture = false) {
  return run(
    "opam",
    [args[0], "--cli=2.5", "--no-self-upgrade", ...args.slice(1)],
    capture,
  );
}

export function check_sandbox() {
  const config = readFileSync(resolve(opam_root, "config"), "utf8");
  if (!/^repositories: "default"$/m.test(config)) {
    throw new Error(
      "Only the committed official opam repository may be selected",
    );
  }
  for (const operation of ["build", "install", "remove"]) {
    const expected = new RegExp(
      `wrap-${operation}-commands:\\s*\\["%\\{hooks\\}%/sandbox\\.sh" "${operation}"\\] \\{os = "linux" \\| os = "macos"\\}`,
    );
    if (!expected.test(config)) {
      throw new Error(`Missing default opam ${operation} sandbox wrapper`);
    }
  }
  const hook = readFileSync(
    resolve(opam_root, "opam-init/hooks/sandbox.sh"),
    "utf8",
  );
  if (
    !hook.includes(
      process.platform === "darwin" ? "exec sandbox-exec" : "exec bwrap",
    )
  ) {
    throw new Error("Missing platform opam sandbox hook");
  }
  const repositories = readFileSync(
    resolve(opam_root, "repo/repos-config"),
    "utf8",
  );
  const expected_repositories = `opam-version: "2.0"\nrepositories:\n  "default"\n    {"${repository_url}"}`;
  if (repositories.trim() !== expected_repositories) {
    throw new Error(
      "Unexpected opam repository; remove the local .tools root and bootstrap again",
    );
  }
  const revision = run(
    "git",
    ["-C", resolve(opam_root, "repo/default"), "rev-parse", "HEAD"],
    true,
  );
  if (!repository_url.endsWith(`#${revision}`)) {
    throw new Error(
      "opam repository checkout differs from the committed revision",
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  mkdirSync(tool_environment.TMPDIR, { recursive: true });
  check_sandbox();
  opam(["exec", "--", ...process.argv.slice(2)]);
}
