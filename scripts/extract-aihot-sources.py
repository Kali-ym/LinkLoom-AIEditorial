#!/usr/bin/env python3
"""Extract AI HOT source catalog and produce Folo import artifacts.

Reads the public items API (no admin access), classifies sources, discovers
RSS/Atom feeds, and writes OPML + markdown lists under exports/aihot-folo/.
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_BASE = "https://aihot.virxact.com"
UA = "aihot-skill/0.3.6 (+https://aihot.virxact.com/aihot-skill/)"
REQUEST_GAP_SEC = 1.0
FEED_GAP_SEC = 0.4
MAX_PAGES = 40
TAKE = 100

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "exports" / "aihot-folo"

# High-confidence source-name → feed URL mappings (plan step 2).
HARDCODED_FEEDS: dict[str, dict[str, str]] = {
    "IT之家（RSS）": {
        "xmlUrl": "https://www.ithome.com/rss/",
        "htmlUrl": "https://www.ithome.com/",
    },
    "TechCrunch：AI（RSS）": {
        "xmlUrl": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "htmlUrl": "https://techcrunch.com/category/artificial-intelligence/",
    },
    "The Decoder：AI News（RSS）": {
        "xmlUrl": "https://the-decoder.com/feed/",
        "htmlUrl": "https://the-decoder.com/",
    },
    "MarkTechPost（RSS）": {
        "xmlUrl": "https://www.marktechpost.com/feed/",
        "htmlUrl": "https://www.marktechpost.com/",
    },
    "The Verge：AI（RSS）": {
        "xmlUrl": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "htmlUrl": "https://www.theverge.com/ai-artificial-intelligence",
    },
    "Ars Technica：AI（RSS）": {
        "xmlUrl": "https://arstechnica.com/ai/feed/",
        "htmlUrl": "https://arstechnica.com/ai/",
    },
    "Artificial Intelligence News（RSS）": {
        "xmlUrl": "https://www.artificialintelligence-news.com/feed/",
        "htmlUrl": "https://www.artificialintelligence-news.com/",
    },
    "Apple Machine Learning Research（RSS）": {
        "xmlUrl": "https://machinelearning.apple.com/rss.xml",
        "htmlUrl": "https://machinelearning.apple.com/",
    },
    "Claude Code：GitHub Releases（RSS）": {
        "xmlUrl": "https://github.com/anthropics/claude-code/releases.atom",
        "htmlUrl": "https://github.com/anthropics/claude-code/releases",
    },
    "Hugging Face：Blog（RSS）": {
        "xmlUrl": "https://huggingface.co/blog/feed.xml",
        "htmlUrl": "https://huggingface.co/blog",
    },
    "Google Developers Blog（RSS）": {
        "xmlUrl": "https://developers.googleblog.com/feeds/posts/default",
        "htmlUrl": "https://developers.googleblog.com/",
    },
    "Google DeepMind：Blog（RSS）": {
        "xmlUrl": "https://deepmind.google/blog/rss.xml",
        "htmlUrl": "https://deepmind.google/blog/",
    },
    "VentureBeat：AI（RSS）": {
        "xmlUrl": "https://venturebeat.com/category/ai/feed/",
        "htmlUrl": "https://venturebeat.com/category/ai/",
    },
    "Google Blog：AI（RSS）": {
        "xmlUrl": "https://blog.google/technology/ai/rss/",
        "htmlUrl": "https://blog.google/technology/ai/",
    },
    "Gary Marcus：The Road to AI We Can Trust（RSS）": {
        "xmlUrl": "https://garymarcus.substack.com/feed",
        "htmlUrl": "https://garymarcus.substack.com/",
    },
    "Nathan Lambert：Interconnects（RSS）": {
        "xmlUrl": "https://www.interconnects.ai/feed",
        "htmlUrl": "https://www.interconnects.ai/",
    },
    "OpenRouter：Announcements（RSS）": {
        "xmlUrl": "https://openrouter.ai/blog/feed.xml",
        "htmlUrl": "https://openrouter.ai/blog",
    },
    "OpenAI：Alignment 研究博客（RSS）": {
        "xmlUrl": "https://alignment.openai.com/rss.xml",
        "htmlUrl": "https://alignment.openai.com/",
    },
    "OpenAI：官网动态（RSS · 排除企业/客户案例）": {
        "xmlUrl": "https://openai.com/blog/rss.xml",
        "htmlUrl": "https://openai.com/blog",
        "note": "公开侧只能订官方 Blog RSS，无法复现 AI HOT 对企业/客户案例的过滤。",
    },
    "Simon Willison 博客": {
        "xmlUrl": "https://simonwillison.net/atom/everything/",
        "htmlUrl": "https://simonwillison.net/",
    },
    "GitHub Blog": {
        "xmlUrl": "https://github.blog/feed/",
        "htmlUrl": "https://github.blog/",
    },
    "Cursor Blog": {
        "xmlUrl": "https://cursor.com/atom.xml",
        "htmlUrl": "https://cursor.com/blog",
    },
    "Tomer Tunguz 博客（VC 分析）": {
        "xmlUrl": "https://www.tomtunguz.com/index.xml",
        "htmlUrl": "https://www.tomtunguz.com/",
    },
    "Hacker News 热门（buzzing.cc 中文翻译）": {
        "xmlUrl": "https://hn.buzzing.cc/feed.xml",
        "htmlUrl": "https://hn.buzzing.cc/",
    },
    "HuggingFace Daily Papers（社区热门论文）": {
        "xmlUrl": "https://rss.arxiv.org/rss/cs.AI",
        "htmlUrl": "https://huggingface.co/papers",
        "note": "HF Daily Papers 无稳定公开 RSS；用 arXiv cs.AI RSS 作为最接近的可订阅替代。",
    },
}

KNOWN_BLOG_DOMAINS = {
    "simonwillison.net",
    "github.blog",
    "cursor.com",
    "www.tomtunguz.com",
    "tomtunguz.com",
    "www.lmsys.org",
    "lmsys.org",
    "openai.com",
    # Note: do NOT treat huggingface.co as a blanket blog domain —
    # model cards / org pages would false-positive onto blog/feed.xml.
}

COMMON_FEED_PATHS = (
    "/feed",
    "/rss",
    "/atom.xml",
    "/feed.xml",
    "/index.xml",
    "/rss.xml",
    "/feeds/posts/default",
)

X_HANDLE_RE = re.compile(r"@([A-Za-z0-9_]+)")
LINK_ALT_RE = re.compile(
    r"""<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]*>""",
    re.IGNORECASE,
)
HREF_RE = re.compile(r"""href=["']([^"']+)["']""", re.IGNORECASE)
TYPE_RE = re.compile(r"""type=["']([^"']+)["']""", re.IGNORECASE)


@dataclass
class SourceEntry:
    name: str
    kind: str  # rss | x | wechat | web | api | other
    count: int = 0
    sample_urls: list[str] = field(default_factory=list)
    domains: dict[str, int] = field(default_factory=dict)
    x_handle: str | None = None
    xml_url: str | None = None
    html_url: str | None = None
    feed_status: str | None = None  # resolved | discovered | skipped | failed
    note: str | None = None


def log(msg: str) -> None:
    print(msg, flush=True)


def http_get(
    url: str,
    *,
    timeout: float = 20.0,
    ua: str = UA,
    max_bytes: int = 2_000_000,
) -> tuple[int, bytes, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": ua,
            "Accept": "*/*",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(max_bytes)
            ctype = resp.headers.get("Content-Type", "")
            return resp.getcode() or 200, raw, ctype
    except urllib.error.HTTPError as e:
        raw = e.read(max_bytes) if e.fp else b""
        ctype = e.headers.get("Content-Type", "") if e.headers else ""
        return e.code, raw, ctype
    except Exception as e:  # noqa: BLE001 — network probe must not crash batch
        return 0, str(e).encode(), ""


def api_get_json(path_and_query: str, *, retries: int = 3) -> dict[str, Any]:
    url = f"{API_BASE}{path_and_query}"
    delay = REQUEST_GAP_SEC
    last_err: Exception | None = None
    for attempt in range(retries):
        time.sleep(REQUEST_GAP_SEC if attempt == 0 else delay)
        code, raw, _ = http_get(url, timeout=30.0)
        if code == 429:
            delay = min(60.0, 30.0 * (attempt + 1))
            log(f"  429 on {path_and_query}, backoff {delay:.0f}s")
            continue
        if code >= 500:
            delay = min(30.0, 5.0 * (attempt + 1))
            log(f"  {code} on {path_and_query}, retry")
            continue
        if code != 200:
            raise RuntimeError(f"API {code} for {url}: {raw[:200]!r}")
        return json.loads(raw.decode("utf-8"))
    raise RuntimeError(f"API failed after retries: {url}") from last_err


def classify(name: str, sample_url: str) -> tuple[str, str | None]:
    if name.startswith("X：") or name.startswith("X:"):
        m = X_HANDLE_RE.search(name)
        return "x", (m.group(1) if m else None)
    if "公众号" in name:
        return "wechat", None
    if "（API）" in name or "(API)" in name:
        return "api", None
    if "（网页" in name or "(网页" in name:
        return "web", None
    if "（RSS）" in name or "(RSS)" in name or "RSS ·" in name or "（RSS ·" in name:
        return "rss", None
    if name in HARDCODED_FEEDS:
        return "rss", None
    host = urllib.parse.urlparse(sample_url).netloc.lower() if sample_url else ""
    if host.startswith("www."):
        host = host[4:]
    if host in KNOWN_BLOG_DOMAINS or any(host.endswith("." + d) for d in KNOWN_BLOG_DOMAINS):
        return "rss", None
    # Remaining named blogs without RSS label still try discovery
    if any(k in name for k in ("博客", "Blog", "News", "Research")):
        return "rss", None
    return "other", None


def looks_like_feed(body: bytes, ctype: str) -> bool:
    head = body[:800].lstrip().lower()
    if b"<html" in head[:200] and b"<rss" not in head and b"<feed" not in head:
        return False
    ctype_l = ctype.lower()
    if any(t in ctype_l for t in ("rss", "atom", "xml")) and b"<html" not in head[:120]:
        if b"<rss" in head or b"<feed" in head or b"rdf:rdf" in head:
            return True
    return b"<rss" in head or b"<feed" in head or b"rdf:rdf" in head


def origin_of(url: str) -> str:
    p = urllib.parse.urlparse(url)
    if not p.scheme or not p.netloc:
        return ""
    return f"{p.scheme}://{p.netloc}"


def absolutize(base: str, href: str) -> str:
    return urllib.parse.urljoin(base, href)


def extract_alternate_feeds(page_url: str, html_bytes: bytes) -> list[str]:
    text = html_bytes.decode("utf-8", errors="ignore")
    found: list[str] = []
    for tag in LINK_ALT_RE.findall(text):
        type_m = TYPE_RE.search(tag)
        href_m = HREF_RE.search(tag)
        if not href_m:
            continue
        type_v = (type_m.group(1) if type_m else "").lower()
        if type_v and "rss" not in type_v and "atom" not in type_v and "xml" not in type_v:
            continue
        found.append(absolutize(page_url, href_m.group(1)))
    # also catch bare feed links
    for m in re.finditer(r"""href=["']([^"']*(?:feed|rss|atom)[^"']*)["']""", text, re.I):
        href = m.group(1)
        if href.startswith("mailto:"):
            continue
        found.append(absolutize(page_url, href))
    # dedupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for u in found:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def validate_feed(url: str) -> bool:
    time.sleep(FEED_GAP_SEC)
    code, body, ctype = http_get(url, timeout=15.0, ua="LinkLoom-aihot-export/1.0 (+https://aihot.virxact.com/)")
    if code != 200:
        return False
    return looks_like_feed(body, ctype)


