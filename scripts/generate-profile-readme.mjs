import { writeFile } from "node:fs/promises";

const USERNAME = "delusionofgrandeur";
const DISPLAY_NAME = "spy";
const PROFILE_REPO = "delusionofgrandeur/delusionofgrandeur";
const DARK_IMAGE = "spy_terminal_v3_dark.svg";
const LIGHT_IMAGE = "spy_terminal_v3_light.svg";
const DISCORD_USER_ID = "1477789276337999895";
const PROFILE_TOKEN = process.env.PROFILE_GITHUB_TOKEN || "";
const PUBLIC_TOKEN = PROFILE_TOKEN || process.env.GITHUB_TOKEN || "";

const BIRTH_DATE = new Date(Date.UTC(2006, 11, 21));
const FEATURED_REPOS = new Set(["coursera-scraper", "RepoSecAudit", "sors-whispercore"]);
const LINE_DIVISORS = new Map([
  ["TypeScript", 38],
  ["JavaScript", 38],
  ["Python", 42],
  ["QML", 34],
  ["PowerShell", 45],
  ["Shell", 42],
  ["CSS", 32],
  ["HTML", 42],
  ["SQL", 34],
]);

const staticProfile = {
  os: "Windows 11, Android",
  host: "Sors AI",
  kernel: "vibecoder / security automation",
  ide: "Codex, Claude, VS Code, Cursor",
  programming: "TypeScript, JavaScript, Python, QML",
  frontend: "React Native, Expo, QML, CSS",
  backend: "Node.js, Supabase, PostgreSQL",
  interestSecurity: "repo scanners, auth boundaries",
  interestAi: "agents, local transcription",
  nowBuilding: "secure CLIs, offline AI apps",
  email: "swedishviking20000@proton.me",
  github: USERNAME,
};

const projectCopy = new Map([
  ["coursera-scraper", "course downloader CLI"],
  ["RepoSecAudit", "repo security scanner"],
  ["sors-whispercore", "offline Whisper app"],
]);

async function githubJson(path, token = PUBLIC_TOKEN) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${USERNAME}-profile-readme`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function githubResponse(path, token = PUBLIC_TOKEN) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${USERNAME}-profile-readme`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

async function listRepos() {
  const repos = [];
  let page = 1;

  while (page <= 10) {
    const path = PROFILE_TOKEN
      ? `/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator,organization_member&sort=updated`
      : `/users/${USERNAME}/repos?per_page=100&page=${page}&sort=updated`;
    const batch = await githubJson(path);
    repos.push(...batch);
    if (batch.length < 100) {
      break;
    }
    page += 1;
  }

  return repos.filter((repo) => !repo.archived && !repo.disabled);
}

async function commitCount(repo) {
  try {
    const response = await githubResponse(`/repos/${repo.full_name}/commits?author=${USERNAME}&per_page=1`);
    const link = response.headers.get("link") || "";
    const match = link.match(/[?&]page=(\d+)>; rel="last"/);
    return match ? Number(match[1]) : (await response.json()).length;
  } catch {
    return 0;
  }
}

async function languageStats(repo) {
  try {
    return await githubJson(`/repos/${repo.full_name}/languages`);
  } catch {
    return {};
  }
}

function estimateLines(languageMap) {
  let lines = 0;
  for (const [language, bytes] of Object.entries(languageMap)) {
    const divisor = LINE_DIVISORS.get(language) || 40;
    lines += Math.round(bytes / divisor);
  }
  return lines;
}

async function profileStats(user, repos) {
  const repoStats = await Promise.all(
    repos.map(async (repo) => {
      const [commits, languages] = await Promise.all([commitCount(repo), languageStats(repo)]);
      return { repo, commits, languages };
    }),
  );

  const stars = repos.reduce((total, repo) => total + repo.stargazers_count, 0);
  const commits = repoStats.reduce((total, item) => total + item.commits, 0);
  const contributed = repoStats.filter((item) => item.commits > 0).length;
  const lines = repoStats.reduce((total, item) => total + estimateLines(item.languages), 0);

  return {
    repos: repos.length,
    contributed,
    stars,
    commits,
    followers: user.followers,
    lines,
  };
}

