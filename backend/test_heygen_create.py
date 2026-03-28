import httpx
import asyncio

API_KEY = "sk_V2_hgu_kJ8AiOWufAR_rzWJ3FcFf3rtcRJeEPTvgF3bH9nk5vFE"

# Actual valid (tiny) PNG so it doesn't fail validation
TINY_PNG = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
])

async def test():
    headers = {"X-Api-Key": API_KEY}
    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: Upload via upload.heygen.com
        res = await client.post(
            "https://upload.heygen.com/v1/asset",
            headers={**headers, "Content-Type": "image/png"},
            content=TINY_PNG,
        )
        data = res.json().get("data", {})
        asset_id = data.get("id")
        image_key = data.get("image_key")
        print(f"Uploaded: ID={asset_id}, ImageKey={image_key}")

        # Step 2: Try creating avatar group with ID
        res1 = await client.post(
            "https://api.heygen.com/v2/photo_avatar/avatar_group/create",
            headers={**headers, "Content-Type": "application/json"},
            json={"name": "Test Avatar ID", "image_key": asset_id},
        )
        print(f"Create via ID: {res1.status_code} | {res1.text}")

        # Step 3: Try creating avatar group with ImageKey
        res2 = await client.post(
            "https://api.heygen.com/v2/photo_avatar/avatar_group/create",
            headers={**headers, "Content-Type": "application/json"},
            json={"name": "Test Avatar ImageKey", "image_key": image_key},
        )
        print(f"Create via ImageKey: {res2.status_code} | {res2.text}")

asyncio.run(test())
