"""Test the real pi TUI with a PTY and synthetic session; no model requests.
Run: nix-shell -p python3Packages.pyte --run 'python3 tests/live-input.py'
Add --configured to include the user's installed extensions and keybindings.
"""
import codecs
import fcntl
import json
import os
import pty
import select
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import time
from pathlib import Path

import pyte

ROOT = Path(__file__).resolve().parents[1]
CONFIGURED = "--configured" in sys.argv


def run(mode):
    with tempfile.TemporaryDirectory(prefix="pi-input-live-") as directory:
        root = Path(directory)
        settings = {"quietStartup": True}
        agent = Path.home() / ".pi/agent"
        if CONFIGURED:
            settings["packages"] = json.loads((agent / "settings.json").read_text()).get("packages", [])
            for name in ("npm", "git", "extensions"):
                if (agent / name).exists():
                    (root / name).symlink_to(agent / name, target_is_directory=True)
        (root / "settings.json").write_text(json.dumps(settings))
        keybindings = agent / "keybindings.json"
        if keybindings.exists():
            (root / "keybindings.json").write_text(keybindings.read_text())

        # Let pi's own SessionManager create the persisted fixture and tree IDs.
        sdk = (ROOT / "node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js").as_uri()
        fixture_code = f'import {{SessionManager}} from {json.dumps(sdk)};' + '''
const dir = process.argv[1];
const session = SessionManager.create(dir, dir + "/sessions");
session.appendMessage({role:"user", content:[{type:"text", text:"HISTORY_BEFORE_RELOAD"}], timestamp:Date.now()});
session.appendMessage({role:"assistant", content:[{type:"text",text:"SYNTHETIC_REPLY"}],
 api:"openai-completions", provider:"openai", model:"gpt-4o", timestamp:Date.now(), stopReason:"stop",
 usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}});
console.log(session.getSessionFile());
'''
        session = subprocess.check_output(["node", "--input-type=module", "-e", fixture_code, directory], text=True).strip()
        env = {key: value for key, value in os.environ.items() if not key.endswith(("API_KEY", "TOKEN"))}
        env.update(PI_CODING_AGENT_DIR=directory, TERM="xterm-256color")
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 30, 100, 0, 0))
        process = subprocess.Popen(
            ["pi", "--offline", "--provider", "openai", "--model", "gpt-4o", "--api-key", "unused-pty-fixture",
             *([] if CONFIGURED else ["--no-extensions"]), "--no-context-files", "--no-skills", "--no-prompt-templates",
             "--no-mcp", "--no-tools", "--tui-mode", mode, "--extension", str(ROOT / "index.ts"), "--session", session],
            cwd=directory, env=env, stdin=slave, stdout=slave, stderr=slave, start_new_session=True,
        )
        os.close(slave)
        screen = pyte.Screen(100, 30)
        stream = pyte.Stream(screen)
        decoder = codecs.getincrementaldecoder("utf-8")("replace")

        def view():
            return "\n".join(screen.display)

        def input_text():
            borders = [index for index, line in enumerate(screen.display) if line.startswith("─")]
            if len(borders) < 2:
                return None
            return "\n".join(screen.display[borders[-2] + 1:borders[-1]]).strip()

        def wait_for(predicate, label, timeout=12):
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                readable, _, _ = select.select([master], [], [], 0.1)
                if readable:
                    try:
                        data = os.read(master, 65536)
                    except OSError:
                        break
                    if not data:
                        break
                    stream.feed(decoder.decode(data))
                    if b"\x1b[c" in data:
                        os.write(master, b"\x1b[?1;2c")
                    if b"\x1b[6n" in data:
                        os.write(master, f"\x1b[{screen.cursor.y+1};{screen.cursor.x+1}R".encode())
                if predicate(view()):
                    return
                if process.poll() is not None:
                    break
            raise AssertionError(f"{mode}: {label}\n{view()}")

        def send(data):
            os.write(master, data)

        try:
            wait_for(lambda text: input_text() == "" and "$0.00" in text, "input bar ready", timeout=60 if CONFIGURED else 25)
            send(b"LIVE_DRAFT_XYZ")
            wait_for(lambda _: input_text() == "LIVE_DRAFT_XYZ", "draft entered")
            send(b"\x1b[D\x1b[D\x13")
            wait_for(lambda text: "Stash 1" in text and input_text() == "", "Ctrl+S clears and stashes draft")
            send(b"\x13")
            wait_for(lambda text: input_text() == "LIVE_DRAFT_XYZ" and "Stash 1" not in text, "Ctrl+S restores draft")
            send(b"!")
            wait_for(lambda _: input_text() == "LIVE_DRAFT_X!YZ", "restoration preserves cursor")
            send(b"\x05\x15")
            wait_for(lambda _: input_text() == "", "draft cleared")
            send(b"?")
            wait_for(lambda text: "Keyboard shortcuts" in text, "? opens help")
            send(b"?")
            wait_for(lambda text: "Keyboard shortcuts" not in text and input_text() == "", "? closes help")
            send(b"why?")
            wait_for(lambda text: input_text() == "why?" and "Keyboard shortcuts" not in text, "? inside draft remains text")
            send(b"\x05\x15")
            wait_for(lambda _: input_text() == "", "draft cleared before reload")
            send(b"/reload\r")
            wait_for(lambda text: "Reloaded" in text and input_text() == "", "reload finished", timeout=40)
            send(b"\x1b[A")
            wait_for(lambda _: input_text() == "HISTORY_BEFORE_RELOAD", "Up recalls pre-reload prompt")
            send(b"\x13")
            wait_for(lambda text: "Stash 1" in text and input_text() == "", "Ctrl+S works after reload")
            send(b"\x13")
            wait_for(lambda _: input_text() == "HISTORY_BEFORE_RELOAD", "Ctrl+S restores after reload")
            print(f"PASS [{mode}, {'configured' if CONFIGURED else 'isolated'}]: Ctrl+S before/after reload and cursor, ? help/literal, reload → Up history", flush=True)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
            os.close(master)


for terminal_mode in ("regular", "fullscreen"):
    run(terminal_mode)
