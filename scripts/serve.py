"""Static preview server for the CRM, with browser caching turned off.

`python -m http.server` sends Last-Modified but no Cache-Control, so a
browser is free to reuse a copy it already holds. Editing a file and
reloading can then run the PREVIOUS version, with no sign that it has.
index.html caches the same way, which is the worse failure: a stale
document keeps requesting script files that have since been renamed or
deleted, so the app boots missing whole modules and the functions they
define simply are not there.

no-store makes every reload fetch the file that is actually on disk.
Last-Modified and ETag are dropped too, since either one lets a browser
revalidate its way back to a cached copy.

Usage:  python scripts/serve.py [port]     (default 8140)
Wired to the "aee-crm" entry in .claude/launch.json.
"""

import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PORT = 8140


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Serves the repo root and refuses to let anything be cached."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=REPO_ROOT, **kwargs)

    def send_head(self):
        # Suppressing Last-Modified on the way out is not enough: the base
        # handler still honours a conditional request the browser made from
        # an older cached copy and answers 304, so the browser keeps using
        # it. Drop the validators from the REQUEST so every hit is a 200.
        for h in ('If-Modified-Since', 'If-None-Match'):
            if h in self.headers:
                del self.headers[h]
        return super().send_head()

    def send_header(self, keyword, value):
        # Suppress the validators; with them a browser can still 304 its
        # way back to the copy we are trying to replace.
        if keyword.lower() in ('last-modified', 'etag'):
            return
        super().send_header(keyword, value)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    server = ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler)
    print('Serving %s at http://127.0.0.1:%d/  (no-store)' % (REPO_ROOT, port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == '__main__':
    main()
