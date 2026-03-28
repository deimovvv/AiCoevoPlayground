import httpx
import asyncio

API_KEY = "sk_V2_hgu_kJ8AiOWufAR_rzWJ3FcFf3rtcRJeEPTvgF3bH9nk5vFE"

REAL_JPG = open(r"d:\WEB\ugc-creator\backend\data\avatars\taller-santa-clara_ab1f0243.jpeg", "rb").read()
DUMMY_MP3 = bytes.fromhex("FFFB9044000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000")

async def test():
    headers = {"X-Api-Key": API_KEY}
    async with httpx.AsyncClient() as client:
        # Step 1: Upload Image
        res = await client.post("https://upload.heygen.com/v1/asset", headers={**headers, "Content-Type": "image/jpeg"}, content=REAL_JPG)
        image_key = res.json()["data"]["image_key"]
        
        # Step 2: Upload Audio
        res = await client.post("https://upload.heygen.com/v1/asset", headers={**headers, "Content-Type": "audio/mpeg"}, content=DUMMY_MP3)
        audio_url = res.json()["data"]["url"]

        # Step 3: Create Avatar Group
        res = await client.post("https://api.heygen.com/v2/photo_avatar/avatar_group/create", headers={**headers, "Content-Type": "application/json"}, json={"name": "Test Avatar", "image_key": image_key})
        data = res.json()["data"]
        tp_id = data.get("talking_photo_id") or data.get("avatar_id") or data.get("id") or data.get("group_id")

        # Step 4: Create Video with type: avatar
        payload = {
            "title": "Test UGC Lip Sync",
            "video_inputs": [{
                "character": {"type": "avatar", "avatar_id": tp_id}, # Testing avatar instead of talking_photo
                "voice": {"type": "audio", "audio_url": audio_url}
            }],
            "dimension": {"width": 720, "height": 1280}
        }
        res = await client.post("https://api.heygen.com/v2/video/generate", headers={**headers, "Content-Type": "application/json"}, json=payload)
        print(f"Result {res.status_code}: {res.text}")

asyncio.run(test())
