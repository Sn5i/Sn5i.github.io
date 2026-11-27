// =========================================================
// Snow's Widgets website: every live widget on the page.
// Each part is its own block, so you can read them one by one.
// =========================================================

console.log("Snow says hi!");

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const reduceMotion = false; // animations always on, whatever the Windows setting is
const random = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------
// 1. Light / dark switch (remembered for next visit)
// ---------------------------------------------------------
$("#themeToggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("snow-theme", next);
  } catch (e) {
    // private window: the choice just isn't saved
  }
});

// ---------------------------------------------------------
// 2. Falling pixel snow
// ---------------------------------------------------------
const canvas = $("#snow");
const ctx = canvas.getContext("2d");
const flakes = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function makeFlake(startAnywhere) {
  return {
    x: Math.random() * canvas.width,
    y: startAnywhere ? Math.random() * canvas.height : -10,
    size: [4, 6, 8][Math.floor(Math.random() * 3)],
    speed: random(0.4, 1.6),
    drift: Math.random() * Math.PI * 2,
    alpha: random(0.25, 0.8),
  };
}

function drawSnow() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--snow");
  for (const f of flakes) {
    f.y += f.speed;
    f.drift += 0.01;
    f.x += Math.sin(f.drift) * 0.3;
    if (f.y > canvas.height + 10) Object.assign(f, makeFlake(false));
    ctx.globalAlpha = f.alpha;
    ctx.fillRect(Math.round(f.x), Math.round(f.y), f.size, f.size);
  }
  if (!reduceMotion) requestAnimationFrame(drawSnow);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
for (let i = 0; i < 80; i++) flakes.push(makeFlake(true));
drawSnow();

// ---------------------------------------------------------
// 3. Pixel Peaks: stepped mountains in every <svg class="peaks">
// ---------------------------------------------------------
// A ridge is a line of "stairs": every STEP pixels it goes up or down a whole step.
function ridgePoints(seed, base, height, peaks, width, total) {
  const STEP = 16;
  let points = `0,${total} `;
  let previous = base;
  for (let x = 0; x <= width; x += STEP) {
    const wave = Math.sin((x / width) * Math.PI * peaks + seed) * 0.6 + Math.sin((x / width) * Math.PI * peaks * 2.7 + seed * 2) * 0.3;
    const y = Math.round((base - wave * height) / STEP) * STEP;
    points += `${x},${previous} ${x},${y} `;
    previous = y;
  }
  return points + `${width},${previous} ${width},${total}`;
}

function drawPeaks(svg, index) {
  const W = 1600, H = 200;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
  const s = index * 1.7; // every svg gets slightly different mountains
  svg.innerHTML = `
    <polygon class="cap" points="${ridgePoints(1 + s, 80, 50, 1.6, W, H)}" />
    <polygon class="r1"  points="${ridgePoints(1 + s, 80, 50, 1.6, W, H)}" transform="translate(0 16)" />
    <polygon class="r2"  points="${ridgePoints(4 + s, 120, 36, 2.4, W, H)}" />
    <polygon class="r3"  points="${ridgePoints(9 + s, 150, 24, 3.4, W, H)}" />
    <polygon class="r4"  points="${ridgePoints(13 + s, 180, 10, 5, W, H)}" />`;
}

$$(".peaks").forEach(drawPeaks);

// ---------------------------------------------------------
// 4. Things appear with a stepped slide when you scroll to them
// ---------------------------------------------------------
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 },
);
$$(".reveal").forEach((el) => revealObserver.observe(el));

// ---------------------------------------------------------
// 5. The Snow bar lights up the section you're reading
// ---------------------------------------------------------
const navTiles = $$(".snowbar .tile:not(.home):not(.stat)");
const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      navTiles.forEach((tile) => tile.classList.toggle("active", tile.getAttribute("href") === `#${entry.target.id}`));
    }
  },
  { rootMargin: "-45% 0px -50% 0px" },
);
$$("main .section").forEach((section) => sectionObserver.observe(section));