def same_site(a: str, b: str) -> bool:
    """True if hosts share a registrable-ish suffix (last two labels)."""
    def labels(url: str) -> list[str]:
        host = urllib.parse.urlparse(url).netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        return [p for p in host.split(".") if p]

    la, lb = labels(a), labels(b)
    if not la or not lb:
        return False
    if la == lb:
        return True
    return len(la) >= 2 and len(lb) >= 2 and la[-2:] == lb[-2:]


def discover_feed(sample_url: str, html_hint: str | None = None) -> tuple[str | None, str | None]:
    """Return (xmlUrl, htmlUrl) or (None, htmlUrl)."""
    html_url = html_hint or origin_of(sample_url) or sample_url
    if not html_url:
        return None, None

    site_anchor = sample_url or html_url
    candidates: list[str] = []
    # Prefer article page + site origin for <link rel=alternate>; avoid bare
    # mega-hosts' root (e.g. huggingface.co) which often points at blog feed.
    pages = []
    if sample_url:
        pages.append(sample_url)
    origin = origin_of(html_url) or origin_of(sample_url)
    if origin and origin.rstrip("/") not in {p.rstrip("/") for p in pages}:
        # Only probe origin when sample path is shallow (blog/news sites)
        path = urllib.parse.urlparse(sample_url or html_url).path or "/"
        if path.count("/") <= 2:
            pages.append(origin)
    for page in dict.fromkeys(pages + ([html_url] if html_url else [])):
        if not page:
            continue
        time.sleep(FEED_GAP_SEC)
        code, body, ctype = http_get(
            page,
            timeout=12.0,
            ua="LinkLoom-aihot-export/1.0 (+https://aihot.virxact.com/)",
        )
        if code == 200 and body:
            if looks_like_feed(body, ctype) and same_site(page, site_anchor):
                return page, origin_of(page) or html_url
            candidates.extend(extract_alternate_feeds(page, body))

    if origin:
        for path in COMMON_FEED_PATHS:
            candidates.append(origin.rstrip("/") + path)

    seen: set[str] = set()
    for cand in candidates:
        if cand in seen:
            continue
        seen.add(cand)
        if not same_site(cand, site_anchor):
            continue
        # Reject generic /blog/feed when the sample is a model/org card path
        sample_path = urllib.parse.urlparse(sample_url or "").path
        cand_path = urllib.parse.urlparse(cand).path
        if sample_path.startswith("/") and "/blog" not in sample_path:
            if cand_path.rstrip("/").endswith("/blog/feed.xml") or cand_path == "/blog/feed.xml":
                continue
        if validate_feed(cand):
            return cand, origin or html_url
    return None, origin or html_url


