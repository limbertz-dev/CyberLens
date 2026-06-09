"""
CyberChat - grupo WhatsApp simulado (puerto 8080).
Sala compartida para demo en feria: PC + moviles en la misma red WiFi.
"""

from __future__ import annotations

import socket
import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from llm_chat import (
    generate_autonomous_replies,
    generate_group_replies,
    get_personas,
    get_provider_status,
)

DEMO_DIR = Path(__file__).parent
ROOM_PORT = 8080
ROOM_MAX = 600

app = FastAPI(title="CyberChat Grupo", version="3.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_room_lock = threading.Lock()
_room_seq = 0
_room_messages: list[dict] = []


def _get_lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def _room_append(entry: dict) -> dict:
    global _room_seq
    with _room_lock:
        _room_seq += 1
        msg = {
            **entry,
            "id": _room_seq,
            "ts": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        }
        _room_messages.append(msg)
        if len(_room_messages) > ROOM_MAX:
            del _room_messages[: len(_room_messages) - ROOM_MAX]
        return msg


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


class RoomPostRequest(BaseModel):
    role: str
    content: str
    speaker_id: str | None = None
    speaker_name: str | None = None
    source: str = Field(default="host", pattern="^(host|mobile|autochat|host-bots)$")


class MobileSendRequest(BaseModel):
    message: str
    name: str = "Visitante"


def _static(name: str) -> FileResponse:
    return FileResponse(DEMO_DIR / name)


@app.get("/")
def index():
    return _static("index.html")


@app.get("/movil.html")
def movil_page():
    return _static("movil.html")


@app.get("/acceso.html")
def acceso_page():
    return _static("acceso.html")


@app.get("/logo.svg")
def logo():
    return FileResponse(DEMO_DIR / "logo.svg", media_type="image/svg+xml")


@app.get("/demo.css")
def css():
    return FileResponse(DEMO_DIR / "demo.css", media_type="text/css")


@app.get("/demo.js")
def js():
    return FileResponse(DEMO_DIR / "demo.js", media_type="application/javascript")


@app.get("/api/access")
def access_info():
    ip = _get_lan_ip()
    return {
        "lan_ip": ip,
        "port": ROOM_PORT,
        "url_chat": f"http://{ip}:{ROOM_PORT}/",
        "url_mobile": f"http://{ip}:{ROOM_PORT}/movil.html",
        "url_qr": f"http://{ip}:{ROOM_PORT}/acceso.html",
        "hint": "Los visitantes deben estar en la misma red WiFi que esta PC.",
    }


@app.get("/api/room")
def get_room(after: int = 0):
    with _room_lock:
        msgs = [m for m in _room_messages if m["id"] > after]
        return {"last_id": _room_seq, "messages": msgs}


@app.post("/api/room")
def post_room(request: RoomPostRequest):
    content = (request.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="El contenido no puede estar vacio.")
    return _room_append(request.model_dump())


@app.post("/api/mobile/send")
def mobile_send(request: MobileSendRequest):
    text = (request.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacio.")
    name = (request.name or "Visitante").strip()[:32] or "Visitante"
    return _room_append({
        "role": "user",
        "speaker_id": "mobile",
        "speaker_name": name,
        "content": text,
        "source": "mobile",
    })


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
    import logging

    import uvicorn

    class _QuietRoomPollFilter(logging.Filter):
        """Oculta el spam de polling GET /api/room en consola."""

        def filter(self, record: logging.LogRecord) -> bool:
            msg = record.getMessage()
            return "GET /api/room" not in msg

    logging.getLogger("uvicorn.access").addFilter(_QuietRoomPollFilter())

    lan = _get_lan_ip()
    print(f"[CyberChat] Red local: http://{lan}:{ROOM_PORT}/")
    print(f"[CyberChat] Movil:     http://{lan}:{ROOM_PORT}/movil.html")
    print(f"[CyberChat] QR:        http://{lan}:{ROOM_PORT}/acceso.html")
    uvicorn.run(app, host="0.0.0.0", port=ROOM_PORT)
