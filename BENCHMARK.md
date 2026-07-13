# Lithe benchmark and architecture notes

This is a reproducible engineering baseline, not a victory lap. On the July 13,
2026 synthetic six-tab test, Lithe used fewer processes and completed the
JavaScript-only part of the workload faster than Chrome, but Chrome launched
faster and used substantially less memory and CPU. Lithe's current resource
policy is useful, but the measurements show that it is not yet the low-RAM
browser we want it to become.

## Result at a glance

Median of five runs. Both browsers ran from the same internal NVMe, used a
fresh copy of an initialized isolated profile for every run, and opened the
same six local pages. Lower is better for every row.

| Metric | Lithe 0.1.3 alpha | Chrome 150 | Lithe vs. Chrome |
| --- | ---: | ---: | ---: |
| Startup to first local request | 1,695 ms | 461 ms | 268% slower |
| Six-tab completion | 2,162 ms | 1,315 ms | 64% slower |
| Median page workload | 190.0 ms | 184.2 ms | 3% slower |
| JavaScript portion | 45.0 ms | 64.1 ms | 30% faster |
| Peak whole-browser working set | 1,353 MiB | 885 MiB | 53% more |
| Peak process count | 12 | 14 | 14% fewer |
| Whole-browser CPU time | 7.656 s | 3.281 s | 133% more |

The result suggests that Lithe's conservative process cap is working, while
Gecko startup, per-process memory, and browser-level work currently dominate
the overall result. The 2 GiB policy threshold on this 32 GiB machine is a
soft trigger for unloading one eligible background tab; it is not a hard
browser memory cap and it does not shrink active tabs. Reducing the threshold
alone would not fix the measured six-active-tab workload.

Raw results, including all ten runs and observed network endpoints, are in
[`benchmarks/results/windows-2026-07-13.json`](benchmarks/results/windows-2026-07-13.json).

## Test environment and method

- Windows 11 build 26200, Intel Core i7-14700F, 32 GiB RAM.
- Lithe 0.1.3 alpha on Gecko 154.0a1; Chrome 150.0.7871.102.
- Browser windows were minimized, not headless. No extensions were installed.
- A local HTTP server served six pages across loopback hostnames. Each page
  sorts a typed array, creates 9,000 DOM nodes, paints 18,000 canvas rectangles,
  forces layout, and reports its own timings.
- Run order alternated Lithe/Chrome to reduce systematic warm-cache bias.
- Memory, CPU, process count, and TCP endpoints cover the browser's entire
  descendant process group. Profiles were prepared once, then copied fresh for
  each measured run.
- `Cache-Control: no-store` was used. The benchmark machine otherwise had its
  normal warm operating-system and executable caches.

This is a focused regression workload, not Speedometer, a battery-life test,
or a representative sample of every website. The engines and versions also
differ. Treat the numbers as a baseline for improving Lithe and rerun them on
low-memory hardware before making broad performance claims.

## Privacy probe

The same harness loaded a local page from a fresh profile and checked signals
visible to a website, speculative prefetch behavior, and TCP endpoints visible
during the short run.

| Observation | Lithe | Chrome default profile |
| --- | --- | --- |
| `navigator.globalPrivacyControl` | `true` | `undefined` |
| `Sec-GPC` request header | `1` | absent |
| `navigator.doNotTrack` | `1` | `null` |
| `DNT` request header | `1` | absent |
| Test prefetch requested | no | yes |
| External TCP endpoints observed | 3 | 3 |

This probe confirms the configured GPC, DNT, and prefetch defaults. Endpoint
counts are observations, not destination attribution or proof that either
browser does or does not send telemetry: the harness did not decrypt or
inspect payloads, and browser security services can make legitimate background
connections. A serious privacy audit should add DNS capture, destination
classification, payload-independent traffic analysis, storage partitioning
tests, and established fingerprinting/tracker test suites.

## Privacy regime

AI Protection is on by default and can be toggled. While enabled, Lithe turns
on Gecko's tracking, social, email, fingerprinting, cryptomining, query-string,
and bounce-tracking protections in normal and private windows. It sends Global
Privacy Control and Do Not Track signals. Sponsored content, suggestion ads,
studies, Normandy experiments, discovery reporting, telemetry, usage reporting,
prefetch, speculative connections, and new-tab preloading are disabled by
default.

The toggle records whether each affected preference had a user value and what
that value was. Turning protection off restores that prior state instead of
blindly imposing a second set of defaults.