def collect_sources() -> dict[str, SourceEntry]:
    by_name: dict[str, SourceEntry] = {}
    cursor: str | None = None
    pages = 0
    total_items = 0

    while pages < MAX_PAGES:
        q = f"/api/public/items?mode=all&take={TAKE}"
        if cursor:
            q += f"&cursor={urllib.parse.quote(cursor)}"
        log(f"Fetching page {pages + 1}…")
        data = api_get_json(q)
        items = data.get("items") or []
        total_items += len(items)
        for it in items:
            name = it.get("source")
            if isinstance(name, dict):
                name = name.get("name")
            if not name or not isinstance(name, str):
                continue
            url = it.get("url") or ""
            entry = by_name.get(name)
            if not entry:
                kind, handle = classify(name, url)
                entry = SourceEntry(name=name, kind=kind, x_handle=handle)
                by_name[name] = entry
            entry.count += 1
            if url and url not in entry.sample_urls and len(entry.sample_urls) < 5:
                entry.sample_urls.append(url)
            if url:
                host = urllib.parse.urlparse(url).netloc
                if host:
                    entry.domains[host] = entry.domains.get(host, 0) + 1

        pages += 1
        if not data.get("hasNext"):
            break
        cursor = data.get("nextCursor")
        if not cursor:
            break

    log(f"Collected {len(by_name)} sources from {total_items} items across {pages} pages")
    return by_name


