import { writeFile } from "node:fs/promises";

const USERNAME = "delusionofgrandeur";
const DISPLAY_NAME = "spy";
const PROFILE_REPO = "delusionofgrandeur/delusionofgrandeur";
const DARK_IMAGE = "spy_dark.svg";
const LIGHT_IMAGE = "spy_light.svg";
const DISCORD_USER_ID = "1477789276337999895";
const PROFILE_TOKEN = process.env.PROFILE_GITHUB_TOKEN || "";

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
  kernel: "Vibecoder / security automation builder",
  ide: "Codex, Claude, Antigravity, VS Code, Cursor",
  programming: "TypeScript, JavaScript, Python, QML, PowerShell",
  frontend: "React Native, Expo, QML, HTML, CSS",
  backend: "Node.js, Supabase Edge, PostgreSQL, Python",
  interestSecurity: "repo scanners, auth boundaries, launch gates",
  interestAi: "agent workflows, local transcription, AI tools",
  nowBuilding: "secure CLIs, offline AI apps, Android MVPs",
  email: "swedishviking20000@proton.me",
  github: USERNAME,
};

const projectCopy = new Map([
  ["coursera-scraper", "TypeScript course downloader CLI"],
  ["RepoSecAudit", "security scanner for repos"],
  ["sors-whispercore", "offline Whisper desktop app"],
]);

async function githubJson(path, token = PROFILE_TOKEN) {
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

async function githubResponse(path, token = PROFILE_TOKEN) {
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

function line(theme, y, key, value, dots = 28, x = 390) {
  const dotText = ".".repeat(Math.max(2, dots - String(key).length));
  return `<tspan x="${x}" y="${y}" class="cc">- </tspan><tspan class="key">${escapeXml(key)}</tspan><tspan class="cc">: ${dotText} </tspan><tspan class="value">${escapeXml(value)}</tspan>`;
}

function section(y, label, x = 390) {
  return `<tspan x="${x}" y="${y}" class="cc">- ${escapeXml(label)} ---------------------------------------------------</tspan>`;
}

function discordWidget(theme, discord) {
  const avatar = discord.avatar
    ? `<image href="${escapeXml(discord.avatar)}" x="83" y="82" width="150" height="150" clip-path="url(#avatarClip)"/>`
    : `<text x="158" y="166" text-anchor="middle" class="avatar-fallback">SPY</text>`;
  const statusColor = {
    online: "#3fb950",
    idle: "#d29922",
    dnd: "#f85149",
    offline: "#8b949e",
  }[discord.status] || "#8b949e";

  return `
<defs>
  <clipPath id="avatarClip">
    <circle cx="158" cy="157" r="75"/>
  </clipPath>
</defs>
<g>
  <rect x="55" y="62" width="286" height="380" rx="18" class="discord-card"/>
  <circle cx="158" cy="157" r="79" class="avatar-ring"/>
  ${avatar}
  <circle cx="216" cy="214" r="16" fill="${statusColor}" stroke="${theme.card}" stroke-width="5"/>
  <text x="198" y="266" text-anchor="middle" class="discord-name">${escapeXml(truncate(discord.name, 22))}</text>
  <text x="198" y="291" text-anchor="middle" class="discord-user">@${escapeXml(truncate(discord.username, 24))}</text>
  <rect x="78" y="318" width="240" height="42" rx="8" class="presence-row"/>
  <text x="95" y="345" class="discord-label">Status</text>
  <text x="198" y="345" class="discord-value">${escapeXml(discord.status)}</text>
  <rect x="78" y="371" width="240" height="42" rx="8" class="presence-row"/>
  <text x="95" y="398" class="discord-label">Now</text>
  <text x="198" y="398" class="discord-value">${escapeXml(truncate(discord.custom || discord.activity, 18))}</text>
  <text x="198" y="455" text-anchor="middle" class="discord-small">${escapeXml(truncate(discord.activity, 32))}</text>
</g>`;
}

function svg(theme, stats, discord) {
  const repoLine = `${number(stats.repos)} {Contributed: ${number(stats.contributed)}} | Stars: ${number(stats.stars)}`;
  const commitLine = `${number(stats.commits)} | Followers: ${number(stats.followers)}`;
  const locLine = `${number(stats.lines)} (estimated)`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" font-family="ConsolasFallback,Consolas,monospace" width="985px" height="615px" font-size="16px">
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
.discord-card {fill: ${theme.discordCard};}
.presence-row {fill: ${theme.presenceRow};}
.avatar-ring {fill: none; stroke: ${theme.value}; stroke-width: 2;}
.avatar-fallback {fill: ${theme.key}; font-size: 44px; font-weight: 700;}
.discord-name {fill: ${theme.text}; font-size: 22px; font-weight: 700;}
.discord-user, .discord-small {fill: ${theme.cc};}
.discord-label {fill: ${theme.key}; font-weight: 700;}
.discord-value {fill: ${theme.value};}
text, tspan {white-space: pre;}
</style>
<rect width="985px" height="615px" fill="${theme.card}" rx="15"/>
${discordWidget(theme, discord)}
<text x="390" y="30" class="card-text">
<tspan x="390" y="30">spy@github --------------------------------------------------</tspan>
${line(theme, 55, "OS", staticProfile.os)}
${line(theme, 80, "Uptime", ageText(), 25)}
${line(theme, 105, "Host", staticProfile.host)}
${line(theme, 130, "Kernel", staticProfile.kernel, 19)}
${line(theme, 155, "IDE", staticProfile.ide, 25)}
${section(190, "Stack")}
${line(theme, 215, "Languages.Programming", staticProfile.programming, 32)}
${line(theme, 240, "Stack.Frontend", staticProfile.frontend, 28)}
${line(theme, 265, "Stack.Backend", staticProfile.backend, 29)}
${section(300, "Projects")}
${line(theme, 325, "coursera-scraper", projectCopy.get("coursera-scraper"), 31)}
${line(theme, 350, "RepoSecAudit", projectCopy.get("RepoSecAudit"), 27)}
${line(theme, 375, "sors-whispercore", projectCopy.get("sors-whispercore"), 31)}
${section(410, "Interests")}
${line(theme, 435, "Interests.Security", staticProfile.interestSecurity, 31)}
${line(theme, 460, "Interests.AI", staticProfile.interestAi, 26)}
${line(theme, 485, "Now.Building", staticProfile.nowBuilding, 27)}
${section(520, "Contact")}
${line(theme, 545, "Email", staticProfile.email, 26)}
</text>
<text x="690" y="520" class="card-text">
<tspan x="690" y="520" class="key">GitHub</tspan><tspan class="cc">: </tspan><tspan class="value">${escapeXml(staticProfile.github)}</tspan>
<tspan x="690" y="545" class="key">Repos</tspan><tspan class="cc">: </tspan><tspan class="value">${escapeXml(repoLine)}</tspan>
</text>
<text x="390" y="575" class="card-text">
<tspan x="390" y="575" class="key">Commits</tspan><tspan class="cc">: </tspan><tspan class="value">${escapeXml(commitLine)}</tspan>
<tspan x="390" y="600" class="key">Lines of Code on GitHub</tspan><tspan class="cc">: .............. </tspan><tspan class="value">${escapeXml(locLine)}</tspan>
</text>
</svg>`;
}

async function build() {
  const user = await githubJson(`/users/${USERNAME}`, "");
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
