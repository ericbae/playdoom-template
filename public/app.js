const els = {
  canvas: document.querySelector("#canvas"),
  overlay: document.querySelector("#stage-overlay"),
  choiceScreen: document.querySelector("#choice-screen"),
  setupScreen: document.querySelector("#setup-screen"),
  hostSetup: document.querySelector("#host-setup"),
  joinSetup: document.querySelector("#join-setup"),
  endedScreen: document.querySelector("#ended-screen"),
  gamePanel: document.querySelector("#game-panel"),
  statusStack: document.querySelector("#status-stack"),
  engineStatus: document.querySelector("#engine-status"),
  roomStatus: document.querySelector("#room-status"),
  gameRoomOutput: document.querySelector("#game-room-output"),
  playerNames: document.querySelectorAll("[data-player-name]"),
  hostPlayerName: document.querySelector("#host-player-name"),
  joinPlayerName: document.querySelector("#join-player-name"),
  mapSelect: document.querySelector("#map-select"),
  hostMapShot: document.querySelector("#host-map-shot"),
  hostMapPlan: document.querySelector("#host-map-plan"),
  hostMapName: document.querySelector("#host-map-name"),
  hostMapStats: document.querySelector("#host-map-stats"),
  joinMapPreview: document.querySelector("#join-map-preview"),
  joinMapShot: document.querySelector("#join-map-shot"),
  joinMapPlan: document.querySelector("#join-map-plan"),
  joinMapName: document.querySelector("#join-map-name"),
  joinMapStats: document.querySelector("#join-map-stats"),
  gameMapTitle: document.querySelector("#game-map-title"),
  timeLimit: document.querySelector("#time-limit"),
  joinLink: document.querySelector("#join-link"),
  gameCopyLink: document.querySelector("#game-copy-link"),
  leaveGame: document.querySelector("#leave-game"),
  backMenu: document.querySelector("#back-menu"),
  chooseHost: document.querySelector("#choose-host"),
  chooseJoin: document.querySelector("#choose-join"),
  backChoice: document.querySelector("#back-choice"),
  hostGame: document.querySelector("#host-game"),
  joinGame: document.querySelector("#join-game")
};

const DEFAULT_MAP = "08";
const initialInvite = parseInvite(location.href);
const captureMap = normalizeMap(new URL(location.href).searchParams.get("captureMap"));

const state = {
  room: initialInvite.room,
  screen: captureMap ? "capture" : initialInvite.room ? "join" : "choice",
  map: captureMap || initialInvite.map || DEFAULT_MAP,
  maps: [],
  engineReady: false,
  engineLoading: false,
  gameRunning: false,
  mode: null
};

let engineLoadPromise = null;
let resolveEngineLoad;
let rejectEngineLoad;

window.__doomPreviewReady = false;

window.Module = {
  noInitialRun: true,
  canvas: els.canvas,
  locateFile(path) {
    if (path.endsWith(".wasm")) {
      return "/vendor/doom/websockets-doom.wasm";
    }

    return path;
  },
  preRun() {
    setEngineStatus("Downloading game data");
    Module.FS.createPreloadedFile("", "doom2.wad", "/assets/freedm.wad", true, true);
    Module.FS.createPreloadedFile("", "default.cfg", "/default.cfg", true, true);
  },
  onRuntimeInitialized() {
    state.engineReady = true;
    state.engineLoading = false;
    setEngineStatus("Engine ready");
    render();
    resolveEngineLoad?.();
  },
  monitorRunDependencies(left) {
    if (left > 0) {
      setEngineStatus(`Preparing game data (${left})`);
    }
  },
  setStatus(text) {
    if (text) {
      setEngineStatus(text);
    }
  },
  print(text) {
    handleDoomOutput(text);
    console.log(text);
  },
  printErr(text) {
    setRoomStatus(text);
    console.error(text);
  },
  onExit(status) {
    showEnded(status);
  }
};

window.addEventListener("error", (event) => {
  setRoomStatus(event.message || "Browser error");
  rejectEngineLoad?.(event.error || new Error(event.message || "Browser error"));
});

els.chooseHost.addEventListener("click", () => showSetup("host"));
els.chooseJoin.addEventListener("click", () => showSetup("join"));
els.backChoice.addEventListener("click", showChoice);
els.gameCopyLink.addEventListener("click", async () => copyInviteLink());
els.leaveGame.addEventListener("click", returnToMenu);
els.backMenu.addEventListener("click", returnToMenu);
els.hostGame.addEventListener("click", () => startGame("host"));
els.joinGame.addEventListener("click", () => joinFromInput());
els.joinLink.addEventListener("input", render);
els.mapSelect.addEventListener("input", () => {
  state.map = normalizeMap(els.mapSelect.value);
  render();
});
for (const input of els.playerNames) {
  input.addEventListener("input", () => syncPlayerNames(input));
}

