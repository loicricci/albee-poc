import os
import math
from typing import List, Tuple

from dotenv import load_dotenv
from openai import OpenAI

# Charger la clé API
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

DATA_DIR = "data"
PERSONA_FILE = "persona_loic.md"
EMBED_MODEL = "text-embedding-3-small"

# Mémoire en RAM des chunks et de leurs embeddings
_CHUNKS: List[str] = []
_EMBEDS: List[List[float]] = []


def _read_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _load_documents() -> List[str]:
    """Charge tous les fichiers texte/markdown de data/ et ses sous-dossiers sauf persona."""
    docs: List[str] = []
    
    # Load from root data/ directory
    for fname in os.listdir(DATA_DIR):
        if fname == PERSONA_FILE:
            continue
        full = os.path.join(DATA_DIR, fname)
        if os.path.isdir(full):
            # Recursively load from subdirectories (like contributions/)
            for sub_fname in os.listdir(full):
                sub_full = os.path.join(full, sub_fname)
                if os.path.isfile(sub_full) and sub_fname.lower().endswith((".md", ".txt")):
                    docs.append(_read_text_file(sub_full))
        elif fname.lower().endswith((".md", ".txt")):
            docs.append(_read_text_file(full))
    
    return docs


def _split_into_chunks(text: str, max_chars: int = 1200) -> List[str]:
    """Découpe un texte en chunks raisonnables (par paragraphes)."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: List[str] = []
    current = ""

    for p in paragraphs:
        if len(current) + len(p) + 2 <= max_chars:
            current = current + "\n\n" + p if current else p
        else:
            if current:
                chunks.append(current)
            current = p

    if current:
        chunks.append(current)

    return chunks


def _embed_texts(texts: List[str]) -> List[List[float]]:
    """Crée des embeddings pour une liste de textes."""
    if not texts:
        return []

    response = client.embeddings.create(
        model=EMBED_MODEL,
        input=texts,
    )
    return [d.embedding for d in response.data]


def _cosine_sim(v1: List[float], v2: List[float]) -> float:
    """Cosine similarity simple sans numpy."""
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


def _build_index():
    """Construit les chunks + embeddings en mémoire au premier import."""
    global _CHUNKS, _EMBEDS

    docs = _load_documents()
    all_chunks: List[str] = []
    for doc in docs:
        all_chunks.extend(_split_into_chunks(doc))

    if not all_chunks:
        _CHUNKS = []
        _EMBEDS = []
        return

    embeds = _embed_texts(all_chunks)

    _CHUNKS = all_chunks
    _EMBEDS = embeds


# Construire l'index à l'import
_build_index()


def reload_index():
    """Reconstruit l'index avec tous les documents disponibles (y compris les nouvelles contributions)."""
    _build_index()


def search(query: str, k: int = 4) -> List[Tuple[str, float]]:
    """Retourne les k chunks les plus pertinents (texte, score)."""
    if not _CHUNKS or not _EMBEDS:
        return []

    # Embed de la requête
    q_emb_resp = client.embeddings.create(
        model=EMBED_MODEL,
        input=[query],
    )
    q_emb = q_emb_resp.data[0].embedding

    scores: List[Tuple[str, float]] = []

    for chunk, emb in zip(_CHUNKS, _EMBEDS):
        sim = _cosine_sim(q_emb, emb)
        scores.append((chunk, sim))

    # Trier par similarité décroissante
    scores.sort(key=lambda x: x[1], reverse=True)

    return scores[:k]
