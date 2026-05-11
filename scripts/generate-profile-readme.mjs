import { execFile } from "node:child_process";
import { access, readdir, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
  additions: 28142,
  deletions: 4634,
};

const CHURN_CONCURRENCY = Number(process.env.PROFILE_CHURN_CONCURRENCY || 3);
const API_CHURN_CONCURRENCY = Number(process.env.PROFILE_API_CHURN_CONCURRENCY || 8);
const REPO_SEARCH_ROOTS = (process.env.PROFILE_REPO_SEARCH_ROOTS || join(process.cwd(), ".."))
  .split(delimiter)
  .filter(Boolean);

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
  discord: "sipayisko",
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

async function git(args, options = {}) {
  const { stdout } = await execFileAsync("git", args, {
    ...options,
    maxBuffer: 1024 * 1024 * 64,
  });
  return stdout;
}

function normalizeRemote(value) {
  return String(value || "")
    .trim()
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .toLowerCase();
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function localRepoIndex() {
  const index = new Map();

  for (const root of REPO_SEARCH_ROOTS) {
    if (!(await pathExists(root))) {
      continue;
    }

    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidate = join(root, entry.name);
      if (!(await pathExists(join(candidate, ".git")))) {
        continue;
      }

      try {
        const remote = normalizeRemote(await git(["-C", candidate, "config", "--get", "remote.origin.url"]));
        if (remote && !index.has(remote)) {
          index.set(remote, candidate);
        }
      } catch {
        // Ignore directories that look like git repos but do not have an origin remote.
      }
    }
  }

  return index;
}

function parseNumstat(output) {
  return output.split(/\r?\n/).reduce(
    (total, line) => {
      const [additions, deletions] = line.trim().split(/\s+/);
      const added = Number(additions);
      const deleted = Number(deletions);
      if (Number.isFinite(added)) {
        total.additions += added;
      }
      if (Number.isFinite(deleted)) {
        total.deletions += deleted;
      }
      return total;
    },
    { additions: 0, deletions: 0 },
  );
}

async function localRepoChurn(repo, repoDir) {
  const branchRef = `origin/${repo.default_branch || "main"}`;
  try {
    const output = await git(["-C", repoDir, "log", "--numstat", "--pretty=tformat:", branchRef]);
    return parseNumstat(output);
  } catch {
    const output = await git(["-C", repoDir, "log", "--numstat", "--pretty=tformat:"]);
    return parseNumstat(output);
  }
}

async function repoApiChurn(repo) {
  console.warn(`Using GitHub commit stats for ${repo.full_name}`);
  const commits = [];
  let page = 1;

  while (page <= 10) {
    const path = `/repos/${repo.full_name}/commits?sha=${repo.default_branch || "main"}&per_page=100&page=${page}`;
    const batch = await githubJson(path);
    commits.push(...batch.map((commit) => commit.sha));
    if (batch.length < 100) {
      break;
    }
    page += 1;
  }

  const churn = { additions: 0, deletions: 0 };
  let nextCommit = 0;
  const workerCount = Math.max(1, Math.min(API_CHURN_CONCURRENCY, commits.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextCommit < commits.length) {
        const sha = commits[nextCommit];
        nextCommit += 1;
        const detail = await githubJson(`/repos/${repo.full_name}/commits/${sha}`);
        churn.additions += Number(detail.stats?.additions || 0);
        churn.deletions += Number(detail.stats?.deletions || 0);
      }
    }),
  );

  return churn;
}

async function repoChurn(repo, localRepos) {
  const localRepo = localRepos.get(repo.full_name.toLowerCase());
  if (localRepo) {
    console.warn(`Using local git history for ${repo.full_name}`);
    return localRepoChurn(repo, localRepo);
  }

  try {
    return await repoApiChurn(repo);
  } catch (error) {
    console.warn(`Skipping churn for ${repo.full_name}: ${error.message}`);
    return { additions: 0, deletions: 0 };
  }
}

async function realChurn(repos) {
  const localRepos = await localRepoIndex();
  const churn = { additions: 0, deletions: 0 };
  let nextRepo = 0;
  const workerCount = Math.max(1, Math.min(CHURN_CONCURRENCY, repos.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextRepo < repos.length) {
        const repo = repos[nextRepo];
        nextRepo += 1;
        const repoTotals = await repoChurn(repo, localRepos);
        churn.additions += repoTotals.additions;
        churn.deletions += repoTotals.deletions;
      }
    }),
  );
  return churn;
}

async function profileStats() {
  try {
    const user = await githubJson(`/users/${USERNAME}`);
    const repos = await listRepos();
    const repoStats = await Promise.all(repos.map(async (repo) => ({ commits: await commitCount(repo) })));
    const churn = await realChurn(repos);
    const netLines = Math.max(0, churn.additions - churn.deletions);

    return {
      repos: repos.length,
      contributed: repoStats.filter((item) => item.commits > 0).length,
      stars: repos.reduce((total, repo) => total + repo.stargazers_count, 0),
      commits: repoStats.reduce((total, item) => total + item.commits, 0),
      followers: user.followers,
      lines: netLines,
      additions: churn.additions,
      deletions: churn.deletions,
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

function locLine(y, stats) {
  return `<tspan x="80" y="${y}" class="cc">- </tspan><tspan class="key">Lines of Code on GitHub</tspan><tspan class="cc">: ............. </tspan><tspan x="420" y="${y}" class="value">${number(stats.lines)}</tspan><tspan class="cc"> ( </tspan><tspan class="plus">${number(stats.additions)}++</tspan><tspan class="cc">, </tspan><tspan class="minus">${number(stats.deletions)}--</tspan><tspan class="cc"> )</tspan>`;
}

function section(y, label, x = 80) {
  return `<tspan x="${x}" y="${y}" class="cc">- ${escapeXml(label)} ------------------------------------------------------------------------------------</tspan>`;
}

function svg(theme, stats) {
  const repoLine = `${number(stats.repos)} {Contributed: ${number(stats.contributed)}} | Stars: ${number(stats.stars)}`;
  const commitLine = `${number(stats.commits)} | Followers: ${number(stats.followers)}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" font-family="ConsolasFallback,Consolas,monospace" width="985px" height="744px" viewBox="0 0 985 744" font-size="15px" text-rendering="geometricPrecision">
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
.plus {fill: ${theme.plus};}
.minus {fill: ${theme.minus};}
.cc {fill: ${theme.cc};}
.card-text {fill: ${theme.text};}
text, tspan {white-space: pre;}
</style>
<rect width="985px" height="744px" fill="${theme.card}" rx="22"/>
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
${line(608, "Discord", staticProfile.discord)}
${section(646, "GitHub Stats")}
${line(670, "Repos", repoLine)}
${line(694, "Commits", commitLine)}
${locLine(718, stats)}
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
    plus: "#3fb950",
    minus: "#f85149",
    cc: "#616e7f",
  };

  const light = {
    card: "#f6f8fa",
    text: "#24292f",
    key: "#953800",
    value: "#0a3069",
    plus: "#1a7f37",
    minus: "#cf222e",
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
