import httpx
import asyncio

API_KEY = "sk_V2_hgu_kJ8AiOWufAR_rzWJ3FcFf3rtcRJeEPTvgF3bH9nk5vFE"

async def test():
    headers = {"X-Api-Key": API_KEY, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get("https://api.heygen.com/v1/asset", headers=headers)
        print(f"Status GET /v1/asset: {res.status_code}")
        print(res.text[:300])
        
        # also try List Assets endpoint
        res2 = await client.get("https://api.heygen.com/v1/asset/list", headers=headers)
        print(f"Status GET /v1/asset/list: {res2.status_code}")
        print(res2.text[:300])

asyncio.run(test())
