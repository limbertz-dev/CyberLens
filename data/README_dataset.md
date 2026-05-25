# Dataset `twitter_riesgos_dataset.csv`

Archivo único con todos los ejemplos para entrenar el clasificador NLP (estilo publicaciones de X/Twitter en español).

**508 ejemplos** balanceados: 127 por cada etiqueta.

## Columnas

| Columna | Descripción |
|---------|-------------|
| `id` | Identificador único del ejemplo |
| `text` | Texto del tweet o publicación |
| `label` | `phishing`, `oversharing`, `toxicidad` o `normal` |

## Clases

- **phishing** — Estafas, enlaces falsos, robo de credenciales.
- **oversharing** — Exposición excesiva de datos personales, ubicación, salud, finanzas.
- **toxicidad** — Insultos, amenazas, odio, acoso (ejemplos sintéticos para entrenamiento).
- **normal** — Contenido cotidiano sin riesgo evidente.

## Editar el dataset

1. Abre `twitter_riesgos_dataset.csv` en Excel, LibreOffice o un editor de texto.
2. Guarda siempre en **UTF-8** (con BOM en Excel si los acentos se ven mal).
3. Agrega filas con `text` y `label`; actualiza `id` si quieres mantenerlos únicos.
4. Intenta mantener un número similar de ejemplos por clase para evitar desbalance.

## Emojis y símbolos

El CSV es UTF-8. En `main.py`, el preprocesado elimina emojis y números (`isalpha()`); no causan errores de lectura.

## Uso en Python

```python
import csv

with open("data/twitter_riesgos_dataset.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

texts = [r["text"] for r in rows]
labels = [r["label"] for r in rows]
```

Con pandas (si está instalado):

```python
import pandas as pd

df = pd.read_csv("data/twitter_riesgos_dataset.csv")
X = df["text"]
y = df["label"]
```

## Nota sobre toxicidad

Los textos de `toxicidad` son **sintéticos y educativos**. En producción combina el modelo con moderación y revisión humana.
