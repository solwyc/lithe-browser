# Lithe privacy boundaries

Lithe is designed so its project-specific personalization stays on the local
device. The browser does not operate a Lithe telemetry or advertising service.

Default Lithe builds disable Mozilla telemetry upload, studies, sponsored new
tab content, speculative connections, link prefetching, and Firefox-hosted AI
product surfaces. AI Protection is enabled by default and can be toggled in
Privacy settings. Websites can still collect data you choose to send them, and
ordinary browsing necessarily contacts the sites, CDNs, certificate services,
and search providers involved in a request.

## Search

DuckDuckGo is the default search engine. A search entered in the address bar is
sent to DuckDuckGo under DuckDuckGo's own privacy terms.

## Vibes

Vibes is off until the user enables it. When enabled:

- a generic category query is sent to DuckDuckGo;
- up to three candidate pages may be fetched without cookies or a referrer and
  without executing their scripts;
- the bundled MIT-licensed BGE Small model classifies candidate text locally;
- likes, dislikes, dwell signals, category scores, and seen URLs are stored only
  in the current Lithe profile;
- seen history retains up to 1,000 URLs, matches at the domain level, and is
  never silently reset when a discovery search runs out of fresh sites; and
- Vibes does not send the local taste profile or ordinary browsing history to a
  model provider, Google, or a Lithe server.

If live discovery is unavailable, Vibes uses its bundled offline catalog.

## Alpha notice

Lithe is experimental software. These defaults are test-covered and auditable
in this repository, but they are not a promise of anonymity. Review the source
and use network inspection if your threat model requires stronger assurance.
