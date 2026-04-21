"""
Apify TikTok Service
━━━━━━━━━━━━━━━━━━━
Uses Apify's clockworks/tiktok-scraper actor to:
  1. Download a single TikTok video by URL (reliable, bypasses bot detection)
  2. Scrape a profile and return top-performing videos by engagement rate

Requires: APIFY_API_KEY in .env
Actor: clockworks/tiktok-scraper  (free tier: $5 credit on signup)
"""

import os
import asyncio
import httpx
from typing import Optional

APIFY_API_KEY = os.getenv("APIFY_API_KEY")
APIFY_BASE = "https://api.apify.com/v2"
ACTOR_ID = "clockworks~tiktok-scraper"


def is_configured() -> bool:
    return bool(APIFY_API_KEY)


async def _run_actor(input_payload: dict, timeout_s: int = 120) -> list[dict]:
    """Run Apify actor synchronously and return dataset items."""
    url = f"{APIFY_BASE}/acts/{ACTOR_ID}/run-sync-get-dataset-items"
    params = {"token": APIFY_API_KEY, "timeout": timeout_s, "memory": 512}
    async with httpx.AsyncClient(timeout=timeout_s + 10) as client:
        resp = await client.post(url, json=input_payload, params=params)
        resp.raise_for_status()
        return resp.json()


async def get_video_info(video_url: str) -> dict:
    """
    Fetch metadata + download URL for a single TikTok video.
    Returns: { url, download_url, author, description, likes, comments, shares, plays, duration }
    """
    items = await _run_actor({
        "postURLs": [video_url],
        "resultsType": "posts",
        "maxPostsPerPage": 1,
    })
    if not items:
        raise Exception("No data returned from Apify for this URL")
    item = items[0]
    print(f"[apify-tiktok] Raw keys: {list(item.keys())}")
    for key in ("videoMeta", "video", "mediaUrls", "downloadUrl", "videoUrl", "playAddr"):
        if key in item:
            v = item[key]
            print(f"[apify-tiktok] {key} = {str(v)[:200]}")
    normalized = _normalize_item(item)
    normalized["_raw_keys"] = list(item.keys())
    normalized["_video_meta"] = item.get("videoMeta") or {}
    normalized["_media_urls"] = item.get("mediaUrls") or []
    normalized["_submitted_video_url"] = item.get("submittedVideoUrl") or ""
    return normalized


async def get_profile_top_videos(profile_url: str, limit: int = 10) -> list[dict]:
    """
    Scrape a TikTok profile and return top `limit` videos by engagement rate.
    profile_url: https://www.tiktok.com/@username
    Returns sorted list (best first).
    """
    items = await _run_actor({
        "profiles": [profile_url],
        "resultsType": "posts",
        "maxPostsPerPage": min(limit * 3, 50),  # fetch extra, rank, return top
    }, timeout_s=180)

    if not items:
        raise Exception("No videos found for this profile")

    normalized = [_normalize_item(i) for i in items]

    # Sort by engagement rate = (likes + comments + shares) / plays
    def engagement_rate(v: dict) -> float:
        plays = v.get("plays", 0) or 1
        interactions = (v.get("likes", 0) or 0) + (v.get("comments", 0) or 0) + (v.get("shares", 0) or 0)
        return interactions / plays

    return sorted(normalized, key=engagement_rate, reverse=True)[:limit]


def _extract_download_url(item: dict) -> str:
    """Try every known field path for the video download URL."""
    candidates = [
        # nested objects
        (item.get("videoMeta") or {}).get("downloadAddr"),
        (item.get("videoMeta") or {}).get("playAddr"),
        (item.get("video") or {}).get("downloadAddr"),
        (item.get("video") or {}).get("playAddr"),
        (item.get("video") or {}).get("bitrateInfo", [{}])[0].get("PlayAddr", {}).get("UrlList", [None])[0] if isinstance((item.get("video") or {}).get("bitrateInfo"), list) and (item.get("video") or {}).get("bitrateInfo") else None,
        # top-level
        item.get("downloadUrl"),
        item.get("videoUrl"),
        item.get("playAddr"),
        (item.get("mediaUrls") or [None])[0],
    ]
    return next((c for c in candidates if c), "")


def _normalize_item(item: dict) -> dict:
    """Normalize Apify TikTok item to a consistent schema."""
    video_meta = item.get("videoMeta") or item.get("video") or {}
    author_meta = item.get("authorMeta") or item.get("author") or {}
    return {
        "url": item.get("webVideoUrl") or item.get("url") or "",
        "download_url": _extract_download_url(item),
        "thumbnail_url": (video_meta.get("coverUrl") or video_meta.get("cover") or
                          item.get("thumbnailUrl") or item.get("coverUrl") or ""),
        "author": (author_meta.get("name") or author_meta.get("uniqueId") or
                   item.get("authorName") or ""),
        "description": item.get("text") or item.get("description") or "",
        "likes": item.get("diggCount") or item.get("likes") or 0,
        "comments": item.get("commentCount") or item.get("comments") or 0,
        "shares": item.get("shareCount") or item.get("shares") or 0,
        "plays": item.get("playCount") or item.get("plays") or 0,
        "duration": (video_meta.get("duration") or item.get("duration") or 0),
        "created_at": item.get("createTimeISO") or item.get("createdAt") or "",
    }
