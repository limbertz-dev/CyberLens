# CyberChat — Grupo WhatsApp simulado

Grupo con 4 personajes para demostrar CyberLens. Funciona solo; la extension es opcional.

## Personajes

| Nombre | Comportamiento | CyberLens detecta |
|--------|----------------|-------------------|
| Ana | Amable, normal | Seguro |
| Carlos | Estafas, urgencias | Phishing |
| Diana | Insultos, agresividad | Toxicidad |
| Eduardo | Datos personales | Oversharing |

## 1. Configurar Groq (gratis, recomendado)

1. Entra a **https://console.groq.com/** y crea una cuenta (Google o email).
2. Ve a **API Keys** → **Create API Key**.
3. Copia la clave (empieza con `gsk_...`).
4. En la carpeta `demo/`, copia el archivo de ejemplo:
   ```powershell
   copy .env.example .env
   ```
5. Abre `.env` y pega tu clave:
   ```
   GROQ_API_KEY=gsk_tu_clave_real
   GROQ_MODEL=llama-3.1-8b-instant
   ```

**Modelo recomendado:** `llama-3.1-8b-instant` (rapido, ideal para demos).

**Alternativa:** `llama-3.3-70b-versatile` (mas inteligente, un poco mas lento).

## 2. Iniciar el grupo

```powershell
cd demo
.\iniciar_demo.ps1
```

Abre **http://localhost:8080**

## 3. Con CyberLens (opcional)

1. Inicia el backend ML: `..\iniciar_servidor.ps1`
2. Activa la extension CyberLens en Chrome
3. Escribe en el grupo — cada mensaje se clasifica automaticamente

## Switch Autochat (ahorrar tokens)

En el header hay un switch **Autochat**:
- **Apagado (default):** el grupo no escribe solo; solo responde cuando tu mandas mensaje.
- **Encendido:** los bots siguen charlando entre ellos cada 15-35 segundos.

Usalo para pausar y no gastar tokens sin cerrar el servidor.

## Limites y uso de Groq

Groq no muestra un contador de "tokens restantes" como saldo fijo. En su lugar usa **rate limits** (peticiones y tokens por minuto/dia):

- **Ver tus limites:** https://console.groq.com/settings/limits
- **Documentacion:** https://console.groq.com/docs/rate-limits
- **Uso / facturacion:** https://console.groq.com/settings/billing

En el plan gratis, si llegas al limite veras error 429 y el chat usara plantillas locales hasta que se reinicie la cuota (suele ser por minuto o por dia).

## Sin API key

Funciona con plantillas locales. El grupo responde, pero con mensajes menos naturales.
