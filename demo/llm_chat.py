"""
Motor del grupo WhatsApp simulado de CyberChat.
Una sola API key de Groq; cuatro personajes con comportamientos distintos.
"""

from __future__ import annotations

import json
import logging
import os
import random
import re
import urllib.error
import urllib.request
from pathlib import Path

log = logging.getLogger("cyberchat")

_ENV_PATH = Path(__file__).parent / ".env"

PERSONAS: dict[str, dict] = {
    "ana": {
        "name": "Ana",
        "category": "normal",
        "emoji": "A",
        "color": "#10b981",
        "instruction": (
            "Eres Ana: amable, empatica y segura. Comentas ideas utiles, haces preguntas, "
            "propones planes sanos. Nunca insultas ni compartes datos sensibles."
        ),
    },
    "carlos": {
        "name": "Carlos",
        "category": "phishing",
        "emoji": "C",
        "color": "#f43f5e",
        "instruction": (
            "Eres Carlos en un simulador educativo. Actua como estafador convincente: "
            "urgencia, enlaces raros, premios falsos, pide contrasenas o datos bancarios. "
            "Ficticio, solo para demostracion."
        ),
    },
    "diana": {
        "name": "Diana",
        "category": "toxicidad",
        "emoji": "D",
        "color": "#a78bfa",
        "instruction": (
            "Eres Diana en un simulador educativo. Eres toxica: sarcasmo cruel, insultos, "
            "menosprecio hacia otros del grupo. Ficticio, solo para demostracion."
        ),
    },
    "eduardo": {
        "name": "Eduardo",
        "category": "oversharing",
        "emoji": "E",
        "color": "#fbbf24",
        "instruction": (
            "Eres Eduardo en un simulador educativo. Compartes de mas datos personales "
            "ficticios: telefono, direccion, CLABE, RFC, deudas, problemas intimos. "
            "Ficticio, solo para demostracion."
        ),
    },
}

STYLE_RULES = (
    "ESTILO OBLIGATORIO:\n"
    "- Mensajes cortos: 1-2 oraciones claras, como amigos adultos en WhatsApp.\n"
    "- Tono informal pero legible: español correcto en la mayoria de mensajes.\n"
    "- Modismos ocasionales y suaves: jaja, va, oye, la neta (no en cada mensaje).\n"
    "- Evita abreviaturas excesivas (ke, q, ps, tmb). Como mucho una cada varios mensajes.\n"
    "- COHERENCIA: responde directamente al ultimo mensaje del hilo; no cambies de tema sin relacion.\n"
    "- Si alguien pregunto algo, responde eso primero. Si alguien conto algo, reacciona a eso.\n"
    "- NUNCA uses 'Sobre...', 'Respecto a...', ni tono de bot o formal.\n"
)

SAMPLES = {
    "ana": [
        "Jaja si, a mi tambien me paso algo parecido.",
        "Va, me late. Cuenten mas.",
        "Suena bien, yo me apunto.",
        "Oye, buen punto el que dijiste.",
    ],
    "carlos": [
        "Urgente: entren aqui bit.ly/verify-premio antes de que cierre.",
        "Les llego el correo del sorteo? Metan su tarjeta para cobrar hoy.",
        "Su cuenta se bloquea en 1 hora, confirmen contraseña en este enlace.",
    ],
    "diana": [
        "Ay ya, otra vez con lo mismo?",
        "Nadie les pregunto, la verdad.",
        "Pues que esperaban, siempre igual aqui.",
    ],
    "eduardo": [
        "Les paso mi CLABE 032180000118359719 y mi cel 5512345678.",
        "Vivo en Reforma 142 depa 3B, por si me visitan.",
        "Mi contraseña del banco es Inversion2024# por si me ayudan.",
    ],
}


def _load_dotenv() -> None:
    if not _ENV_PATH.exists():
        return
    for line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ[key.strip()] = value.strip().strip('"').strip("'")


_load_dotenv()


def _format_history_line(item: dict) -> str:
    speaker = item.get("speaker_name") or item.get("speaker") or "Alguien"
    if speaker in ("user", "Tu"):
        speaker = "Tu"
    content = (item.get("content") or "").strip()
    return f"{speaker}: {content}"


