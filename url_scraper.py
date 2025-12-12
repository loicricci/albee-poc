import re
import json
import requests
from bs4 import BeautifulSoup
from typing import Optional, List
from urllib.parse import urlparse, urljoin


def extract_urls(text: str) -> List[str]:
    """Extract all URLs from a text string."""
    # Multiple patterns to catch different URL formats
    patterns = [
        r'https?://[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\].,;:!?)]',  # URLs with protocol
        r'www\.[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\].,;:!?)]',     # www. URLs
    ]
    
    urls = []
    for pattern in patterns:
        matches = re.findall(pattern, text)
        urls.extend(matches)
    
    # Clean URLs (remove trailing punctuation and add protocol if needed)
    cleaned_urls = []
    for url in urls:
        # Remove trailing punctuation that's not part of the URL
        url = url.rstrip('.,;:!?)')
        # Add https:// if it's a www. URL
        if url.startswith('www.'):
            url = 'https://' + url
        cleaned_urls.append(url)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in cleaned_urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    
    return unique_urls


def scrape_url(url: str, max_length: int = 8000) -> Optional[dict]:
    """
    Scrape content from a URL.
    
    Returns:
        dict with 'title', 'content', 'url' or None if failed
    """
    try:
        # Set headers to mimic a modern browser
        # Note: Don't specify Accept-Encoding - let requests handle compression automatically
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        
        # Fetch the URL with timeout
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        response.raise_for_status()
        
        # Handle encoding properly - ensure we get text, not bytes
        if response.encoding is None or response.encoding == 'ISO-8859-1':
            # Try to detect encoding from content
            response.encoding = response.apparent_encoding or 'utf-8'
        
        # Get text content (requests handles decompression automatically)
        # Force text decoding
        try:
            html_content = response.text
        except UnicodeDecodeError:
            # Fallback: decode manually
            html_content = response.content.decode('utf-8', errors='replace')
        
        # Verify we have valid text
        if not html_content or len(html_content) < 10:
            print(f"[URL Scraper] Empty or invalid HTML content for {url}")
            return None
        
        # Parse HTML - try lxml first, fallback to html.parser
        try:
            soup = BeautifulSoup(html_content, 'lxml')
        except Exception:
            soup = BeautifulSoup(html_content, 'html.parser')
        
        # Extract title from multiple sources
        title = None
        if soup.title:
            title = soup.title.get_text().strip()
            # Clean up title (remove extra whitespace/newlines)
            title = re.sub(r'\s+', ' ', title).strip()
            print(f"[URL Scraper] Found title from <title>: '{title}'")
        if not title or len(title) < 2:
            og_title = soup.find('meta', property='og:title')
            if og_title:
                title = og_title.get('content', '').strip()
        if not title or len(title) < 2:
            twitter_title = soup.find('meta', attrs={'name': 'twitter:title'})
            if twitter_title:
                title = twitter_title.get('content', '').strip()
        if not title or len(title) < 2:
            h1 = soup.find('h1')
            if h1:
                title = h1.get_text().strip()
                title = re.sub(r'\s+', ' ', title).strip()
        
        # Extract description from meta tags (important for JS-rendered sites)
        description_parts = []
        og_desc = soup.find('meta', property='og:description')
        if og_desc:
            desc = og_desc.get('content', '').strip()
            if desc:
                description_parts.append(desc)
        
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            desc = meta_desc.get('content', '').strip()
            if desc and desc not in description_parts:
                description_parts.append(desc)
        
        twitter_desc = soup.find('meta', attrs={'name': 'twitter:description'})
        if twitter_desc:
            desc = twitter_desc.get('content', '').strip()
            if desc and desc not in description_parts:
                description_parts.append(desc)
        
        # Try to extract JSON-LD structured data
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_ld_scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict):
                    if 'description' in data and data['description']:
                        description_parts.append(str(data['description']))
                    if 'name' in data and not title:
                        title = str(data['name'])
            except:
                pass
        
        # Remove script and style elements before extracting body content
        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.decompose()
        
        # Extract main content - try multiple strategies
        content_parts = []
        
        # Strategy 1: Try semantic HTML elements
        main_content = soup.find('main') or soup.find('article') or soup.find('section')
        if main_content:
            text = main_content.get_text(separator=' ', strip=True)
            if text and len(text) > 50:
                content_parts.append(text)
        
        # Strategy 2: Try common content div classes
        if not content_parts:
            for selector in ['div.content', 'div.main-content', 'div.post-content', 'div.article-content', 'div[class*="content"]']:
                try:
                    div = soup.select_one(selector)
                    if div:
                        text = div.get_text(separator=' ', strip=True)
                        if text and len(text) > 50:
                            content_parts.append(text)
                            break
                except:
                    pass
        
        # Strategy 3: Extract all paragraph text
        if not content_parts:
            paragraphs = soup.find_all('p')
            para_texts = [p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)]
            if para_texts:
                content_parts.append(' '.join(para_texts))
        
        # Strategy 4: Fallback to body text
        if not content_parts:
            body = soup.find('body')
            if body:
                text = body.get_text(separator=' ', strip=True)
                if text and len(text) > 50:
                    content_parts.append(text)
        
        # Combine all content
        all_content = []
        if description_parts:
            all_content.append("Description: " + " | ".join(description_parts))
        if content_parts:
            all_content.extend(content_parts)
        
        content = " ".join(all_content)
        
        # Clean up whitespace
        content = re.sub(r'\s+', ' ', content)
        
        # If we have minimal content but have title/description, still return it
        if not content or len(content.strip()) < 10:
            # Try to get at least something from the page
            if description_parts:
                content = " | ".join(description_parts)
            elif title:
                # Check if this looks like a JS-rendered SPA (minimal body text, lots of script tags)
                script_count = len(soup.find_all('script'))
                body_text_length = len(soup.get_text().strip())
                
                if script_count > 3 and body_text_length < 100:
                    content = f"Page: {title}. This appears to be a JavaScript-rendered single-page application (SPA). The main content is loaded dynamically via JavaScript and may not be accessible through basic web scraping. Available information: Title: {title}"
                else:
                    content = f"Page title: {title}. Limited content available from this page."
            else:
                print(f"[URL Scraper] Very limited content for {url}")
                return None
        
        # Truncate if too long
        if len(content) > max_length:
            content = content[:max_length] + "... [content truncated]"
        
        print(f"[URL Scraper] Successfully scraped {url}: {len(content)} chars, title: {title or 'N/A'}")
        
        return {
            'url': url,
            'title': title or 'Untitled',
            'content': content.strip()
        }
        
    except requests.exceptions.RequestException as e:
        print(f"[URL Scraper] Error fetching URL {url}: {e}")
        return None
    except Exception as e:
        print(f"[URL Scraper] Error parsing URL {url}: {e}")
        import traceback
        traceback.print_exc()
        return None


def scrape_urls_from_text(text: str, max_urls: int = 3) -> List[dict]:
    """
    Extract and scrape content from URLs found in text.
    
    Args:
        text: Text that may contain URLs
        max_urls: Maximum number of URLs to scrape (to avoid overload)
    
    Returns:
        List of scraped content dictionaries
    """
    urls = extract_urls(text)
    if not urls:
        return []
    
    # Limit number of URLs to scrape
    urls = urls[:max_urls]
    
    scraped_content = []
    for url in urls:
        result = scrape_url(url)
        if result:
            scraped_content.append(result)
    
    return scraped_content

