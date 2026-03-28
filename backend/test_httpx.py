import httpx
import asyncio

API_KEY = "sk_V2_hgu_kJ8AiOWufAR_rzWJ3FcFf3rtcRJeEPTvgF3bH9nk5vFE"
UPLOAD_BASE = "https://upload.heygen.com"

# 1. Valid JPG Image
with open(r"d:\WEB\ugc-creator\backend\data\avatars\taller-santa-clara_ab1f0243.jpeg", "rb") as f:
    REAL_JPG = f.read()

async def test():
    # Only send API key, DO NOT override Content-Type!
    headers = {"X-Api-Key": API_KEY}
    
    async with httpx.AsyncClient(timeout=30) as client:
        # Let httpx assemble the multipart/form-data correctly
        print("Uploading via multipart/form-data to upload.heygen.com...")
        res = await client.post(
            f"{UPLOAD_BASE}/v1/asset",
            headers=headers,
            files={"file": ("avatar.jpeg", REAL_JPG, "image/jpeg")},
        )
        print(f"Status: {res.status_code}")
        print(f"Body: {res.text}")

        data = res.json().get("data", {})
        image_key = data.get("image_key") or data.get("id") or data.get("asset_id")
        print(f"Parsed ID: {image_key}")

        if not image_key:
            return

        print("Testing video creation to see if dimensions error goes away...")
        res_avatar = await client.post(
            "https://api.heygen.com/v2/photo_avatar/avatar_group/create",
            headers={**headers, "Content-Type": "application/json"},
            json={"name": "Test Avatar", "image_key": image_key},
        )
        tp_id = res_avatar.json().get("data", {}).get("talking_photo_id") or res_avatar.json().get("data", {}).get("group_id") or res_avatar.json().get("data", {}).get("id")

        print("Generating Video...")
        # valid dummy audio, HeyGen needs a real duration audio to generate video. Let's use a real audio from earlier!
        valid_audio_url_from_earlier = "https://resource2.heygen.ai/audio/e437da453f2c4b83acf94563d0017dddc/original.mp3"
        payload = {
            "title": "Test UGC Lip Sync",
            "video_inputs": [{
                "character": {"type": "talking_photo", "talking_photo_id": tp_id},
                "voice": {"type": "audio", "audio_url": valid_audio_url_from_earlier}
            }],
            "dimension": {"width": 720, "height": 1280}
        }
        res_vid = await client.post(
            "https://api.heygen.com/v2/video/generate",
            headers={**headers, "Content-Type": "application/json"},
            json=payload,
        )
        print(f"Result {res_vid.status_code}: {res_vid.text}")

asyncio.run(test())
