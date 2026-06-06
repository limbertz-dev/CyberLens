"""
Sistema de Alerta de Riesgos Digitales — Backend
FastAPI + Pipeline NLP (NLTK) + Clasificador ML (Scikit-Learn)

Uso:
    uvicorn main:app --reload --port 8000
"""

import csv
import string
from collections import Counter
from pathlib import Path

import nltk
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline as SKPipeline

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


# ─── Términos más influyentes por categoría ───────────────────────────────────
def _compute_top_terms(n: int = 8) -> dict[str, list[dict]]:
    """
    Extrae los términos (1-gram / 2-gram) con mayor peso positivo que el modelo
    aprendió para cada categoría. Útil en la feria para mostrar *qué* palabras
    empujan una predicción (ej. 'gratis', 'haz clic' → phishing).
    """
    feature_names = vectorizer.get_feature_names_out()
    coef = model.coef_
    classes_model = model.classes_.tolist()

    # LogisticRegression binaria devuelve coef_ de forma (1, n_features);
    # con 4 clases es (n_classes, n_features).
    if coef.shape[0] == 1:
        rows = {classes_model[0]: -coef[0], classes_model[1]: coef[0]}
    else:
        rows = {cls: coef[i] for i, cls in enumerate(classes_model)}

    top: dict[str, list[dict]] = {}
    for cls, weights in rows.items():
        order = np.argsort(weights)[::-1][:n]
        top[cls] = [
            {"term": str(feature_names[j]), "weight": round(float(weights[j]), 3)}
            for j in order
            if weights[j] > 0
        ]
    return top


# ─── Evaluación del modelo (cross-validation) ─────────────────────────────────
def _compute_model_stats() -> dict:
    """
    Evalúa el modelo con validación cruzada estratificada (5-fold) sobre el
    mismo dataset de entrenamiento. Se ejecuta una sola vez al arrancar el
    servidor para que el endpoint sea instantáneo.
    """
    label_counts = Counter(_labels)
    classes_order = sorted(label_counts.keys())
    min_class = min(label_counts.values()) if label_counts else 0
    n_splits = min(5, min_class) if min_class >= 2 else 0

    base = {
        "dataset": DATASET_PATH.name,
        "samples": len(_texts),
        "features": int(X_train.shape[1]),
        "vectorizer": "TfidfVectorizer (max_features=1000, ngram_range=(1,2))",
        "vectorizer_params": {"max_features": 1000, "ngram_range": [1, 2]},
        "classifier": "LogisticRegression (C=1.0, max_iter=1000)",
        "classes_order": classes_order,
        "label_counts": {cls: int(label_counts.get(cls, 0)) for cls in classes_order},
        "top_terms": _compute_top_terms(),
    }

    if n_splits < 2:
        return {
            **base,
            "ok": False,
            "reason": "Dataset insuficiente para validación cruzada.",
        }

    eval_pipeline = SKPipeline([
        ("tfidf", TfidfVectorizer(max_features=1000, ngram_range=(1, 2))),
        ("clf", LogisticRegression(max_iter=1000, random_state=42, C=1.0)),
    ])
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

    y_true = list(_labels)
    y_pred = cross_val_predict(eval_pipeline, _cleaned, y_true, cv=skf, method="predict")
    y_proba = cross_val_predict(eval_pipeline, _cleaned, y_true, cv=skf, method="predict_proba")

    accuracy = float(accuracy_score(y_true, y_pred))
    cm = confusion_matrix(y_true, y_pred, labels=classes_order).tolist()
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=classes_order, zero_division=0
    )

    # Confianza promedio por categoría: para cada clase verdadera C,
    # promedio de la probabilidad que el modelo asignó a C.
    y_true_arr = np.array(y_true)
    avg_conf_per_class: dict[str, float] = {}
    for i, cls in enumerate(classes_order):
        mask = y_true_arr == cls
        avg_conf_per_class[cls] = float(np.mean(y_proba[mask, i])) if mask.any() else 0.0

    return {
        **base,
        "ok": True,
        "cv_splits": n_splits,
        "accuracy": accuracy,
        "macro_f1": float(np.mean(f1)),
        "confusion_matrix": cm,
        "per_class": [
            {
                "label": classes_order[i],
                "precision": float(precision[i]),
                "recall": float(recall[i]),
                "f1": float(f1[i]),
                "support": int(support[i]),
                "avg_confidence": avg_conf_per_class[classes_order[i]],
            }
            for i in range(len(classes_order))
        ],
    }


MODEL_STATS = _compute_model_stats()
if MODEL_STATS.get("ok"):
    print(
        f"[OK] Evaluación 5-fold — accuracy={MODEL_STATS['accuracy']:.3f} "
        f"macro_f1={MODEL_STATS['macro_f1']:.3f}"
    )
else:
    print(f"[WARN] Evaluación no realizada: {MODEL_STATS.get('reason')}")

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


@app.get("/model/stats")
@app.get("/model-stats")
def model_stats():
    """
    Estadísticas de calidad del modelo calculadas con validación cruzada
    estratificada (5-fold) sobre el dataset de entrenamiento.
    Útil para defender el proyecto: precisión, F1, matriz de confusión,
    confianza promedio por clase y términos más influyentes por categoría.

    Expuesto en dos rutas equivalentes: /model/stats y /model-stats.
    """
    return MODEL_STATS


@app.post("/pipeline/preview")
def pipeline_preview(request: AnalyzeRequest):
    """
    Devuelve cada etapa del pipeline NLP para un texto dado.
    Pensado para demos: muestra cómo el texto crudo se transforma paso a paso
    hasta convertirse en una predicción.
    """
    raw = request.text or ""
    if not raw.strip():
        raise HTTPException(status_code=400, detail="El campo 'text' no puede estar vacío.")

    lowered = raw.lower()
    raw_tokens = word_tokenize(lowered, language="spanish")
    no_punct = [t for t in raw_tokens if t not in string.punctuation and t.isalpha()]
    no_stop = [t for t in no_punct if t not in STOP_WORDS]
    cleaned = " ".join(no_stop)

    vector = vectorizer.transform([cleaned])
    feature_names = vectorizer.get_feature_names_out()
    row = vector.toarray()[0]
    nonzero_idx = np.argsort(row)[::-1]
    tfidf_top = [
        {"term": str(feature_names[i]), "weight": round(float(row[i]), 4)}
        for i in nonzero_idx if row[i] > 0
    ][:8]

    proba_list = model.predict_proba(vector)[0]
    category = model.predict(vector)[0]
    classes = model.classes_.tolist()
    probabilities = {cls: round(float(p), 4) for cls, p in zip(classes, proba_list)}

    return {
        "raw": raw,
        "lowered": lowered,
        "raw_tokens": raw_tokens,
        "no_punct": no_punct,
        "no_stopwords": no_stop,
        "cleaned": cleaned,
        "tfidf_top": tfidf_top,
        "prediction": {
            "category": category,
            "probabilities": probabilities,
        },
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
