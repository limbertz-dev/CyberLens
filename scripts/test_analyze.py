import json
import urllib.request

msgs = [
    "Hola a todos, bienvenidos al grupo. Aquí estamos Ana, Carlos, Diana y Eduardo.",
    "SON UNOS PENDEJOS",
    "Eres un pendejo",
    "Los de este grupo son unos pendejos",
    "Hola grupo, ¿alguien tiene el link?",
]

for m in msgs:
    req = urllib.request.Request(
        "http://localhost:8000/analyze",
        data=json.dumps({"text": m}).encode(),
        headers={"Content-Type": "application/json"},
    )
    r = json.loads(urllib.request.urlopen(req).read())
    print(
        m[:55].ljust(56),
        "->",
        r["category"].ljust(12),
        f"{r['probability']:.0%}",
        r["confidence_level"],
        "|",
        r["cleaned_text"],
    )
