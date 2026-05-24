"""
Sistema de Alerta de Riesgos Digitales — Backend
FastAPI + Pipeline NLP (NLTK) + Clasificador ML (Scikit-Learn)

Uso:
    uvicorn main:app --reload --port 8000
"""

import string
import nltk
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

# ─── Descarga de recursos NLTK ────────────────────────────────────────────────
for _resource in ("punkt", "punkt_tab", "stopwords"):
    try:
        nltk.download(_resource, quiet=True)
    except Exception:
        # Algunos resource IDs (p. ej. punkt_tab) solo existen en NLTK >= 3.9.
        # Si la versión instalada no lo conoce, lo ignoramos y seguimos.
        pass

# ─── Dataset semilla ──────────────────────────────────────────────────────────
DATASET = [
    # ── phishing ────────────────────────────────────────────────────────────
    ("Haz clic aquí para verificar tu cuenta bancaria urgentemente",                "phishing"),
    ("Tu contraseña ha expirado ingresa tus datos en este enlace",                  "phishing"),
    ("Has ganado un premio reclámalo ahora con tus datos personales",               "phishing"),
    ("Verificación requerida accede a tu cuenta antes de que sea suspendida",       "phishing"),
    ("Ingresa tu número de tarjeta para confirmar la transacción sospechosa",       "phishing"),
    ("Tu cuenta será bloqueada si no actualizas tus datos en 24 horas",             "phishing"),
    ("Accede al siguiente enlace para recuperar tu cuenta de forma segura",         "phishing"),
    ("El banco solicita verificar tu identidad urgentemente en este portal",        "phishing"),
    ("Gana dinero fácil solo necesitas tu número de cuenta bancaria",               "phishing"),
    ("Confirma tus datos o perderás acceso a tus servicios financieros",            "phishing"),
    ("Alerta de seguridad inicia sesión para proteger tu cuenta ahora",             "phishing"),
    ("Promoción exclusiva solo para ti haz clic y proporciona tus datos",           "phishing"),
    ("Reclama tu reembolso bancario ingresando tus credenciales aquí",              "phishing"),
    ("Tu tarjeta fue comprometida verifica tus datos de inmediato",                 "phishing"),
    ("Acceso limitado actualiza tu información personal para continuar",            "phishing"),
    # ── desinformacion ──────────────────────────────────────────────────────
    ("El gobierno está ocultando la verdad sobre la vacuna comparte esto",          "desinformacion"),
    ("Científicos descubrieron que el agua causa cáncer pero lo silencian",         "desinformacion"),
    ("La tierra es plana y la NASA nos miente desde hace décadas",                  "desinformacion"),
    ("Los chips en las vacunas permiten rastrear a la población entera",            "desinformacion"),
    ("El 5G provoca enfermedades y el gobierno lo sabe pero no lo dice",            "desinformacion"),
    ("Esta planta cura el cáncer pero la industria farmacéutica lo oculta",         "desinformacion"),
    ("El COVID fue creado en laboratorio para controlar a la humanidad",            "desinformacion"),
    ("Beber agua con limón en ayunas elimina todos los virus del cuerpo",           "desinformacion"),
    ("Los medios mienten sobre las elecciones aquí está la verdad real",            "desinformacion"),
    ("Investigación censurada demuestra que las mascarillas son dañinas",           "desinformacion"),
    ("El calentamiento global es un invento para cobrar más impuestos",             "desinformacion"),
    ("Las quimtrails envenenan el agua y el gobierno lo permite",                   "desinformacion"),
    ("Esta bebida casera cura la diabetes en tres días sin efectos secundarios",    "desinformacion"),
    ("La pandemia fue planeada para implantar el nuevo orden mundial",              "desinformacion"),
    ("Los extraterrestres ya están entre nosotros según fuentes secretas filtradas","desinformacion"),
    # ── oversharing ─────────────────────────────────────────────────────────
    ("Hoy fui al hospital me diagnosticaron diabetes tipo 2 estoy asustado",        "oversharing"),
    ("Mi dirección es Calle 45 número 123 vengan a visitarme cuando quieran",       "oversharing"),
    ("Comparto mi número de teléfono personal para quien quiera contactarme",       "oversharing"),
    ("Estoy de vacaciones hasta el lunes la casa queda sola todo el fin de semana", "oversharing"),
    ("Mi número de pasaporte es XY123456 lo necesitaban para el trámite",           "oversharing"),
    ("Acabo de abrir cuenta en ese banco aquí está mi número de cliente",           "oversharing"),
    ("Mi hijo tiene 8 años y va al colegio San Andrés en el barrio norte",          "oversharing"),
    ("Publico mi RUT y cédula porque me lo pidieron en el chat del grupo",          "oversharing"),
    ("Estoy solo en casa hasta el viernes mi familia viajó a otra ciudad",          "oversharing"),
    ("Mi contraseña del banco la cambié a algo fácil porque la olvidaba",           "oversharing"),
    ("Aquí les dejo mi ubicación exacta para que me encuentren fácilmente",         "oversharing"),
    ("Pelee con mi pareja y me echó de la casa estoy en la calle ahora",            "oversharing"),
    ("Tengo VIH y lo comparto para crear conciencia entre mis seguidores",          "oversharing"),
    ("Salgo de trabajar a las 10pm y camino solo por la avenida principal",         "oversharing"),
    ("Mi cuenta de banco tiene saldo suficiente para prestarles lo que necesiten",  "oversharing"),
    # ── seguro ──────────────────────────────────────────────────────────────
    ("Hermoso día para salir a caminar por el parque con la familia",               "seguro"),
    ("Recomiendo este libro de historia está muy bien escrito y documentado",       "seguro"),
    ("El partido de fútbol estuvo increíble gran actuación del equipo local",       "seguro"),
    ("Nueva exposición de arte en el museo abierta hasta fin de mes",               "seguro"),
    ("Excelente receta de pasta que encontré sencilla y deliciosa para todos",      "seguro"),
    ("El clima en la ciudad es perfecto para esta época del año",                   "seguro"),
    ("Acabo de terminar mi tesis universitaria después de meses de trabajo",        "seguro"),
    ("Gran concierto anoche la banda estuvo increíble en el escenario",             "seguro"),
    ("Empezando a aprender programación cualquier consejo es bienvenido",           "seguro"),
    ("El café de ese lugar es excelente totalmente recomendado para visitar",       "seguro"),
    ("Orgulloso de mi equipo por el trabajo realizado durante todo el proyecto",    "seguro"),
    ("Las flores del jardín ya empezaron a brotar señal de que llega la primavera", "seguro"),
    ("Hoy completé mi primer maratón fue una experiencia increíble y emocionante",  "seguro"),
    ("El documental sobre naturaleza que vi anoche fue muy educativo e interesante","seguro"),
    ("Celebrando con amigos el fin de año escolar muy contento por todos",          "seguro"),
]

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
    # 1. Minúsculas
    text = text.lower()
    # 2. Tokenización
    tokens = word_tokenize(text, language="spanish")
    # 3. Filtrado: sin puntuación, sin stopwords, solo palabras
    tokens = [
        t for t in tokens
        if t not in string.punctuation
        and t not in STOP_WORDS
        and t.isalpha()
    ]
    return " ".join(tokens)

