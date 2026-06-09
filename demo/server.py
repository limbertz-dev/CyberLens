"""
CyberChat - grupo WhatsApp simulado (puerto 8080).
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from llm_chat import (
    generate_autonomous_replies,
    generate_group_replies,
    get_personas,
    get_provider_status,
)

DEMO_DIR = Path(__file__).parent

app = FastAPI(title="CyberChat Grupo", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class HistoryItem(BaseModel):
    role: str
    speaker: str | None = None
    speaker_name: str | None = None
    content: str


class GroupChatRequest(BaseModel):
    message: str
    history: list[HistoryItem] = []


class AutonomousRequest(BaseModel):
    history: list[HistoryItem] = []


class GroupMessage(BaseModel):
    speaker_id: str
    speaker_name: str
    category: str
    text: str
    provider: str


class GroupChatResponse(BaseModel):
    messages: list[GroupMessage]


@app.get("/")
def index():
    return FileResponse(DEMO_DIR / "index.html")


@app.get("/logo.svg")
def logo():
    return FileResponse(DEMO_DIR / "logo.svg", media_type="image/svg+xml")


@app.get("/demo.css")
def css():
    return FileResponse(DEMO_DIR / "demo.css", media_type="text/css")


@app.get("/demo.js")
def js():
    return FileResponse(DEMO_DIR / "demo.js", media_type="application/javascript")


@app.get("/api/status")
def status():
    return get_provider_status()


@app.get("/api/personas")
def personas():
    return get_personas()


@app.post("/api/group/chat", response_model=GroupChatResponse)
def group_chat(request: GroupChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacio.")

    history = [h.model_dump() for h in request.history]
    try:
        result = generate_group_replies(request.message.strip(), history)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GroupChatResponse(**result)


@app.post("/api/group/autonomous", response_model=GroupChatResponse)
def group_autonomous(request: AutonomousRequest):
    history = [h.model_dump() for h in request.history]
    try:
        result = generate_autonomous_replies(history)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GroupChatResponse(**result)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8080)
