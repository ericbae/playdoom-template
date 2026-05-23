import { readFile, stat } from "node:fs/promises";

const checks = [
  ["public/vendor/doom/websockets-doom.js", assertJs],
  ["public/vendor/doom/websockets-doom.wasm", assertWasm],
  ["public/assets/freedm.wad", assertIwad],
  ["public/assets/maps.json", assertMaps],
  ["public/assets/map-previews/MAP08.svg", assertSvg],
  ["public/assets/map-shots/MAP08.png", assertPng],
  ["public/default.cfg", assertCfg]
];

for (const [file, assert] of checks) {
  const bytes = await readFile(file);
  const info = await stat(file);
  assert(bytes);
  console.log(`${file}: ${info.size.toLocaleString()} bytes`);
}

console.log("Asset verification passed");

function assertJs(bytes) {
  const text = bytes.toString("utf8", 0, Math.min(bytes.length, 4096));
  if (!text.includes("WebAssembly") && !text.includes("Module")) {
    throw new Error("Engine JavaScript does not look like an Emscripten build");
  }
}

function assertWasm(bytes) {
  if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error("Engine WASM has an invalid magic header");
  }
}

function assertIwad(bytes) {
  const header = bytes.toString("ascii", 0, 4);
  if (header !== "IWAD" && header !== "PWAD") {
    throw new Error("FreeDM WAD has an invalid header");
  }
}

function assertCfg(bytes) {
  if (!bytes.toString("utf8").includes("sfx_volume")) {
    throw new Error("Default config is missing sound settings");
  }
}

function assertMaps(bytes) {
  const maps = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(maps) || maps.length !== 32 || !maps.find((map) => map.id === "08")) {
    throw new Error("Map metadata is invalid");
  }
}

function assertSvg(bytes) {
  if (!bytes.toString("utf8").includes("<svg")) {
    throw new Error("Map preview SVG is invalid");
  }
}

function assertPng(bytes) {
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    throw new Error("Map screenshot PNG is invalid");
  }
}
