/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import {
  clearTimeout,
  setTimeout,
} from "resource://gre/modules/Timer.sys.mjs";
import {
  classifyVibesTexts,
  VIBES_CATEGORIES,
} from "moz-src:///browser/components/LitheVibesClassifier.sys.mjs";

const lazy = XPCOMUtils.declareLazy({
  CustomizableUI:
    "moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs",
});

const WIDGET_ID = "lithe-vibes-button";
const STATE_PREF = "lithe.vibes.localProfile";
const LAUNCH_PAGE = "chrome://browser/content/lithe-vibes/vibes.html";
const DDG_SEARCH = "https://html.duckduckgo.com/html/";
const MAX_SEEN = 240;
const FETCH_LIMIT_BYTES = 72 * 1024;
const BLOCKED_HOSTS = new Set([
  "duckduckgo.com",
  "html.duckduckgo.com",
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
]);

export const VIBES_CANDIDATES = [
  {
    title: "Radio Garden",
    url: "https://radio.garden/",
    tags: ["music-discovery", "radio", "interactive"],
  },
  {
    title: "Neal.fun",
    url: "https://neal.fun/",
    tags: ["games", "interactive", "weird-web"],
  },
  {
    title: "Earth Nullschool",
    url: "https://earth.nullschool.net/",
    tags: ["environment", "maps", "weather"],
  },
  {
    title: "WindowSwap",
    url: "https://www.window-swap.com/",
    tags: ["relaxing", "travel", "video"],
  },
  {
    title: "Public Domain Review",
    url: "https://publicdomainreview.org/",
    tags: ["history", "visual-art", "archives"],
  },
  {
    title: "Atlas Obscura",
    url: "https://www.atlasobscura.com/",
    tags: ["travel", "history", "weird-web"],
  },
  {
    title: "Open Culture",
    url: "https://www.openculture.com/",
    tags: ["education", "world-cultures", "books"],
  },
  {
    title: "Project Gutenberg",
    url: "https://www.gutenberg.org/",
    tags: ["books", "literature", "archives"],
  },
  {
    title: "NASA Image of the Day",
    url: "https://www.nasa.gov/image-of-the-day/",
    tags: ["space", "astronomy", "photography"],
  },
  {
    title: "Stellarium Web",
    url: "https://stellarium-web.org/",
    tags: ["space", "astronomy", "interactive"],
  },
  {
    title: "Colossal",
    url: "https://www.thisiscolossal.com/",
    tags: ["visual-art", "graphic-design", "photography"],
  },
  {
    title: "Internet Archive",
    url: "https://archive.org/",
    tags: ["archives", "books", "nostalgia"],
  },
];

function normalizedScores(scores) {
  if (!scores || typeof scores !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(scores)
      .filter(([, value]) => Number.isFinite(value))
      .map(([tag, value]) => [tag, Math.max(-5, Math.min(8, value))])
  );
}

export function normalizeVibesState(state = {}) {
  return {
    scores: normalizedScores(state.scores),
    seen: Array.isArray(state.seen)
      ? state.seen.filter(url => typeof url === "string").slice(-MAX_SEEN)
      : [],
    last:
      state.last && typeof state.last === "object"
        ? {
            url: String(state.last.url || ""),
            title: String(state.last.title || ""),
            tags: Array.isArray(state.last.tags)
              ? state.last.tags.filter(tag => typeof tag === "string")
              : [],
            tagScores:
              state.last.tagScores && typeof state.last.tagScores === "object"
                ? normalizedScores(state.last.tagScores)
                : {},
            classifier: String(state.last.classifier || ""),
            discovery: String(state.last.discovery || ""),
            startedAt: Number(state.last.startedAt) || 0,
            feedbackGiven: Boolean(state.last.feedbackGiven),
            learnedAt: Number(state.last.learnedAt) || 0,
          }
        : null,
  };
}

function candidateTagScore(candidate, tag) {
  const classified = candidate.tagScores?.[tag];
  return Number.isFinite(classified) ? Math.max(0.1, classified) : 0.35;
}

