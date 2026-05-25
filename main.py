"""
Sistema de Alerta de Riesgos Digitales — Backend
FastAPI + Pipeline NLP (NLTK) + Clasificador ML (Scikit-Learn)

Uso:
    uvicorn main:app --reload --port 8000
"""

import csv
import string
from pathlib import Path

import nltk
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

DATASET_PATH = Path(__file__).parent / "data" / "twitter_riesgos_dataset.csv"
VALID_LABELS = frozenset({"phishing", "oversharing", "toxicidad", "normal"})

# ─── Descarga de recursos NLTK ────────────────────────────────────────────────
for _resource in ("punkt", "punkt_tab", "stopwords"):
    try:
        nltk.download(_resource, quiet=True)
    except Exception:
        pass


def load_dataset(path: Path = DATASET_PATH) -> list[tuple[str, str]]:
    """Carga textos y etiquetas desde el CSV de entrenamiento."""
    if not path.exists():
        raise FileNotFoundError(
            f"No se encontró el dataset en {path}. "
            "Verifica que exista data/twitter_riesgos_dataset.csv"
        )

    rows: list[tuple[str, str]] = []
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "text" not in reader.fieldnames or "label" not in reader.fieldnames:
            raise ValueError("El CSV debe tener columnas 'text' y 'label'")

        for i, row in enumerate(reader, start=2):
            text = (row.get("text") or "").strip()
            label = (row.get("label") or "").strip().lower()
            if not text:
                continue
            if label not in VALID_LABELS:
                raise ValueError(
                    f"Fila {i}: etiqueta inválida '{label}'. "
                    f"Usa: {', '.join(sorted(VALID_LABELS))}"
                )
            rows.append((text, label))

    if not rows:
        raise ValueError(f"El dataset en {path} no tiene filas válidas")

    return rows


# ─── Pipeline NLP ─────────────────────────────────────────────────────────────
STOP_WORDS = set(stopwords.words("spanish"))


def clean_text(text: str) -> str:
    """
    Aplica el pipeline NLP completo:
    1. Normalización a minúsculas
    2. Tokenización
    3. Eliminación de puntuación
    4. Eliminación de stopwords en español
    """
    text = text.lower()
    tokens = word_tokenize(text, language="spanish")
    tokens = [
        t
        for t in tokens
        if t not in string.punctuation
        and t not in STOP_WORDS
        and t.isalpha()
    ]
    return " ".join(tokens)


# ─── Entrenamiento del modelo ─────────────────────────────────────────────────
DATASET = load_dataset()
_texts, _labels = zip(*DATASET)
_cleaned = [clean_text(t) for t in _texts]

vectorizer = TfidfVectorizer(max_features=1000, ngram_range=(1, 2))
X_train = vectorizer.fit_transform(_cleaned)

model = LogisticRegression(max_iter=1000, random_state=42, C=1.0)
model.fit(X_train, _labels)

print(
    f"[OK] Modelo entrenado con {len(_texts)} ejemplos desde {DATASET_PATH.name} "
    f"— categorías: {model.classes_.tolist()}"
)

# ─── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="API de Riesgos Digitales",
    description=(
        "Clasifica texto en categorías de riesgo: "
        "phishing, oversharing, toxicidad, normal."
    ),
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str


class AnalyzeResponse(BaseModel):
    category: str
    probability: float
    margin: float
    confidence_level: str
    cleaned_text: str


def _confidence_meta(proba_list, classes: list[str], category: str) -> tuple[float, float, str]:
    """
    probability: confianza en la clase predicha (predict_proba).
    margin: diferencia respecto a la segunda clase más probable.
    confidence_level: etiqueta legible para la UI de la feria.
    """
    idx = classes.index(category)
    prob = float(proba_list[idx])
    others = [float(p) for i, p in enumerate(proba_list) if i != idx]
    margin = prob - max(others) if others else prob

    if prob >= 0.65 and margin >= 0.12:
        level = "alta"
    elif prob >= 0.45 and margin >= 0.08:
        level = "media"
    elif prob >= 0.28:
        level = "baja"
    else:
        level = "incierta"

    return prob, margin, level


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "API de Riesgos Digitales activa",
        "dataset": str(DATASET_PATH.name),
        "samples": len(_texts),
        "categories": model.classes_.tolist(),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    """
    Recibe texto crudo, ejecuta el pipeline NLP, vectoriza con TF-IDF
    y clasifica con el modelo de Regresión Logística.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="El campo 'text' no puede estar vacío.")

    cleaned = clean_text(request.text)
    vector = vectorizer.transform([cleaned])

    category = model.predict(vector)[0]
    proba_list = model.predict_proba(vector)[0]
    classes = model.classes_.tolist()
    probability, margin, confidence_level = _confidence_meta(
        proba_list, classes, category
    )

    return AnalyzeResponse(
        category=category,
        probability=round(probability, 4),
        margin=round(margin, 4),
        confidence_level=confidence_level,
        cleaned_text=cleaned,
    )
