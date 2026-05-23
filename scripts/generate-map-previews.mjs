import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const wadPath = "public/assets/freedm.wad";
const outDir = "public/assets/map-previews";
const mapsOut = "public/assets/maps.json";
const wad = readFileSync(wadPath);
const directory = readDirectory(wad);
const names = readMapNames(wad, directory);
const maps = [];

await mkdir(outDir, { recursive: true });

for (const marker of directory.filter((entry) => /^MAP\d\d$/.test(entry.name))) {
  const id = marker.name.slice(3);
  const lumps = mapLumps(marker.index);
  const vertices = readVertices(lumps.VERTEXES);
  const linedefs = readLinedefs(lumps.LINEDEFS);
  const things = readThings(lumps.THINGS);
  const svg = renderPreview(vertices, linedefs, things);
  const preview = `/assets/map-previews/${marker.name}.svg`;
  const shot = `/assets/map-shots/${marker.name}.png`;

  await writeFile(`${outDir}/${marker.name}.svg`, svg);
  maps.push({
    id,
    map: marker.name,
    name: names.get(Number(id)) || `${marker.name}`,
    preview,
    shot,
    stats: {
      things: things.length,
      linedefs: linedefs.length,
      sectors: Math.floor((lumps.SECTORS?.size || 0) / 26)
    }
  });
}

await writeFile(`${mapsOut}`, `${JSON.stringify(maps, null, 2)}\n`);
console.log(`Generated ${maps.length} map previews`);

function readDirectory(bytes) {
  const count = bytes.readInt32LE(4);
  const offset = bytes.readInt32LE(8);
  const entries = [];

  for (let i = 0; i < count; i += 1) {
    const entryOffset = offset + i * 16;
    entries.push({
      index: i,
      pos: bytes.readInt32LE(entryOffset),
      size: bytes.readInt32LE(entryOffset + 4),
      name: bytes.toString("ascii", entryOffset + 8, entryOffset + 16).replace(/\0+$/, "")
    });
  }

  return entries;
}

function readMapNames(bytes, entries) {
  const namesByMap = new Map();
  const dehacked = entries.find((entry) => entry.name === "DEHACKED");

  if (!dehacked) {
    return namesByMap;
  }

  const text = bytes.toString("utf8", dehacked.pos, dehacked.pos + dehacked.size);
  for (const line of text.split("\n")) {
    const match = line.match(/^HUSTR_(\d+)\s*=\s*(.+)$/);
    if (!match) {
      continue;
    }

    namesByMap.set(Number(match[1]), match[2].trim());
  }

  return namesByMap;
}

function mapLumps(markerIndex) {
  const result = {};
  for (const entry of directory.slice(markerIndex + 1, markerIndex + 12)) {
    result[entry.name] = entry;
  }

  return result;
}

function lumpBytes(entry) {
  return wad.subarray(entry.pos, entry.pos + entry.size);
}

function readVertices(entry) {
  const bytes = lumpBytes(entry);
  const vertices = [];

  for (let offset = 0; offset < bytes.length; offset += 4) {
    vertices.push({
      x: bytes.readInt16LE(offset),
      y: bytes.readInt16LE(offset + 2)
    });
  }

  return vertices;
}

function readLinedefs(entry) {
  const bytes = lumpBytes(entry);
  const linedefs = [];

  for (let offset = 0; offset < bytes.length; offset += 14) {
    linedefs.push({
      start: bytes.readUInt16LE(offset),
      end: bytes.readUInt16LE(offset + 2),
      right: bytes.readInt16LE(offset + 10),
      left: bytes.readInt16LE(offset + 12)
    });
  }

  return linedefs;
}

function readThings(entry) {
  const bytes = lumpBytes(entry);
  const things = [];

  for (let offset = 0; offset < bytes.length; offset += 10) {
    things.push({
      x: bytes.readInt16LE(offset),
      y: bytes.readInt16LE(offset + 2),
      type: bytes.readInt16LE(offset + 6)
    });
  }

  return things;
}

function renderPreview(vertices, linedefs, things) {
  const width = 420;
  const height = 240;
  const pad = 18;
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const mapWidth = Math.max(1, maxX - minX);
  const mapHeight = Math.max(1, maxY - minY);
  const scale = Math.min((width - pad * 2) / mapWidth, (height - pad * 2) / mapHeight);
  const offsetX = (width - mapWidth * scale) / 2;
  const offsetY = (height - mapHeight * scale) / 2;
  const point = (vertex) => ({
    x: Number((offsetX + (vertex.x - minX) * scale).toFixed(2)),
    y: Number((height - offsetY - (vertex.y - minY) * scale).toFixed(2))
  });

  const walls = [];
  const inner = [];

  for (const line of linedefs) {
    const start = point(vertices[line.start]);
    const end = point(vertices[line.end]);
    const target = line.left >= 0 ? inner : walls;
    target.push(`<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"/>`);
  }

  const markers = things
    .filter((thing) => thing.type === 11 || (thing.type >= 1 && thing.type <= 4) || thing.type >= 2001)
    .slice(0, 80)
    .map((thing) => {
      const p = point(thing);
      const isSpawn = thing.type === 11 || (thing.type >= 1 && thing.type <= 4);
      const fill = isSpawn ? "#b7493c" : "#d3b15b";
      const radius = isSpawn ? 3.2 : 2.2;
      return `<circle cx="${p.x}" cy="${p.y}" r="${radius}" fill="${fill}"/>`;
    });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">`,
    '<rect width="100%" height="100%" fill="#070706"/>',
    `<g stroke="#5e5a4f" stroke-width="1.6" stroke-linecap="round">${inner.join("")}</g>`,
    `<g stroke="#d3b15b" stroke-width="2.4" stroke-linecap="round">${walls.join("")}</g>`,
    `<g opacity="0.95">${markers.join("")}</g>`,
    "</svg>"
  ].join("");
}