export function selectVibesCandidate(candidates, inputState, random = Math.random) {
  const state = normalizeVibesState(inputState);
  let available = candidates.filter(candidate => !state.seen.includes(candidate.url));
  if (!available.length) {
    state.seen = [];
    available = [...candidates];
  }
  if (!available.length) {
    return { candidate: null, state };
  }

  const weighted = available.map(candidate => {
    const affinity = candidate.tags.reduce(
      (total, tag) =>
        total + (state.scores[tag] || 0) * candidateTagScore(candidate, tag),
      0
    );
    const exploration = candidate.tags.some(tag => !(tag in state.scores))
      ? 0.28
      : 0;
    const rankBonus = Math.max(0, 0.32 - (candidate.searchRank || 0) * 0.04);
    return {
      candidate,
      weight: Math.max(0.08, 1 + affinity * 0.38 + exploration + rankBonus),
    };
  });
  const totalWeight = weighted.reduce((total, item) => total + item.weight, 0);
  let cursor = random() * totalWeight;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return { candidate: item.candidate, state };
    }
  }
  return { candidate: weighted.at(-1).candidate, state };
}

export function updateVibesState(inputState, candidate, delta) {
  const state = normalizeVibesState(inputState);
  for (const tag of candidate.tags) {
    const scaledDelta = delta * candidateTagScore(candidate, tag);
    state.scores[tag] = Math.max(
      -5,
      Math.min(8, (state.scores[tag] || 0) + scaledDelta)
    );
  }
  if (state.last?.url === candidate.url) {
    state.last.feedbackGiven = true;
    state.last.learnedAt ||= Date.now();
  }
  return state;
}

export function recordPassiveVibesInterest(inputState, now = Date.now()) {
  let state = normalizeVibesState(inputState);
  if (!state.last || state.last.feedbackGiven || state.last.learnedAt) {
    return state;
  }

  const dwellMS = Math.max(0, now - state.last.startedAt);
  const delta = dwellMS >= 90_000 ? 0.5 : dwellMS >= 25_000 ? 0.22 : 0;
  if (delta) {
    state = updateVibesState(state, state.last, delta);
    state.last.feedbackGiven = false;
  }
  state.last.learnedAt = now;
  return state;
}

function topInterestIds(state, limit = 2) {
  return Object.entries(state.scores)
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([id]) => id);
}

export function buildVibesDiscoveryQuery(inputState, random = Math.random) {
  const state = normalizeVibesState(inputState);
  const categoryById = new Map(
    VIBES_CATEGORIES.map(category => [category.id, category])
  );
  const interests = topInterestIds(state)
    .map(id => categoryById.get(id))
    .filter(Boolean);
  const explore =
    VIBES_CATEGORIES[
      Math.min(
        VIBES_CATEGORIES.length - 1,
        Math.floor(random() * VIBES_CATEGORIES.length)
      )
    ];
  const terms = [...interests, explore]
    .filter((category, index, all) =>
      all.findIndex(item => item.id === category.id) === index
    )
    .slice(0, 2)
    .map(category => `"${category.label}"`)
    .join(" ");
  return `${terms} interesting independent website -site:facebook.com -site:pinterest.com`;
}

function unwrapDuckDuckGoURL(href) {
  try {
    const url = new URL(href, DDG_SEARCH);
    if (url.hostname.endsWith("duckduckgo.com")) {
      const unwrapped = url.searchParams.get("uddg");
      if (unwrapped) {
        return decodeURIComponent(unwrapped);
      }
    }
    return url.href;
  } catch {
    return "";
  }
}