// ---------------------------------------------------------
// 6. Toasts (look like Windows notifications)
// ---------------------------------------------------------
function toast(title, text) {
  const box = document.createElement("div");
  box.className = "toast";
  box.innerHTML = `<img src="logo.png" alt=""><div><b></b><span></span></div>`;
  box.querySelector("b").textContent = title;
  box.querySelector("span").textContent = text;
  $("#toasts").appendChild(box);
  setTimeout(() => box.classList.add("out"), 3600);
  setTimeout(() => box.remove(), 4000);
}

// ---------------------------------------------------------
// 7. Download: read the newest version straight from GitHub
// ---------------------------------------------------------
async function loadRelease() {
  try {
    const response = await fetch("https://api.github.com/repos/Sn5i/Snows-Widgets/releases");
    if (!response.ok) return; // keep the text that's already on the page
    const releases = (await response.json()).filter((r) => !r.draft && !r.prerelease);
    const latest = releases[0];
    if (!latest) return;

    const installer = latest.assets.find((a) => a.name.endsWith("-setup.exe"));
    $("#dlVersion").textContent = latest.tag_name;
    $("#dlDate").textContent = new Date(latest.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (installer) {
      $("#dlSize").textContent = `${Math.round(installer.size / 1024 / 1024)} MB`;
      $("#dlButton").href = installer.browser_download_url;
    }

    // add up the installer downloads of every version
    let downloads = 0;
    for (const release of releases) {
      for (const asset of release.assets) {
        if (asset.name.endsWith("-setup.exe")) downloads += asset.download_count;
      }
    }
    if (downloads > 0) $("#dlCount").textContent = `Downloaded ${downloads.toLocaleString("en-US")} times`;
  } catch (e) {
    // offline or GitHub busy: the button still opens the releases page
  }
}
loadRelease();

// ---------------------------------------------------------
// 8. Clipping: buffer fills up, Save (or Ctrl+F7) saves a clip
// ---------------------------------------------------------
let clipping = true;
let buffer = 0;

function buildLevels() {
  $$("[data-levels]").forEach((row) => {
    row.innerHTML = "<i></i>".repeat(16);
  });
}

function tickClipping() {
  if (clipping) buffer = Math.min(60, buffer + 1);
  $("#bufText").textContent = `${buffer} / 60 s`;
  $("#bufFill").style.width = `${(buffer / 60) * 100}%`;
}

function tickLevels() {
  $$("[data-levels]").forEach((row, index) => {
    const level = clipping ? Math.round(random(index ? 2 : 6, index ? 9 : 14)) : 0;
    row.querySelectorAll("i").forEach((bar, i) => {
      bar.className = i < level ? (i > 11 ? "lit hot" : "lit") : "";
    });
  });
}

function saveClip() {
  if (!clipping) {
    toast("Clipping is off", "Turn clipping on first, then save.");
    return;
  }
  const flash = $("#clipFlash");
  flash.classList.remove("go");
  void flash.offsetWidth; // restart the animation
  flash.classList.add("go");
  const now = new Date();
  const name = `Snow-${now.toISOString().slice(0, 10)}-${now.toTimeString().slice(0, 8).replaceAll(":", "-")}.mp4`;
  const item = document.createElement("div");
  item.textContent = name;
  $("#savedList").prepend(item);
  if ($("#savedList").children.length > 3) $("#savedList").lastElementChild.remove();
  toast("Clip saved", `The last ${buffer} seconds · ${name}`);
}

$("#clipSave").addEventListener("click", saveClip);
$("#clipToggle").addEventListener("click", () => {
  clipping = !clipping;
  buffer = 0;
  $("#clipToggle").textContent = clipping ? "■ Stop clipping" : "● Start clipping";
  $("#clipToggle").classList.toggle("danger", clipping);
  $("#clipToggle").classList.toggle("primary", !clipping);
  $("#clipState").textContent = clipping ? "● Active" : "Off";
  $("#clipState").classList.toggle("on", clipping);
});

// the real shortcut works on the website too
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "F7") {
    event.preventDefault();
    saveClip();
  }
});

