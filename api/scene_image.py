import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler


ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3"
IMAGE_MODEL = os.environ.get("ARK_IMAGE_MODEL", "doubao-seedream-4-5-251128")


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        api_key = os.environ.get("ARK_API_KEY", "")
        if not api_key:
            self.send_json(500, {"error": "未配置 ARK_API_KEY"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            prompt = body.get("prompt", "").strip()
            if not prompt:
                self.send_json(400, {"error": "prompt 不能为空"})
                return
            if len(prompt) > 4000:
                self.send_json(400, {"error": "prompt 过长"})
                return

            payload = json.dumps(
                {
                    "model": IMAGE_MODEL,
                    "prompt": prompt,
                    "size": "2K",
                    "response_format": "url",
                    "watermark": False,
                    "sequential_image_generation": "disabled",
                },
                ensure_ascii=False,
            ).encode("utf-8")

            req = urllib.request.Request(
                f"{ARK_BASE}/images/generations",
                data=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))

            url = result["data"][0]["url"]
            self.send_json(
                200,
                {
                    "url": url,
                    "originalUrl": url,
                    "source": "ai",
                    "model": IMAGE_MODEL,
                },
            )
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            self.send_json(502, {"error": detail})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
