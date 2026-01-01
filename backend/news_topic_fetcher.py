"""
News Topic Fetcher Module

Fetches trending news topics and filters them using AI to ensure they are safe,
avoiding named individuals, brands, and controversial topics.
"""

import os
import json
import random
import time
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import requests
from openai import OpenAI

client = OpenAI()


class NewsTopicFetcher:
    """
    Fetches news topics from News API and filters them for safe, general topics
    suitable for AI-generated content without legal issues.
    """
    
    def __init__(self):
        self.api_key = os.getenv("NEWS_API_KEY")
        if not self.api_key:
            print("[NewsTopicFetcher] Warning: NEWS_API_KEY not set, will use fallback topics")
        
        self.base_url = "https://newsapi.org/v2"
        
        # Fallback topics if API fails or not configured
        self.fallback_topics = [
            {
                "topic": "Advances in renewable energy technology",
                "description": "New developments in solar, wind, and sustainable energy solutions",
                "category": "technology"
            },
            {
                "topic": "Deep sea exploration discoveries",
                "description": "Scientists discover new marine ecosystems in unexplored ocean depths",
                "category": "science"
            },
            {
                "topic": "Artificial intelligence breakthroughs",
                "description": "Recent advances in machine learning and AI applications",
                "category": "technology"
            },
            {
                "topic": "Space exploration milestones",
                "description": "New discoveries and missions in space exploration",
                "category": "science"
            },
            {
                "topic": "Ancient archaeological findings",
                "description": "Recent archaeological discoveries revealing ancient civilizations",
                "category": "history"
            },
            {
                "topic": "Wildlife conservation efforts",
                "description": "Successful conservation programs protecting endangered species",
                "category": "environment"
            },
            {
                "topic": "Medical research breakthroughs",
                "description": "New treatments and understanding of human health",
                "category": "science"
            },
            {
                "topic": "Climate change adaptation strategies",
                "description": "Innovative solutions for adapting to changing climate",
                "category": "environment"
            },
            {
                "topic": "Quantum computing advances",
                "description": "Breakthroughs in quantum computing technology",
                "category": "technology"
            },
            {
                "topic": "Cultural festivals around the world",
                "description": "Celebrations of diverse cultural traditions globally",
                "category": "culture"
            }
        ]
    
    def get_safe_daily_topic(self, category: Optional[str] = None) -> Dict[str, str]:
        """
        Fetch a safe, filtered news topic suitable for AI content generation.
        
        Args:
            category: Optional category filter (business, entertainment, general, 
                     health, science, sports, technology)
        
        Returns:
            Dictionary with:
                - topic: Brief topic title
                - description: Detailed description
                - category: Topic category
                - source: Where the topic came from
        """
        print(f"[NewsTopicFetcher] Fetching safe daily topic...")
        start_time = time.time()
        
        # Try to fetch from News API
        if self.api_key:
            try:
                fetch_start = time.time()
                articles = self._fetch_top_headlines(category)
                fetch_duration = time.time() - fetch_start
                print(f"[NewsTopicFetcher]   News API fetch took {fetch_duration:.2f}s")
                
                if articles:
                    # Filter articles for safe topics
                    filter_start = time.time()
                    safe_topic = self._filter_and_select_topic(articles)
                    filter_duration = time.time() - filter_start
                    print(f"[NewsTopicFetcher]   AI filtering took {filter_duration:.2f}s")
                    
                    if safe_topic:
                        total_duration = time.time() - start_time
                        print(f"[NewsTopicFetcher] ✅ Found topic: {safe_topic['topic']} (total: {total_duration:.2f}s)")
                        return safe_topic
            except Exception as e:
                print(f"[NewsTopicFetcher] Error fetching from News API: {e}")
        
        # Fallback to predefined safe topics
        print("[NewsTopicFetcher] Using fallback topic")
        topic = random.choice(self.fallback_topics)
        topic["source"] = "fallback"
        total_duration = time.time() - start_time
        print(f"[NewsTopicFetcher] ✅ Fallback topic selected ({total_duration:.2f}s)")
        return topic
    
    def _fetch_top_headlines(self, category: Optional[str] = None) -> List[Dict]:
        """Fetch top headlines from News API"""
        
        # Use top-headlines endpoint for trending news
        url = f"{self.base_url}/top-headlines"
        
        params = {
            "apiKey": self.api_key,
            "language": "en",
            "pageSize": 20,  # Fetch more to have options after filtering
        }
        
        if category:
            params["category"] = category
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "ok":
                articles = data.get("articles", [])
                print(f"[NewsTopicFetcher] Fetched {len(articles)} articles from News API")
                return articles
            else:
                print(f"[NewsTopicFetcher] API returned error: {data.get('message')}")
                return []
                
        except Exception as e:
            print(f"[NewsTopicFetcher] Error calling News API: {e}")
            return []
    
    def _filter_and_select_topic(self, articles: List[Dict]) -> Optional[Dict[str, str]]:
        """
        Use GPT-4o-mini to filter articles and select a safe topic.
        
        Filters out:
        - Named individuals (celebrities, politicians, etc.)
        - Specific companies/brands
        - Controversial/sensitive topics
        - Legal issues
        """
        
        # Prepare article summaries for AI filtering
        article_summaries = []
        for i, article in enumerate(articles[:15]):  # Limit to 15 for token efficiency
            summary = {
                "id": i,
                "title": article.get("title", ""),
                "description": article.get("description", ""),
            }
            article_summaries.append(summary)
        
        # Construct filtering prompt
        filter_prompt = f"""You are a content safety filter. Review these news articles and select ONE that is safe for AI-generated social media content.

SAFETY CRITERIA - The topic MUST:
✅ Be about general concepts, trends, or phenomena
✅ Avoid naming specific people (celebrities, politicians, athletes, etc.)
✅ Avoid naming specific companies or brands
✅ Avoid controversial or sensitive subjects (politics, religion, violence, etc.)
✅ Be suitable for creative, lighthearted social media posts
✅ Not involve legal issues, scandals, or negative events

IDEAL TOPICS:
- Scientific discoveries (without naming researchers)
- Technology trends (general, not specific products)
- Natural phenomena and weather events
- Cultural celebrations and traditions
- Space exploration milestones
- Environmental initiatives
- Sports events (without naming specific athletes)
- Artistic movements and trends

ARTICLES TO REVIEW:
{json.dumps(article_summaries, indent=2)}

TASK:
1. Identify which articles meet ALL safety criteria
2. Select the BEST one for creative content
3. Return ONLY a JSON object with:
{{
  "selected_id": <article id number or null if none are safe>,
  "topic": "<brief topic title in general terms>",
  "description": "<detailed description without names/brands>",
  "category": "<science/technology/culture/environment/sports>",
  "reasoning": "<why this topic is safe>"
}}

If NO articles are safe, return {{"selected_id": null}}.
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a content safety expert. Return only valid JSON."
                    },
                    {
                        "role": "user",
                        "content": filter_prompt
                    }
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
                        )
            
            result = json.loads(response.choices[0].message.content)
            
            if result.get("selected_id") is not None:
                result["source"] = "news_api_filtered"
                print(f"[NewsTopicFetcher] AI selected topic: {result['topic']}")
                print(f"[NewsTopicFetcher] Reasoning: {result['reasoning']}")
                
                # Log token usage if available
                if hasattr(response, 'usage'):
                    print(f"[NewsTopicFetcher] API tokens: {response.usage.total_tokens}")
                
                return result
            else:
                print("[NewsTopicFetcher] No safe topics found in articles")
                return None
                
        except Exception as e:
            print(f"[NewsTopicFetcher] Error in AI filtering: {e}")
            return None


# Convenience function for easy import
def get_safe_daily_topic(category: Optional[str] = None) -> Dict[str, str]:
    """
    Get a safe daily topic for content generation.
    
    Args:
        category: Optional category filter
    
    Returns:
        Dictionary with topic, description, category, source
    """
    fetcher = NewsTopicFetcher()
    return fetcher.get_safe_daily_topic(category)


# Testing
if __name__ == "__main__":
    print("=" * 80)
    print("Testing News Topic Fetcher")
    print("=" * 80)
    
    topic = get_safe_daily_topic()
    
    print("\n" + "=" * 80)
    print("RESULT:")
    print("=" * 80)
    print(f"Topic: {topic['topic']}")
    print(f"Description: {topic['description']}")
    print(f"Category: {topic['category']}")
    print(f"Source: {topic['source']}")
    print("=" * 80)


