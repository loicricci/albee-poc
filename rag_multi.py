import os
import math
from typing import List, Tuple, Optional, Dict
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

EMBED_MODEL = "text-embedding-3-small"

# Global cache for multiple knowledge bases
_KNOWLEDGE_BASES: Dict[str, Dict] = {}


def _read_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _load_documents_from_dir(data_dir: str, persona_file: Optional[str] = None) -> List[str]:
    """Load all text/markdown files from a directory and its subdirectories."""
    docs: List[str] = []
    
    if not os.path.exists(data_dir):
        return docs
    
    for fname in os.listdir(data_dir):
        # Skip persona file if specified
        if persona_file and fname == persona_file:
            continue
        
        full = os.path.join(data_dir, fname)
        if os.path.isdir(full):
            # Recursively load from subdirectories
            for sub_fname in os.listdir(full):
                sub_full = os.path.join(full, sub_fname)
                if os.path.isfile(sub_full) and sub_fname.lower().endswith((".md", ".txt", ".pdf")):
                    try:
                        docs.append(_read_text_file(sub_full))
                    except Exception as e:
                        print(f"Error reading {sub_full}: {e}")
        elif fname.lower().endswith((".md", ".txt")):
            try:
                docs.append(_read_text_file(full))
            except Exception as e:
                print(f"Error reading {full}: {e}")
    
    return docs


def _split_into_chunks(text: str, max_chars: int = 1200) -> List[str]:
    """Split text into reasonable chunks (by paragraphs)."""
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
    """Create embeddings for a list of texts."""
    if not texts:
        return []

    # Batch embeddings (OpenAI supports up to 2048 inputs, but we'll do smaller batches)
    batch_size = 100
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = client.embeddings.create(
            model=EMBED_MODEL,
            input=batch,
        )
        all_embeddings.extend([d.embedding for d in response.data])
    
    return all_embeddings


def _cosine_sim(v1: List[float], v2: List[float]) -> float:
    """Cosine similarity."""
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


def build_index(knowledge_base_id: str, data_dir: str, persona_file: Optional[str] = None):
    """Build index for a specific knowledge base."""
    global _KNOWLEDGE_BASES
    
    print(f"[RAG] Building index for '{knowledge_base_id}' from {data_dir}")
    
    docs = _load_documents_from_dir(data_dir, persona_file)
    all_chunks: List[str] = []
    
    for doc in docs:
        all_chunks.extend(_split_into_chunks(doc))

    if not all_chunks:
        _KNOWLEDGE_BASES[knowledge_base_id] = {
            'chunks': [],
            'embeds': []
        }
        print(f"[RAG] No documents found for '{knowledge_base_id}'")
        return

    print(f"[RAG] Found {len(docs)} documents, {len(all_chunks)} chunks for '{knowledge_base_id}'")
    embeds = _embed_texts(all_chunks)

    _KNOWLEDGE_BASES[knowledge_base_id] = {
        'chunks': all_chunks,
        'embeds': embeds
    }
    print(f"[RAG] Index built successfully for '{knowledge_base_id}'")


def reload_index(knowledge_base_id: str, data_dir: str, persona_file: Optional[str] = None):
    """Reload index for a specific knowledge base."""
    build_index(knowledge_base_id, data_dir, persona_file)


def search(query: str, knowledge_base_id: str, k: int = 4) -> List[Tuple[str, float]]:
    """Search in a specific knowledge base."""
    if knowledge_base_id not in _KNOWLEDGE_BASES:
        print(f"[RAG] Knowledge base '{knowledge_base_id}' not found")
        return []
    
    kb = _KNOWLEDGE_BASES[knowledge_base_id]
    chunks = kb['chunks']
    embeds = kb['embeds']
    
    if not chunks or not embeds:
        return []

    # Embed the query
    q_emb_resp = client.embeddings.create(
        model=EMBED_MODEL,
        input=[query],
    )
    q_emb = q_emb_resp.data[0].embedding

    scores: List[Tuple[str, float]] = []

    for chunk, emb in zip(chunks, embeds):
        sim = _cosine_sim(q_emb, emb)
        scores.append((chunk, sim))

    # Sort by similarity descending
    scores.sort(key=lambda x: x[1], reverse=True)

    return scores[:k]


# Initialize default knowledge bases
def initialize_default_kbs():
    """Initialize default knowledge bases."""
    # Loïc's knowledge base
    build_index("loic", "data", "persona_loic.md")
    
    # Victor Hugo's knowledge base (includes books subdirectory)
    build_index("victor_hugo", "data/victor_hugo", "persona_victor_hugo.md")


# Auto-initialize on import
initialize_default_kbs()

