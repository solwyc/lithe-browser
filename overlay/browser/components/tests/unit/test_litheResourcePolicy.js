/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { getLitheResourceTier } = ChromeUtils.importESModule(
  "moz-src:///browser/components/LitheResourcePolicy.sys.mjs"
);
const {
  buildVibesDiscoveryQuery,
  chooseUnseenVibesResults,
  hasSeenVibesCandidate,
  recordPassiveVibesInterest,
  sanitizeVibesCandidateURL,
  selectVibesCandidate,
  updateVibesState,
  VIBES_CANDIDATES,
} =
  ChromeUtils.importESModule(
    "moz-src:///browser/components/LitheVibes.sys.mjs"
  );
const {
  classifyVibesTextLexically,
  rankCategoryEmbeddings,
  VIBES_CATEGORIES,
} = ChromeUtils.importESModule(
  "moz-src:///browser/components/LitheVibesClassifier.sys.mjs"
);

const GIB = 1024 * 1024 * 1024;

add_task(function test_resource_tiers_are_bounded() {
  Assert.deepEqual(getLitheResourceTier(4 * GIB), {
    name: "minimal",
    processCount: 2,
    webIsolatedProcessCount: 1,
    softLimitMB: 640,
    minInactiveMs: 60_000,
    lowCommitThresholdMB: 512,
  });
  Assert.equal(getLitheResourceTier(8 * GIB).name, "lean");
  Assert.equal(getLitheResourceTier(16 * GIB).name, "balanced");

  const roomy = getLitheResourceTier(128 * GIB);
  Assert.equal(roomy.name, "roomy");
  Assert.equal(roomy.processCount, 4);
  Assert.equal(roomy.softLimitMB, 2048);
});

add_task(function test_vibes_selection_and_feedback_stay_local() {
  const first = selectVibesCandidate(VIBES_CANDIDATES, {}, () => 0);
  Assert.equal(first.candidate, VIBES_CANDIDATES[0]);

  first.state.seen.push(first.candidate.url);
  const second = selectVibesCandidate(VIBES_CANDIDATES, first.state, () => 0);
  Assert.notEqual(second.candidate.url, first.candidate.url);

  const updated = updateVibesState({}, first.candidate, 1);
  for (const tag of first.candidate.tags) {
    Assert.equal(updated.scores[tag], 0.35);
  }

  const exhausted = selectVibesCandidate(
    VIBES_CANDIDATES,
    { seen: VIBES_CANDIDATES.map(candidate => candidate.url) },
    () => 0
  );
  Assert.equal(exhausted.candidate, null, "seen history is never silently reset");
});

add_task(function test_vibes_has_130_distinct_semantic_categories() {
  Assert.equal(VIBES_CATEGORIES.length, 130);
  Assert.equal(new Set(VIBES_CATEGORIES.map(category => category.id)).size, 130);

  const vectors = VIBES_CATEGORIES.map(() => [0, 1]);
  const spaceIndex = VIBES_CATEGORIES.findIndex(category => category.id == "space");
  vectors[spaceIndex] = [1, 0];
  const ranked = rankCategoryEmbeddings([1, 0], vectors, 1);
  Assert.equal(ranked[0].id, "space");

  const lexical = classifyVibesTextLexically(
    "NASA astronauts launched a rocket on a new space mission"
  );
  Assert.ok(
    lexical.some(category => category.id == "space"),
    "The zero-cost fallback recognizes obvious category language"
  );
});

add_task(function test_vibes_query_reveals_only_generic_categories() {
  const query = buildVibesDiscoveryQuery({ scores: { space: 3 } }, () => 0);
  Assert.ok(query.includes('"Space"'));
  Assert.ok(query.includes('"Visual art"'));
  Assert.ok(query.includes("interesting independent website"));
  Assert.ok(!query.includes("history"));

  const differentExploration = buildVibesDiscoveryQuery(
    { scores: { space: 3, astronomy: 2 } },
    () => 0.9
  );
  Assert.ok(differentExploration.includes('"Space"'));
  Assert.notEqual(differentExploration, query);
});

add_task(function test_vibes_never_reintroduces_seen_sites_when_results_are_thin() {
  const results = [
    { url: "https://www.example.com/new-page", title: "Same site" },
    { url: "https://fresh.example.net/", title: "Fresh site" },
  ];
  const state = { seen: ["https://example.com/already-seen"] };
  Assert.ok(hasSeenVibesCandidate(state, results[0]));

  const chosen = chooseUnseenVibesResults(results, state, () => 0);
  Assert.deepEqual(
    chosen.map(result => result.url),
    ["https://fresh.example.net/"],
    "fewer than three fresh results must not reopen seen domains"
  );
});

add_task(function test_vibes_candidate_urls_cannot_target_local_services() {
  Assert.equal(sanitizeVibesCandidateURL("http://127.0.0.1/admin"), "");
  Assert.equal(sanitizeVibesCandidateURL("http://router.local/"), "");
  Assert.equal(sanitizeVibesCandidateURL("file:///C:/secret.txt"), "");
  Assert.equal(
    sanitizeVibesCandidateURL("https://example.com/a#fragment"),
    "https://example.com/a"
  );
});

add_task(function test_vibes_passive_learning_requires_meaningful_dwell() {
  const state = {
    scores: {},
    seen: [],
    last: {
      url: "https://example.com/",
      title: "Example",
      tags: ["space"],
      startedAt: 1000,
    },
  };
  const tooFast = recordPassiveVibesInterest(state, 20_000);
  Assert.equal(tooFast.scores.space, undefined);

  state.last.startedAt = 1000;
  const interested = recordPassiveVibesInterest(state, 100_000);
  Assert.greater(interested.scores.space, 0);
});
