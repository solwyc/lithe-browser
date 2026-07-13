/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

/**
 * Return conservative defaults based on installed memory. The soft limit is
 * intentionally capped on roomy systems: spare RAM is headroom, not a target.
 */
export function getLitheResourceTier(totalMemoryBytes) {
  if (totalMemoryBytes <= 4 * GIB) {
    return {
      name: "minimal",
      processCount: 2,
      webIsolatedProcessCount: 1,
      softLimitMB: 640,
      minInactiveMs: 60_000,
      lowCommitThresholdMB: 512,
    };
  }

  if (totalMemoryBytes <= 8 * GIB) {
    return {
      name: "lean",
      processCount: 3,
      webIsolatedProcessCount: 1,
      softLimitMB: 1024,
      minInactiveMs: 120_000,
      lowCommitThresholdMB: 768,
    };
  }

  if (totalMemoryBytes <= 16 * GIB) {
    return {
      name: "balanced",
      processCount: 4,
      webIsolatedProcessCount: 2,
      softLimitMB: 1536,
      minInactiveMs: 180_000,
      lowCommitThresholdMB: 1024,
    };
  }

  return {
    name: "roomy",
    processCount: 4,
    webIsolatedProcessCount: 2,
    softLimitMB: 2048,
    minInactiveMs: 300_000,
    lowCommitThresholdMB: 1024,
  };
}

function totalProcessMemory(processInfo) {
  let total = processInfo.memory || 0;
  for (const child of processInfo.children || []) {
    total += totalProcessMemory(child);
  }
  return total;
}

export const LitheResourcePolicy = {
  _checking: false,
  _timer: null,

  init() {
    if (!Services.prefs.getBoolPref("lithe.resourcePolicy.enabled", false)) {
      return;
    }

    let totalMemoryBytes;
    try {
      totalMemoryBytes = Services.sysinfo.getProperty("memsize");
    } catch (error) {
      console.error("Lithe could not determine installed memory", error);
      totalMemoryBytes = 8 * GIB;
    }

    const tier = getLitheResourceTier(totalMemoryBytes);
    const defaults = Services.prefs.getDefaultBranch("");

    // Preserve user overrides by changing defaults rather than user prefs.
    defaults.setIntPref("dom.ipc.processCount", tier.processCount);
    defaults.setIntPref(
      "dom.ipc.processCount.webIsolated",
      tier.webIsolatedProcessCount
    );
    defaults.setBoolPref("dom.ipc.processPrelaunch.enabled", false);
    defaults.setIntPref("dom.ipc.processPrelaunch.fission.number", 0);
    defaults.setBoolPref("browser.tabs.unloadOnLowMemory", true);
    defaults.setIntPref(
      "browser.tabs.min_inactive_duration_before_unload",
      tier.minInactiveMs
    );
    defaults.setIntPref(
      "browser.low_commit_space_threshold_mb",
      tier.lowCommitThresholdMB
    );
    defaults.setIntPref("lithe.resourcePolicy.softLimitMB", tier.softLimitMB);
    defaults.setCharPref("lithe.resourcePolicy.activeTier", tier.name);

    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._timer.initWithCallback(
      () => this._checkMemory(),
      Services.prefs.getIntPref(
        "lithe.resourcePolicy.checkIntervalMS",
        30_000
      ),
      Ci.nsITimer.TYPE_REPEATING_SLACK
    );
    Services.obs.addObserver(this, "quit-application-granted");
  },

  observe(_subject, topic) {
    if (topic != "quit-application-granted") {
      return;
    }
    Services.obs.removeObserver(this, topic);
    this._timer?.cancel();
    this._timer = null;
  },

  async _checkMemory() {
    if (this._checking) {
      return;
    }
    this._checking = true;

    try {
      const processInfo = await ChromeUtils.requestProcInfo();
      const memoryBytes = totalProcessMemory(processInfo);
      const softLimitBytes =
        Services.prefs.getIntPref(
          "lithe.resourcePolicy.softLimitMB",
          2048
        ) * MIB;

      if (memoryBytes <= softLimitBytes) {
        return;
      }

      const { TabUnloader } = ChromeUtils.importESModule(
        "moz-src:///browser/components/tabbrowser/TabUnloader.sys.mjs"
      );
      await TabUnloader.unloadLeastRecentlyUsedTab(
        Services.prefs.getIntPref(
          "browser.tabs.min_inactive_duration_before_unload",
          300_000
        )
      );
    } catch (error) {
      console.error("Lithe resource-policy check failed", error);
    } finally {
      this._checking = false;
    }
  },
};
