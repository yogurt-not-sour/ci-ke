import json
import os
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler


ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3"
CHAT_ENDPOINT = os.environ.get("ARK_CHAT_ENDPOINT", "ep-20260419215927-d5c6b")

SCENE_B_SYSTEM_PROMPT = """你是「此刻」App 的场景 B 设计助手。根据用户的事件描述、担心内容和小行动，生成场景 B 的图像描述与含义解释。

场景 B 的目标不是安慰用户，也不是制造光明未来，而是在保留现实压力的基础上，帮助用户换一个更宽、更有行动空间的角度看问题。

请先识别用户的深层心理冲突，例如：路径合法性焦虑、同辈比较焦虑、失控感、被否定感、价值感动摇、未来不确定感、关系中的委屈、对自我能力的怀疑。

图像必须：1.与用户原始事件有关；2.保留现实压力，不要阳光大团圆；3.加入「出口」或「可移动空间」的视觉元素；4.体现用户慢慢重新获得一点主动权；5.柔和插画、情绪真实、克制、不鸡汤。

禁止：夸张阳光、胜利姿势、灿烂大笑、大团圆、光明未来式画面、无关的抽象安慰。

解释文字：温暖积极但不夸张；不否定用户痛苦；不用空泛鸡汤；不说「你一定会成功」「一切都会好起来」。

请严格只输出 JSON：
{"deepConflict":"","reframe":"","sceneBDescription":"","imagePrompt":"","caption":"","meaningExplanation":""}"""


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
            user_msg = (
                f"事件描述：{limit_text(body.get('triggerEvent', '（未填写）'))}\n"
                f"最担心：{limit_text(body.get('mainWorry', '（未填写）'))}\n"
                f"可做的小行动：{limit_text(body.get('smallAction', '（未填写）'))}\n"
                f"身体状态：{limit_text(body.get('bodyState', '（未填写）'), 120)}\n"
                f"用户补充的场景细节：{limit_text(body.get('sceneDetails', ''), 1000)}。请保留这些地点、人物和物件，不将故事替换成无关的抽象风景。\n"
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
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode("utf-8"))

            content = result["choices"][0]["message"]["content"]
            meta = parse_json_from_llm(content)
            validate_meta(meta)
            self.send_json(200, meta)
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


def limit_text(value, max_len=500):
    text = str(value or "").strip()
    return text[:max_len]


def parse_json_from_llm(text):
    text = text.strip()
    block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if block:
        text = block.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        text = text[start : end + 1]
    return json.loads(text)


def validate_meta(meta):
    required = [
        "deepConflict",
        "reframe",
        "sceneBDescription",
        "imagePrompt",
        "caption",
        "meaningExplanation",
    ]
    for key in required:
        if not meta.get(key) or not isinstance(meta[key], str):
            raise ValueError(f"LLM 返回缺少字段: {key}")
