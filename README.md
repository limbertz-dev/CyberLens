# Sistema de Alerta de Riesgos Digitales — MVP

Prototipo local que analiza texto en sitios web (redes sociales, chats, foros, etc.) mediante una extensión de navegador,
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
[OK] Modelo entrenado con 508 ejemplos desde twitter_riesgos_dataset.csv — categorías: ['normal', 'oversharing', 'phishing', 'toxicidad']
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### d) Verificar que funciona

Abre en el navegador: [http://localhost:8000](http://localhost:8000)

Respuesta esperada:
```json
{
  "status": "ok",
  "message": "API de Riesgos Digitales activa",
  "categories": ["normal", "oversharing", "phishing", "toxicidad"]
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
2. Abre cualquier sitio con texto visible (X, Facebook, Reddit, WhatsApp Web, etc.)
3. Navega por el contenido — los bloques de texto detectados se analizarán automáticamente
4. Cada publicación mostrará una alerta visual debajo del texto:

| Categoría       | Indicador visual                         |
|-----------------|------------------------------------------|
| Phishing        | Borde rojo · etiqueta roja               |
| Toxicidad       | Borde morado · etiqueta morada           |
| Oversharing     | Borde naranja · etiqueta naranja         |
| Normal          | Borde verde · etiqueta verde             |

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
  → Vectorización TF-IDF (max_features=1000, ngram_range=(1,2))
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

- El modelo se entrena con `data/twitter_riesgos_dataset.csv` (508 ejemplos). Las predicciones deben interpretarse como **alertas preventivas**, no como veredictos definitivos.
- La extensión usa selectores genéricos y de plataformas conocidas; en sitios muy personalizados puede analizar menos bloques de texto.
- Solo procesa texto en español.
- No almacena ningún dato — cada análisis es al vuelo.

---

## 8. Ampliar el dataset (opcional)

Para mejorar la precisión del modelo, agrega filas en `data/twitter_riesgos_dataset.csv` (columnas `text` y `label`: `phishing`, `oversharing`, `toxicidad` o `normal`).

Mantén un número similar de ejemplos por categoría para evitar desbalance.
Reinicia el servidor después de modificar el CSV (con `--reload` se recarga solo al guardar `main.py`; si solo cambias el CSV, reinicia uvicorn):

```bash
uvicorn main:app --reload --port 8000
```