def _build_group_context(history: list[dict]) -> str:
    lines = [_format_history_line(h) for h in history[-16:] if h.get("content")]
    return "\n".join(lines) if lines else "(el grupo acaba de empezar)"


def _pick_responders_autonomous(history: list[dict]) -> list[str]:
    all_ids = list(PERSONAS.keys())
    last_speaker = (history[-1].get("speaker") or "") if history else ""
    pool = [p for p in all_ids if p != last_speaker and p != "user"]
    if not pool:
        pool = all_ids.copy()

    count = 1 if random.random() < 0.65 else 2
    chosen: list[str] = []
    risk = [p for p in pool if p != "ana"]
    if risk and random.random() < 0.7:
        chosen.append(random.choice(risk))
        pool = [p for p in pool if p not in chosen]

    while len(chosen) < count and pool:
        pick = random.choice(pool)
        chosen.append(pick)
        pool.remove(pick)

    return chosen or [random.choice(all_ids)]


def _pick_responders(history_len: int) -> list[str]:
    all_ids = list(PERSONAS.keys())
    if history_len < 2:
        return ["ana", random.choice(["carlos", "diana", "eduardo"])]

    count = random.choice([2, 3, 3])
    chosen: list[str] = []

    # Siempre al menos un personaje de riesgo para la demo
    risk_pool = ["carlos", "diana", "eduardo"]
    chosen.append(random.choice(risk_pool))

    remaining = [p for p in all_ids if p not in chosen]
    random.shuffle(remaining)
    for pid in remaining:
        if len(chosen) >= count:
            break
        chosen.append(pid)

    if "ana" not in chosen and random.random() < 0.6:
        chosen[-1] = "ana"

    random.shuffle(chosen)
    return chosen


def _build_persona_prompt(
    persona_id: str,
    history: list[dict],
    *,
    user_message: str | None = None,
    prior_speaker: str | None = None,
    prior_text: str | None = None,
    autonomous: bool = False,
) -> str:
    persona = PERSONAS[persona_id]
    context = _build_group_context(history)

    if autonomous:
        task = (
            "El grupo sigue activo y tu quieres meter un comentario espontaneo. "
            "Reacciona al ultimo mensaje o cambia de tema casualmente."
        )
    elif prior_text and prior_speaker:
        task = (
            f"Acabas de leer a {prior_speaker}: \"{prior_text}\". "
            f"Reacciona en el grupo. El usuario dijo: \"{user_message}\"."
        )
    else:
        task = f"El usuario escribio: \"{user_message}\". Responde en el grupo."

    return (
        f"Eres {persona['name']} en el grupo de WhatsApp \"Grupo CyberSeguridad\". "
        f"{persona['instruction']}\n\n"
        f"{STYLE_RULES}\n"
        "- Escribe SOLO tu mensaje, sin nombre al inicio.\n"
        "- No digas que eres IA.\n\n"
        f"Historial reciente:\n{context}\n\n"
        f"{task}"
    )


def _template_reply(persona_id: str) -> str:
    return random.choice(SAMPLES[persona_id])


def _http_post_json(url: str, payload: dict, headers: dict, timeout: int = 30) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _call_groq(system: str, user_content: str) -> str | None:
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.88,
        "max_tokens": 120,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "CyberChat/3.0",
    }
    data = _http_post_json(
        "https://api.groq.com/openai/v1/chat/completions",
        payload,
        headers,
    )
    text = data["choices"][0]["message"]["content"].strip()
    # Limpiar si el modelo pone "Ana:" al inicio
    text = re.sub(r"^[A-Za-zÁ-ú]+:\s*", "", text)
    return text


def _call_gemini(system: str, user_content: str) -> str | None:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": f"{system}\n\n{user_content}"}],
        }],
        "generationConfig": {"temperature": 0.95, "maxOutputTokens": 100},
    }
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        f"?key={api_key}"
    )
    headers = {"Content-Type": "application/json", "User-Agent": "CyberChat/3.0"}
    data = _http_post_json(url, payload, headers)
    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    return re.sub(r"^[A-Za-zÁ-ú]+:\s*", "", text)


_groq_ok_cache: bool | None = None


