"""
Web Research Module for Agent Knowledge Base Initialization

This module provides functionality to automatically research a person or topic
and gather initial data for an agent's knowledge base at creation time.
"""

import os
import json
import requests
from typing import List, Dict, Optional
from urllib.parse import quote_plus
from .url_scraper import scrape_url


class WebResearcher:
    """
    Researches a topic/person on the web and returns structured content
    suitable for adding to an agent's knowledge base.
    """
    
    def __init__(self):
        # You can use different search APIs:
        # - Google Custom Search API (requires API key)
        # - Bing Search API (requires API key)
        # - DuckDuckGo (no API key needed, but less results)
        # - SerpAPI (paid service with good results)
        
        self.google_api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
        self.google_search_engine_id = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
        self.serpapi_key = os.getenv("SERPAPI_KEY")
    
    def research_topic(
        self, 
        topic: str, 
        max_sources: int = 5,
        search_queries: Optional[List[str]] = None
    ) -> Dict:
        """
        Research a topic by searching the web and scraping relevant sources.
        
        Args:
            topic: The person or topic to research
            max_sources: Maximum number of sources to scrape
            search_queries: Custom search queries (auto-generated if None)
        
        Returns:
            Dictionary with:
                - topic: The researched topic
                - sources: List of scraped content
                - summary: AI-generated summary (optional)
                - queries_used: List of search queries executed
        """
        print(f"[WebResearcher] Starting research on: {topic}")
        
        # Generate search queries if not provided
        if not search_queries:
            search_queries = self._generate_search_queries(topic)
        
        # Collect unique URLs from search results
        all_urls = []
        for query in search_queries[:3]:  # Limit to 3 queries to avoid rate limits
            urls = self._search_web(query, max_results=max_sources)
            all_urls.extend(urls)
        
        # Remove duplicates while preserving order
        unique_urls = []
        seen = set()
        for url in all_urls:
            if url not in seen:
                seen.add(url)
                unique_urls.append(url)
        
        # Limit total URLs
        unique_urls = unique_urls[:max_sources]
        
        print(f"[WebResearcher] Found {len(unique_urls)} unique URLs to scrape")
        
        # Scrape content from each URL
        sources = []
        for url in unique_urls:
            scraped = scrape_url(url, max_length=4000)
            if scraped and scraped.get('content'):
                sources.append({
                    'url': scraped['url'],
                    'title': scraped['title'],
                    'content': scraped['content'],
                    'source_type': self._classify_source(url)
                })
        
        print(f"[WebResearcher] Successfully scraped {len(sources)} sources")
        
        return {
            'topic': topic,
            'sources': sources,
            'queries_used': search_queries,
            'total_sources': len(sources)
        }
    
    def _generate_search_queries(self, topic: str) -> List[str]:
        """Generate effective search queries for a topic with intelligent detection."""
        topic_lower = topic.lower()
        
        # Detect if it's a person (simple heuristic)
        is_person = self._is_likely_person(topic)
        
        if is_person:
            # Queries optimized for people
            queries = [
                f"{topic}",  # Basic search
                f"{topic} biography",  # Biographical info
                f"{topic} profile",  # Professional profile
                f"{topic} background career",  # Career history
                f"{topic} achievements accomplishments",  # Notable work
                f"{topic} linkedin",  # Professional network
                f"{topic} latest news updates",  # Recent activity
            ]
        elif any(keyword in topic_lower for keyword in ['company', 'corporation', 'inc', 'ltd', 'llc']):
            # Queries optimized for companies
            queries = [
                f"{topic}",  # Basic search
                f"{topic} about company",  # Company info
                f"{topic} products services",  # What they do
                f"{topic} history founding",  # Company history
                f"{topic} news latest",  # Recent news
                f"{topic} wikipedia",  # Encyclopedia entry
            ]
        elif any(keyword in topic_lower for keyword in ['technology', 'concept', 'theory', 'method']):
            # Queries optimized for concepts/technologies
            queries = [
                f"{topic}",  # Basic search
                f"{topic} explanation definition",  # What it is
                f"{topic} how it works",  # How it works
                f"{topic} applications uses",  # Use cases
                f"{topic} tutorial guide",  # Learning resources
                f"{topic} latest developments",  # Recent advances
            ]
        else:
            # Generic queries for unknown types
            queries = [
                f"{topic}",  # Basic search
                f"{topic} overview",  # General overview
                f"{topic} about information",  # General info
                f"{topic} background",  # Background info
                f"{topic} wikipedia",  # Encyclopedia entry
                f"{topic} latest news",  # Recent updates
            ]
        
        return queries
    
    def _is_likely_person(self, topic: str) -> bool:
        """Heuristic to detect if topic is likely a person's name."""
        # Simple heuristics:
        # - Contains 2-4 words
        # - First letters are uppercase
        # - No special company/tech keywords
        words = topic.split()
        if len(words) < 2 or len(words) > 4:
            return False
        
        # Check if it starts with capital letters (name pattern)
        if not all(word[0].isupper() for word in words if word):
            return False
        
        # Exclude if it contains company/tech keywords
        topic_lower = topic.lower()
        exclude_keywords = [
            'company', 'corporation', 'inc', 'ltd', 'llc', 'technologies',
            'systems', 'software', 'solutions', 'group', 'foundation'
        ]
        if any(keyword in topic_lower for keyword in exclude_keywords):
            return False
        
        return True
    
    def _search_web(self, query: str, max_results: int = 5) -> List[str]:
        """
        Search the web and return URLs.
        Tries multiple search providers in order of preference.
        """
        # Try SerpAPI first (best results, requires paid API key)
        if self.serpapi_key:
            urls = self._search_serpapi(query, max_results)
            if urls:
                return urls
        
        # Try Google Custom Search (requires free API key)
        if self.google_api_key and self.google_search_engine_id:
            urls = self._search_google(query, max_results)
            if urls:
                return urls
        
        # Fallback to DuckDuckGo (no API key needed, limited results)
        urls = self._search_duckduckgo(query, max_results)
        return urls
    
    def _search_serpapi(self, query: str, max_results: int) -> List[str]:
        """Search using SerpAPI (paid service with excellent results)."""
        try:
            url = "https://serpapi.com/search"
            params = {
                "q": query,
                "api_key": self.serpapi_key,
                "num": max_results,
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            urls = []
            for result in data.get("organic_results", [])[:max_results]:
                if "link" in result:
                    urls.append(result["link"])
            
            print(f"[WebResearcher] SerpAPI found {len(urls)} URLs for query: {query}")
            return urls
        except Exception as e:
            print(f"[WebResearcher] SerpAPI search failed: {e}")
            return []
    
    def _search_google(self, query: str, max_results: int) -> List[str]:
        """Search using Google Custom Search API."""
        try:
            url = "https://www.googleapis.com/customsearch/v1"
            params = {
                "key": self.google_api_key,
                "cx": self.google_search_engine_id,
                "q": query,
                "num": min(max_results, 10),  # Google API limits to 10
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            urls = []
            for item in data.get("items", [])[:max_results]:
                if "link" in item:
                    urls.append(item["link"])
            
            print(f"[WebResearcher] Google found {len(urls)} URLs for query: {query}")
            return urls
        except Exception as e:
            print(f"[WebResearcher] Google search failed: {e}")
            return []
    
    def _search_duckduckgo(self, query: str, max_results: int) -> List[str]:
        """
        Search using DuckDuckGo (no API key required).
        This is a basic implementation using their HTML interface.
        """
        try:
            # DuckDuckGo HTML search
            url = "https://html.duckduckgo.com/html/"
            params = {"q": query}
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
            
            response = requests.post(url, data=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Parse HTML to extract links
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(response.text, 'html.parser')
            
            urls = []
            for result in soup.find_all('a', class_='result__a')[:max_results]:
                href = result.get('href')
                if href and href.startswith('http'):
                    urls.append(href)
            
            print(f"[WebResearcher] DuckDuckGo found {len(urls)} URLs for query: {query}")
            return urls
        except Exception as e:
            print(f"[WebResearcher] DuckDuckGo search failed: {e}")
            return []
    
    def _classify_source(self, url: str) -> str:
        """Classify the type of source based on URL."""
        url_lower = url.lower()
        
        if any(wiki in url_lower for wiki in ['wikipedia.org', 'wikimedia.org']):
            return 'encyclopedia'
        elif any(social in url_lower for social in ['linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com']):
            return 'social_media'
        elif any(news in url_lower for news in ['news', 'times', 'post', 'cnn', 'bbc', 'reuters']):
            return 'news'
        elif any(academic in url_lower for academic in ['.edu', 'scholar.google', 'arxiv.org', 'researchgate']):
            return 'academic'
        elif any(blog in url_lower for blog in ['medium.com', 'blog', 'wordpress', 'substack']):
            return 'blog'
        else:
            return 'general'


def research_and_format_for_agent(topic: str, max_sources: int = 5) -> List[Dict]:
    """
    Research a topic and return formatted documents ready for agent ingestion.
    
    Args:
        topic: Person or topic to research
        max_sources: Maximum number of sources to gather
    
    Returns:
        List of document dictionaries with 'title', 'content', and 'source' fields
    """
    researcher = WebResearcher()
    research_results = researcher.research_topic(topic, max_sources=max_sources)
    
    # Format for agent document ingestion
    documents = []
    
    # Create an overview document
    overview_content = f"Research Overview: {topic}\n\n"
    overview_content += f"Sources analyzed: {len(research_results['sources'])}\n\n"
    
    for i, source in enumerate(research_results['sources'], 1):
        overview_content += f"\n--- Source {i}: {source['title']} ---\n"
        overview_content += f"URL: {source['url']}\n"
        overview_content += f"Type: {source['source_type']}\n"
        overview_content += f"\nContent:\n{source['content']}\n"
    
    documents.append({
        'title': f"Web Research: {topic}",
        'content': overview_content,
        'source': f"web_research:{','.join(research_results['queries_used'][:3])}"
    })
    
    # Also create individual documents for each source (better for RAG)
    for source in research_results['sources']:
        documents.append({
            'title': source['title'],
            'content': source['content'],
            'source': source['url']
        })
    
    return documents


# Example usage for testing
if __name__ == "__main__":
    # Test the researcher
    researcher = WebResearcher()
    results = researcher.research_topic("Elon Musk", max_sources=3)
    
    print(f"\n=== Research Results ===")
    print(f"Topic: {results['topic']}")
    print(f"Sources found: {results['total_sources']}")
    print(f"Queries used: {results['queries_used']}")
    
    for i, source in enumerate(results['sources'], 1):
        print(f"\n--- Source {i} ---")
        print(f"Title: {source['title']}")
        print(f"URL: {source['url']}")
        print(f"Type: {source['source_type']}")
        print(f"Content length: {len(source['content'])} chars")