if (state.room) {
  els.joinLink.value = inviteLink();
}

render();
loadMapData();
requestAnimationFrame(() => {
  const task = state.screen === "capture" ? startGame("capture") : loadEngine();
  task.catch((error) => {
      setEngineStatus("Engine failed");
      setRoomStatus(error.message);
    });
});

function showChoice() {
  if (state.gameRunning) {
    return;
  }

  state.screen = "choice";
  setRoomStatus("Ready");
  render();
}

function showEnded(status = 0) {
  state.gameRunning = false;
  state.screen = "ended";
  setRoomStatus(status ? `Game ended (${status})` : "Game ended");
  render();
}

function returnToMenu() {
  location.replace("/");
}

function showSetup(screen) {
  state.screen = screen;
  setRoomStatus(screen === "host" ? "Choose game details" : "Paste game link");
  render();
}

function loadEngine() {
  if (state.engineReady) {
    return Promise.resolve();
  }

  if (engineLoadPromise) {
    return engineLoadPromise;
  }

  state.engineLoading = true;
  setEngineStatus("Downloading engine");
  render();

  engineLoadPromise = new Promise((resolve, reject) => {
    resolveEngineLoad = resolve;
    rejectEngineLoad = reject;

    const script = document.createElement("script");
    script.src = "/vendor/doom/websockets-doom.js";
    script.async = true;
    script.onerror = () => reject(new Error("Doom engine failed to load"));
    document.body.append(script);
  });

  return engineLoadPromise;
}

async function startGame(mode) {
  if (state.gameRunning) {
    return;
  }

  if (mode === "host" && !state.room) {
    setRoomStatus("Creating invite");
    state.map = normalizeMap(els.mapSelect.value);
    const response = await fetchJson("/api/newroom");
    state.room = response.room;
    history.replaceState(null, "", `/room/${state.room}`);
    els.joinLink.value = inviteLink();
    render();
    await copyInviteLink("Invite copied");
  }

  if (mode === "join" && !state.room) {
    setRoomStatus("Paste a game link first");
    render();
    return;
  }

  await loadEngine();

  state.mode = mode;
  state.gameRunning = true;
  window.__doomPreviewReady = false;
  els.canvas.focus();
  els.overlay.classList.add("is-hidden");

  if (mode === "host") {
    setRoomStatus("Share invite before pressing Space");
  } else if (mode === "capture") {
    setRoomStatus("Capturing preview");
  } else {
    setRoomStatus("Waiting for host");
  }

  render();

  const name = playerName();
  const args = [
    "-iwad",
    "doom2.wad",
    "-warp",
    state.map,
    "-window",
    "-nogui",
    "-nomusic",
    "-config",
    "default.cfg",
    "-servername",
    "linkarena",
    "-nodes",
    "4",
    "-pet",
    name
  ];

  if (mode === "host") {
    const timeLimit = Number(els.timeLimit.value);
    if (timeLimit > 0) {
      args.push("-timer", String(timeLimit));
    }

    args.push(
      "-deathmatch",
      "-altdeath",
      "-server",
      "-privateserver",
      "-dup",
      "1",
      "-wss",
      socketUrl(state.room)
    );
  } else if (mode === "join") {
    args.push("-connect", "1", "-dup", "1", "-wss", socketUrl(state.room));
  } else if (mode === "capture") {
    args.push("-deathmatch", "-altdeath");
  }

  callMain(args);
}

function handleDoomOutput(text) {
  const match = /^doom:\s*(\d+)/i.exec(String(text));

  if (match && Number(match[1]) === 10) {
    window.__doomPreviewReady = true;

    if (state.mode === "host" && state.room) {
      fetch(`/api/room/${state.room}`, { method: "POST" }).catch(() => {});
    }
  }
}

function render() {
  const activeScreen = state.gameRunning ? (state.mode === "capture" ? "capture" : "game") : state.screen;
  document.body.dataset.screen = activeScreen;

  els.choiceScreen.classList.toggle("is-hidden", activeScreen !== "choice");
  els.setupScreen.classList.toggle("is-hidden", activeScreen !== "host" && activeScreen !== "join");
  els.hostSetup.classList.toggle("is-hidden", activeScreen !== "host");
  els.joinSetup.classList.toggle("is-hidden", activeScreen !== "join");
  els.gamePanel.classList.toggle("is-hidden", activeScreen !== "game");
  els.endedScreen.classList.toggle("is-hidden", activeScreen !== "ended");
  els.statusStack.classList.toggle("is-hidden", activeScreen === "choice" || activeScreen === "capture");

  const roomLabel = state.room ? inviteLink() : "No invite yet";
  els.gameRoomOutput.value = roomLabel;
  els.gameRoomOutput.textContent = roomLabel;

  els.gameCopyLink.disabled = !state.room;
  els.hostGame.disabled = state.gameRunning;
  els.joinGame.disabled = state.gameRunning || !joinRoomFromInput();
  els.mapSelect.value = state.map;
  els.gameMapTitle.textContent = `MAP${state.map}`;
  renderMapPreview("host", state.map);

  const joinInvite = parseInvite(els.joinLink.value.trim());
  const joinMap = joinInvite.map || (state.screen === "join" && state.map) || "";
  els.joinMapPreview.classList.toggle("is-hidden", !joinInvite.room);
  if (joinInvite.room) {
    renderMapPreview("join", joinMap || DEFAULT_MAP);
  }
}