def resolve_feeds(sources: dict[str, SourceEntry]) -> None:
    for name, entry in sorted(sources.items(), key=lambda kv: -kv[1].count):
        if entry.kind in ("x", "wechat", "api", "web"):
            entry.feed_status = "skipped"
            if entry.kind == "wechat":
                entry.note = "微信公众号无稳定公开 RSS，Folo 无法可靠导入。"
            elif entry.kind == "api":
                entry.note = "API 抓取源，无公开 RSS。"
            elif entry.kind == "web":
                entry.note = "网页抓取源，无公开 RSS。"
            elif entry.kind == "x":
                entry.html_url = f"https://x.com/{entry.x_handle}" if entry.x_handle else None
                entry.note = "请在 Folo 中通过 X 主页链接原生订阅。"
            continue

        # Treat 'other' blog-like as rss candidates; pure unknown skip after try
        if entry.kind == "other":
            # still try discovery once; if fail, skip
            pass

        if name in HARDCODED_FEEDS:
            meta = HARDCODED_FEEDS[name]
            xml_url = meta["xmlUrl"]
            html_url = meta.get("htmlUrl")
            note = meta.get("note")
            log(f"  validate hardcoded: {name}")
            time.sleep(FEED_GAP_SEC)
            code, body, ctype = http_get(
                xml_url,
                timeout=20.0,
                ua="LinkLoom-aihot-export/1.0 (+https://aihot.virxact.com/)",
            )
            ok = code == 200 and looks_like_feed(body, ctype)
            # Network flakes (code 0 / SSL) on known-good feeds: keep URL, annotate.
            network_flake = code == 0
            if ok or network_flake:
                entry.xml_url = xml_url
                entry.html_url = html_url
                entry.feed_status = "resolved"
                entry.kind = "rss"
                bits = []
                if note:
                    bits.append(note)
                if network_flake and not ok:
                    bits.append(f"本机校验时网络失败（code={code}），仍写入已知 feed URL。")
                entry.note = " ".join(bits) or None
            else:
                entry.feed_status = "failed"
                entry.note = (note + " " if note else "") + f"硬编码 feed 校验失败 ({code}): {xml_url}"
                entry.html_url = html_url
            continue

        if entry.kind not in ("rss", "other"):
            entry.feed_status = "skipped"
            continue

        sample = entry.sample_urls[0] if entry.sample_urls else ""
        top_domain = ""
        if entry.domains:
            top_domain = max(entry.domains.items(), key=lambda x: x[1])[0]
        html_hint = f"https://{top_domain}/" if top_domain else None
        log(f"  discover: {name}")
        xml_url, html_url = discover_feed(sample, html_hint)
        if xml_url:
            entry.xml_url = xml_url
            entry.html_url = html_url
            entry.feed_status = "discovered"
            entry.kind = "rss"
        else:
            entry.html_url = html_url
            entry.feed_status = "failed"
            entry.note = "未能发现可用的 RSS/Atom feed。"
            if entry.kind == "other":
                entry.feed_status = "skipped"
                entry.note = "非 RSS 标注源，且未能发现 feed。"


