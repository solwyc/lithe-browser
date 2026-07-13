/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { SearchService } from "moz-src:///toolkit/components/search/SearchService.sys.mjs";

const ENABLED_PREF = "lithe.privacy.aiProtection.enabled";
const RESTORE_PREF = "lithe.privacy.aiProtection.restoreState";
const VIBES_RUNTIME_MIGRATION_PREF = "lithe.vibes.runtimeMigrationVersion";

const PROTECTION_SETTINGS = [
  { pref: "privacy.trackingprotection.enabled", type: "bool", value: true },
  {
    pref: "privacy.trackingprotection.pbmode.enabled",
    type: "bool",
    value: true,
  },
  {
    pref: "privacy.trackingprotection.fingerprinting.enabled",
    type: "bool",
    value: true,
  },
  {
    pref: "privacy.trackingprotection.cryptomining.enabled",
    type: "bool",
    value: true,
  },
  {
    pref: "privacy.trackingprotection.socialtracking.enabled",
    type: "bool",
    value: true,
  },
  {
    pref: "privacy.trackingprotection.emailtracking.enabled",
    type: "bool",
    value: true,
  },
  { pref: "privacy.fingerprintingProtection", type: "bool", value: true },
  {
    pref: "privacy.fingerprintingProtection.pbmode",
    type: "bool",
    value: true,
  },
  { pref: "privacy.query_stripping.enabled", type: "bool", value: true },
  {
    pref: "privacy.query_stripping.enabled.pbmode",
    type: "bool",
    value: true,
  },
  { pref: "privacy.globalprivacycontrol.enabled", type: "bool", value: true },
  { pref: "privacy.donottrackheader.enabled", type: "bool", value: true },
  { pref: "privacy.bounceTrackingProtection.mode", type: "int", value: 1 },
  { pref: "browser.ai.control.default", type: "string", value: "blocked" },
  { pref: "extensions.ml.enabled", type: "bool", value: false },
  { pref: "browser.ml.chat.enabled", type: "bool", value: false },
  { pref: "browser.smartwindow.enabled", type: "bool", value: false },
];

function getValue({ pref, type }) {
  if (type == "bool") {
    return Services.prefs.getBoolPref(pref);
  }
  if (type == "int") {
    return Services.prefs.getIntPref(pref);
  }
  return Services.prefs.getStringPref(pref);
}

function setValue({ pref, type }, value) {
  if (type == "bool") {
    Services.prefs.setBoolPref(pref, value);
  } else if (type == "int") {
    Services.prefs.setIntPref(pref, value);
  } else {
    Services.prefs.setStringPref(pref, value);
  }
}

export const LithePrivacyPolicy = {
  _initialized: false,

  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._migrateVibesRuntime();
    Services.prefs.addObserver(ENABLED_PREF, this);
    this._apply(Services.prefs.getBoolPref(ENABLED_PREF, true));
    this._setDuckDuckGoDefault();
  },

  _migrateVibesRuntime() {
    if (Services.prefs.getIntPref(VIBES_RUNTIME_MIGRATION_PREF, 0) >= 1) {
      return;
    }

    // Early Lithe prototypes disabled Gecko's entire local inference runtime.
    // Vibes now needs that runtime, while every Firefox AI product surface
    // remains independently blocked below.
    Services.prefs.setBoolPref("browser.ml.enable", true);
    if (Services.prefs.prefHasUserValue(RESTORE_PREF)) {
      try {
        const restoreState = JSON.parse(
          Services.prefs.getStringPref(RESTORE_PREF)
        ).filter(setting => setting.pref !== "browser.ml.enable");
        Services.prefs.setStringPref(RESTORE_PREF, JSON.stringify(restoreState));
      } catch (error) {
        console.error("Lithe could not migrate its local inference setting", error);
      }
    }
    Services.prefs.setIntPref(VIBES_RUNTIME_MIGRATION_PREF, 1);
  },

  observe(_subject, topic, data) {
    if (topic == "nsPref:changed" && data == ENABLED_PREF) {
      this._apply(Services.prefs.getBoolPref(ENABLED_PREF, true));
    }
  },

  _apply(enabled) {
    if (enabled) {
      if (!Services.prefs.prefHasUserValue(RESTORE_PREF)) {
        const restoreState = PROTECTION_SETTINGS.map(setting => ({
          pref: setting.pref,
          type: setting.type,
          hadUserValue: Services.prefs.prefHasUserValue(setting.pref),
          value: getValue(setting),
        }));
        Services.prefs.setStringPref(
          RESTORE_PREF,
          JSON.stringify(restoreState)
        );
      }

      for (const setting of PROTECTION_SETTINGS) {
        setValue(setting, setting.value);
      }
      return;
    }

    if (!Services.prefs.prefHasUserValue(RESTORE_PREF)) {
      return;
    }

    try {
      const restoreState = JSON.parse(
        Services.prefs.getStringPref(RESTORE_PREF)
      );
      for (const setting of restoreState) {
        if (setting.hadUserValue) {
          setValue(setting, setting.value);
        } else {
          Services.prefs.clearUserPref(setting.pref);
        }
      }
    } catch (error) {
      console.error("Lithe could not restore privacy preferences", error);
    }
    Services.prefs.clearUserPref(RESTORE_PREF);
  },

  async _setDuckDuckGoDefault() {
    if (Services.prefs.getBoolPref("lithe.search.defaultInitialized", false)) {
      return;
    }

    try {
      await SearchService.init();
      const engine =
        SearchService.getEngineById("ddg@search.mozilla.orgdefault") ||
        SearchService.getEngineByName("DuckDuckGo");
      if (!engine) {
        console.error("Lithe could not find the bundled DuckDuckGo engine");
        return;
      }

      await SearchService.setDefault(
        engine,
        SearchService.CHANGE_REASON.CONFIG
      );
      Services.prefs.setBoolPref("lithe.search.defaultInitialized", true);
    } catch (error) {
      console.error("Lithe could not set DuckDuckGo as default", error);
    }
  },
};
