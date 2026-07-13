/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This file contains branding-specific prefs.

pref("startup.homepage_override_url", "");
pref("startup.homepage_welcome_url", "");
pref("startup.homepage_welcome_url.additional", "");
// The time interval between checks for a new version (in seconds)
pref("app.update.interval", 86400); // 24 hours
// Give the user x seconds to react before showing the big UI. default=24 hours
pref("app.update.promptWaitTime", 86400);
// URL user can browse to manually if for some reason all update installation
// attempts fail.
pref("app.update.url.manual", "https://github.com/solwyc/lithe-browser/releases/latest");
// A default value for the "More information about this update" link
// supplied in the "An update is available" page of the update wizard.
pref("app.update.url.details", "https://github.com/solwyc/lithe-browser/releases/latest");
pref("app.releaseNotesURL.aboutDialog", "https://github.com/solwyc/lithe-browser/releases/latest");
pref("app.update.auto", false);
pref("app.update.service.enabled", false);

// The number of days a binary is permitted to be old
// without checking for an update.  This assumes that
// app.update.checkInstallTime is true.
pref("app.update.checkInstallTime.days", 2);

// Give the user x seconds to reboot before showing a badge on the hamburger
// button. default=immediately
pref("app.update.badgeWaitTime", 0);

// Number of usages of the web console.
// If this is less than 5, then pasting code into the web console is disabled
pref("devtools.selfxss.count", 5);

// Lithe defaults: keep the browser quiet, compact, and predictable.
pref("browser.uidensity", 1);
pref("browser.startup.homepage", "about:newtab");
pref("browser.toolbars.bookmarks.visibility", "newtab");
pref("browser.newtabpage.activity-stream.showSponsored", false);
pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
pref("browser.newtabpage.activity-stream.feeds.topsites", true);
pref("browser.newtabpage.activity-stream.default.sites", "");
pref("browser.newtabpage.activity-stream.logowordmark.alwaysVisible", true);
pref("browser.newtabpage.activity-stream.showWeather", false);
pref("browser.newtabpage.activity-stream.system.showWeather", false);
pref("browser.newtabpage.activity-stream.widgets.weather.enabled", false);
pref("browser.newtabpage.activity-stream.widgets.system.weather.enabled", false);
pref("browser.newtabpage.activity-stream.widgets.system.weatherForecast.enabled", false);
pref("browser.newtabpage.activity-stream.discoverystream.promoCard.visible", false);
pref("browser.newtabpage.activity-stream.unifiedAds.tiles.enabled", false);
pref("browser.newtabpage.activity-stream.unifiedAds.spocs.enabled", false);
pref("browser.newtabpage.activity-stream.unifiedAds.ohttp.enabled", false);
pref("browser.urlbar.suggest.quicksuggest.sponsored", false);
pref("browser.urlbar.sponsoredTopSites", false);
pref("browser.search.suggest.enabled", false);

// Lithe privacy and local discovery controls.
pref("lithe.privacy.aiProtection.enabled", true);
pref("lithe.search.defaultInitialized", false);
pref("lithe.search.defaultMigrationVersion", 0);
pref("lithe.vibes.available", true);
pref("lithe.vibes.enabled", false);
pref("lithe.vibes.discovery.enabled", true);
pref("lithe.vibes.animation.minimumMS", 3000);
pref("lithe.vibes.classifier", "bge-small-en-v1.5-q8");
pref("lithe.vibes.runtimeMigrationVersion", 0);
pref("lithe.vibes.toolbarMigrationVersion", 0);

// Avoid speculative/background work that trades memory, network activity, and
// privacy for small anticipatory speed gains. Foreground loading is unchanged.
pref("browser.newtab.preload", false);
pref("browser.tabs.hoverPreview.showThumbnails", false);
pref("browser.pagethumbnails.capturing_disabled", true);
pref("browser.sessionstore.interval", 30000);
pref("browser.urlbar.speculativeConnect.enabled", false);
pref("network.prefetch-next", false);

// Avoid preloading idle content processes while preserving Fission site
// isolation and Gecko's dedicated media/RDD/GPU process boundaries. The
// startup resource policy adapts these caps to installed memory.
pref("lithe.resourcePolicy.enabled", true);
pref("lithe.resourcePolicy.checkIntervalMS", 30000);
pref("lithe.resourcePolicy.softLimitMB", 2048);
pref("lithe.resourcePolicy.activeTier", "fallback");
pref("dom.ipc.processCount", 4);
pref("dom.ipc.processCount.webIsolated", 2);
pref("dom.ipc.processPrelaunch.enabled", false);
pref("dom.ipc.processPrelaunch.fission.number", 0);
pref("dom.ipc.keepProcessesAlive.privilegedabout", 0);
pref("browser.tabs.unloadOnLowMemory", true);
pref("browser.tabs.min_inactive_duration_before_unload", 300000);

// Tighten background timer budgets without changing foreground page behavior.
pref("dom.timeout.background_budget_regeneration_rate", 200);
pref("dom.timeout.background_throttling_max_budget", 25);
pref("dom.timeout.budget_throttling_max_delay", 30000);
pref("dom.timeout.throttling_delay", 10000);

// Keep built-in hang detection active even when a runaway page is not
// receiving user input. Normal yielding JavaScript is unaffected.
pref("dom.ipc.processHangMonitor", true);
pref("dom.max_script_run_time", 10);
pref("dom.max_script_run_time.require_critical_input", false);
pref("dom.global_stop_script", true);

// Keep Firefox AI product surfaces off while allowing Vibes to use Gecko's
// local inference runtime with its bundled model. No hosted inference is used.
pref("browser.ml.enable", true);
pref("extensions.ml.enabled", false);
pref("browser.ml.chat.enabled", false);
pref("browser.ml.linkPreview.enabled", false);
pref("browser.smartwindow.enabled", false);
pref("browser.shopping.experience2023.enabled", false);
pref("browser.shopping.experience2023.integratedSidebar", false);
pref("extensions.htmlaboutaddons.recommendations.enabled", false);

// No background telemetry upload in Lithe builds.
pref("datareporting.healthreport.uploadEnabled", false);
pref("datareporting.usage.uploadEnabled", false);
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
pref("datareporting.policy.firstRunURL", "");
pref("toolkit.telemetry.enabled", false);
pref("toolkit.telemetry.unified", false);
pref("browser.newtabpage.activity-stream.telemetry", false);
pref("browser.newtabpage.activity-stream.telemetry.privatePing.enabled", false);
pref("browser.crashReports.unsubmittedCheck.enabled", false);
pref("browser.tabs.crashReporting.sendReport", false);
pref("breakpad.reportURL", "");
pref("app.normandy.enabled", false);
pref("app.shield.optoutstudies.enabled", false);
pref("browser.discovery.enabled", false);