buildLevels();
setInterval(tickClipping, 1000);
setInterval(tickLevels, 140);

// ---------------------------------------------------------
// 9. Folders: tabs, search and Open All
// ---------------------------------------------------------
const folders = {
  Gaming: [
    { name: "Discord", color: "#5865f2", letter: "D" },
    { name: "Spotify", color: "#1db954", letter: "S" },
    { name: "VALORANT", color: "#ff4655", letter: "V" },
    { name: "Steam", color: "#1b2838", letter: "S" },
  ],
  Streaming: [
    { name: "OBS Studio", color: "#302e31", letter: "O" },
    { name: "Twitch Dashboard", color: "#9146ff", letter: "T" },
    { name: "Discord", color: "#5865f2", letter: "D" },
    { name: "Spotify", color: "#1db954", letter: "S" },
  ],
  AI: [
    { name: "ChatGPT", color: "#10a37f", letter: "G" },
    { name: "Claude", color: "#d97757", letter: "C" },
    { name: "Copilot", color: "#0078d4", letter: "C" },
  ],
};
let currentFolder = "Gaming";

function renderFolderTabs() {
  $("#folderTabs").innerHTML = "";
  for (const name of Object.keys(folders)) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `tab${name === currentFolder ? " active" : ""}`;
    tab.textContent = name;
    tab.addEventListener("click", () => {
      currentFolder = name;
      $("#folderSearch").value = "";
      renderFolderTabs();
      renderFolderList();
    });
    $("#folderTabs").appendChild(tab);
  }
}

function renderFolderList() {
  const query = $("#folderSearch").value.trim().toLowerCase();
  const apps = folders[currentFolder].filter((app) => app.name.toLowerCase().includes(query));
  $("#folderList").innerHTML = apps.length
    ? apps.map((app) => `<li><span class="app-icon" style="background:${app.color}">${app.letter}</span>${app.name}</li>`).join("")
    : `<li class="empty">No apps match "${query.replace(/[<>&"]/g, "")}"</li>`;
}

function openAll() {
  const stage = $("#folderStage");
  const layer = $("#folderWindows");
  layer.innerHTML = "";
  folders[currentFolder].forEach((app, i) => {
    const win = document.createElement("div");
    win.className = "app-window";
    win.style.left = `${clamp(8 + i * 22, 4, 70)}%`;
    win.style.top = `${10 + (i % 2) * 34 + Math.floor(i / 2) * 6}%`;
    win.style.animationDelay = `${i * 0.15}s`;
    win.innerHTML = `<header style="background:${app.color}">${app.name}</header><div></div>`;
    layer.appendChild(win);
  });
  $("#openAll").textContent = `Opening ${folders[currentFolder].length} apps...`;
  setTimeout(() => layer.querySelectorAll(".app-window").forEach((w) => w.classList.add("closing")), 2600);
  setTimeout(() => {
    layer.innerHTML = "";
    $("#openAll").textContent = "Open All";
  }, 3000);
  stage.scrollIntoView({ block: "nearest" });
}

$("#folderSearch").addEventListener("input", renderFolderList);
$("#openAll").addEventListener("click", openAll);
renderFolderTabs();
renderFolderList();

// ---------------------------------------------------------
// 10. Companion: Start opens, panels slide in around it
// ---------------------------------------------------------
const startColors = ["#3ea8ff", "#f6b73c", "#1db954", "#5865f2", "#ff4655", "#9146ff", "#d97757", "#10a37f", "#e81123", "#0078d4", "#7cf2a8", "#a8dcff"];
$(".start-grid").innerHTML = startColors.map((c) => `<span style="background:${c}"></span>`).join("");
$("#startBtn").addEventListener("click", () => $("#companionStage").classList.toggle("open"));

