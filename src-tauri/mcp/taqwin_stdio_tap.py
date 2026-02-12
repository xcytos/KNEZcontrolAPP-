import argparse
import json
import os
import subprocess
import sys
import threading
import time


def _find_header_end(buf: bytes):
    crlf = buf.find(b"\r\n\r\n")
    if crlf >= 0:
        return crlf, 4
    lf = buf.find(b"\n\n")
    if lf >= 0:
        return lf, 2
    return -1, 0


def _try_parse_one(buf: bytearray):
    if not buf:
        return None
    if buf[:15].lower().startswith(b"content-length:"):
        header_end, sep_len = _find_header_end(buf)
        if header_end < 0:
            return None
        header = bytes(buf[:header_end]).decode("utf-8", errors="replace")
        content_length = None
        for line in header.splitlines():
            if line.lower().startswith("content-length:"):
                try:
                    content_length = int(line.split(":", 1)[1].strip())
                except Exception:
                    content_length = None
                break
        if content_length is None:
            del buf[: header_end + sep_len]
            return None
        body_start = header_end + sep_len
        body_end = body_start + content_length
        if len(buf) < body_end:
            return None
        body = bytes(buf[body_start:body_end])
        del buf[:body_end]
        try:
            return json.loads(body.decode("utf-8", errors="replace"))
        except Exception:
            return None

    nl = buf.find(b"\n")
    if nl < 0:
        return None
    line = bytes(buf[:nl])
    del buf[: nl + 1]
    if line.endswith(b"\r"):
        line = line[:-1]
    text = line.decode("utf-8", errors="replace").strip()
    if not text:
        return None
    if not (text.startswith("{") or text.startswith("[")):
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def _tap_requests(source, sink, stop_event: threading.Event):
    buf = bytearray()
    while not stop_event.is_set():
        chunk = source.read(4096)
        if not chunk:
            break
        try:
            sink.write(chunk)
            sink.flush()
        except Exception:
            break
        buf.extend(chunk)
        while True:
            msg = _try_parse_one(buf)
            if msg is None:
                break
            if isinstance(msg, dict) and msg.get("jsonrpc") == "2.0":
                method = msg.get("method")
                if method == "tools/call":
                    params = msg.get("params") if isinstance(msg.get("params"), dict) else {}
                    tool = params.get("name")
                    rid = msg.get("id")
                    try:
                        print(f"Received tools/call tool={tool} id={rid}", file=sys.stderr, flush=True)
                    except Exception:
                        pass


def _pump(source, sink, stop_event: threading.Event):
    while not stop_event.is_set():
        chunk = source.read(4096)
        if not chunk:
            break
        try:
            sink.write(chunk)
            sink.flush()
        except Exception:
            break


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True)
    ap.add_argument("--cwd", default=None)
    ap.add_argument("--", dest="rest", nargs=argparse.REMAINDER)
    args = ap.parse_args()

    target = args.target
    cwd = args.cwd

    env = dict(os.environ)
    env.setdefault("PYTHONUNBUFFERED", "1")

    cmd = [sys.executable, "-u", target]
    if args.rest:
        cmd.extend(args.rest)

    p = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=cwd,
        env=env,
        bufsize=0,
    )

    stop_event = threading.Event()
    t_in = threading.Thread(target=_tap_requests, args=(sys.stdin.buffer, p.stdin, stop_event), daemon=True)
    t_out = threading.Thread(target=_pump, args=(p.stdout, sys.stdout.buffer, stop_event), daemon=True)
    t_err = threading.Thread(target=_pump, args=(p.stderr, sys.stderr.buffer, stop_event), daemon=True)
    t_in.start()
    t_out.start()
    t_err.start()

    try:
        while True:
            code = p.poll()
            if code is not None:
                break
            time.sleep(0.05)
    finally:
        stop_event.set()
        try:
            p.kill()
        except Exception:
            pass


if __name__ == "__main__":
    main()

