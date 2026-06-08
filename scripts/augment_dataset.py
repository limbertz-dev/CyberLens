"""Añade ejemplos de saludos de grupo e insultos cortos al dataset."""
import csv
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "data" / "twitter_riesgos_dataset.csv"
rows = list(csv.DictReader(path.open(encoding="utf-8")))
start_id = max(int(r["id"]) for r in rows) + 1

new_rows = [
    ("Hola a todos, bienvenidos al grupo. Aquí estamos Ana, Carlos, Diana y Eduardo.", "normal"),
    ("Buenos días grupo, espero que tengan un excelente lunes", "normal"),
    ("Bienvenidos al grupo de estudio, aquí compartimos apuntes y dudas", "normal"),
    ("Hola grupo, ¿alguien tiene el link de la videollamada de hoy?", "normal"),
    ("Buenas tardes a todos, gracias por aceptarme en el grupo", "normal"),
    ("Presento al grupo: soy Laura y trabajo en diseño UX", "normal"),
    ("Hola a todos, este es nuestro chat del proyecto final", "normal"),
    ("Bienvenidos nuevos integrantes, lean las reglas fijadas arriba", "normal"),
    ("Qué tal grupo, ¿cómo les fue en la presentación de ayer?", "normal"),
    ("Hola grupo de la uni, ¿recuerdan la fecha del examen parcial?", "normal"),
    ("Buenos días al grupo de la familia, les mando un abrazo", "normal"),
    ("Bienvenidos al grupo de running, salimos a correr el sábado 7am", "normal"),
    ("Hola a todos, aquí compartiremos avances del hackathon", "normal"),
    ("Grupo de vecinos: recordatorio de junta este jueves a las 6pm", "normal"),
    ("Hola grupo, ¿alguien puede cubrir mi turno el viernes?", "normal"),
    ("Bienvenidos al canal, por favor preséntense con nombre y ciudad", "normal"),
    ("Buenas noches grupo, mañana subo las fotos del evento", "normal"),
    ("Hola a todos, gracias por sumarse al grupo de voluntariado", "normal"),
    ("En este grupo coordinamos logística del viaje escolar", "normal"),
    ("Hola grupo, ¿confirmamos menú para la cena del viernes?", "normal"),
    ("Bienvenidos al grupo de lectura, el libro del mes es Cien años de soledad", "normal"),
    ("Hola a todos, aquí estamos el equipo completo del laboratorio", "normal"),
    ("Buenos días grupo, hoy toca repaso de la unidad 3", "normal"),
    ("Qué onda grupo, ¿alguien ya terminó la tarea de matemáticas?", "normal"),
    ("Hola grupo de WhatsApp del trabajo, aviso de reunión a las 10", "normal"),
    ("SON UNOS PENDEJOS", "toxicidad"),
    ("Eres un pendejo", "toxicidad"),
    ("Son unos pendejos todos ustedes", "toxicidad"),
    ("Qué pendejos son", "toxicidad"),
    ("Pendejos ignorantes", "toxicidad"),
    ("Eres pendejo y lo sabes", "toxicidad"),
    ("No sean pendejos", "toxicidad"),
    ("Pendejo ridículo", "toxicidad"),
    ("Son unos idiotas", "toxicidad"),
    ("Eres un idiota", "toxicidad"),
    ("Idiotas de mierda", "toxicidad"),
    ("Imbéciles todos", "toxicidad"),
    ("Eres un imbécil", "toxicidad"),
    ("Estúpidos de verdad", "toxicidad"),
    ("Qué estúpido eres", "toxicidad"),
    ("Inútil de mierda", "toxicidad"),
    ("Eres basura", "toxicidad"),
    ("Vete a la mierda", "toxicidad"),
    ("Hijo de puta", "toxicidad"),
    ("Puto ridículo", "toxicidad"),
    ("Cabrones insoportables", "toxicidad"),
    ("Eres un cabrón", "toxicidad"),
    ("Malditos pendejos", "toxicidad"),
    ("Pendejos sin cerebro", "toxicidad"),
    ("Son la peor basura de este chat", "toxicidad"),
]

with path.open("a", encoding="utf-8", newline="") as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL)
    for i, (text, label) in enumerate(new_rows):
        w.writerow([start_id + i, text, label])

print(f"Added {len(new_rows)} rows (ids {start_id}-{start_id + len(new_rows) - 1})")
