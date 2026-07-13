#!/usr/bin/env python3
"""Repeatable local Lithe/Chrome performance and privacy smoke benchmark.

This intentionally uses local pages rather than public benchmark sites. It
measures whole-browser process groups with initialized, isolated profiles and
does not require WebDriver, browser extensions, or hosted analytics.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import platform
import shutil
import statistics
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import psutil


WORKLOAD_TABS = 6
LOOPBACK_HOSTS = ["127.0.0.1", "localhost", "127.0.0.2", "127.0.0.3", "127.0.0.4", "127.0.0.5"]


@dataclass
class BenchState:
    first_request: dict[str, float] = field(default_factory=dict)
    results: dict[str, dict[str, Any]] = field(default_factory=dict)
    request_headers: dict[str, dict[str, str]] = field(default_factory=dict)
    prefetched: set[str] = field(default_factory=set)
    condition: threading.Condition = field(default_factory=threading.Condition)

    def record_first(self, token: str, headers: Any) -> None:
        with self.condition:
            self.first_request.setdefault(token, time.perf_counter())
            self.request_headers.setdefault(
                token,
                {str(key).lower(): str(value) for key, value in headers.items()},
            )
            self.condition.notify_all()

    def record_result(self, token: str, result: dict[str, Any]) -> None:
        with self.condition:
            self.results[token] = result
            self.condition.notify_all()

    def wait_for(self, tokens: list[str], timeout: float) -> bool:
        deadline = time.perf_counter() + timeout
        with self.condition:
            while not all(token in self.results for token in tokens):
                remaining = deadline - time.perf_counter()
                if remaining <= 0:
                    return False
                self.condition.wait(min(0.2, remaining))
        return True


STATE = BenchState()


def workload_html(token: str) -> str:
    encoded = json.dumps(token)
    return f"""<!doctype html>
<meta charset="utf-8">
<title>Lithe local benchmark</title>
<style>body{{font:14px system-ui;margin:16px}} .row{{display:grid;grid-template-columns:repeat(8,1fr);gap:2px}} .cell{{height:3px}}</style>
<main id="root"><h1>Local browser workload</h1></main>
<canvas id="canvas" width="640" height="360"></canvas>
<script>
(async () => {{
  const token = {encoded};
  const started = performance.now();
  const values = new Float64Array(320000);
  for (let i = 0; i < values.length; i++) values[i] = Math.sin(i * 0.017) * Math.cos(i * 0.0031) + (i % 97);
  values.sort();
  let checksum = 0;
  for (let i = 0; i < values.length; i += 127) checksum += values[i];
  const jsFinished = performance.now();

  const row = document.createElement('div');
  row.className = 'row';
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 9000; i++) {{
    const node = document.createElement('span');
    node.className = 'cell';
    node.style.background = `hsl(${{i % 360}} 45% ${{35 + (i % 30)}}%)`;
    fragment.appendChild(node);
  }}
  row.appendChild(fragment);
  document.querySelector('#root').appendChild(row);

  const context = document.querySelector('#canvas').getContext('2d');
  for (let i = 0; i < 18000; i++) {{
    context.fillStyle = `rgba(${{i % 255}},${{(i * 3) % 255}},${{(i * 7) % 255}},0.16)`;
    context.fillRect((i * 13) % 640, (i * 17) % 360, 4, 4);
  }}
  checksum += document.body.offsetHeight;
  const domFinished = performance.now();
  await Promise.resolve();
  const finished = performance.now();
  const query = new URLSearchParams({{
    token,
    kind: 'workload',
    total_ms: (finished - started).toFixed(3),
    js_ms: (jsFinished - started).toFixed(3),
    dom_ms: (domFinished - jsFinished).toFixed(3),
    checksum: checksum.toFixed(3),
  }});
  await fetch('/result?' + query, {{cache: 'no-store'}});
}})();
</script>"""


def privacy_html(token: str) -> str:
    encoded = json.dumps(token)
    return f"""<!doctype html>
