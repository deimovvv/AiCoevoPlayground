import httpx
import asyncio

API_KEY = "sk_V2_hgu_kJ8AiOWufAR_rzWJ3FcFf3rtcRJeEPTvgF3bH9nk5vFE"
HEYGEN_BASE = "https://api.heygen.com"

async def list_photos():
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.get(
            f"{HEYGEN_BASE}/v2/avatars",
            headers={"X-Api-Key": API_KEY},
        )
    data = res.json().get("data", {})
    tps = data.get("talking_photos", [])
    print(f"Returned talking photos: {len(tps)}")
    print("Sample:", tps[:2])

asyncio.run(list_photos())
