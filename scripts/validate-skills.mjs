import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const skillsDir = new URL("../plugin/skills/", import.meta.url);
const allowedProperties = new Set(["name", "description", "license", "allowed-tools", "metadata"]);
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseFrontmatter(source) {
  const fields = new Map();
  let currentKey;

  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }

    const field = line.match(/^([A-Za-z0-9-]+):(?:\s*(.*))?$/);
    if (field) {
      const [, key, value = ""] = field;
      if (fields.has(key)) {
        throw new Error(`duplicate frontmatter key: ${key}`);
      }
      fields.set(key, value);
      currentKey = key;
      continue;
    }

    if (/^\s+/.test(line) && currentKey) {
      fields.set(currentKey, `${fields.get(currentKey)}\n${line.trim()}`);
      continue;
    }

    throw new Error(`malformed frontmatter line: ${line}`);
  }

  return fields;
}

function scalarValue(value) {
  const trimmed = value.trim();
  if (/^[>|][+-]?(?:\n|$)/.test(trimmed)) {
    return trimmed.replace(/^[>|][+-]?\n?/, "").replace(/\n/g, " ").trim();
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function validateFrontmatter(content, directoryName) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return ["missing or malformed YAML frontmatter"];
  }

  let frontmatter;
  try {
    frontmatter = parseFrontmatter(match[1]);
  } catch (error) {
    return [error.message];
  }

  const errors = [];
  const unexpected = [...frontmatter.keys()].filter((key) => !allowedProperties.has(key));
  if (unexpected.length > 0) {
    errors.push(`unsupported frontmatter key(s): ${unexpected.sort().join(", ")}`);
  }

  const name = scalarValue(frontmatter.get("name") ?? "");
  const description = scalarValue(frontmatter.get("description") ?? "");
  if (name === "") {
    errors.push("name must be a non-empty string");
  } else {
    if (!namePattern.test(name) || name.length > 64) {
      errors.push("name must be at most 64 characters using lowercase letters, digits, and single hyphens");
    }
    if (name !== directoryName) {
      errors.push(`name '${name}' must match its directory '${directoryName}'`);
    }
  }

  if (description === "") {
    errors.push("description must be a non-empty string");
  } else {
    if (description.length > 1024) {
      errors.push("description must be at most 1024 characters");
    }
    if (/[<>]/.test(description)) {
      errors.push("description must not contain angle brackets");
    }
  }

  return errors;
}

const entries = await readdir(skillsDir, { withFileTypes: true });
const skillDirectories = entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
const failures = [];

for (const directory of skillDirectories) {
  const skillFile = new URL(`${directory.name}/SKILL.md`, skillsDir);
  let content;
  try {
    content = await readFile(skillFile, "utf8");
  } catch (error) {
    failures.push(`${path.join("plugin/skills", directory.name, "SKILL.md")}: ${error.code === "ENOENT" ? "file is missing" : error.message}`);
    continue;
  }

  for (const error of validateFrontmatter(content, directory.name)) {
    failures.push(`${path.join("plugin/skills", directory.name, "SKILL.md")}: ${error}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${skillDirectories.length} skill frontmatter files.`);
}
