#!/usr/bin/env python3
"""Refresh data/playlist.json from the public Spotify embed of the studio playlist."""
import json
import os
import re
import sys
import urllib.request

PLAYLIST_ID = "7DJLINjuWNN45nSB3i6dol"
EMBED_URL = f"https://open.spotify.com/embed/playlist/{PLAYLIST_ID}"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "playlist.json")


def fetch(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "Accept-Language": "en",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "replace")


def find_key(node, key):
    if isinstance(node, dict):
        if key in node:
            return node
        for value in node.values():
            found = find_key(value, key)
            if found is not None:
                return found
    elif isinstance(node, list):
        for value in node:
            found = find_key(value, key)
            if found is not None:
                return found
    return None


def find_tracks(node):
    if isinstance(node, list):
        tracks = [i for i in node if isinstance(i, dict) and str(i.get("uri", "")).startswith("spotify:track:")]
        if tracks and len(tracks) >= len(node) // 2:
            return tracks
        for value in node:
            found = find_tracks(value)
            if found:
                return found
    elif isinstance(node, dict):
        for value in node.values():
            found = find_tracks(value)
            if found:
                return found
    return None


def clean(text):
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def main():
    page = fetch(EMBED_URL)
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', page, re.S)
    if not match:
        sys.exit("Could not find the embedded playlist data in the Spotify page.")
    data = json.loads(match.group(1))
    tracks = find_tracks(data)
    if not tracks:
        entity = find_key(data, "trackList")
        sys.exit(f"No tracks found. Entity keys: {sorted(entity) if entity else 'none'}")

    entity = find_key(data, "trackList") or {}
    result = {
        "id": PLAYLIST_ID,
        "name": clean(entity.get("name") or entity.get("title") or "Prisma Studios"),
        "url": f"https://open.spotify.com/playlist/{PLAYLIST_ID}",
        "count": len(tracks),
        "tracks": [
            {
                "id": track["uri"].split(":")[-1],
                "title": clean(track.get("title")),
                "artists": clean(track.get("subtitle")),
                "duration": int(track.get("duration") or 0) // 1000,
                "explicit": bool(track.get("isExplicit")),
            }
            for track in tracks
        ],
    }

    previous = None
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            previous = json.load(f)
    if previous and len(result["tracks"]) < len(previous["tracks"]) // 2:
        sys.exit(f"Refusing to overwrite: got {len(result['tracks'])} tracks, had {len(previous['tracks'])}.")

    text = json.dumps(result, ensure_ascii=False, indent=1) + "\n"
    if previous == result:
        print(f"No change ({result['count']} songs).")
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Wrote {result['count']} songs. First: {result['tracks'][0]['title']} - {result['tracks'][0]['artists']}")


if __name__ == "__main__":
    main()
