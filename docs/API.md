# CyberLens — Código de la API

Base: **http://localhost:8000**

## 1. Ver si la API está viva

```http
GET http://localhost:8000/
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000"
```

**Respuesta ejemplo:**
```json
{
  "status": "ok",
  "message": "API de Riesgos Digitales activa",
  "dataset": "twitter_riesgos_dataset.csv",
  "samples": 508,
  "categories": ["normal", "oversharing", "phishing", "toxicidad"]
}
```

---

## 2. Analizar un texto (el que usa la extensión)

```http
POST http://localhost:8000/analyze
Content-Type: application/json

{"text": "Haz clic aquí para verificar tu cuenta bancaria"}
```

**PowerShell:**
```powershell
$body = '{"text": "Haz clic aquí para verificar tu cuenta bancaria"}'
Invoke-RestMethod -Uri "http://localhost:8000/analyze" -Method Post -Body $body -ContentType "application/json; charset=utf-8"
```

**Python:**
```python
import requests

r = requests.post(
    "http://localhost:8000/analyze",
    json={"text": "Haz clic aquí para verificar tu cuenta bancaria"},
)
print(r.status_code)
print(r.json())
```

**JavaScript (fetch):**
```javascript
const res = await fetch("http://localhost:8000/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Haz clic aquí para verificar tu cuenta bancaria" }),
});
const data = await res.json();
console.log(data);
```

**Respuesta ejemplo:**
```json
{
  "category": "phishing",
  "probability": 0.4566,
  "margin": 0.1995,
  "confidence_level": "media",
  "cleaned_text": "haz clic aqui verificar cuenta bancaria"
}
```

---

## 3. Documentación en el navegador

- Swagger: http://localhost:8000/docs  
- ReDoc: http://localhost:8000/redoc  

---

## Si no te devuelve nada (timeout / error)

1. En terminal, dentro del proyecto:
   ```powershell
   cd "e:\2026 - SÉPTIMO SEMESTRE\MACHINE LEARNING\CyberLens"
   .\venv\Scripts\Activate.ps1
   uvicorn main:app --reload --port 8000
   ```
2. Espera ver: `Application startup complete`
3. Abre http://localhost:8000 en el navegador
4. Clic en el icono de la extensión CyberLens → popup de prueba

Si el puerto está ocupado, cierra la terminal anterior con `Ctrl+C`.