async function lanyardStatus() {
  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`, {
      headers: { "User-Agent": `${USERNAME}-profile-readme` },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const body = await response.json();
    const data = body.data || {};
    const user = data.discord_user || {};
    const custom = (data.activities || []).find((item) => item.type === 4);
    const activity = (data.activities || []).find((item) => item.type !== 4);
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
      : "";
    const avatar = avatarUrl ? await imageDataUri(avatarUrl) : "";
    const spotify = data.spotify || null;

    return {
      ok: true,
      name: user.global_name || user.username || "spy",
      username: user.username || "discord",
      status: data.discord_status || "offline",
      custom: custom?.state || "",
      activity: spotify
        ? `Spotify: ${spotify.song} - ${spotify.artist}`
        : activity
          ? `${activity.name}${activity.details ? `: ${activity.details}` : ""}`
          : "No active rich presence",
      avatar,
    };
  } catch {
    return {
      ok: false,
      name: "spy",
      username: "sipayisko",
      status: "offline",
      custom: "",
      activity: "Discord presence unavailable",
      avatar: "",
    };
  }
}

async function imageDataUri(url) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": `${USERNAME}-profile-readme` },
    });
    if (!response.ok) {
      return "";
    }
    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

function ageText(now = new Date()) {
  let years = now.getUTCFullYear() - BIRTH_DATE.getUTCFullYear();
  let months = now.getUTCMonth() - BIRTH_DATE.getUTCMonth();
  let days = now.getUTCDate() - BIRTH_DATE.getUTCDate();

  if (days < 0) {
    const priorMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    days += priorMonth.getUTCDate();
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return `${years} years, ${months} months, ${days} days`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function number(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function line(y, key, value, options = {}) {
  const x = options.x || 390;
  const valueX = options.valueX || 680;
  const max = options.max || 34;
  const charWidth = options.charWidth || 8.35;
  const fixedChars = 4 + String(key).length;
  const dotCount = Math.max(3, Math.floor((valueX - x) / charWidth) - fixedChars);
  return `<tspan x="${x}" y="${y}" class="cc">- </tspan><tspan class="key">${escapeXml(key)}</tspan><tspan class="cc">: ${".".repeat(dotCount)} </tspan><tspan x="${valueX}" y="${y}" class="value">${escapeXml(truncate(value, max))}</tspan>`;
}

function section(y, label, x = 390) {
  return `<tspan x="${x}" y="${y}" class="cc">- ${escapeXml(label)} ------------------------------------------------------</tspan>`;
}

function discordWidget(theme, discord) {
  const isSpotify = discord.activity.startsWith("Spotify:");
  const activityLabel = isSpotify ? "Spotify" : "Activity";
  const activityValue = isSpotify ? discord.activity.replace(/^Spotify:\s*/, "") : discord.activity;
  const nowValue = discord.custom || (isSpotify ? "listening" : discord.status);
  const avatar = discord.avatar
    ? `<image href="${escapeXml(discord.avatar)}" x="128" y="126" width="128" height="128" clip-path="url(#avatarClip)"/>`
    : `<text x="192" y="206" text-anchor="middle" class="avatar-fallback">SPY</text>`;
  const statusColor = {
    online: "#3fb950",
    idle: "#d29922",
    dnd: "#f85149",
    offline: "#8b949e",
  }[discord.status] || "#8b949e";

  return `
<defs>
  <clipPath id="avatarClip">
    <circle cx="192" cy="190" r="64"/>
  </clipPath>
</defs>
<g>
  <rect x="55" y="75" width="285" height="560" rx="24" class="discord-card"/>
  <text x="80" y="110" class="discord-title">DISCORD PRESENCE</text>
  <circle cx="305" cy="105" r="6" fill="${statusColor}"/>
  <circle cx="192" cy="190" r="68" class="avatar-ring"/>
  ${avatar}
  <circle cx="245" cy="241" r="15" fill="${statusColor}" stroke="${theme.card}" stroke-width="5"/>
  <text x="198" y="288" text-anchor="middle" class="discord-name">${escapeXml(DISPLAY_NAME)}</text>
  <text x="198" y="313" text-anchor="middle" class="discord-user">@${escapeXml(truncate(discord.username, 22))}</text>
  <rect x="78" y="348" width="240" height="44" rx="12" class="presence-row"/>
  <text x="95" y="376" class="discord-label">Status</text>
  <text x="300" y="376" text-anchor="end" class="discord-value">${escapeXml(discord.status)}</text>
  <rect x="78" y="406" width="240" height="44" rx="12" class="presence-row"/>
  <text x="95" y="434" class="discord-label">Now</text>
  <text x="300" y="434" text-anchor="end" class="discord-value">${escapeXml(truncate(nowValue, 20))}</text>
  <rect x="78" y="470" width="240" height="96" rx="14" class="presence-row"/>
  <text x="95" y="501" class="discord-label">${escapeXml(activityLabel)}</text>
  <text x="95" y="529" class="discord-value">${escapeXml(truncate(activityValue, 26))}</text>
  <text x="95" y="552" class="discord-small">${escapeXml(discord.ok ? "live via Lanyard" : "presence unavailable")}</text>
  <text x="198" y="608" text-anchor="middle" class="discord-small">lanyard.cnrad.dev / live</text>
</g>`;
}

function svg(theme, stats, discord) {
  const repoLine = `${number(stats.repos)} {Contributed: ${number(stats.contributed)}} | Stars: ${number(stats.stars)}`;
  const commitLine = `${number(stats.commits)} | Followers: ${number(stats.followers)}`;
  const locLine = `${number(stats.lines)} (estimated)`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" font-family="ConsolasFallback,Consolas,monospace" width="985px" height="705px" viewBox="0 0 985 705" font-size="15px" text-rendering="geometricPrecision">
<style>
@font-face {
src: local("Consolas"), local("Consolas Bold");
font-family: "ConsolasFallback";
font-display: swap;
-webkit-size-adjust: 109%;
size-adjust: 109%;
}
.key {fill: ${theme.key};}
.value {fill: ${theme.value};}
.cc {fill: ${theme.cc};}
.card-text {fill: ${theme.text};}
.discord-card {fill: ${theme.discordCard}; opacity: .72;}
.presence-row {fill: ${theme.presenceRow};}
.avatar-ring {fill: none; stroke: ${theme.value}; stroke-width: 2;}
.avatar-fallback {fill: ${theme.key}; font-size: 44px; font-weight: 700;}
.discord-name {fill: ${theme.text}; font-size: 22px; font-weight: 700;}
.discord-user, .discord-small {fill: ${theme.cc};}
.discord-title {fill: ${theme.cc}; font-size: 12px; font-weight: 700;}
.discord-label {fill: ${theme.key}; font-weight: 700;}
.discord-value {fill: ${theme.value};}
text, tspan {white-space: pre;}
</style>
<rect width="985px" height="705px" fill="${theme.card}" rx="22"/>
${discordWidget(theme, discord)}
<text x="390" y="40" class="card-text">
<tspan x="390" y="40">spy@github ------------------------------------------------------</tspan>
${line(68, "OS", staticProfile.os)}
${line(92, "Uptime", ageText())}
${line(116, "Host", staticProfile.host)}
${line(140, "Kernel", staticProfile.kernel)}
${line(164, "IDE", staticProfile.ide)}
${section(202, "Stack")}
${line(226, "Languages.Programming", staticProfile.programming)}
${line(250, "Stack.Frontend", staticProfile.frontend)}
${line(274, "Stack.Backend", staticProfile.backend)}
${section(312, "Projects")}
${line(336, "coursera-scraper", projectCopy.get("coursera-scraper"))}
${line(360, "RepoSecAudit", projectCopy.get("RepoSecAudit"))}
${line(384, "sors-whispercore", projectCopy.get("sors-whispercore"))}
${section(422, "Interests")}
${line(446, "Interests.Security", staticProfile.interestSecurity)}
${line(470, "Interests.AI", staticProfile.interestAi)}
${line(494, "Now.Building", staticProfile.nowBuilding)}
${section(532, "Contact")}
${line(556, "Email", staticProfile.email, { valueX: 610, max: 34 })}
${line(580, "GitHub", staticProfile.github, { valueX: 610, max: 34 })}
${section(618, "GitHub Stats")}
${line(642, "Repos", repoLine, { valueX: 610, max: 34 })}
${line(666, "Commits", commitLine, { valueX: 610, max: 34 })}
${line(690, "Lines of Code on GitHub", locLine, { valueX: 610, max: 34 })}
</text>
</svg>`;
}

