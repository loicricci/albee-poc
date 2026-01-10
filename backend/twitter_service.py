"""
Twitter Service
Handles Twitter API interactions for fetching tweets.
"""

import os
import tweepy
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class TwitterService:
    """Service for interacting with Twitter API v2."""
    
    def __init__(self):
        """Initialize Twitter API client."""
        self.bearer_token = os.getenv("TWITTER_BEARER_TOKEN")
        
        if not self.bearer_token:
            logger.warning("TWITTER_BEARER_TOKEN not set - Twitter features will be disabled")
            self.client = None
        else:
            try:
                self.client = tweepy.Client(bearer_token=self.bearer_token)
                logger.info("Twitter API client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Twitter client: {e}")
                self.client = None
    
    def is_available(self) -> bool:
        """Check if Twitter API is available."""
        return self.client is not None
    
    def search_recent_tweets(
        self,
        query: str,
        max_results: int = 10,
        days_back: int = 7
    ) -> List[Dict]:
        """
        Search for recent tweets matching a query.
        
        Args:
            query: Search query (supports Twitter search operators)
            max_results: Maximum number of tweets to return (10-100)
            days_back: How many days back to search (max 7 for free tier)
        
        Returns:
            List of tweet dictionaries with id, text, author, created_at
        """
        if not self.is_available():
            raise RuntimeError("Twitter API not available - check TWITTER_BEARER_TOKEN")
        
        try:
            # Calculate start time
            start_time = datetime.utcnow() - timedelta(days=days_back)
            
            # Search tweets
            response = self.client.search_recent_tweets(
                query=query,
                max_results=min(max_results, 100),  # API limit
                start_time=start_time,
                tweet_fields=['created_at', 'author_id', 'public_metrics'],
                user_fields=['username', 'name'],
                expansions=['author_id']
            )
            
            if not response.data:
                logger.info(f"No tweets found for query: {query}")
                return []
            
            # Build user map
            users = {}
            if response.includes and 'users' in response.includes:
                users = {user.id: user for user in response.includes['users']}
            
            # Format results
            tweets = []
            for tweet in response.data:
                author = users.get(tweet.author_id)
                tweets.append({
                    'id': str(tweet.id),
                    'text': tweet.text,
                    'author_id': str(tweet.author_id),
                    'author_username': author.username if author else None,
                    'author_name': author.name if author else None,
                    'created_at': tweet.created_at,
                    'likes': tweet.public_metrics.get('like_count', 0) if tweet.public_metrics else 0,
                    'retweets': tweet.public_metrics.get('retweet_count', 0) if tweet.public_metrics else 0,
                })
            
            logger.info(f"Found {len(tweets)} tweets for query: {query}")
            return tweets
            
        except tweepy.TooManyRequests:
            logger.error("Twitter API rate limit exceeded")
            raise RuntimeError("Twitter API rate limit exceeded - try again later")
        except tweepy.Unauthorized:
            logger.error("Twitter API unauthorized - check credentials")
            raise RuntimeError("Twitter API authentication failed")
        except Exception as e:
            logger.error(f"Twitter search failed: {e}")
            raise RuntimeError(f"Twitter search failed: {str(e)}")
    
    def get_user_tweets(
        self,
        username: str,
        max_results: int = 10
    ) -> List[Dict]:
        """
        Get recent tweets from a specific user.
        
        Args:
            username: Twitter username (without @)
            max_results: Maximum number of tweets to return (5-100)
        
        Returns:
            List of tweet dictionaries
        """
        if not self.is_available():
            raise RuntimeError("Twitter API not available - check TWITTER_BEARER_TOKEN")
        
        try:
            # Get user ID
            user = self.client.get_user(username=username)
            if not user.data:
                logger.warning(f"Twitter user not found: {username}")
                return []
            
            user_id = user.data.id
            
            # Get user's tweets
            response = self.client.get_users_tweets(
                id=user_id,
                max_results=min(max_results, 100),
                tweet_fields=['created_at', 'public_metrics'],
                exclude=['retweets', 'replies']  # Only original tweets
            )
            
            if not response.data:
                logger.info(f"No tweets found for user: {username}")
                return []
            
            # Format results
            tweets = []
            for tweet in response.data:
                tweets.append({
                    'id': str(tweet.id),
                    'text': tweet.text,
                    'author_id': str(user_id),
                    'author_username': username,
                    'author_name': user.data.name,
                    'created_at': tweet.created_at,
                    'likes': tweet.public_metrics.get('like_count', 0) if tweet.public_metrics else 0,
                    'retweets': tweet.public_metrics.get('retweet_count', 0) if tweet.public_metrics else 0,
                })
            
            logger.info(f"Found {len(tweets)} tweets for user: {username}")
            return tweets
            
        except tweepy.TooManyRequests:
            logger.error("Twitter API rate limit exceeded")
            raise RuntimeError("Twitter API rate limit exceeded - try again later")
        except Exception as e:
            logger.error(f"Failed to fetch tweets for user {username}: {e}")
            raise RuntimeError(f"Failed to fetch tweets: {str(e)}")
    
    def format_tweet_for_agent_update(self, tweet: Dict) -> Dict:
        """
        Format a tweet into an agent update structure.
        
        Args:
            tweet: Tweet dictionary from API
        
        Returns:
            Dictionary with title, content, topic for AgentUpdate
        """
        author = tweet.get('author_name') or tweet.get('author_username') or 'Unknown'
        username = tweet.get('author_username')
        
        # Create title
        title = f"Tweet from @{username}" if username else f"Tweet from {author}"
        
        # Create content with metadata
        content = f"{tweet['text']}\n\n"
        content += f"---\n"
        content += f"Author: {author}"
        if username:
            content += f" (@{username})"
        content += f"\n"
        content += f"Posted: {tweet['created_at'].strftime('%Y-%m-%d %H:%M UTC')}\n"
        content += f"Engagement: {tweet.get('likes', 0)} likes, {tweet.get('retweets', 0)} retweets\n"
        content += f"Source: https://twitter.com/{username}/status/{tweet['id']}"
        
        return {
            'title': title,
            'content': content,
            'topic': 'twitter',
        }


# Global instance
_twitter_service = None


def get_twitter_service() -> TwitterService:
    """Get or create the global Twitter service instance."""
    global _twitter_service
    if _twitter_service is None:
        _twitter_service = TwitterService()
    return _twitter_service










