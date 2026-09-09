import os
import uuid
import asyncio
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from huggingface_hub import InferenceClient


app = FastAPI(title="MotionFrame AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_TOKEN = os.getenv("HF_TOKEN")

OUTPUT_DIR = Path("/tmp/motionframe")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

tasks = {}


def get_client():
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is not configured.")

    return InferenceClient(
        provider="fal-ai",
        api_key=HF_TOKEN,
    )


@app.get("/")
def home():
    return {
        "ok": True,
        "service": "MotionFrame AI",
        "provider": "huggingface-fal",
        "model": "MiniMaxAI/MiniMax-H3",
        "generation_ready": bool(HF_TOKEN),
    }


@app.get("/status")
def status():
    return {
        "service": "MotionFrame AI",
        "provider": "huggingface-fal",
        "model": "MiniMaxAI/MiniMax-H3",
        "generation_ready": bool(HF_TOKEN),
    }


async def create_video(
    task_id: str,
    image_bytes: bytes,
    prompt: str,
):
    try:
        tasks[task_id] = {
            "status": "RUNNING",
            "output": [],
        }

        client = get_client()

        video = await asyncio.to_thread(
            client.image_to_video,
            image_bytes,
            prompt=prompt,
            model="MiniMaxAI/MiniMax-H3",
        )

        output_path = OUTPUT_DIR / f"{task_id}.mp4"

        if isinstance(video, bytes):
            output_path.write_bytes(video)
        elif hasattr(video, "read"):
            output_path.write_bytes(video.read())
        else:
            raise RuntimeError(
                "AI provider returned an unsupported video format."
            )

        tasks[task_id] = {
            "status": "SUCCEEDED",
            "output": [
                f"https://motionframe-ai.onrender.com/videos/{task_id}"
            ],
        }

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
    if not HF_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="HF_TOKEN is not configured."
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

    task_id = str(uuid.uuid4())

    tasks[task_id] = {
        "status": "PENDING",
        "output": [],
    }

    asyncio.create_task(
        create_video(
            task_id,
            image_bytes,
            prompt.strip(),
        )
    )

    return {
        "provider": "huggingface-fal",
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
