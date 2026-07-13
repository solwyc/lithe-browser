/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const status = document.querySelector("#vibes-status");
const messages = [
  "Asking DuckDuckGo for a few interesting corners…",
  "Reading the room without sending your taste profile…",
  "The little local classifier found a spark…",
];

for (const [index, message] of messages.entries()) {
  setTimeout(() => {
    status.textContent = message;
    document.documentElement.dataset.phase = String(index + 1);
  }, index * 1000);
}
