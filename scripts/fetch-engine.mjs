import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const files = [
  {
    url: "https://silentspacemarine.com/websockets-doom.js",
    out: "public/vendor/doom/websockets-doom.js"
  },
  {
    url: "https://silentspacemarine.com/websockets-doom.wasm",
    out: "public/vendor/doom/websockets-doom.wasm"
  }
];

for (const file of files) {
  await download(file.url, file.out);
}

await writeFile(
  "public/vendor/doom/SOURCE.txt",
  [
    "Engine artifact source",
    "",
    "Downloaded from Cloudflare's public Silent Space Marine demo:",
    "https://silentspacemarine.com/",
    "",
    "Upstream source repositories:",
    "https://github.com/cloudflare/doom",
    "https://github.com/cloudflare/doom-wasm",
    "",
    "This project uses these prebuilt files for the first runnable MVP.",
    "For a production distribution, build the WebAssembly artifact from source",
    "with the matching Emscripten toolchain and publish build instructions."
  ].join("\n")
);

console.log("Engine files ready in public/vendor/doom");

async function download(url, out) {
  await mkdir(dirname(out), { recursive: true });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  const tmp = `${out}.tmp`;
  const body = Buffer.from(await response.arrayBuffer());
  await writeFile(tmp, body);
  await rename(tmp, out);

  console.log(`Downloaded ${url} -> ${join(process.cwd(), out)}`);
}
