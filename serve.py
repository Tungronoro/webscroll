"""HTTP server ho tro Range requests (can thiet de seek video)."""
import http.server
import os
import socketserver

PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))

class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_GET(self):
        # Let SimpleHTTPRequestHandler handle normally, but inject Range support
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().do_GET()
        fs = os.fstat(os.open(path, os.O_RDONLY))
        size = fs.st_size
        rng = self.headers.get('Range')
        if rng and rng.startswith('bytes='):
            try:
                spec = rng[6:].split(',')[0].strip()
                start_s, end_s = spec.split('-')
                start = int(start_s) if start_s else 0
                end = int(end_s) if end_s else size - 1
                end = min(end, size - 1)
                if start > end or start >= size:
                    self.send_error(416, 'Range Not Satisfiable')
                    return
                length = end - start + 1
                with open(path, 'rb') as f:
                    f.seek(start)
                    data = f.read(length)
                self.send_response(206)
                self.send_header('Content-Type', self.guess_type(path))
                self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Length', str(length))
                self.send_header('Last-Modified', self.date_time_string(fs.st_mtime))
                self.end_headers()
                self.wfile.write(data)
                return
            except Exception:
                pass
        super().do_GET()

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

with socketserver.ThreadingTCPServer(('', PORT), RangeHandler) as httpd:
    print(f'Serving (Range-supported) at http://localhost:{PORT}')
    print(f'Root: {ROOT}')
    httpd.serve_forever()
