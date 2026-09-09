import os
import uuid
import asyncio
import base64
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

WAVESPEED_API_URL = (
    "https://api.wavespeed.ai/api/v3/"
    "wavespeed-ai/minimax-h3/image-to-video"
)

WAVESPEED_RESULT_URL = (
    "https://api.wavespeed.ai/api/v3/predictions"
)

OUTPUT_DIR = Path("/tmp/motionframe")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

tasks = {}


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


async def create_video(
    task_id: str,
    image_bytes: bytes,
    image_content_type: str,
    prompt: str,
    duration: int,
):
    try:
        tasks[task_id] = {
            "status": "RUNNING",
            "output": [],
        }

        encoded_image = base64.b64encode(
            image_bytes
        ).decode("utf-8")

        image_data_url = (
            f"data:{image_content_type};base64,{encoded_image}"
        )

        payload = {
            "prompt": prompt,
            "image": image_data_url,
            "duration": duration,
            "resolution": "480p",
        }

        headers = {
            "Authorization": f"Bearer {WAVESPEED_API_KEY}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(
            timeout=120
        ) as client:

            response = await client.post(
                WAVESPEED_API_URL,
                headers=headers,
                json=payload,
            )

            if response.status_code >= 400:
                raise RuntimeError(
                    f"WaveSpeed error "
                    f"{response.status_code}: "
                    f"{response.text}"
                )

            submit_data = response.json()

            data = submit_data.get(
                "data",
                submit_data,
            )

            prediction_id = data.get("id")

            if not prediction_id:
                raise RuntimeError(
                    "WaveSpeed did not return prediction id: "
                    + str(submit_data)
                )

            result_url = (
                f"{WAVESPEED_RESULT_URL}/"
                f"{prediction_id}/result"
            )

            for _ in range(180):

                await asyncio.sleep(2)

                result_response = await client.get(
                    result_url,
                    headers=headers,
                )

                if result_response.status_code >= 400:
                    raise RuntimeError(
                        f"WaveSpeed result error "
                        f"{result_response.status_code}: "
                        f"{result_response.text}"
                    )

                result_json = result_response.json()

                result_data = result_json.get(
                    "data",
                    result_json,
                )

                status = (
                    result_data.get("status", "")
                    .lower()
                )

                if status == "completed":

                    outputs = result_data.get(
                        "outputs",
                        []
                    )

                    if not outputs:
                        raise RuntimeError(
                            "WaveSpeed completed but returned no video."
                        )

                    video_url = outputs[0]

                    video_response = await client.get(
                        video_url,
                        timeout=120,
                    )

                    if video_response.status_code >= 400:
                        raise RuntimeError(
                            "Could not download generated video."
                        )

                    output_path = (
                        OUTPUT_DIR /
                        f"{task_id}.mp4"
                    )

                    output_path.write_bytes(
                        video_response.content
                    )

                    tasks[task_id] = {
                        "status": "SUCCEEDED",
                        "output": [
                            f"https://motionframe-ai.onrender.com/"
                            f"videos/{task_id}"
                        ],
                    }

                    return

                if status in [
                    "failed",
                    "cancelled",
                    "timeout",
                    "deleted",
                ]:
                    raise RuntimeError(
                        "WaveSpeed generation failed: "
                        + str(result_data)
                    )

            raise RuntimeError(
                "WaveSpeed generation timed out."
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
            status_code=503,
            detail="WAVESPEED_API_KEY is not configured."
        )

    if not prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="Prompt is required."
        )

    content_type = image.content_type or ""

    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="File must be an image."
        )

    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Image is empty."
        )

    if duration < 3:
        duration = 3

    if duration > 15:
        duration = 15

    task_id = str(uuid.uuid4())

    tasks[task_id] = {
        "status": "PENDING",
        "output": [],
    }

    asyncio.create_task(
        create_video(
            task_id,
            image_bytes,
            content_type,
            prompt.strip(),
            duration,
        )
    )

    return {
        "provider": "wavespeed",
        "task_id": task_id,
    }


@app.get("/tasks/{task_id}")
def get_task(task_id: str):
    task = tasks.get(task_id)

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found."
        )

    return task


@app.get("/videos/{task_id}")
def get_video(task_id: str):
    video_path = OUTPUT_DIR / f"{task_id}.mp4"

    if not video_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Video not found."
        )

    return FileResponse(
        path=video_path,
        media_type="video/mp4",
        filename=f"motionframe-{task_id}.mp4",
    )