function setEngineStatus(text) {
  els.engineStatus.textContent = text;
}

function setRoomStatus(text) {
  els.roomStatus.textContent = text;
}

async function fetchJson(path) {
  const response = await fetch(path, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function inviteLink() {
  const url = new URL(`/room/${state.room}`, location.origin);
  url.searchParams.set("map", state.map);
  url.searchParams.set("timer", els.timeLimit.value);
  return url.toString();
}

async function copyInviteLink(status = "Invite copied") {
  if (!state.room) {
    return;
  }

  try {
    await navigator.clipboard.writeText(inviteLink());
    setRoomStatus(status);
  } catch {
    setRoomStatus("Invite ready");
  }
}

async function joinFromInput() {
  const invite = parseInvite(els.joinLink.value.trim());
  if (!invite.room) {
    setRoomStatus("Paste a game link first");
    render();
    return;
  }

  state.room = invite.room;
  state.map = invite.map || DEFAULT_MAP;
  history.replaceState(null, "", `/room/${state.room}?map=${state.map}`);
  render();
  await startGame("join");
}

function joinRoomFromInput() {
  return parseInvite(els.joinLink.value.trim()).room;
}

function parseInvite(value) {
  const result = { room: "", map: "", timer: "" };

  if (!value) {
    if (state?.room) {
      result.room = state.room;
      result.map = state.map;
    }
    return result;
  }

  try {
    const url = new URL(value, location.origin);
    result.room = extractRoom(url);
    result.map = normalizeMap(url.searchParams.get("map") || "");
    result.timer = url.searchParams.get("timer") || "";
    return result;
  } catch {
    result.room = value.match(/^[0-9a-f]{64}-[0-9a-f]{8}$/i)?.[0] || "";
    return result;
  }
}

function extractRoom(url) {
  const roomPath = url.pathname.match(/^\/room\/([^/]+)$/);
  if (roomPath) {
    return roomPath[1];
  }

  return url.searchParams.get("room") || "";
}

function socketUrl(room) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/api/ws/${room}`;
}

function playerName() {
  const input = state.mode === "join" ? els.joinPlayerName : els.hostPlayerName;
  const raw = input.value.trim() || "Marine";

  return raw.replace(/[^a-z0-9_-]/gi, "").slice(0, 15) || "Marine";
}

function syncPlayerNames(source) {
  for (const input of els.playerNames) {
    if (input !== source) {
      input.value = source.value;
    }
  }
}

async function loadMapData() {
  try {
    const response = await fetch("/assets/maps.json");
    state.maps = await response.json();
    els.mapSelect.replaceChildren(
      ...state.maps.map((map) => {
        const option = document.createElement("option");
        option.value = map.id;
        option.textContent = `${map.map} - ${map.name.replace(/^DM\d+:\s*/, "")}`;
        return option;
      })
    );
    els.mapSelect.value = state.map;
    render();
  } catch (error) {
    setRoomStatus(error.message);
  }
}

function mapById(id) {
  return state.maps.find((map) => map.id === normalizeMap(id));
}

function renderMapPreview(target, id) {
  const map = mapById(id);
  const shot = target === "host" ? els.hostMapShot : els.joinMapShot;
  const plan = target === "host" ? els.hostMapPlan : els.joinMapPlan;
  const name = target === "host" ? els.hostMapName : els.joinMapName;
  const stats = target === "host" ? els.hostMapStats : els.joinMapStats;

  if (!map) {
    name.textContent = `MAP${normalizeMap(id) || DEFAULT_MAP}`;
    stats.textContent = "Map preview loading";
    shot.removeAttribute("src");
    plan.removeAttribute("src");
    return;
  }

  shot.src = map.shot;
  shot.alt = `${map.name} in-game preview`;
  plan.src = map.preview;
  plan.alt = `${map.name} floor plan`;
  name.textContent = `${map.map} - ${map.name.replace(/^DM\d+:\s*/, "")}`;
  stats.textContent = `${map.stats.sectors} sectors`;
}

function normalizeMap(value) {
  const match = String(value || "").match(/\d{1,2}/);
  if (!match) {
    return "";
  }

  const number = Number(match[0]);
  if (number < 1 || number > 32) {
    return "";
  }

  return String(number).padStart(2, "0");
}