export function sanitizeVibesCandidateURL(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return "";
    }
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !host ||
      BLOCKED_HOSTS.has(host) ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.includes(":") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
      (url.port && !["80", "443"].includes(url.port))
    ) {
      return "";
    }
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function hiddenDocumentFromHTML(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

export function parseDuckDuckGoResults(html) {
  const document = hiddenDocumentFromHTML(html);
  const rows = [...document.querySelectorAll(".result")];
  const results = [];
  const seenDomains = new Set();
  for (const [index, row] of rows.entries()) {
    const anchor = row.querySelector("a.result__a, h2 a, a[href]");
    const rawURL = unwrapDuckDuckGoURL(anchor?.getAttribute("href") || "");
    const url = sanitizeVibesCandidateURL(rawURL);
    if (!url) {
      continue;
    }
    const domain = new URL(url).hostname.toLowerCase();
    if (seenDomains.has(domain)) {
      continue;
    }
    seenDomains.add(domain);
    const snippet =
      row.querySelector(".result__snippet")?.textContent?.trim() || "";
    results.push({
      title: anchor.textContent.trim() || domain,
      url,
      snippet,
      searchRank: index,
    });
    if (results.length >= 10) {
      break;
    }
  }
  return results;
}

export function extractReadablePageText(html, fallback = {}) {
  try {
    const document = hiddenDocumentFromHTML(html);
    for (const node of document.querySelectorAll(
      "script, style, noscript, template, svg"
    )) {
      node.remove();
    }
    const description =
      document.querySelector('meta[name="description"], meta[property="og:description"]')
        ?.content || "";
    const headings = [...document.querySelectorAll("h1, h2, h3")]
      .slice(0, 16)
      .map(node => node.textContent)
      .join(" ");
    const paragraphs = [...document.querySelectorAll("main p, article p, p")]
      .slice(0, 24)
      .map(node => node.textContent)
      .join(" ");
    return [
      document.title,
      description,
      headings,
      paragraphs,
      fallback.title,
      fallback.snippet,
    ]
      .filter(Boolean)
      .join(". ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch {
    return `${fallback.title || ""}. ${fallback.snippet || ""}`.trim();
  }
}

async function readLimitedResponse(response, byteLimit) {
  if (!response.body?.getReader) {
    return (await response.text()).slice(0, byteLimit);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (received < byteLimit) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const usable = value.subarray(0, byteLimit - received);
    received += usable.byteLength;
    text += decoder.decode(usable, { stream: received < byteLimit });
    if (usable.byteLength < value.byteLength) {
      await reader.cancel();
      break;
    }
  }
  text += decoder.decode();
  return text;
}

async function fetchLimitedText(url, { timeoutMS = 6500, htmlOnly = true } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: { Accept: "text/html,application/xhtml+xml;q=0.9" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const finalURL = sanitizeVibesCandidateURL(response.url);
    if (!finalURL && !response.url.startsWith("https://html.duckduckgo.com/")) {
      throw new Error("Vibes refused a redirect to a local or unsafe address");
    }
    const type = response.headers.get("content-type") || "";
    if (htmlOnly && type && !/html|xhtml/i.test(type)) {
      throw new Error(`Unsupported candidate content type: ${type}`);
    }
    return await readLimitedResponse(response, FETCH_LIMIT_BYTES);
  } finally {
    clearTimeout(timeout);
  }
}

function shuffledTopResults(results, random) {
  const pool = results.slice(0, 8);
  for (let index = pool.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, 3);
}

async function discoverVibesCandidates(state, random = Math.random) {
  const query = buildVibesDiscoveryQuery(state, random);
  const searchURL = `${DDG_SEARCH}?q=${encodeURIComponent(query)}&kl=wt-wt&kp=-2`;
  const html = await fetchLimitedText(searchURL, { timeoutMS: 8000 });
  const unseen = parseDuckDuckGoResults(html).filter(
    result => !state.seen.includes(result.url)
  );
  const searchResults = shuffledTopResults(
    unseen.length >= 3 ? unseen : parseDuckDuckGoResults(html),
    random
  );
  if (!searchResults.length) {
    throw new Error("DuckDuckGo returned no usable websites");
  }

  const pageTexts = await Promise.all(
    searchResults.map(async result => {
      try {
        const pageHTML = await fetchLimitedText(result.url);
        return extractReadablePageText(pageHTML, result);
      } catch (error) {
        console.error(`Vibes could not pre-read ${result.url}`, error);
        return `${result.title}. ${result.snippet}`;
      }
    })
  );
  const classifications = await classifyVibesTexts(pageTexts);
  return searchResults.map((result, index) => {
    const tags = classifications[index]?.tags || [];
    return {
      ...result,
      tags: tags.map(tag => tag.id),
      tagScores: Object.fromEntries(tags.map(tag => [tag.id, tag.score])),
      classifier: classifications[index]?.source || "local-keywords",
    };
  });
}

function minimumDelay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export const LitheVibes = {
  _tabs: new WeakMap(),
  _pending: new WeakMap(),

  init() {
    if (!Services.prefs.getBoolPref("lithe.vibes.available", true)) {
      return;
    }

    lazy.CustomizableUI.createWidget({
      id: WIDGET_ID,
      type: "button",
      localized: false,
      label: "Vibes",
      tooltiptext: "Vibes — discover something interesting",
      defaultArea: lazy.CustomizableUI.AREA_NAVBAR,
      removable: true,
      showInPrivateBrowsing: false,
      onCreated(node) {
        node.style.listStyleImage =
          'url("chrome://branding/content/about-logo.svg")';
      },
      onCommand: event => this.next(event.view),
    });
  },

  _loadState() {
    try {
      return normalizeVibesState(
        JSON.parse(Services.prefs.getStringPref(STATE_PREF, "{}"))
      );
    } catch {
      return normalizeVibesState();
    }
  },

  _saveState(state) {
    Services.prefs.setStringPref(
      STATE_PREF,
      JSON.stringify(normalizeVibesState(state))
    );
  },

  _findTab(win) {
    const cached = this._tabs.get(win);
    if (cached?.parentNode) {
      return cached;
    }
    const tab = [...win.gBrowser.tabs].find(
      item => item.getAttribute("lithe-vibes-tab") === "true"
    );
    if (tab) {
      this._tabs.set(win, tab);
    }
    return tab;
  },

  _showLaunchPage(win) {
    const url = `${LAUNCH_PAGE}?round=${Date.now()}`;
    let tab = this._findTab(win);
    if (!tab) {
      tab = win.gBrowser.addTrustedTab(url, { inBackground: false });
      tab.setAttribute("lithe-vibes-tab", "true");
      this._tabs.set(win, tab);
    } else {
      tab.linkedBrowser.loadURI(Services.io.newURI(url), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      });
    }
    win.gBrowser.selectedTab = tab;
    return tab;
  },

  async next(win) {
    if (this._pending.get(win)) {
      const tab = this._findTab(win);
      if (tab) {
        win.gBrowser.selectedTab = tab;
      }
      return this._pending.get(win);
    }

    const pending = this._next(win).finally(() => this._pending.delete(win));
    this._pending.set(win, pending);
    return pending;
  },

  async _next(win) {
    if (!Services.prefs.getBoolPref("lithe.vibes.enabled", false)) {
      const enabled = Services.prompt.confirm(
        win,
        "Turn on Vibes?",
        "Vibes sends DuckDuckGo a generic category query, then pre-reads up to three candidate pages without cookies so its bundled classifier can choose locally. Your browsing history and taste profile never leave this Lithe profile."
      );
      if (!enabled) {
        return;
      }
      Services.prefs.setBoolPref("lithe.vibes.enabled", true);
    }

    let state = recordPassiveVibesInterest(this._loadState());
    this._saveState(state);
    const tab = this._showLaunchPage(win);
    const animationMS = Math.max(
      0,
      Services.prefs.getIntPref("lithe.vibes.animation.minimumMS", 3000)
    );
    const liveDiscovery = Services.prefs.getBoolPref(
      "lithe.vibes.discovery.enabled",
      true
    );

    let candidates = VIBES_CANDIDATES;
    const launchStartedAt = Date.now();
    try {
      const [, discovered] = await Promise.all([
        minimumDelay(animationMS),
        liveDiscovery
          ? discoverVibesCandidates(state)
          : Promise.resolve(VIBES_CANDIDATES),
      ]);
      if (discovered.some(candidate => candidate.tags.length)) {
        candidates = discovered;
      }
    } catch (error) {
      console.error("Lithe Vibes used its offline discovery catalog", error);
      await minimumDelay(
        Math.max(0, animationMS - (Date.now() - launchStartedAt))
      );
    }

    if (!tab.parentNode) {
      return;
    }
    const selection = selectVibesCandidate(candidates, state);
    const { candidate } = selection;
    if (!candidate) {
      return;
    }
    state = selection.state;
    state.seen.push(candidate.url);
    state.seen = state.seen.slice(-MAX_SEEN);
    state.last = {
      url: candidate.url,
      title: candidate.title,
      tags: candidate.tags,
      tagScores: candidate.tagScores || {},
      classifier: candidate.classifier || "offline-catalog",
      discovery: candidate.classifier ? "duckduckgo" : "offline-catalog",
      startedAt: Date.now(),
      feedbackGiven: false,
      learnedAt: 0,
    };
    this._saveState(state);

    win.gBrowser.selectedTab = tab;
    tab.linkedBrowser.loadURI(Services.io.newURI(candidate.url), {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });

    const notificationBox = win.gBrowser.getNotificationBox(tab.linkedBrowser);
    notificationBox.getNotificationWithValue("lithe-vibes-feedback")?.close();
    await notificationBox.appendNotification(
      "lithe-vibes-feedback",
      {
        label: `Vibes · ${candidate.title}`,
        priority: notificationBox.PRIORITY_INFO_MEDIUM,
      },
      [
        {
          label: "More like this",
          callback: () => this.feedback(candidate, 1),
        },
        {
          label: "Less like this",
          callback: () => {
            this.feedback(candidate, -1);
            this.next(win);
          },
        },
        { label: "Next", callback: () => this.next(win) },
      ]
    );
  },

  feedback(candidate, delta) {
    this._saveState(updateVibesState(this._loadState(), candidate, delta));
  },
};