// ---------------------------------------------------------
// 11. RAM Optimizer: counts down to 51% and shows what was freed
// ---------------------------------------------------------
const TOTAL_RAM = 31.1;
let ramPercent = 78;
let optimizing = false;
const ramApps = [
  ["chrome", 1.7],
  ["VALORANT", 1.4],
  ["Discord", 1.1],
  ["Spotify", 1.0],
  ["steamwebhelper", 0.8],
];

function showRam() {
  const used = (TOTAL_RAM * ramPercent) / 100;
  $("#ramFill").style.width = `${ramPercent}%`;
  $("#ramUsed").textContent = `${used.toFixed(1)} GB`;
  $("#ramFree").textContent = `${(TOTAL_RAM - used).toFixed(1)} GB`;
  $("#ramLabel").textContent = `${ramPercent > 70 ? "High" : "Normal"} · ${ramPercent}% in use`;
  $$('[data-live="ram"]').forEach((el) => (el.textContent = `${ramPercent}%`));
}

function renderRamApps(scale) {
  $("#ramTop").innerHTML = ramApps
    .map(([name, gb]) => {
      const size = gb * scale;
      return `<div><div class="row"><span>${name}</span><span>${size.toFixed(1)} GB</span></div><div class="bar-track"><div style="width:${(size / 1.7) * 100}%"></div></div></div>`;
    })
    .join("");
}

function optimizeRam(deep) {
  if (optimizing) return;
  if (ramPercent <= 51) {
    // already optimized: fill it back up so it can be tried again
    ramPercent = 78;
    $("#ramFreed").classList.remove("show");
    renderRamApps(1);
    showRam();
    $("#ramGo").textContent = "Optimize now";
    return;
  }
  optimizing = true;
  const goal = deep ? 46 : 51;
  const timer = setInterval(() => {
    ramPercent -= 1;
    showRam();
    if (ramPercent <= goal) {
      clearInterval(timer);
      optimizing = false;
      const freed = deep ? 3.74 : 2.21; // the numbers from a real run on Snow's PC
      $("#ramFreed").textContent = `−${freed.toFixed(2)} GB`;
      $("#ramFreed").classList.add("show");
      renderRamApps(0.7);
      $("#ramGo").textContent = "Fill it again";
      toast("RAM optimized", `Freed ${freed.toFixed(2)} GB · 78% → ${goal}% in use`);
    }
  }, 45);
}

$("#ramGo").addEventListener("click", () => optimizeRam(false));
$("#ramDeep").addEventListener("click", () => optimizeRam(true));
renderRamApps(1);
showRam();

// ---------------------------------------------------------
// 12. Twitch: real data for Snow_x5 (same free service the app uses without login)
// ---------------------------------------------------------
const CHANNEL = "snow_x5";
let wasLive = false;

async function decapi(what) {
  const response = await fetch(`https://decapi.me/twitch/${what}/${CHANNEL}`);
  return (await response.text()).trim();
}

