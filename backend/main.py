import os
import base64

import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="MotionFrame AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


AI_PROVIDER = os.getenv("AI_VIDEO_PROVIDER", "none").lower()

RUNWAY_API = "https://api.dev.runwayml.com/v1"
RUNWAY_VERSION = "2024-11-06"


def runway_headers():
    api_key = os.getenv("RUNWAYML_API_SECRET")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Runway API key is not configured."
        )

    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Runway-Version": RUNWAY_VERSION,
    }


@app.get("/")
def home():
    return {
        "ok": True,
        "service": "MotionFrame AI",
        "provider": AI_PROVIDER,
        "generation_ready": AI_PROVIDER != "none",
    }


@app.get("/status")
def status():
    return {
        "service": "MotionFrame AI",
        "provider": AI_PROVIDER,
        "generation_ready": AI_PROVIDER != "none",
    }


@app.post("/generate")
async def generate_video(
    image: UploadFile = File(...),
    prompt: str = Form(...),
    duration: int = Form(5),
):
    if not prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="Prompt is required."
        )

    content_type = image.content_type or "image/jpeg"

    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="File must be an image."
        )

    image_bytes = await image.read()

    if AI_PROVIDER == "none":
        raise HTTPException(
            status_code=503,
            detail="AI video provider is not configured yet."
        )

    if AI_PROVIDER == "runway":
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        data_uri = f"data:{content_type};base64,{encoded}"

        payload = {
            "model": "gen4_turbo",
            "promptImage": data_uri,
            "promptText": prompt.strip(),
            "duration": duration,
            "ratio": "1280:720",
        }

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{RUNWAY_API}/image_to_video",
                headers=runway_headers(),
                json=payload,
            )

        if response.status_code >= 400:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.text,
            )

        result = response.json()

        return {
            "provider": "runway",
            "task_id": result.get("id"),
        }

    raise HTTPException(
        status_code=503,
        detail=f"Provider '{AI_PROVIDER}' is not implemented yet."
    )


@app.get("/tasks/{task_id}")
async def get_task(task_id: str):
    if AI_PROVIDER != "runway":
        raise HTTPException(
            status_code=503,
            detail="Task polling is not available for the current provider."
        )

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{RUNWAY_API}/tasks/{task_id}",
            headers=runway_headers(),
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text,
        )

    return response.json()
