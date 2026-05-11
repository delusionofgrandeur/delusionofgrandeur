import { writeFile } from "node:fs/promises";

const USERNAME = "delusionofgrandeur";
const DISPLAY_NAME = "spy";
const PROFILE_REPO = "delusionofgrandeur/delusionofgrandeur";
const PROFILE_IMAGE = "profile-card.svg";
const DISCORD_USER_ID = process.env.DISCORD_USER_ID || "1477789276337999895";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

const featuredProjects = [
  ["coursera-scraper", "CLI"],
  ["RepoSecAudit", "scanner"],
  ["sors-whispercore", "app"],
];

const stackChips = ["TS", "JS", "PY", "RN", "SB"];
const toolChips = ["CODEX", "GHA", "PW", "EXPO", "GH"];

async function githubJson(path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${USERNAME}-profile-readme`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function lanyardStatus(userId) {
  if (!userId) {
    return {
      contact: "GitHub: github.com/delusionofgrandeur | Discord: set DISCORD_USER_ID",
      status: "Discord widget awaiting numeric user ID",
    };
  }

  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, {
      headers: { "User-Agent": `${USERNAME}-profile-readme` },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const body = await response.json();
    const data = body.data || {};
    const user = data.discord_user || {};
    const activity = (data.activities || []).find((item) => item.type !== 4);
    const custom = (data.activities || []).find((item) => item.type === 4);
    const discordName = user.global_name || user.username || "discord";
    const activityText = activity ? ` | ${activity.name}` : "";
    const customText = custom?.state ? ` | ${custom.state}` : "";

    return {
      contact: `GitHub: github.com/delusionofgrandeur | Discord: ${discordName}`,
      status: `${data.discord_status || "offline"}${activityText}${customText}`,
    };
  } catch (error) {
    return {
      contact: `GitHub: github.com/delusionofgrandeur | Discord: discord.com/users/${userId}`,
      status: `Discord ID linked | live status pending Lanyard visibility`,
    };
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clamp(value, length = 74) {
  const text = String(value);
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function chip(text, x, y, width = null) {
  const safe = escapeXml(text);
  const chipWidth = width || Math.max(46, safe.length * 9 + 22);
  return `
  <rect x="${x}" y="${y - 21}" width="${chipWidth}" height="30" rx="6" class="chip-box"/>
  <text x="${x + chipWidth / 2}" y="${y}" text-anchor="middle" class="chip-text">${safe}</text>`;
}

function row({ y, icon, label, value, chips = [] }) {
  let chipX = 315;
  const chipMarkup = chips
    .map((item) => {
      const markup = chip(item, chipX, y);
      chipX += Math.max(46, String(item).length * 9 + 22) + 10;
      return markup;
    })
    .join("");

  return `
  <g class="row">
    <rect x="30" y="${y - 33}" width="1040" height="46" rx="8" class="row-bg"/>
    <rect x="48" y="${y - 25}" width="30" height="30" rx="7" class="icon-box"/>
    <text x="63" y="${y - 4}" text-anchor="middle" class="icon-text">${escapeXml(icon)}</text>
    <text x="98" y="${y - 4}" class="label">${escapeXml(label)}</text>
    ${
      chips.length
        ? chipMarkup
        : `<text x="315" y="${y - 4}" class="value">${escapeXml(clamp(value))}</text>`
    }
  </g>`;
}

async function build() {
  const user = await githubJson(`/users/${USERNAME}`);
  const repos = await githubJson(`/users/${USERNAME}/repos?per_page=100&sort=updated`);
  const stars = repos.reduce((total, repo) => total + repo.stargazers_count, 0);
  const forks = repos.reduce((total, repo) => total + repo.forks_count, 0);
  const originalRepos = repos.filter((repo) => !repo.fork).length;
  const discord = await lanyardStatus(DISCORD_USER_ID);
  const updated = new Date().toISOString().slice(0, 16).replace("T", " ");

  const building = featuredProjects.map(([name, desc]) => `${name}: ${desc}`).join(" | ");
  const stats = `repos ${user.public_repos} | originals ${originalRepos} | stars ${stars} | forks ${forks} | followers ${user.followers} | since ${formatDate(user.created_at)}`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" font-family="ConsolasFallback,Consolas,monospace" width="1100px" height="585px" font-size="16px">
<style>
@font-face {
  src: local("Consolas"), local("Consolas Bold");
  font-family: "ConsolasFallback";
  font-display: swap;
  -webkit-size-adjust: 109%;
  size-adjust: 109%;
}
text, tspan { white-space: pre; }
.bg { fill: #020403; }
.terminal { fill: #050a07; stroke: #39ff14; stroke-width: 2; }
.topbar { fill: #07130c; }
.grid { stroke: #123c20; stroke-width: 1; opacity: 0.42; }
.scan { fill: #39ff14; opacity: 0.045; }
.title { fill: #39ff14; font-size: 48px; font-weight: 700; letter-spacing: 0; }
.prompt { fill: #00ffd5; font-size: 15px; }
.muted { fill: #5bff75; opacity: 0.74; }
.row-bg { fill: #06110a; stroke: #174d24; stroke-width: 1; }
.icon-box { fill: #0a1f10; stroke: #39ff14; stroke-width: 1.5; }
.icon-text { fill: #39ff14; font-size: 12px; font-weight: 700; }
.label { fill: #94ff9f; font-weight: 700; }
.value { fill: #d9ffe1; }
.chip-box { fill: #08190e; stroke: #39ff14; stroke-width: 1; }
.chip-text { fill: #d9ffe1; font-size: 13px; font-weight: 700; }
.edge { stroke: #39ff14; stroke-width: 2; opacity: 0.78; }
.hot { fill: #39ff14; }
</style>
<rect width="1100" height="585" class="bg"/>
${Array.from({ length: 13 }, (_, index) => `<line x1="${70 + index * 80}" y1="0" x2="${70 + index * 80}" y2="585" class="grid"/>`).join("")}
${Array.from({ length: 8 }, (_, index) => `<line x1="0" y1="${70 + index * 64}" x2="1100" y2="${70 + index * 64}" class="grid"/>`).join("")}
<rect x="18" y="18" width="1064" height="549" rx="18" class="terminal"/>
<rect x="18" y="18" width="1064" height="50" rx="18" class="topbar"/>
<circle cx="48" cy="43" r="6" fill="#39ff14"/>
<circle cx="70" cy="43" r="6" fill="#00ffd5"/>
<circle cx="92" cy="43" r="6" fill="#ff2079"/>
<text x="122" y="49" class="prompt">profile://delusionofgrandeur/mainframe</text>
<path d="M36 88 H1064 M36 535 H1064" class="edge"/>
<text x="48" y="136" class="title">${escapeXml(DISPLAY_NAME)}</text>
<text x="171" y="134" class="prompt">@${escapeXml(USERNAME)} :: cyberpunk profile card</text>
<text x="48" y="164" class="muted">single-panel layout / dynamic github stats / discord-ready status row</text>
${row({ y: 218, icon: "@", label: "HANDLE", value: `${DISPLAY_NAME} / @${USERNAME}` })}
${row({ y: 270, icon: "FX", label: "FOCUS", value: "security automation, CLI tooling, offline AI apps" })}
${row({ y: 322, icon: "ST", label: "STACK", chips: stackChips })}
${row({ y: 374, icon: "CB", label: "CURRENTLY BUILDING", value: building })}
${row({ y: 426, icon: "GH", label: "GITHUB STATS", value: stats })}
${row({ y: 478, icon: "DM", label: "CONTACT", value: discord.contact })}
${row({ y: 530, icon: "TL", label: "FAVORITE TOOLS", chips: toolChips })}
<text x="48" y="558" class="prompt">$ status --discord</text>
<text x="245" y="558" class="value">${escapeXml(clamp(discord.status, 70))}</text>
<text x="810" y="558" class="muted">updated ${escapeXml(updated)} UTC</text>
${Array.from({ length: 9 }, (_, index) => `<rect x="18" y="${92 + index * 48}" width="1064" height="2" class="scan"/>`).join("")}
</svg>`;

  const readme = `<a href="https://github.com/${USERNAME}">
  <img alt="${DISPLAY_NAME} cyberpunk GitHub profile README" src="https://raw.githubusercontent.com/${PROFILE_REPO}/main/${PROFILE_IMAGE}">
</a>

<!--
Generated by scripts/generate-profile-readme.mjs.
Discord status uses Lanyard with user ID ${DISCORD_USER_ID}.
-->
`;

  await writeFile(PROFILE_IMAGE, svg.replace(/[ \t]+$/gm, ""), "utf8");
  await writeFile("README.md", readme, "utf8");
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