async function loadTwitch() {
  try {
    const [uptime, game, title, viewers, followers, avatar] = await Promise.all(
      ["uptime", "game", "title", "viewercount", "followcount", "avatar"].map(decapi),
    );
    const live = !uptime.toLowerCase().includes("offline");

    $("#twPill").textContent = live ? "LIVE" : "Offline";
    $("#twPill").classList.toggle("live", live);
    $("#twGame").textContent = game || "—";
    $("#twTitle").textContent = title;
    $("#twViewers").textContent = live ? Number(viewers).toLocaleString("en-US") : "—";
    if (/^\d+$/.test(followers)) $("#twFollowers").textContent = Number(followers).toLocaleString("en-US");
    if (avatar.startsWith("https://")) $("#twAvatar").src = avatar;

    const thumb = $("#twThumb");
    thumb.classList.toggle("live", live);
    thumb.style.backgroundImage = live ? `url(https://static-cdn.jtvnw.net/previews-ttv/live_user_${CHANNEL}-640x360.jpg?t=${Date.now()})` : "";
    $("#twThumbText").textContent = live ? `Live for ${uptime}` : `Offline · last played ${game || "—"}`;
    $$('[data-live="dot"]').forEach((dot) => dot.classList.toggle("on", live));

    if (live && !wasLive) toast("Snow_x5 is live", `Playing ${game} · ${title}`);
    wasLive = live;
  } catch (e) {
    $("#twPill").textContent = "Offline";
    $("#twThumbText").textContent = "Couldn't reach Twitch right now";
  }
}

loadTwitch();
setInterval(loadTwitch, 60000); // check again every minute

// ---------------------------------------------------------
// 13. Metrics: live numbers, a moving graph and top apps
// ---------------------------------------------------------
const metrics = {
  cpu: { name: "CPU usage", value: 23, history: [], apps: [["VALORANT", 14], ["Discord", 3], ["chrome", 2.4], ["Spotify", 1.2]] },
  gpu: { name: "GPU usage", value: 61, history: [], apps: [["VALORANT", 58], ["dwm", 3], ["chrome", 1.1]] },
  ram: { name: "RAM in use", value: 78, history: [], apps: ramApps.slice(0, 4).map(([n, gb]) => [n, gb * 10]) },
};
let currentMetric = "cpu";
const GRAPH_BARS = 40;

for (const key of Object.keys(metrics)) {
  for (let i = 0; i < GRAPH_BARS; i++) metrics[key].history.push(metrics[key].value + random(-6, 6));
}
$("#graph").innerHTML = "<i></i>".repeat(GRAPH_BARS);

function tickMetrics() {
  metrics.cpu.value = clamp(metrics.cpu.value + random(-5, 5), 8, 60);
  metrics.gpu.value = clamp(metrics.gpu.value + random(-6, 6), 35, 92);
  metrics.ram.value = ramPercent; // the RAM Optimizer above changes this one
  for (const key of Object.keys(metrics)) {
    const m = metrics[key];
    m.history.push(m.value);
    m.history.shift();
  }
  $$('[data-live="cpu"]').forEach((el) => (el.textContent = `${Math.round(metrics.cpu.value)}%`));
  $$('[data-live="gpu"]').forEach((el) => (el.textContent = `${Math.round(metrics.gpu.value)}%`));
  showMetric();
}

function showMetric() {
  const m = metrics[currentMetric];
  $("#metricName").textContent = m.name;
  $("#metricValue").textContent = `${Math.round(m.value)}%`;
  $$("#graph i").forEach((bar, i) => (bar.style.height = `${clamp(m.history[i], 2, 100)}%`));
  const top = m.apps[0][1];
  $("#metricTop").innerHTML = m.apps
    .map(([name, value]) => `<div><div class="row"><span>${name}</span><span>${value.toFixed(1)}%</span></div><div class="bar-track"><div style="width:${(value / top) * 100}%"></div></div></div>`)
    .join("");
}

$$("#metricTabs .tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    currentMetric = tab.dataset.metric;
    $$("#metricTabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
    showMetric();
  }),
);
showMetric();
setInterval(tickMetrics, 1000);

// ---------------------------------------------------------
// 14. Footer: copy the Discord name
// ---------------------------------------------------------
$("#discordBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("Sn5i");
    toast("Copied", "Discord name Sn5i is on your clipboard.");
  } catch (e) {
    toast("Discord", "Add me on Discord: Sn5i");
  }
});

// ---------------------------------------------------------
// 15. Tour video: stays still for people who turned off animations
// ---------------------------------------------------------
if (reduceMotion) $("#tourVideo").pause();