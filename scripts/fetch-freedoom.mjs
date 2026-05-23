import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const version = "0.13.0";
const archive = `.cache/freedm-${version}.zip`;
const sourceWad = "freedm.wad";
const out = "public/assets/freedm.wad";
const url = `https://github.com/freedoom/freedoom/releases/download/v${version}/freedm-${version}.zip`;

await mkdir(dirname(archive), { recursive: true });
await mkdir(dirname(out), { recursive: true });

if (!existsSync(archive)) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  console.log(`Downloaded ${url}`);
}

const { stdout: listing } = await execFile("unzip", ["-Z1", archive], {
  maxBuffer: 1024 * 1024
});
const entry = listing
  .split("\n")
  .find((line) => line === sourceWad || line.endsWith(`/${sourceWad}`));

if (!entry) {
  throw new Error(`${sourceWad} was not found in the Freedoom archive`);
}

const { stdout: wad } = await execFile("unzip", ["-p", archive, entry], {
  encoding: "buffer",
  maxBuffer: 64 * 1024 * 1024
});

const tmp = `${out}.tmp`;
await writeFile(tmp, wad);
await rename(tmp, out);

console.log(`FreeDM ready at ${out}`);