# ─── Entrenamiento del modelo ─────────────────────────────────────────────────
_texts, _labels = zip(*DATASET)
_cleaned = [clean_text(t) for t in _texts]

vectorizer = TfidfVectorizer(max_features=500, ngram_range=(1, 2))
X_train = vectorizer.fit_transform(_cleaned)

model = LogisticRegression(max_iter=1000, random_state=42, C=1.0)
model.fit(X_train, _labels)

print(f"[OK] Modelo entrenado con {len(_texts)} ejemplos — categorías: {model.classes_.tolist()}")

# ─── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="API de Riesgos Digitales",
    description="Clasifica texto en categorías de riesgo: phishing, desinformacion, oversharing, seguro.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Modelos de datos ──────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    text: str

class AnalyzeResponse(BaseModel):
    category: str
    probability: float
    cleaned_text: str

# ─── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "API de Riesgos Digitales activa",
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

    # Pipeline NLP
    cleaned = clean_text(request.text)

    # Vectorización TF-IDF
    vector = vectorizer.transform([cleaned])

    # Predicción
    category   = model.predict(vector)[0]
    proba_list = model.predict_proba(vector)[0]
    classes    = model.classes_.tolist()
    probability = float(proba_list[classes.index(category)])

    return AnalyzeResponse(
        category=category,
        probability=round(probability, 4),
        cleaned_text=cleaned,
    )
