import httpx
import asyncio

API_KEY = "sk_V2_hgu_kJ8AiOWufAR_rzWJ3FcFf3rtcRJeEPTvgF3bH9nk5vFE"

# 1. Valid JPG Image
with open(r"d:\WEB\ugc-creator\backend\data\avatars\taller-santa-clara_ab1f0243.jpeg", "rb") as f:
    REAL_JPG = f.read()

# 2. Dummy Audio MP3 bytes
DUMMY_MP3 = bytes.fromhex(
    "FFFB90440000000000000000000000000000000000000000000000000000"
    "0000000000000000000000000000000000000000000000000000000000"
)

async def test():
    headers = {"X-Api-Key": API_KEY}
    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: Upload Image
        print("Uploading Image...")
        res = await client.post(
            "https://upload.heygen.com/v1/asset",
            headers={**headers, "Content-Type": "image/jpeg"},
            content=REAL_JPG,
        )
        data = res.json().get("data", {})
        image_key = data.get("image_key")
        print(f"Image Key: {image_key}")
        
        # Step 3: Upload Audio 
        print("Uploading Audio...")
        res_audio = await client.post(
            "https://upload.heygen.com/v1/asset",
            headers={**headers, "Content-Type": "audio/mpeg"},
            content=DUMMY_MP3,
        )
        audio_url = res_audio.json().get("data", {}).get("url")
        print(f"Audio URL: {audio_url}")

        print("Waiting 10 seconds for HeyGen async dimension parsing...")
        await asyncio.sleep(10)

        # Step 2: Create Photo Avatar
        print("Creating Photo Avatar...")
        res_avatar = await client.post(
            "https://api.heygen.com/v2/photo_avatar/avatar_group/create",
            headers={**headers, "Content-Type": "application/json"},
            json={"name": "Test Avatar", "image_key": image_key},
        )
        data = res_avatar.json().get("data", {})
        tp_id = data.get("talking_photo_id") or data.get("avatar_id") or data.get("id") or data.get("group_id")
        print(f"Talking Photo ID: {tp_id}")

        # Step 4: Create Video
        print("Generating Video...")
        payload = {
            "title": "Test UGC Lip Sync",
            "video_inputs": [
                {
                    "character": {
                        "type": "talking_photo",
                        "talking_photo_id": tp_id,
                    },
                    "voice": {
                        "type": "audio",
                        "audio_url": audio_url,
                    },
                }
            ],
            "dimension": {"width": 720, "height": 1280},
        }
        res_vid = await client.post(
            "https://api.heygen.com/v2/video/generate",
            headers={**headers, "Content-Type": "application/json"},
            json=payload,
        )
        print(f"Result {res_vid.status_code}: {res_vid.text}")

asyncio.run(test())
