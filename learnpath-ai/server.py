import json, sys, os, urllib.request, urllib.parse, re, concurrent.futures, time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

sys.stdout.reconfigure(encoding="utf-8")

DEEPSEEK_KEY = "cbb7c1f1d7114c40867fa6112f95db3b"
DEEPSEEK_URL = "https://genaiapi.shanghaitech.edu.cn/api/v1/start"
DEEPSEEK_MODEL = "deepseek-chat"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

BILI_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    "Referer": "https://search.bilibili.com/",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Origin": "https://search.bilibili.com",
    "Cookie": "buvid3=test-value; b_nut=1700000000",
}

_search_cache = {}
_SEARCH_CACHE_TTL = 1800

def _get_cache(key):
    if key in _search_cache:
        ts, val = _search_cache[key]
        if time.time() - ts < _SEARCH_CACHE_TTL:
            return val
    return None

def _set_cache(key, val):
    _search_cache[key] = (time.time(), val)

def search_bilibili(keyword, pagesize=6):
    cache_key = "bili:" + str(keyword) + ":" + str(pagesize)
    cached = _get_cache(cache_key)
    if cached is not None:
        print("[Cache] hit:", str(keyword)[:30])
        return cached
    url = "https://api.bilibili.com/x/web-interface/search/type?search_type=video"
    url += "&keyword=" + urllib.parse.quote(keyword)
    url += "&pagesize=" + str(pagesize) + "&page=1"
    req = urllib.request.Request(url, headers=BILI_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise Exception("Bili error " + str(e.code))
    if data.get("code") != 0:
        raise Exception("Bili code=" + str(data.get("code")))
    results = []
    for r in data.get("data", {}).get("result", []):
        results.append({
            "bvid": r.get("bvid", ""),
            "title": re.sub(r"<[^>]+>", "", r.get("title", "")),
            "author": r.get("author", ""),
            "description": (r.get("description") or "")[:200],
            "duration": r.get("duration", ""),
            "play": r.get("play", 0),
            "danmaku": r.get("video_review", 0),
            "favorites": r.get("favorites", 0),
            "like": r.get("like", 0),
            "pic": "https:" + r.get("pic", "") if r.get("pic") else "",
            "tag": r.get("tag", ""),
            "arcurl": r.get("arcurl", ""),
            "pubdate": r.get("pubdate", 0),
        })
    _set_cache(cache_key, results)
    return results

def call_deepseek(messages, max_tokens=2000, temperature=0.7):
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    headers = {
        "Authorization": "Bearer " + DEEPSEEK_KEY,
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers, method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    if "choices" not in result:
        raise Exception("AI API error: " + str(result.get("message", "unknown")))
    return result["choices"][0]["message"]["content"]


def analyze_learning_goal(query, duration="30"):
    prompt = (
        "用户想学习：" + query + "\n\n"
        + "请分析学习目标，返回JSON（只返回JSON）：\n"
        + '{"topic":"学习主题","keywords":["k1","k2","k3"],"difficulty":"beginner","description":"一句话","subtopics":["s1","s2"],"roadmap":[{"step":1,"title":"第一步","description":"说明"}]}\n\n'
        + "要求：keywords填3个B站搜索关键词，大学课程必须含'大学'限定词。difficulty:beginner/intermediate/advanced。roadmap 3-5步含days字段。JSON顶层加total_days和daily_hours。学习时长" + duration + "天"
    )
    return call_deepseek([
        {"role": "system", "content": "只输出JSON，不要其他文字"},
        {"role": "user", "content": prompt},
    ], max_tokens=800)


def rank_videos(videos, query, duration="30"):
    items = []
    for i, v in enumerate(videos):
        items.append("[" + str(i) + "]" + v.get("title","")[:50] + "|" + v.get("author","") + "|播放:" + str(v.get("play",0)))
    P = (
        "用户想学：" + query + "\n学习时长" + str(duration) + "天\n\n视频：\n" + "\n".join(items) + "\n\n"
        + "返回JSON数组：\n"
        + '[{"index":0,"score":9,"relevance_reason":"理由","suggested_order":1,"roadmap_step":1,"days_estimate":3,"suggestion":"建议15字"}]\n\n'
        + "score 1-10分，roadmap_step对应步骤编号，days_estimate建议天数，suggestion学习建议15字内"
    )
    return call_deepseek([
        {"role": "system", "content": "只输出JSON数组"},
        {"role": "user", "content": P},
    ], max_tokens=2000)




def generate_video_detail(query, video):
    items = []
    items.append("标题：" + video.get("title", ""))
    items.append("作者：" + video.get("author", ""))
    items.append("简介：" + (video.get("description", "") or "")[:100])
    items.append("时长：" + str(video.get("duration", "")))
    info = chr(10).join(items)
    prompt = ("用户学：" + query + chr(10) + chr(10) + "分析此B站视频：" + chr(10) + info
        + chr(10) + chr(10) + "返回JSON（只返回JSON）："
        + '{"introduction":"视频评价80字","study_plan":{"total_days":3,"daily_hours":2,"schedule":[{"day":1,"topic":"主题","content":"学什么"}]},"comparison":"对比分析40字"}')
    return call_deepseek([
        {"role": "system", "content": "只输出JSON"},
        {"role": "user", "content": prompt},
    ], max_tokens=2000)

class LearnPathHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = "/index.html" if parsed.path == "/" else parsed.path
        fp = os.path.join(PROJECT_DIR, path.lstrip("/"))
        if os.path.isfile(fp):
            ext = os.path.splitext(fp)[1]
            mime = {".html":"text/html;charset=utf-8",".css":"text/css;charset=utf-8",".js":"application/javascript; charset=utf-8"}
            self.send_response(200)
            self.send_header("Content-Type", mime.get(ext, "application/octet-stream"))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with open(fp, "rb") as f:
                self.wfile.write(f.read())
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        try:
            p = urlparse(self.path)
            if p.path == "/api/search":
                self._search()
            elif p.path == "/api/video-detail":
                self._video_detail()
            else:
                self._json(404, {"error":"Not found"})
        except Exception as e:
            try:
                self._json(500, {"error":str(e)})
            except: pass

    def _search(self):
        try:
            cl = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(cl).decode("utf-8"))
        except:
            self._json(400, {"error":"Invalid"})
            return
        q = body.get("query","").strip()
        duration = str(body.get("duration", "30"))
        if not q:
            self._json(400, {"error":"请输入"})
            return

        # Accept custom API config from frontend
        cfg = body.get("api_config", {})
        if cfg:
            global DEEPSEEK_KEY, DEEPSEEK_URL, DEEPSEEK_MODEL
            if cfg.get("api_key"):
                DEEPSEEK_KEY = cfg["api_key"]
            if cfg.get("api_url"):
                DEEPSEEK_URL = cfg["api_url"]
            if cfg.get("api_model"):
                DEEPSEEK_MODEL = cfg["api_model"]


        # Step 1: Analyze
        try:
            ar = analyze_learning_goal(q, duration)
            analysis = json.loads(ar)
        except Exception as e:
            print("[Error] AI:", e)
            analysis = {"topic":q,"keywords":[q],"difficulty":"beginner","description":"","subtopics":[],"roadmap":[],"total_days":int(duration),"daily_hours":max(1,int(duration)//10)}
        keywords = analysis.get("keywords",[q])[:3]
        if q not in keywords:
            keywords.insert(0, q)

        # Step 2: Parallel search
        errs = []
        all_v = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
            fm = {ex.submit(search_bilibili, kw, 6): kw for kw in keywords[:3]}
            for f in concurrent.futures.as_completed(fm):
                kw = fm[f]
                try:
                    all_v.extend(f.result(timeout=20))
                except Exception as e:
                    errs.append(str(kw)+": "+str(e)[:60])
        seen = set()
        uniq = []
        for v in all_v:
            if v.get("bvid") and v["bvid"] not in seen:
                seen.add(v["bvid"])
                uniq.append(v)
        uniq = uniq[:15]

        # Step 3: Ranking
        if uniq:
            try:
                rr = rank_videos(uniq, q, duration)
                ranking = json.loads(rr)
                sm = {}
                for item in ranking:
                    sm[item.get("index")] = item
                for i, v in enumerate(uniq):
                    info = sm.get(i, {})
                    v["ai_score"] = info.get("score", 6.0)
                    v["relevance_reason"] = info.get("relevance_reason", "")
                    v["suggested_order"] = info.get("suggested_order", 99)
                    v["roadmap_step"] = info.get("roadmap_step", 0)
                    v["days_estimate"] = info.get("days_estimate", 0)
                    v["suggestion"] = info.get("suggestion", "")
                uniq.sort(key=lambda x: (x.get("suggested_order",99), -x.get("ai_score",0)))
                for i, v in enumerate(uniq):
                    v["suggested_order"] = i + 1
            except Exception as e:
                print("[Error] Rank:", e)
                for i, v in enumerate(uniq):
                    v["ai_score"] = max(1, 10 - i*0.5)
                    v["relevance_reason"] = ""
                    v["suggested_order"] = i+1
                    v["roadmap_step"] = 0
                    v["days_estimate"] = 0
                    v["suggestion"] = ""

        roadmap = analysis.get("roadmap", [])
        self._json(200, {"analysis":analysis, "videos":uniq, "roadmap":roadmap})


    def _video_detail(self):
        try:
            cl = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(cl).decode("utf-8"))
        except:
            self._json(400, {"error":"Invalid"})
            return
        q = body.get("query", "")
        v = body.get("video", {})
        if not q or not v.get("bvid"):
            self._json(400, {"error":"Missing params"})
            return
        try:
            detail = generate_video_detail(q, v)
            parsed = json.loads(detail)
            self._json(200, parsed)
        except Exception as e:
            print("[Error] Video detail:", e)
            self._json(200, {"introduction":"AI 分析服务暂时不可用，请稍后重试","study_plan":{"total_days":0,"daily_hours":0,"schedule":[]},"comparison":""})

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, f, *a):
        print("[S]", a[0], a[1], a[2])

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin","*")
        self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers","Content-Type")
        self.end_headers()


def run_server(port=8000):
    HTTPServer(("0.0.0.0", port), LearnPathHandler).serve_forever()

if __name__ == "__main__":
    run_server(int(sys.argv[1]) if len(sys.argv) > 1 else 8000)

