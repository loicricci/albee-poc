"""
Reranking module for RAG using cross-encoder models.

This module provides semantic reranking of retrieved documents using
sentence-transformers cross-encoders for improved relevance.
"""

import os
from sentence_transformers import CrossEncoder

# Global model instance for lazy loading
_model = None

# Default model - lightweight and fast for reranking
RERANK_MODEL = os.getenv("RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")


def get_reranker() -> CrossEncoder:
    """
    Lazy-load and return the cross-encoder reranking model.
    
    Returns:
        CrossEncoder: The loaded reranking model
    """
    global _model
    if _model is None:
        _model = CrossEncoder(RERANK_MODEL)
    return _model


def rerank_chunks(query: str, chunks: list[str], top_k: int = 5) -> list[str]:
    """
    Rerank a list of text chunks by relevance to the query using a cross-encoder.
    
    Cross-encoders jointly encode the query and each candidate, providing
    more accurate relevance scores than cosine similarity alone.
    
    Args:
        query: The search query to rank against
        chunks: List of candidate text chunks to rerank
        top_k: Number of top-ranked chunks to return
    
    Returns:
        List of top-k chunks ordered by relevance (most relevant first)
    
    Example:
        >>> candidates = ["Paris is in France", "London is in England", "Cats are animals"]
        >>> rerank_chunks("What is the capital of France?", candidates, top_k=2)
        ["Paris is in France", "London is in England"]
    """
    if not chunks:
        return []
    
    # If we have fewer chunks than top_k, just return all
    if len(chunks) <= top_k:
        return chunks
    
    # Get the reranker model
    ranker = get_reranker()
    
    # Create (query, chunk) pairs for the cross-encoder
    pairs = [(query, chunk) for chunk in chunks]
    
    # Get relevance scores
    scores = ranker.predict(pairs)
    
    # Sort by score descending and return top_k
    ranked = sorted(zip(chunks, scores), key=lambda x: x[1], reverse=True)
    
    return [chunk for chunk, score in ranked[:top_k]]