def _test_groq() -> bool:
    global _groq_ok_cache
    if _groq_ok_cache is not None:
        return _groq_ok_cache
    try:
        result = _call_groq(
            "Responde solo: ok",
            "Di exactamente la palabra ok",
        )
        _groq_ok_cache = bool(result)
    except Exception as exc:
        log.warning("Groq test failed: %s", exc)
        _groq_ok_cache = False
    return _groq_ok_cache


def _generate_persona_text(
    persona_id: str,
    history: list[dict],
    *,
    user_message: str | None = None,
    prior_speaker: str | None = None,
    prior_text: str | None = None,
    autonomous: bool = False,
) -> tuple[str, str]:
    system = _build_persona_prompt(
        persona_id,
        history,
        user_message=user_message,
        prior_speaker=prior_speaker,
        prior_text=prior_text,
        autonomous=autonomous,
    )
    user_content = "Escribe tu mensaje para el grupo ahora."

    global _groq_ok_cache
    for name, caller in (("groq", _call_groq), ("gemini", _call_gemini)):
        try:
            text = caller(system, user_content)
            if text and len(text) > 5:
                if name == "groq":
                    _groq_ok_cache = True
                return text, name
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:200]
            log.warning("%s HTTP %s: %s", name, exc.code, body)
        except Exception as exc:
            log.warning("%s error: %s", name, exc)

    return _template_reply(persona_id), "templates"


def get_personas() -> list[dict]:
    return [
        {
            "id": pid,
            "name": p["name"],
            "category": p["category"],
            "emoji": p["emoji"],
            "color": p["color"],
        }
        for pid, p in PERSONAS.items()
    ]


def get_provider_status() -> dict:
    _load_dotenv()
    groq_key = bool(os.environ.get("GROQ_API_KEY", "").strip())
    gemini_key = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant") if groq_key else (
        os.environ.get("GEMINI_MODEL", "gemini-2.0-flash") if gemini_key else None
    )

    groq_working = _test_groq() if groq_key else False

    if groq_working:
        active = "groq"
        hint = f"Groq activo ({model})"
    elif gemini_key:
        active = "gemini"
        hint = f"Gemini configurado ({model})"
    elif groq_key:
        active = "templates"
        hint = "API key detectada pero Groq no responde. Reinicia iniciar_demo.ps1"
    else:
        active = "templates"
        hint = "Sin API key. Copia .env.example a .env y agrega GROQ_API_KEY"

    return {
        "active": active,
        "groq": groq_key,
        "groq_working": groq_working,
        "gemini": gemini_key,
        "model": model,
        "personas": len(PERSONAS),
        "hint": hint,
    }


def _build_messages(
    responders: list[str],
    history: list[dict],
    *,
    user_message: str | None = None,
    autonomous: bool = False,
) -> list[dict]:
    messages: list[dict] = []
    running = history.copy()
    prior_speaker: str | None = None
    prior_text: str | None = None

    for persona_id in responders:
        text, provider = _generate_persona_text(
            persona_id,
            running,
            user_message=user_message,
            prior_speaker=prior_speaker,
            prior_text=prior_text,
            autonomous=autonomous,
        )
        persona = PERSONAS[persona_id]
        entry = {
            "speaker_id": persona_id,
            "speaker_name": persona["name"],
            "category": persona["category"],
            "text": text,
            "provider": provider,
        }
        messages.append(entry)
        running.append({
            "role": "assistant",
            "speaker": persona_id,
            "speaker_name": persona["name"],
            "content": text,
        })
        prior_speaker = persona["name"]
        prior_text = text

    return messages


def generate_group_replies(
    user_message: str,
    history: list[dict] | None = None,
) -> dict:
    _load_dotenv()

    if not user_message or not user_message.strip():
        raise ValueError("El mensaje no puede estar vacio")

    history = list(history or [])
    responders = _pick_responders(len(history))
    return {
        "messages": _build_messages(
            responders,
            history,
            user_message=user_message.strip(),
            autonomous=False,
        )
    }


def generate_autonomous_replies(history: list[dict] | None = None) -> dict:
    _load_dotenv()
    history = list(history or [])
    if len(history) < 1:
        return {"messages": []}

    responders = _pick_responders_autonomous(history)
    return {
        "messages": _build_messages(
            responders,
            history,
            autonomous=True,
        )
    }
