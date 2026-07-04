#!/usr/bin/env python3
"""Kleiner Entwicklungs-Server, der das Browser-Caching abschaltet.

Hintergrund: `python3 -m http.server` lässt den Browser JS-Module aggressiv
cachen – nach Änderungen sieht man dann ohne hartes Neuladen die alte Version.
Dieser Server schickt `Cache-Control: no-store`, sodass immer frisch geladen wird.

    python3 serve.py            # → http://localhost:8090
    python3 serve.py 8095       # eigener Port
"""
import functools
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


Handler = functools.partial(NoCacheHandler, directory=DIRECTORY)

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Zeitleiste läuft (ohne Cache): http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")