async function build() {
  const user = await githubJson(`/users/${USERNAME}`);
  const [repos, discord] = await Promise.all([listRepos(), lanyardStatus()]);
  const stats = await profileStats(user, repos);

  const dark = {
    card: "#161b22",
    discordCard: "#0d1117",
    presenceRow: "#161b22",
    text: "#c9d1d9",
    key: "#ffa657",
    value: "#a5d6ff",
    cc: "#616e7f",
  };

  const light = {
    card: "#f6f8fa",
    discordCard: "#ffffff",
    presenceRow: "#f6f8fa",
    text: "#24292f",
    key: "#953800",
    value: "#0a3069",
    cc: "#c2cfde",
  };

  const readme = `<a href="https://github.com/${USERNAME}">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/${PROFILE_REPO}/main/${DARK_IMAGE}">
    <img alt="${DISPLAY_NAME} GitHub profile README" src="https://raw.githubusercontent.com/${PROFILE_REPO}/main/${LIGHT_IMAGE}">
  </picture>
</a>

<!-- Generated by scripts/generate-profile-readme.mjs. -->
`;

  await writeFile(DARK_IMAGE, svg(dark, stats, discord).replace(/[ \t]+$/gm, ""), "utf8");
  await writeFile(LIGHT_IMAGE, svg(light, stats, discord).replace(/[ \t]+$/gm, ""), "utf8");
  await writeFile("README.md", readme, "utf8");
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
