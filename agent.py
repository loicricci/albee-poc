import os
from typing import List, Dict
import rag

from dotenv import load_dotenv
from openai import OpenAI

# Charger les variables d'environnement depuis .env
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY is not set. Check your .env file.")

client = OpenAI(api_key=api_key)


def load_persona(path: str = "data/persona_loic.md") -> str:
    if not os.path.exists(path):
        return "You are a helpful assistant."
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def generate_reply(history: List[Dict[str, str]], user_message: str) -> str:
    persona = load_persona()

    # 1) RAG : récupérer du contexte pertinent
    rag_results = rag.search(user_message, k=4)
    context_chunks = [txt for (txt, _score) in rag_results]
    context_text = "\n\n---\n\n".join(context_chunks) if context_chunks else ""

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": persona}
    ]

    if context_text:
        messages.append({
            "role": "system",
            "content": (
                "Here is additional context from Loïc's personal knowledge base. "
                "Use it if relevant, but do not invent facts.\n\n"
                f"{context_text}"
            ),
        })

    # 2) historique de conversation
    for msg in history:
        role = msg.get("role", "user")
        if role not in ("user", "assistant", "system"):
            role = "user"
        messages.append({"role": role, "content": msg["content"]})

    # 3) nouveau message
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=messages,
        temperature=0.4,
    )

    return response.choices[0].message.content.strip()