<meta charset="utf-8">
<title>Lithe local privacy probe</title>
<link rel="prefetch" href="/prefetched?token={urllib.parse.quote(token)}">
<h1>Local privacy probe</h1>
<script>
(async () => {{
  const token = {encoded};
  await new Promise(resolve => setTimeout(resolve, 2500));
  const query = new URLSearchParams({{
    token,
    kind: 'privacy',
    global_privacy_control: String(navigator.globalPrivacyControl),
    do_not_track: String(navigator.doNotTrack),
    cookie_enabled: String(navigator.cookieEnabled),
  }});
  await fetch('/result?' + query, {{cache: 'no-store'}});
}})();
</script>"""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        token = query.get("token", [""])[0]
        if parsed.path in {"/prepare", "/workload", "/privacy"}:
            STATE.record_first(token, self.headers)
        if parsed.path == "/prepare":
            STATE.record_result(token, {"kind": "prepare"})
            self.respond("<!doctype html><title>Ready</title>ready")
        elif parsed.path == "/workload":
            self.respond(workload_html(token))
        elif parsed.path == "/privacy":
            self.respond(privacy_html(token))
        elif parsed.path == "/prefetched":
            with STATE.condition:
                STATE.prefetched.add(token)
            self.respond("prefetched", "text/plain; charset=utf-8")
        elif parsed.path == "/result":
            result = {
                key: values[0]
                for key, values in query.items()
                if key != "token"
            }
            result["received_at"] = time.perf_counter()
            STATE.record_result(token, result)
            self.respond("ok", "text/plain; charset=utf-8")
        else:
            self.send_error(404)

    def respond(self, body: str, content_type: str = "text/html; charset=utf-8") -> None:
        payload = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
        self.close_connection = True

    def log_message(self, _format: str, *_args: Any) -> None:
        return


class QuietThreadingHTTPServer(ThreadingHTTPServer):
    def handle_error(self, request: Any, client_address: Any) -> None:
        error = sys.exc_info()[1]
        if isinstance(error, (ConnectionResetError, ConnectionAbortedError)):
            return
        super().handle_error(request, client_address)


def profile_ignore(_directory: str, names: list[str]) -> set[str]:
    ignored = {"parent.lock", "lock", ".parentlock"}
    ignored.update(name for name in names if name.startswith("Singleton"))
    return ignored.intersection(names)


def lithe_user_js(profile: Path) -> None:
    profile.mkdir(parents=True, exist_ok=True)
    (profile / "user.js").write_text(
        "\n".join(
            [
                'user_pref("browser.shell.checkDefaultBrowser", false);',
                'user_pref("browser.aboutwelcome.enabled", false);',
                'user_pref("browser.startup.page", 0);',
                'user_pref("browser.sessionstore.resume_from_crash", false);',
                'user_pref("trailhead.firstrun.didSeeAboutWelcome", true);',
            ]
        )
        + "\n",
        encoding="utf-8",
    )


def browser_command(kind: str, executable: Path, profile: Path, urls: list[str]) -> list[str]:
    if kind == "lithe":
        command = [
            str(executable),
            "-no-remote",
            "-profile",
            str(profile),
            "-url",
            urls[0],
        ]
        for url in urls[1:]:
            command.extend(["-new-tab", url])
        return command
    return [
        str(executable),
        f"--user-data-dir={profile}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
        "--new-window",
        *urls,
    ]


def launch(command: list[str]) -> subprocess.Popen[bytes]:
    startupinfo = None
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 6  # SW_MINIMIZE
    return subprocess.Popen(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        startupinfo=startupinfo,
    )


def process_group(root_pid: int, profile: Path) -> list[psutil.Process]:
    found: dict[int, psutil.Process] = {}
    try:
        root = psutil.Process(root_pid)
        found[root.pid] = root
        for child in root.children(recursive=True):
            found[child.pid] = child
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
    profile_text = str(profile).lower()
    for process in psutil.process_iter(["pid", "cmdline"]):
        try:
            command = " ".join(process.info["cmdline"] or []).lower()
            if profile_text in command:
                found[process.pid] = process
                for child in process.children(recursive=True):
                    found[child.pid] = child
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return list(found.values())


def stop_group(process: subprocess.Popen[bytes], profile: Path) -> None:
    members = process_group(process.pid, profile)
    for member in members:
        try:
            member.terminate()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    _, alive = psutil.wait_procs(members, timeout=4)
    for member in alive:
        try:
            member.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    psutil.wait_procs(alive, timeout=3)


def endpoint_is_external(ip: str) -> bool:
    try:
        address = ipaddress.ip_address(ip.split("%", 1)[0])
        return not (address.is_loopback or address.is_unspecified)
    except ValueError:
        return False


class Sampler:
    def __init__(self, root_pid: int, profile: Path) -> None:
        self.root_pid = root_pid
        self.profile = profile
        self.peak_rss = 0
        self.peak_processes = 0
        self.cpu_by_pid: dict[int, float] = {}
        self.external_endpoints: set[str] = set()

    def sample(self) -> tuple[int, int]:
        rss = 0
        members = process_group(self.root_pid, self.profile)
        for process in members:
            try:
                rss += process.memory_info().rss
                cpu = process.cpu_times()
                self.cpu_by_pid[process.pid] = max(
                    self.cpu_by_pid.get(process.pid, 0.0), cpu.user + cpu.system
                )
                for connection in process.net_connections(kind="inet"):
                    if connection.raddr and endpoint_is_external(connection.raddr.ip):
                        self.external_endpoints.add(
                            f"{connection.raddr.ip}:{connection.raddr.port}"
                        )
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        self.peak_rss = max(self.peak_rss, rss)
        self.peak_processes = max(self.peak_processes, len(members))
        return rss, len(members)

    @property
    def cpu_seconds(self) -> float:
        return sum(self.cpu_by_pid.values())


def wait_and_sample(
    process: subprocess.Popen[bytes],
    profile: Path,
    tokens: list[str],
    timeout: float,
) -> tuple[Sampler, bool]:
    sampler = Sampler(process.pid, profile)
    deadline = time.perf_counter() + timeout
    completed = False
    while time.perf_counter() < deadline:
        sampler.sample()
        with STATE.condition:
            completed = all(token in STATE.results for token in tokens)
        if completed:
            break
        if process.poll() is not None and not process_group(process.pid, profile):
            break
        time.sleep(0.1)
    return sampler, completed


def prepare_profile(kind: str, executable: Path, destination: Path, port: int) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    if kind == "lithe":
        lithe_user_js(destination)
    token = f"prepare-{kind}-{time.time_ns()}"
    url = f"http://127.0.0.1:{port}/prepare?token={token}"
    process = launch(browser_command(kind, executable, destination, [url]))
    try:
        if not STATE.wait_for([token], 30):
            raise RuntimeError(f"{kind} profile preparation timed out")
        time.sleep(1.5)
    finally:
        stop_group(process, destination)


def fresh_profile(baseline: Path, destination: Path) -> None:
    shutil.copytree(baseline, destination, ignore=profile_ignore)


def run_workload(
    kind: str,
    executable: Path,
    baseline: Path,
    iteration: int,
    port: int,
    workspace: Path,
) -> dict[str, Any]:
    profile = workspace / f"{kind}-run-{iteration}-{time.time_ns()}"
    fresh_profile(baseline, profile)
    group = f"{kind}-{iteration}-{time.time_ns()}"
    tokens = [f"{group}-{index}" for index in range(WORKLOAD_TABS)]
    urls = [
        f"http://{LOOPBACK_HOSTS[index]}:{port}/workload?token={token}"
        for index, token in enumerate(tokens)
    ]
    started = time.perf_counter()
    process = launch(browser_command(kind, executable, profile, urls))
    sampler, completed = wait_and_sample(process, profile, tokens, 50)
    if not completed:
        requested = [token for token in tokens if token in STATE.first_request]
        finished_tokens = [token for token in tokens if token in STATE.results]
        stop_group(process, profile)
        raise RuntimeError(
            f"{kind} workload iteration {iteration} timed out; "
            f"requested={len(requested)}/{len(tokens)} "
            f"finished={len(finished_tokens)}/{len(tokens)}"
        )
    finished = max(float(STATE.results[token]["received_at"]) for token in tokens)
    first = min(STATE.first_request[token] for token in tokens)
    time.sleep(2)
    settled_rss, settled_processes = sampler.sample()
    stop_group(process, profile)
    js_values = [float(STATE.results[token]["js_ms"]) for token in tokens]
    total_values = [float(STATE.results[token]["total_ms"]) for token in tokens]
    return {
        "browser": kind,
        "iteration": iteration,
        "startup_to_first_request_ms": round((first - started) * 1000, 3),
        "six_tab_completion_ms": round((finished - started) * 1000, 3),
        "median_page_workload_ms": round(statistics.median(total_values), 3),
        "median_page_js_ms": round(statistics.median(js_values), 3),
        "peak_working_set_mib": round(sampler.peak_rss / 1024 / 1024, 3),
        "settled_working_set_mib": round(settled_rss / 1024 / 1024, 3),
        "peak_process_count": sampler.peak_processes,
        "settled_process_count": settled_processes,
        "cpu_seconds": round(sampler.cpu_seconds, 3),
        "external_endpoints_observed": sorted(sampler.external_endpoints),
    }


def run_privacy(
    kind: str,
    executable: Path,
    baseline: Path,
    port: int,
    workspace: Path,
) -> dict[str, Any]:
    profile = workspace / f"{kind}-privacy-{time.time_ns()}"
    fresh_profile(baseline, profile)
    token = f"privacy-{kind}-{time.time_ns()}"
    url = f"http://127.0.0.1:{port}/privacy?token={token}"
    process = launch(browser_command(kind, executable, profile, [url]))
    try:
        sampler, completed = wait_and_sample(process, profile, [token], 35)
        if not completed:
            raise RuntimeError(f"{kind} privacy probe timed out")
        time.sleep(1)
        sampler.sample()
        result = dict(STATE.results[token])
        headers = STATE.request_headers.get(token, {})
        return {
            "browser": kind,
            "navigator_global_privacy_control": result.get(
                "global_privacy_control"
            ),
            "navigator_do_not_track": result.get("do_not_track"),
            "sec_gpc_header": headers.get("sec-gpc"),
            "dnt_header": headers.get("dnt"),
            "prefetch_requested": token in STATE.prefetched,
            "external_endpoint_count": len(sampler.external_endpoints),
            "external_endpoints_observed": sorted(sampler.external_endpoints),
        }
    finally:
        stop_group(process, profile)


def median_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    numeric_keys = [
        "startup_to_first_request_ms",
        "six_tab_completion_ms",
        "median_page_workload_ms",
        "median_page_js_ms",
        "peak_working_set_mib",
        "settled_working_set_mib",
        "peak_process_count",
        "settled_process_count",
        "cpu_seconds",
    ]
    return {
        key: round(statistics.median(float(row[key]) for row in rows), 3)
        for key in numeric_keys
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lithe", type=Path, required=True)
    parser.add_argument("--chrome", type=Path, required=True)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--lithe-version", default="unknown")
    parser.add_argument("--chrome-version", default="unknown")
    args = parser.parse_args()
    for executable in (args.lithe, args.chrome):
        if not executable.is_file():
            parser.error(f"Executable not found: {executable}")
    if args.runs < 3:
        parser.error("Use at least three runs so the median is meaningful")

    server = QuietThreadingHTTPServer(("0.0.0.0", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_port
    runs: list[dict[str, Any]] = []
    privacy: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(
        prefix="lithe-browser-benchmark-", ignore_cleanup_errors=True
    ) as temp:
        workspace = Path(temp)
        baselines = {
            "lithe": workspace / "lithe-baseline",
            "chrome": workspace / "chrome-baseline",
        }
        try:
            prepare_profile("lithe", args.lithe, baselines["lithe"], port)
            prepare_profile("chrome", args.chrome, baselines["chrome"], port)
            browsers = {
                "lithe": args.lithe,
                "chrome": args.chrome,
            }
            for iteration in range(1, args.runs + 1):
                order = ["lithe", "chrome"] if iteration % 2 else ["chrome", "lithe"]
                for kind in order:
                    print(f"performance {iteration}/{args.runs}: {kind}", flush=True)
                    runs.append(
                        run_workload(
                            kind,
                            browsers[kind],
                            baselines[kind],
                            iteration,
                            port,
                            workspace,
                        )
                    )
            for kind in ("lithe", "chrome"):
                print(f"privacy: {kind}", flush=True)
                privacy.append(
                    run_privacy(
                        kind,
                        browsers[kind],
                        baselines[kind],
                        port,
                        workspace,
                    )
                )
        finally:
            server.shutdown()
            server.server_close()

    by_browser = {
        kind: [row for row in runs if row["browser"] == kind]
        for kind in ("lithe", "chrome")
    }
    document = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": {
            "runs": args.runs,
            "workload_tabs": WORKLOAD_TABS,
            "profiles": "initialized isolated profile copied fresh for every measured run",
            "order": "alternating Lithe/Chrome by iteration",
            "server": "local HTTP on Windows loopback; Cache-Control: no-store",
        },
        "environment": {
            "platform": platform.platform(),
            "processor": platform.processor(),
            "logical_cpus": os.cpu_count(),
            "physical_memory_gib": round(psutil.virtual_memory().total / 1024**3, 3),
            "lithe_version": args.lithe_version,
            "chrome_version": args.chrome_version,
            "lithe_executable": str(args.lithe),
            "chrome_executable": str(args.chrome),
        },
        "summary_medians": {
            kind: median_summary(rows) for kind, rows in by_browser.items()
        },
        "performance_runs": runs,
        "privacy_probe": privacy,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
