import { readFile } from "node:fs/promises";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

const packageJson = await readJson("package.json");
const packageLock = await readJson("package-lock.json");
const claudeManifest = await readJson("plugin/.claude-plugin/plugin.json");
const codexManifest = await readJson("plugin/.codex-plugin/plugin.json");
const codexMarketplace = await readJson(".agents/plugins/marketplace.json");

const versions = new Map([
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json packages['']", packageLock.packages?.[""]?.version],
  ["Claude plugin manifest", claudeManifest.version],
  ["Codex plugin manifest", codexManifest.version],
  ["Codex marketplace", codexMarketplace.plugins?.[0]?.version],
]);

const expected = packageJson.version;
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const invalid = [...versions].filter(([, version]) => !semver.test(version ?? ""));
const mismatches = [...versions].filter(([, version]) => version !== expected);

if (invalid.length > 0 || mismatches.length > 0) {
  for (const [source, version] of versions) {
    console.error(`${source}: ${version ?? "<missing>"}`);
  }
  process.exitCode = 1;
} else if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== `v${expected}`) {
  console.error(`Tag ${process.env.GITHUB_REF_NAME} does not match plugin version v${expected}.`);
  process.exitCode = 1;
} else {
  console.log(`Plugin versions are aligned on ${expected}.`);
}