def escape_attr(value: str) -> str:
    return html.escape(value, quote=True)


def write_opml(sources: dict[str, SourceEntry], path: Path) -> int:
    rss_entries = [
        e
        for e in sources.values()
        if e.xml_url and e.feed_status in ("resolved", "discovered")
    ]
    rss_entries.sort(key=lambda e: (-e.count, e.name))

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<opml version="2.0">',
        "  <head>",
        "    <title>AI HOT Sources → Folo</title>",
        f"    <dateCreated>{datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')}</dateCreated>",
        "  </head>",
        "  <body>",
        '    <outline text="AI HOT Sources" title="AI HOT Sources">',
        (
            '      <outline type="rss" text="AI HOT — 精选" title="AI HOT — 精选" '
            'xmlUrl="https://aihot.virxact.com/feed.xml" '
            'htmlUrl="https://aihot.virxact.com/" />'
        ),
    ]
    for e in rss_entries:
        attrs = [
            'type="rss"',
            f'text="{escape_attr(e.name)}"',
            f'title="{escape_attr(e.name)}"',
            f'xmlUrl="{escape_attr(e.xml_url or "")}"',
        ]
        if e.html_url:
            attrs.append(f'htmlUrl="{escape_attr(e.html_url)}"')
        lines.append(f'      <outline {" ".join(attrs)} />')
    lines.extend(["    </outline>", "  </body>", "</opml>", ""])
    path.write_text("\n".join(lines), encoding="utf-8")
    return len(rss_entries) + 1  # + curated


