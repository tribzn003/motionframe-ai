import os
import uuid
import base64
import asyncio
from pathlib import Path

import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse


app = FastAPI(title="MotionFrame AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

WAVESPEED_API_KEY = os.getenv("WAVESPEED_API_KEY")

CREATE_URL = (
    "https://api.wavespeed.ai/api/v3/"
    "wavespeed-ai/minimax-h3/image-to-video"
)

RESULT_URL = (
    "https://api.wavespeed.ai/api/v3/"
    "predictions/{prediction_id}/result"
)

BASE_URL = "https://motionframe-ai.onrender.com"

OUTPUT_DIR = Path("/tmp/motionframe")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

tasks = {}


def headers():
    return {
        "Authorization": f"Bearer {WAVESPEED_API_KEY}",
        "Content-Type": "application/json",
    }


@app.get("/")
def home():
    return {
        "ok": True,
        "service": "MotionFrame AI",
        "provider": "wavespeed",
        "model": "MiniMax H3",
        "generation_ready": bool(WAVESPEED_API_KEY),
    }


@app.get("/status")
def status():
    return {
        "service": "MotionFrame AI",
        "provider": "wavespeed",
        "model": "MiniMax H3",
        "generation_ready": bool(WAVESPEED_API_KEY),
    }


async def run_generation(
    task_id,
    image_data,
    prompt,
    duration,
):
    try:
        tasks[task_id]["status"] = "PROCESSING"

        payload = {
            "prompt": prompt,
            "image": image_data,
            "duration": duration,
            "resolution": "480p",
        }

        async with httpx.AsyncClient(
            timeout=120
        ) as client:

            response = await client.post(
                CREATE_URL,
                headers=headers(),
                json=payload,
            )

            if response.status_code >= 400:
                raise RuntimeError(
                    response.text
                )

            result = response.json()
            data = result.get("data", result)
            prediction_id = data.get("id")

            if not prediction_id:
                raise RuntimeError(
                    "WaveSpeed nije vratio ID zadatka."
                )

            for attempt in range(180):
                await asyncio.sleep(5)

                poll = await client.get(
                    RESULT_URL.format(
                        prediction_id=prediction_id
                    ),
                    headers=headers(),
                )

                if poll.status_code >= 400:
                    raise RuntimeError(
                        poll.text
                    )

                poll_result = poll.json()
                poll_data = poll_result.get(
                    "data",
                    poll_result,
                )

                prediction_status = str(
                    poll_data.get("status", "")
                ).lower()

                if prediction_status == "completed":
                    outputs = (
                        poll_data.get("outputs")
                        or []
                    )

                    if not outputs:
                        raise RuntimeError(
                            "Video nije vracen."
                        )

                    video_response = await client.get(
                        outputs[0]
                    )

                    video_response.raise_for_status()

                    video_path = (
                        OUTPUT_DIR
                        / f"{task_id}.mp4"
                    )

                    video_path.write_bytes(
                        video_response.content
                    )

                    tasks[task_id] = {
                        "status": "SUCCEEDED",
                        "output": [
                            f"{BASE_URL}/videos/{task_id}"
                        ],
                        "failure": None,
                    }

                    return

                failed_statuses = {
                    "failed",
                    "cancelled",
                    "canceled",
                    "timeout",
                    "deleted",
                }

                if prediction_status in failed_statuses:
                    error = (
                        poll_data.get("error")
                        or "Generisanje nije uspelo."
                    )

                    raise RuntimeError(
                        str(error)
                    )

            raise RuntimeError(
                "Generisanje traje predugo."
            )

    except Exception as error:
        tasks[task_id] = {
            "status": "FAILED",
            "output": [],
            "failure": str(error),
        }


@app.post("/generate")
async def generate_video(
    image: UploadFile = File(...),
    prompt: str = Form(...),
    duration: int = Form(5),
):
    if not WAVESPEED_API_KEY:
        raise HTTPException(
            status_code=500,
            detail=(
                "WAVESPEED_API_KEY nije podesen."
            ),
        )

    if not image.content_type:
        raise HTTPException(
            status_code=400,
            detail="Fotografija nije pronadjena.",
        )

    if not image.content_type.startswith(
        "image/"
    ):
        raise HTTPException(
            status_code=400,
            detail="Fajl mora biti fotografija.",
        )

    if not prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="Opis pokreta je obavezan.",
        )

    image_bytes = await image.read()

    encoded = base64.b64encode(
        image_bytes
    ).decode("utf-8")

    image_data = (
        f"data:{image.content_type};"
        f"base64,{encoded}"
    )

    task_id = str(uuid.uuid4())

    tasks[task_id] = {
        "status": "QUEUED",
        "output": [],
        "failure": None,
    }

    asyncio.create_task(
        run_generation(
            task_id,
            image_data,
            prompt.strip(),
            duration,
        )
    )

    return {
        "task_id": task_id,
        "status": "QUEUED",
    }


@app.get("/tasks/{task_id}")
def get_task(task_id: str):
    task = tasks.get(task_id)

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Zadatak nije pronadjen.",
        )

    return task


@app.get("/videos/{task_id}")
def get_video(task_id: str):
    video_path = (
        OUTPUT_DIR
        / f"{task_id}.mp4"
    )

    if not video_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Video nije pronadjen.",
        )

    return FileResponse(
        video_path,
        media_type="video/mp4",
        filename="motionframe-video.mp4",
    )