Firefox-branded AI surfaces and extension ML features are blocked. Gecko's
local inference runtime remains available only because Vibes uses it locally;
Lithe does not need a hosted inference API. These defaults reduce tracking and
unwanted background work, but they do not make a user anonymous or replace a
VPN, Tor, operating-system hardening, or careful account use.

## Performance regime

Lithe selects a conservative tier from installed physical memory and changes
default preferences without overwriting deliberate user overrides.

| Installed RAM | Tier | General content processes | Site-isolated processes | Soft memory trigger | Background-tab age before unload |
| --- | --- | ---: | ---: | ---: | ---: |
| up to 4 GiB | minimal | 2 | 1 | 640 MiB | 60 s |
| up to 8 GiB | lean | 3 | 1 | 1,024 MiB | 120 s |
| up to 16 GiB | balanced | 4 | 2 | 1,536 MiB | 180 s |
| over 16 GiB | roomy | 4 | 2 | 2,048 MiB | 300 s |

Process prelaunch is disabled, low-memory tab unloading is enabled, and every
30 seconds Lithe totals Gecko's process memory. Above the tier's soft trigger,
it asks Gecko to unload the least-recently-used eligible background tab.
Script-hang monitoring remains enabled, the long-script threshold is ten
seconds, and background timer budgets are tightened. Compatibility-sensitive
features are kept when removing them would break modern media or common sites.

The next performance work should be driven by profiles, especially startup
traces and per-process memory reports. Likely experiments include delayed
initialization of nonessential browser modules, tighter Vibes model lifetime,
discarding background tabs more proactively under real pressure, and measuring
the cost of privacy services independently. The table above shows why claiming
Chrome parity on resource use would be premature.

## How Vibes recommends sites

Vibes keeps a local taste vector with one score for each of 130 human-readable
categories. A discovery round works as follows:

1. Choose the user's strongest positive category and a randomly selected
   exploration category. The exploration category is always present and is
   forced to differ from the interest category.
2. Send DuckDuckGo a generic query containing only those category labels and
   wording for an interesting independent website. The local taste vector,
   browsing history, feedback, and visited URLs are not sent.
3. Parse up to ten results, keeping one result per domain and rejecting search
   engines, local addresses, credentials, non-HTTP URLs, and unusual ports.
4. Remove domains already present in the local seen history. Randomly choose up
   to three fresh results from the first eight; seen sites are never added back
   merely because a search produced fewer than three fresh results.
5. Pre-read at most 72 KiB from each candidate without cookies, scripts,
   referrers, or persistent HTTP caching. Strip executable and decorative
   markup and keep at most 6,000 characters of page text.
6. Run the pinned, MIT-licensed `Xenova/bge-small-en-v1.5` q8 ONNX model on the
   CPU with two low-priority threads. It embeds category prompts and page text,
   then uses cosine similarity to assign the seven closest tags. A local
   keyword classifier is the failure fallback, and the model worker is shut
   down after the round.
7. Give each candidate a weight of
   `max(0.08, 1 + 0.38*affinity + explorationBonus + searchRankBonus)` and
   make a weighted-random choice. This balances learned taste, novelty, and
   search quality instead of repeatedly selecting the single top score.

Like and Nope feedback updates only the selected site's tag scores, scaled by
classifier confidence and clamped to `[-5, 8]`. Staying on a site for 25 or 90
seconds adds a small positive signal unless explicit feedback was already
given. The taste vector, seen list, and last feedback live in the user's local
browser profile; Vibes does not inspect ordinary browsing history.

Version 0.1.3 expands the local seen history from 240 to 1,000 URLs, treats any
page on an already-seen domain as seen, never silently clears that history when
the candidate pool is exhausted, and keeps a random exploration category in
every query. The Vibes tab also retains up to 50 Back/Next entries for the
current session.

Vibes is local-first, not network-free. DuckDuckGo receives the generic search,
and candidate sites receive limited page requests during pre-reading. They do
not receive Lithe cookies or a referring page from that pre-read.

## Reproduce

Install Python and the pinned benchmark dependency, close other Lithe and
Chrome windows, and run from the repository root:

```powershell
python -m pip install -r benchmarks\requirements.txt
python benchmarks\browser_benchmark.py `
  --lithe 'C:\path\to\Lithe\lithe.exe' `
  --chrome 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  --runs 5 `
  --lithe-version '0.1.3-alpha / Gecko 154.0a1' `
  --chrome-version '150.0.7871.102' `
  --output 'benchmarks\results\windows-local.json'
```

Do not compare executables on different storage devices. Close ambient browser
processes, report all unfavorable results, and keep the raw JSON with any
published summary.
