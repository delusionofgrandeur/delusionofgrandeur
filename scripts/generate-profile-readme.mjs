import { writeFile } from "node:fs/promises";

const USERNAME = "delusionofgrandeur";
const DISPLAY_NAME = "spy";
const PROFILE_REPO = "delusionofgrandeur/delusionofgrandeur";
const DARK_IMAGE = "spy_terminal_v4_dark.svg";
const LIGHT_IMAGE = "spy_terminal_v4_light.svg";
const PROFILE_TOKEN = process.env.PROFILE_GITHUB_TOKEN || "";
const PUBLIC_TOKEN = PROFILE_TOKEN || process.env.GITHUB_TOKEN || "";

const BIRTH_DATE = new Date(Date.UTC(2006, 11, 21));
const FALLBACK_STATS = {
  repos: 6,
  contributed: 3,
  stars: 4,
  commits: 56,
  followers: 2,
  lines: 23488,
};

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

async function profileStats() {
  try {
    const user = await githubJson(`/users/${USERNAME}`);
    const repos = await listRepos();
    const repoStats = await Promise.all(
      repos.map(async (repo) => {
        const [commits, languages] = await Promise.all([commitCount(repo), languageStats(repo)]);
        return { commits, languages };
      }),
    );

    return {
      repos: repos.length,
      contributed: repoStats.filter((item) => item.commits > 0).length,
      stars: repos.reduce((total, repo) => total + repo.stargazers_count, 0),
      commits: repoStats.reduce((total, item) => total + item.commits, 0),
      followers: user.followers,
      lines: repoStats.reduce((total, item) => total + estimateLines(item.languages), 0),
    };
  } catch (error) {
    console.warn(`Using fallback GitHub stats: ${error.message}`);
    return FALLBACK_STATS;
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
  const x = options.x || 80;
  const valueX = options.valueX || 420;
  const max = options.max || 54;
  const charWidth = options.charWidth || 8.35;
  const fixedChars = 4 + String(key).length;
  const dotCount = Math.max(3, Math.floor((valueX - x) / charWidth) - fixedChars);
  return `<tspan x="${x}" y="${y}" class="cc">- </tspan><tspan class="key">${escapeXml(key)}</tspan><tspan class="cc">: ${".".repeat(dotCount)} </tspan><tspan x="${valueX}" y="${y}" class="value">${escapeXml(truncate(value, max))}</tspan>`;
}

function section(y, label, x = 80) {
  return `<tspan x="${x}" y="${y}" class="cc">- ${escapeXml(label)} ------------------------------------------------------------------------------------</tspan>`;
}

function svg(theme, stats) {
  const repoLine = `${number(stats.repos)} {Contributed: ${number(stats.contributed)}} | Stars: ${number(stats.stars)}`;
  const commitLine = `${number(stats.commits)} | Followers: ${number(stats.followers)}`;
  const locLine = `${number(stats.lines)} (estimated)`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" font-family="ConsolasFallback,Consolas,monospace" width="985px" height="720px" viewBox="0 0 985 720" font-size="15px" text-rendering="geometricPrecision">
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
text, tspan {white-space: pre;}
</style>
<rect width="985px" height="720px" fill="${theme.card}" rx="22"/>
<text x="80" y="42" class="card-text">
<tspan x="80" y="42">spy@github ------------------------------------------------------------------------------------</tspan>
${line(72, "OS", staticProfile.os)}
${line(96, "Uptime", ageText())}
${line(120, "Host", staticProfile.host)}
${line(144, "Kernel", staticProfile.kernel)}
${line(168, "IDE", staticProfile.ide)}
${section(206, "Stack")}
${line(230, "Languages.Programming", staticProfile.programming)}
${line(254, "Stack.Frontend", staticProfile.frontend)}
${line(278, "Stack.Backend", staticProfile.backend)}
${section(316, "Projects")}
${line(340, "coursera-scraper", projectCopy.get("coursera-scraper"))}
${line(364, "RepoSecAudit", projectCopy.get("RepoSecAudit"))}
${line(388, "sors-whispercore", projectCopy.get("sors-whispercore"))}
${section(426, "Interests")}
${line(450, "Interests.Security", staticProfile.interestSecurity)}
${line(474, "Interests.AI", staticProfile.interestAi)}
${line(498, "Now.Building", staticProfile.nowBuilding)}
${section(536, "Contact")}
${line(560, "Email", staticProfile.email)}
${line(584, "GitHub", staticProfile.github)}
${section(622, "GitHub Stats")}
${line(646, "Repos", repoLine)}
${line(670, "Commits", commitLine)}
${line(694, "Lines of Code on GitHub", locLine)}
</text>
</svg>`;
}

async function build() {
  const stats = await profileStats();

  const dark = {
    card: "#161b22",
    text: "#c9d1d9",
    key: "#ffa657",
    value: "#a5d6ff",
    cc: "#616e7f",
  };

  const light = {
    card: "#f6f8fa",
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

  await writeFile(DARK_IMAGE, svg(dark, stats).replace(/[ \t]+$/gm, ""), "utf8");
  await writeFile(LIGHT_IMAGE, svg(light, stats).replace(/[ \t]+$/gm, ""), "utf8");
  await writeFile("README.md", readme, "utf8");
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