def write_rss_md(sources: dict[str, SourceEntry], path: Path) -> int:
    """Markdown twin of the OPML list — paste feed URLs into Folo one by one."""
    rss_entries = [
        e
        for e in sources.values()
        if e.xml_url and e.feed_status in ("resolved", "discovered")
    ]
    rss_entries.sort(key=lambda e: (-e.count, e.name))

    lines = [
        "# AI HOT → Folo：RSS / Atom 清单",
        "",
        "可批量导入同目录的 `aihot-sources-rss.opml`；也可以在 [Folo](https://app.folo.is/) 添加订阅时逐条粘贴下方 **Feed URL**。",
        "",
        f"共 **{len(rss_entries) + 1}** 条（含 AI HOT 精选；按近 7 天公开池出现频次排序）。",
        "",
        "- [AI HOT — 精选](https://aihot.virxact.com/feed.xml) — Feed: `https://aihot.virxact.com/feed.xml` · 站点: [aihot.virxact.com](https://aihot.virxact.com/)",
    ]
    for e in rss_entries:
        feed = e.xml_url or ""
        site = e.html_url or ""
        site_part = f" · 站点: [{urllib.parse.urlparse(site).netloc or site}]({site})" if site else ""
        note_part = f" — _{e.note}_" if e.note else ""
        lines.append(
            f"- [{e.name}]({feed}) — Feed: `{feed}`{site_part} （{e.count}）{note_part}"
        )
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    return len(rss_entries) + 1


def write_x_md(sources: dict[str, SourceEntry], path: Path) -> int:
    xs = [e for e in sources.values() if e.kind == "x" and e.x_handle]
    xs.sort(key=lambda e: (-e.count, e.x_handle or ""))
    lines = [
        "# AI HOT → Folo：X 账号清单",
        "",
        "在 [Folo](https://app.folo.is/) 中搜索或粘贴下列主页链接逐条添加。",
        "",
        f"共 **{len(xs)}** 个账号（按近 7 天公开池出现频次排序）。",
        "",
    ]
    for e in xs:
        lines.append(f"- [@{e.x_handle}](https://x.com/{e.x_handle}) — {e.name} （{e.count}）")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    return len(xs)


def write_skipped_md(sources: dict[str, SourceEntry], path: Path) -> int:
    groups: dict[str, list[SourceEntry]] = defaultdict(list)
    for e in sources.values():
        if e.kind == "x":
            continue
        if e.xml_url and e.feed_status in ("resolved", "discovered"):
            continue
        if e.kind == "wechat":
            groups["微信公众号"].append(e)
        elif e.kind in ("web", "api"):
            groups["网页 / API 抓取"].append(e)
        elif e.feed_status == "failed":
            groups["RSS 探测失败"].append(e)
        else:
            groups["其他无法导入"].append(e)

    lines = [
        "# AI HOT → Folo：无法导入的信源",
        "",
        "以下信源无法可靠转为标准 RSS，或探测失败，故未写入 OPML。",
        "",
    ]
    total = 0
    for title in ("微信公众号", "网页 / API 抓取", "RSS 探测失败", "其他无法导入"):
        items = groups.get(title) or []
        if not items:
            continue
        items.sort(key=lambda e: (-e.count, e.name))
        total += len(items)
        lines.append(f"## {title}（{len(items)}）")
        lines.append("")
        for e in items:
            note = e.note or ""
            sample = e.sample_urls[0] if e.sample_urls else ""
            extra = f" — {note}" if note else ""
            sample_s = f" · 样本: {sample}" if sample else ""
            lines.append(f"- **{e.name}** （{e.count}）{extra}{sample_s}")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    return total


