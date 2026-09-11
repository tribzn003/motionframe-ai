import os
import uuid
import shutil
import time
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
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
BASE_URL = "https://motionframe-ai.onrender.com"
SPACE_URL = "https://wan-ai-wan2-1.hf.space"

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
        "model": "Wan 2
