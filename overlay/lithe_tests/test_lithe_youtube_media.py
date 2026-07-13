import json

from marionette_driver import By, Wait
from marionette_harness import MarionetteTestCase


class TestLitheYouTubeMedia(MarionetteTestCase):
    def test_youtube_playback_and_decoder(self):
        self.marionette.timeout.page_load = 90
        self.marionette.timeout.script = 180
        self.marionette.set_window_rect(width=1280, height=900)
        self.marionette.set_pref("media.autoplay.default", 0)
        self.marionette.navigate(
            "https://www.youtube.com/watch?v=jNQXAC9IVRw"
        )

        video = Wait(self.marionette, timeout=60).until(
            lambda browser: browser.find_element(
                By.CSS_SELECTOR, "video.html5-main-video"
            ),
            message="YouTube did not create its HTML5 video element",
        )

        Wait(self.marionette, timeout=60).until(
            lambda browser: browser.execute_script(
                "return arguments[0].readyState >= 2;",
                script_args=(video,),
            ),
            message="YouTube video never became ready to play",
        )

        if self.marionette.execute_script(
            "return arguments[0].paused;", script_args=(video,)
        ):
            playback = self.marionette.execute_async_script(
                """
                const video = arguments[0];
                const done = arguments[arguments.length - 1];
                video.play().then(
                  () => done({ok: true}),
                  error => done({ok: false, error: String(error)})
                );
                """,
                script_args=(video,),
            )
            self.assertTrue(playback["ok"], playback.get("error"))

        Wait(self.marionette, timeout=30).until(
            lambda browser: browser.execute_script(
                "return !arguments[0].paused && arguments[0].currentTime > 1;",
                script_args=(video,),
            ),
            message="YouTube video did not advance after a WebDriver click",
        )

        state = self.marionette.execute_script(
            """
            const video = arguments[0];
            return {
              currentTime: video.currentTime,
              duration: video.duration,
              height: video.videoHeight,
              paused: video.paused,
              readyState: video.readyState,
              src: video.currentSrc,
              width: video.videoWidth,
            };
            """,
            script_args=(video,),
        )

        with self.marionette.using_context("chrome"):
            media = self.marionette.execute_async_script(
                """
                const done = arguments[arguments.length - 1];
                const { Troubleshoot } = ChromeUtils.importESModule(
                  "resource://gre/modules/Troubleshoot.sys.mjs"
                );
                Troubleshoot.snapshot().then(
                  snapshot => done({
                    audioBackend: snapshot.media?.currentAudioBackend,
                    codecSupportInfo: snapshot.media?.codecSupportInfo,
                  }),
                  error => done({error: String(error)})
                );
                """
            )

            policy = self.marionette.execute_script(
                """
                return {
                  activeTier: Services.prefs.getCharPref(
                    "lithe.resourcePolicy.activeTier"
                  ),
                  enabled: Services.prefs.getBoolPref(
                    "lithe.resourcePolicy.enabled"
                  ),
                  prelaunch: Services.prefs.getBoolPref(
                    "dom.ipc.processPrelaunch.enabled"
                  ),
                  processCount: Services.prefs.getIntPref(
                    "dom.ipc.processCount"
                  ),
                  softLimitMB: Services.prefs.getIntPref(
                    "lithe.resourcePolicy.softLimitMB"
                  ),
                  webIsolatedProcessCount: Services.prefs.getIntPref(
                    "dom.ipc.processCount.webIsolated"
                  ),
                };
                """
            )

            product = self.marionette.execute_async_script(
                """
                const done = arguments[arguments.length - 1];
                const { SearchService } = ChromeUtils.importESModule(
                  "moz-src:///toolkit/components/search/SearchService.sys.mjs"
                );
                const { CustomizableUI } = ChromeUtils.importESModule(
                  "moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs"
                );
                const { AppConstants } = ChromeUtils.importESModule(
                  "resource://gre/modules/AppConstants.sys.mjs"
                );
                SearchService.init().then(
                  () => done({
                    appName: AppConstants.MOZ_APP_BASENAME,
                    runtimeAppName: Services.appinfo.name,
                    defaultSearch: SearchService.defaultEngine?.name,
                    defaultSearchId: SearchService.defaultEngine?.id,
                    vibesWidgetRegistered:
                      !!CustomizableUI.getWidget("lithe-vibes-button"),
                    vibesEnabled: Services.prefs.getBoolPref(
                      "lithe.vibes.enabled"
                    ),
                    protectionEnabled: Services.prefs.getBoolPref(
                      "lithe.privacy.aiProtection.enabled"
                    ),
                    trackerProtection: Services.prefs.getBoolPref(
                      "privacy.trackingprotection.enabled"
                    ),
                    fingerprintingProtection: Services.prefs.getBoolPref(
                      "privacy.fingerprintingProtection"
                    ),
                    queryStripping: Services.prefs.getBoolPref(
                      "privacy.query_stripping.enabled"
                    ),
                    globalPrivacyControl: Services.prefs.getBoolPref(
                      "privacy.globalprivacycontrol.enabled"
                    ),
                    browserAI: Services.prefs.getStringPref(
                      "browser.ai.control.default"
                    ),
                    localInferenceRuntime: Services.prefs.getBoolPref(
                      "browser.ml.enable"
                    ),
                    prefetch: Services.prefs.getBoolPref(
                      "network.prefetch-next"
                    ),
                    speculativeConnect: Services.prefs.getBoolPref(
                      "browser.urlbar.speculativeConnect.enabled"
                    ),
                    telemetryUpload: Services.prefs.getBoolPref(
                      "datareporting.healthreport.uploadEnabled"
                    ),
                    newtabTelemetry: Services.prefs.getBoolPref(
                      "browser.newtabpage.activity-stream.telemetry"
                    ),
                    experiments: Services.prefs.getBoolPref(
                      "app.normandy.enabled"
                    ),
                  }),
                  error => done({error: String(error)})
                );
                """
            )

            classifier = self.marionette.execute_async_script(
                """
                const done = arguments[arguments.length - 1];
                const { classifyVibesTexts, VIBES_CATEGORIES, VIBES_MODEL } =
                  ChromeUtils.importESModule(
                    "moz-src:///browser/components/LitheVibesClassifier.sys.mjs"
                  );
                classifyVibesTexts([
                  "NASA astronauts launched a new rocket on a mission to study planets, stars, and distant galaxies."
                ]).then(
                  results => done({
                    categoryCount: VIBES_CATEGORIES.length,
                    error: null,
                    fallbackReason: results[0].fallbackReason || null,
                    license: VIBES_MODEL.license,
                    source: results[0].source,
                    topIds: results[0].tags.map(tag => tag.id),
                  }),
                  error => done({error: String(error)})
                );
                """
            )

            live_vibes = self.marionette.execute_async_script(
                """
                const done = arguments[arguments.length - 1];
                const { LitheVibes, VIBES_CANDIDATES } =
                  ChromeUtils.importESModule(
                    "moz-src:///browser/components/LitheVibes.sys.mjs"
                  );
                Services.prefs.setBoolPref("lithe.vibes.enabled", true);
                Services.prefs.setBoolPref(
                  "lithe.vibes.discovery.enabled",
                  true
                );
                Services.prefs.setIntPref(
                  "lithe.vibes.animation.minimumMS",
                  3000
                );
                Services.prefs.clearUserPref("lithe.vibes.localProfile");
                const startedAt = Date.now();
                LitheVibes.next(window).then(
                  () => {
                    const profile = JSON.parse(
                      Services.prefs.getStringPref("lithe.vibes.localProfile")
                    );
                    done({
                      classifier: profile.last?.classifier,
                      discovery: profile.last?.discovery,
                      elapsedMS: Date.now() - startedAt,
                      error: null,
                      selectedUrl: profile.last?.url,
                      usedOfflineCatalog: VIBES_CANDIDATES.some(
                        candidate => candidate.url == profile.last?.url
                      ),
                    });
                  },
                  error => done({error: String(error)})
                );
                """
            )

            vibes = self.marionette.execute_async_script(
                """
                const done = arguments[arguments.length - 1];
                const { LitheVibes, VIBES_CANDIDATES } =
                  ChromeUtils.importESModule(
                    "moz-src:///browser/components/LitheVibes.sys.mjs"
                  );
                Services.prefs.setBoolPref("lithe.vibes.enabled", true);
                Services.prefs.setBoolPref(
                  "lithe.vibes.discovery.enabled",
                  false
                );
                Services.prefs.setIntPref(
                  "lithe.vibes.animation.minimumMS",
                  0
                );
                Services.prefs.clearUserPref("lithe.vibes.localProfile");
                LitheVibes.next(window).then(
                  () => {
                    const browser = gBrowser.selectedBrowser;
                    const box = gBrowser.getNotificationBox(browser);
                    const profile = JSON.parse(
                      Services.prefs.getStringPref("lithe.vibes.localProfile")
                    );
                    const selectedUrl = profile.seen.at(-1);
                    done({
                      error: null,
                      feedbackVisible:
                        !!box.getNotificationWithValue("lithe-vibes-feedback"),
                      knownCandidate: VIBES_CANDIDATES.some(
                        candidate => candidate.url == selectedUrl
                      ),
                      currentUri: browser.currentURI.spec,
                      dedicatedTab:
                        gBrowser.selectedTab.getAttribute("lithe-vibes-tab") ==
                        "true",
                      selectedUrl,
                    });
                  },
                  error => done({error: String(error)})
                );
                """
            )

        result = {
            "state": state,
            "media": media,
            "policy": policy,
            "product": product,
            "classifier": classifier,
            "live_vibes": live_vibes,
            "vibes": vibes,
        }
        print("LITHE_MEDIA_RESULT=" + json.dumps(result, sort_keys=True))

        self.assertTrue(policy["enabled"])
        self.assertFalse(policy["prelaunch"])
        self.assertLessEqual(policy["processCount"], 4)
        self.assertLessEqual(policy["softLimitMB"], 2048)
        self.assertEqual(product["appName"], "Lithe")
        self.assertEqual(product["defaultSearch"], "DuckDuckGo")
        self.assertTrue(product["vibesWidgetRegistered"])
        self.assertFalse(product["vibesEnabled"])
        self.assertTrue(product["protectionEnabled"])
        self.assertTrue(product["trackerProtection"])
        self.assertTrue(product["fingerprintingProtection"])
        self.assertTrue(product["queryStripping"])
        self.assertTrue(product["globalPrivacyControl"])
        self.assertEqual(product["browserAI"], "blocked")
        self.assertTrue(product["localInferenceRuntime"])
        self.assertFalse(product["prefetch"])
        self.assertFalse(product["speculativeConnect"])
        self.assertFalse(product["telemetryUpload"])
        self.assertFalse(product["newtabTelemetry"])
        self.assertFalse(product["experiments"])
        self.assertIsNone(classifier["error"])
        self.assertEqual(classifier["categoryCount"], 130)
        self.assertEqual(classifier["license"], "MIT")
        self.assertEqual(classifier["source"], "bge-small-en-v1.5")
        self.assertTrue(
            {"space", "astronomy"}.intersection(classifier["topIds"])
        )
        self.assertIsNone(live_vibes["error"])
        self.assertEqual(live_vibes["discovery"], "duckduckgo")
        self.assertEqual(live_vibes["classifier"], "bge-small-en-v1.5")
        self.assertGreaterEqual(live_vibes["elapsedMS"], 2900)
        self.assertFalse(live_vibes["usedOfflineCatalog"])
        self.assertIsNone(vibes["error"])
        self.assertTrue(vibes["knownCandidate"])
        self.assertTrue(vibes["feedbackVisible"])
        self.assertTrue(vibes["dedicatedTab"])
        self.assertFalse(state["paused"])
        self.assertGreater(state["currentTime"], 1)
        self.assertGreater(state["width"], 0)
        self.assertGreater(state["height"], 0)
