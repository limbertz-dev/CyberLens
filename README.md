# Sistema de Alerta de Riesgos Digitales — MVP

Prototipo local que analiza publicaciones en X (Twitter) mediante una extensión de navegador,
una API FastAPI y un modelo de Machine Learning con NLP.

---

## Estructura del proyecto

```
proyecto-ml-alertas/
├── main.py            ← Backend: FastAPI + NLP + modelo ML
├── requirements.txt   ← Dependencias Python
├── manifest.json      ← Configuración de la extensión (Manifest V3)
├── content.js         ← Script que interactúa con el DOM de X
├── experimentos.ipynb ← Notebook de exploración (opcional)
└── README.md
```

---

## Requisitos previos

- Python 3.10 o superior
- Google Chrome (o cualquier navegador basado en Chromium)
- pip actualizado: `pip install --upgrade pip`

---

## 1. Instalar y ejecutar el backend

### a) Crear entorno virtual (recomendado)

```bash
python -m venv venv

# Linux / macOS
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### b) Instalar dependencias

```bash
pip install -r requirements.txt
```

### c) Levantar el servidor

```bash
uvicorn main:app --reload --port 8000
```

Deberías ver en la consola:

```
[OK] Modelo entrenado con 60 ejemplos — categorías: ['desinformacion', 'oversharing', 'phishing', 'seguro']
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### d) Verificar que funciona

Abre en el navegador: [http://localhost:8000](http://localhost:8000)

Respuesta esperada:
```json
{
  "status": "ok",
  "message": "API de Riesgos Digitales activa",
  "categories": ["desinformacion", "oversharing", "phishing", "seguro"]
}
```

También puedes probar el endpoint directamente en la documentación interactiva:
[http://localhost:8000/docs](http://localhost:8000/docs)

---

## 2. Cargar la extensión en Chrome

1. Abre Chrome y ve a: `chrome://extensions`
2. Activa el **Modo desarrollador** (esquina superior derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona la carpeta del proyecto (`proyecto-ml-alertas/`)
5. La extensión aparecerá en la lista como **"Alerta de Riesgos Digitales"**

---

## 3. Probar el sistema completo

1. Asegúrate de que el servidor está corriendo en `localhost:8000`
2. Abre [https://x.com](https://x.com) en Chrome
3. Navega por el feed — las publicaciones serán analizadas automáticamente
4. Cada publicación mostrará una alerta visual debajo del texto:

| Categoría       | Indicador visual                         |
|-----------------|------------------------------------------|
| Phishing        | Borde rojo · etiqueta roja               |
| Desinformación  | Borde amarillo · etiqueta amarilla       |
| Oversharing     | Borde naranja · etiqueta naranja         |
| Seguro          | Borde verde · etiqueta verde             |

---

## 4. Prueba manual del endpoint

Puedes probar el endpoint `/analyze` directamente con curl:

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Haz clic aquí para verificar tu cuenta bancaria urgentemente"}'
```

Respuesta esperada:

```json
{
  "category": "phishing",
  "probability": 0.9123,
  "cleaned_text": "clic aquí verificar cuenta bancaria urgentemente"
}
```

---

## 5. Pipeline NLP — resumen técnico

El texto pasa por las siguientes transformaciones antes de llegar al modelo:

```
Texto crudo
  → Normalización a minúsculas
  → Tokenización (NLTK word_tokenize, español)
  → Eliminación de signos de puntuación
  → Eliminación de stopwords en español
  → Vectorización TF-IDF (max_features=500, ngram_range=(1,2))
  → Regresión Logística (Scikit-Learn)
  → { category, probability }
```

---

## 6. Comportamiento ante errores

- **Si la API no está corriendo:** la extensión detecta el error silenciosamente y no interrumpe la navegación. Los tweets aparecen sin alerta.
- **Si el texto es muy corto (< 15 caracteres):** se omite el análisis.
- **Si la misma publicación aparece varias veces en el DOM:** el sistema la analiza solo una vez gracias al atributo `data-risk-analyzed`.

---

## 7. Limitaciones del MVP

- El dataset semilla es pequeño (60 ejemplos). Las predicciones deben interpretarse como **alertas preventivas**, no como veredictos definitivos.
- El sistema depende de la estructura actual del DOM de X (`data-testid="tweetText"`). Cambios en la plataforma pueden requerir ajustar el selector en `content.js`.
- Solo procesa texto en español.
- No almacena ningún dato — cada análisis es al vuelo.

---

## 8. Ampliar el dataset (opcional)

Para mejorar la precisión del modelo, agrega más ejemplos al array `DATASET` en `main.py`:

```python
("Texto de ejemplo", "phishing"),       # o desinformacion / oversharing / seguro
```

Mantén un número similar de ejemplos por categoría para evitar desbalance.
Reinicia el servidor después de modificar el dataset:

```bash
uvicorn main:app --reload --port 8000
```
