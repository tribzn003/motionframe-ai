import os
import uuid
import asyncio
import shutil
import time
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from gradio_client import Client, handle_file


app = FastAPI(title="MotionFrame AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_TOKEN = os.getenv("HF_TOKEN")

UPLOAD_DIR = Path("/tmp/motionframe/uploads")
OUTPUT_DIR = Path("/tmp/motionframe/videos")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

tasks = {}


@app.get("/")
def home():
    return {
        "ok": True,
        "service": "MotionFrame AI",
        "provider": "Hugging Face",
        "model": "Wan 2.1",
        "generation_ready": bool(HF_TOKEN),
    }


@app.get("/status")
def status():
    return {
        "service": "MotionFrame AI",
        "provider": "huggingface",
        "model": "Wan 2.1 Image-to-Video",
        "generation_ready": bool(HF_TOKEN),
    }


def find_video_path(result):
    if not result:
        return None

    if isinstance(result, str):
        if result.endswith((".mp4", ".webm", ".mov")):
            return result
        return None

    if isinstance(result, dict):
        if result.get("path"):
            return result["path"]

        if result.get("video"):
            return find_video_path(result["video"])

    if isinstance(result, (list, tuple)):
        for item in result:
            video_path = find_video_path(item)

            if video_path:
                return video_path

    return None


def generate_video(task_id, image_path, prompt):
    try:
        tasks[task_id]["status"] = "processing"

        client = Client(
            "https://wan-ai-wan2-1.hf.space",
            hf_token=HF_TOKEN,
        )

        client.predict(
            prompt=prompt,
            image=handle_file(image_path),
            watermark_wan=False,
            seed=-1,
            api_name="/i2v_generation_async",
        )

        video_path = None

        for _ in range(240):
            result = client.predict(
                api_name="/status_refresh_1",
            )

            video_path = find_video_path(result)

            if video_path:
                break

            tasks[task_id]["status"] = "processing"
            time.sleep(5)

        if not video_path:
            raise RuntimeError(
                "Besplatni AI server nije završio video na vreme."
            )

        extension = Path(video_path).suffix or ".mp4"
        final_path = OUTPUT_DIR / f"{task_id}{extension}"

        shutil.copyfile(video_path, final_path)

        tasks[task_id] = {
            "status": "succeeded",
            "output": [
                f"https://motionframe-ai.onrender.com/videos/{task_id}"
            ],
            "failure": None,
        }

    except Exception as error:
        tasks[task_id] = {
            "status": "failed",
            "output": [],
            "failure": str(error),
        }


@app.post("/generate")
async def generate(
    image: UploadFile = File(...),
    prompt: str = Form(...),
    duration: int = Form(10),
):
    if not HF_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="HF_TOKEN nije podešen.",
        )

    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Potrebno je dodati fotografiju.",
        )

    if not prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="Opis pokreta je obavezan.",
        )

    if duration not in (10, 15, 30):
        raise HTTPException(
            status_code=400,
            detail="Dužina mora biti 10, 15 ili 30 sekundi.",
        )

    task_id = str(uuid.uuid4())
    extension = Path(image.filename or "image.jpg").suffix or ".jpg"
    image_path = UPLOAD_DIR / f"{task_id}{extension}"

    content = await image.read()
    image_path.write_bytes(content)

    tasks[task_id] = {
        "status": "queued",
        "output": [],
        "failure": None,
        "duration": duration,
    }

    asyncio.create_task(
        asyncio.to_thread(
            generate_video,
            task_id,
            str(image_path),
            prompt.strip(),
        )
    )

    return {
        "task_id": task_id,
        "status": "queued",
    }


@app.get("/tasks/{task_id}")
def get_task(task_id: str):
    task = tasks.get(task_id)

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Zadatak nije pronađen.",