def write_catalog(sources: dict[str, SourceEntry], path: Path, stats: dict[str, Any]) -> None:
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "apiBase": API_BASE,
        "stats": stats,
        "sources": [asdict(e) for e in sorted(sources.values(), key=lambda e: (-e.count, e.name))],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_import_md(path: Path, stats: dict[str, Any]) -> None:
    lines = [
        "# 将 AI HOT 信源导入 Folo",
        "",
        f"生成时间（UTC）：`{stats['generatedAt']}`",
        "",
        "## 摘要",
        "",
        f"- 公开池信源总数：**{stats['totalSources']}**",
        f"- OPML 中 RSS/Atom（含 AI HOT 精选）：**{stats['opmlFeeds']}**",
        f"- X 账号需逐条添加：**{stats['xAccounts']}**",
        f"- 跳过 / 失败：**{stats['skipped']}**",
        "",
        "## 文件",
        "",
        "| 文件 | 用途 |",
        "|------|------|",
        "| `aihot-sources-rss.opml` | Folo OPML 批量导入 |",
        "| `aihot-sources-rss.md` | RSS Feed URL 清单（Markdown，可逐条粘贴） |",
        "| `aihot-sources-x.md` | X 主页链接清单 |",
        "| `aihot-sources-skipped.md` | 无法导入说明 |",
        "| `aihot-sources-catalog.json` | 全量元数据 |",
        "",
        "## 步骤 1：导入 RSS",
        "",
        "**方式 A（推荐）— OPML 批量：**",
        "",
        "1. 打开 [https://app.folo.is/](https://app.folo.is/) 并登录。",
        "2. 进入订阅管理 / 设置中的 **Import OPML**（或「导入订阅」）。",
        "3. 选择本目录的 `aihot-sources-rss.opml` 上传。",
        "4. 导入完成后，在列表中应看到文件夹 **AI HOT Sources**。",
        "",
        "**方式 B — Markdown 逐条：**",
        "",
        "1. 打开 `aihot-sources-rss.md`。",
        "2. 复制每条的 Feed URL（反引号内），在 Folo 添加订阅框中粘贴并确认。",
        "",
        "## 步骤 2：添加 X 账号",
        "",
        "1. 打开 `aihot-sources-x.md`。",
        "2. 对每个 `https://x.com/...` 链接，在 Folo 的添加订阅框中粘贴并确认。",
        "3. X 源依赖 Folo 原生抓取，偶发不可用属正常现象，可稍后重试。",
        "",
        "## 步骤 3：关于无法导入的源",
        "",
        "见 `aihot-sources-skipped.md`。微信公众号、部分官网「网页」抓取与纯 API 源没有稳定公开 RSS，",
        "无法批量进 Folo。若仍想覆盖精选内容，请保留已导入的 **AI HOT — 精选** 聚合源。",
        "",
        "## 重新生成",
        "",
        "```bash",
        "python3 scripts/extract-aihot-sources.py",
        "```",
        "",
        "脚本会覆盖 `exports/aihot-folo/` 下的产物。",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def spot_check_opml(opml_path: Path, limit: int = 8) -> list[tuple[str, bool, str]]:
    tree = ET.parse(opml_path)
    urls: list[tuple[str, str]] = []
    for outline in tree.findall(".//outline"):
        xml_url = outline.attrib.get("xmlUrl")
        title = outline.attrib.get("text") or outline.attrib.get("title") or xml_url
        if xml_url:
            urls.append((title or xml_url, xml_url))
    results = []
    for title, url in urls[:limit]:
        ok = validate_feed(url)
        results.append((title, ok, url))
        log(f"  spot-check {'OK' if ok else 'FAIL'}: {title} → {url}")
    return results


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = collect_sources()
    resolve_feeds(sources)

    opml_path = OUT_DIR / "aihot-sources-rss.opml"
    rss_md_path = OUT_DIR / "aihot-sources-rss.md"
    x_path = OUT_DIR / "aihot-sources-x.md"
    skip_path = OUT_DIR / "aihot-sources-skipped.md"
    catalog_path = OUT_DIR / "aihot-sources-catalog.json"
    import_path = OUT_DIR / "IMPORT.md"

    opml_count = write_opml(sources, opml_path)
    write_rss_md(sources, rss_md_path)
    x_count = write_x_md(sources, x_path)
    skip_count = write_skipped_md(sources, skip_path)

    kind_counts = Counter(e.kind for e in sources.values())
    status_counts = Counter(e.feed_status or "none" for e in sources.values())
    generated_at = datetime.now(timezone.utc).isoformat()
    stats: dict[str, Any] = {
        "generatedAt": generated_at,
        "totalSources": len(sources),
        "opmlFeeds": opml_count,
        "xAccounts": x_count,
        "skipped": skip_count,
        "kindCounts": dict(kind_counts),
        "feedStatusCounts": dict(status_counts),
    }
    write_catalog(sources, catalog_path, stats)
    write_import_md(import_path, stats)

    log("Spot-checking OPML feeds…")
    checks = spot_check_opml(opml_path, limit=10)
    failed = [c for c in checks if not c[1]]
    stats["spotCheck"] = [
        {"title": t, "ok": ok, "url": u} for t, ok, u in checks
    ]
    write_catalog(sources, catalog_path, stats)
    write_import_md(import_path, stats)

    log("")
    log("=== Done ===")
    log(f"Output: {OUT_DIR}")
    log(json.dumps(stats, ensure_ascii=False, indent=2))
    if failed:
        log(f"WARNING: {len(failed)} spot-check failures")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
