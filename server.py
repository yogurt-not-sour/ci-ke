#!/usr/bin/env python3
"""静态文件服务 + 火山方舟场景图代理（避免 CORS 与 Key 暴露）"""

import base64
import re
import http.server
import json
import os
import socketserver
import urllib.error
import urllib.request
from urllib.parse import unquote, urlsplit
from pathlib import Path

PORT = int(os.environ.get("PORT", "8081"))
DIR = Path(__file__).parent


def load_env():
    env_path = DIR / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())


load_env()
API_KEY = os.environ.get("ARK_API_KEY", "")
IMAGE_MODEL = os.environ.get("ARK_IMAGE_MODEL", "doubao-seedream-4-5-251128")
CHAT_ENDPOINT = os.environ.get("ARK_CHAT_ENDPOINT", "ep-20260419215927-d5c6b")
ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3"

SCENE_B_SYSTEM_PROMPT = """你是「此刻」App 的场景 B 设计助手。根据用户的事件描述、担心内容和小行动，生成场景 B 的图像描述与含义解释。

场景 B 的目标不是安慰用户，也不是制造光明未来，而是在保留现实压力的基础上，帮助用户换一个更宽、更有行动空间的角度看问题。

请先识别用户的深层心理冲突，例如：路径合法性焦虑、同辈比较焦虑、失控感、被否定感、价值感动摇、未来不确定感、关系中的委屈、对自我能力的怀疑。

图像必须：1.与用户原始事件有关；2.保留现实压力，不要阳光大团圆；3.加入「出口」或「可移动空间」的视觉元素；4.体现用户慢慢重新获得一点主动权；5.柔和插画、情绪真实、克制、不鸡汤。

禁止：夸张阳光、胜利姿势、灿烂大笑、大团圆、光明未来式画面、无关的抽象安慰。

解释文字：温暖积极但不夸张；不否定用户痛苦；不用空泛鸡汤；不说「你一定会成功」「一切都会好起来」。

请严格只输出 JSON：
{"deepConflict":"","reframe":"","sceneBDescription":"","imagePrompt":"","caption":"","meaningExplanation":""}"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        parts = Path(unquote(urlsplit(self.path).path)).parts
        if any(part.startswith('.') for part in parts) or any(part in {'server.py', 'api', 'scripts'} for part in parts):
            self.send_error(404)
            return None
        return super().send_head()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/scene-image":
            self.handle_scene_image()
        elif self.path == "/api/scene-b-meta":
            self.handle_scene_b_meta()
        else:
            self.send_error(404)

    def handle_scene_image(self):
        if not API_KEY:
            self.send_json(500, {"error": "未配置 ARK_API_KEY，请检查 .env.local"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            prompt = body.get("prompt", "").strip()
            if not prompt:
                self.send_json(400, {"error": "prompt 不能为空"})
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
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))

            url = result["data"][0]["url"]

            # 服务端下载图片并转 base64，避免浏览器 CORS 导致前端无法显示
            img_req = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0 (compatible; CikeH5/1.0)"}
            )
            with urllib.request.urlopen(img_req, timeout=60) as img_resp:
                content_type = img_resp.headers.get("Content-Type", "image/jpeg")
                raw = img_resp.read()
            b64 = base64.b64encode(raw).decode("ascii")
            data_url = f"data:{content_type};base64,{b64}"

            self.send_json(
                200,
                {
                    "url": data_url,
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

    def handle_scene_b_meta(self):
        if not API_KEY:
            self.send_json(500, {"error": "未配置 ARK_API_KEY"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            user_msg = (
                f"事件描述：{body.get('triggerEvent', '（未填写）')}\n"
                f"最担心：{body.get('mainWorry', '（未填写）')}\n"
                f"可做的小行动：{body.get('smallAction', '（未填写）')}\n"
                f"身体状态：{body.get('bodyState', '（未填写）')}\n"
                f"用户补充的场景细节：{str(body.get('sceneDetails', ''))[:1000]}。请保留这些地点、人物和物件，不将故事替换成无关的抽象风景。\n"
                f"焦虑强度（0-10）：{body.get('anxietyScore', '（未填写）')}"
            )
            payload = json.dumps(
                {
                    "model": CHAT_ENDPOINT,
                    "messages": [
                        {"role": "system", "content": SCENE_B_SYSTEM_PROMPT},
                        {"role": "user", "content": user_msg},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1200,
                },
                ensure_ascii=False,
            ).encode("utf-8")
            req = urllib.request.Request(
                f"{ARK_BASE}/chat/completions",
                data=payload,
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]
            meta = self.parse_json_from_llm(content)
            required = [
                "deepConflict", "reframe", "sceneBDescription",
                "imagePrompt", "caption", "meaningExplanation",
            ]
            for k in required:
                if not meta.get(k):
                    raise ValueError(f"LLM 返回缺少字段: {k}")
            self.send_json(200, meta)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            self.send_json(502, {"error": detail})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    @staticmethod
    def parse_json_from_llm(text):
        text = text.strip()
        block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if block:
            text = block.group(1).strip()
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
        return json.loads(text)

    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        if "/api/" in str(args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    if not API_KEY:
        print("警告: .env.local 中未找到 ARK_API_KEY，场景图将只能走前端 Canvas 备用方案")
    else:
        print(f"火山方舟已配置 · 生图模型: {IMAGE_MODEL}")
    print(f"预览地址: http://localhost:{PORT}")
    with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
