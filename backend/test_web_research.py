"""
Test script for Web Research feature
Run this to verify the web research functionality works correctly.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

def test_url_scraper():
    """Test the URL scraper module"""
    print("\n" + "="*60)
    print("TEST 1: URL Scraper")
    print("="*60)
    
    from url_scraper import scrape_url
    
    # Test scraping Wikipedia
    test_url = "https://en.wikipedia.org/wiki/Artificial_intelligence"
    print(f"\nScraping: {test_url}")
    
    result = scrape_url(test_url, max_length=2000)
    
    if result:
        print(f"✅ Success!")
        print(f"   Title: {result['title']}")
        print(f"   Content length: {len(result['content'])} chars")
        print(f"   First 200 chars: {result['content'][:200]}...")
        return True
    else:
        print(f"❌ Failed to scrape URL")
        return False


def test_web_researcher():
    """Test the WebResearcher class"""
    print("\n" + "="*60)
    print("TEST 2: Web Researcher")
    print("="*60)
    
    from web_research import WebResearcher
    
    researcher = WebResearcher()
    
    # Test with a simple topic
    topic = "Python programming"
    print(f"\nResearching topic: {topic}")
    print("Max sources: 3")
    print("This may take 20-30 seconds...\n")
    
    try:
        results = researcher.research_topic(topic, max_sources=3)
        
        print(f"\n✅ Research completed!")
        print(f"   Topic: {results['topic']}")
        print(f"   Sources found: {results['total_sources']}")
        print(f"   Queries used: {len(results['queries_used'])}")
        
        if results['sources']:
            print(f"\n   Sources:")
            for i, source in enumerate(results['sources'], 1):
                print(f"   {i}. {source['title']}")
                print(f"      URL: {source['url']}")
                print(f"      Type: {source['source_type']}")
                print(f"      Content: {len(source['content'])} chars")
            return True
        else:
            print("❌ No sources found")
            return False
            
    except Exception as e:
        print(f"❌ Research failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_query_generation():
    """Test intelligent query generation"""
    print("\n" + "="*60)
    print("TEST 3: Intelligent Query Generation")
    print("="*60)
    
    from web_research import WebResearcher
    
    researcher = WebResearcher()
    
    test_topics = [
        ("Elon Musk", "person"),
        ("Tesla Inc", "company"),
        ("Machine Learning", "concept"),
        ("Climate Change", "topic"),
    ]
    
    all_passed = True
    
    for topic, expected_type in test_topics:
        print(f"\nTopic: {topic} (expected: {expected_type})")
        queries = researcher._generate_search_queries(topic)
        print(f"Generated {len(queries)} queries:")
        for i, query in enumerate(queries[:5], 1):
            print(f"  {i}. {query}")
        
        # Check if person detection works
        is_person = researcher._is_likely_person(topic)
        print(f"Detected as person: {is_person}")
        
        if expected_type == "person" and not is_person:
            print(f"❌ Failed to detect {topic} as person")
            all_passed = False
        elif expected_type == "person" and is_person:
            print(f"✅ Correctly detected as person")
    
    return all_passed


def test_research_and_format():
    """Test the complete research and format function"""
    print("\n" + "="*60)
    print("TEST 4: Research and Format for Agent")
    print("="*60)
    
    from web_research import research_and_format_for_agent
    
    topic = "Albert Einstein"
    print(f"\nResearching: {topic}")
    print("Max sources: 3")
    print("This may take 20-30 seconds...\n")
    
    try:
        documents = research_and_format_for_agent(topic, max_sources=3)
        
        if documents:
            print(f"✅ Success!")
            print(f"   Documents created: {len(documents)}")
            
            for i, doc in enumerate(documents, 1):
                print(f"\n   Document {i}:")
                print(f"      Title: {doc['title']}")
                print(f"      Source: {doc['source'][:80]}...")
                print(f"      Content length: {len(doc['content'])} chars")
            
            return True
        else:
            print("❌ No documents created")
            return False
            
    except Exception as e:
        print(f"❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_chunking_and_embedding():
    """Test that content can be chunked and embedded"""
    print("\n" + "="*60)
    print("TEST 5: Chunking and Embedding")
    print("="*60)
    
    try:
        from rag_utils import chunk_text
        from openai_embed import embed_texts
        
        # Create some test content
        test_content = """
        Artificial Intelligence (AI) is intelligence demonstrated by machines, 
        in contrast to the natural intelligence displayed by humans and animals. 
        Leading AI textbooks define the field as the study of "intelligent agents": 
        any device that perceives its environment and takes actions that maximize 
        its chance of successfully achieving its goals.
        """ * 10  # Repeat to make it longer
        
        print(f"\nTest content length: {len(test_content)} chars")
        
        # Chunk the content
        chunks = chunk_text(test_content)
        print(f"✅ Created {len(chunks)} chunks")
        print(f"   First chunk length: {len(chunks[0])} chars")
        
        # Try to embed first chunk
        print(f"\nGenerating embeddings...")
        vectors = embed_texts(chunks[:1])
        
        if vectors and len(vectors) > 0:
            print(f"✅ Generated embedding")
            print(f"   Vector dimensions: {len(vectors[0])}")
            return True
        else:
            print("❌ Failed to generate embeddings")
            return False
            
    except Exception as e:
        print(f"❌ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("WEB RESEARCH FEATURE - COMPREHENSIVE TEST SUITE")
    print("="*60)
    
    results = {
        "URL Scraper": test_url_scraper(),
        "Web Researcher": test_web_researcher(),
        "Query Generation": test_query_generation(),
        "Research & Format": test_research_and_format(),
        "Chunking & Embedding": test_chunking_and_embedding(),
    }
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    total = len(results)
    passed = sum(results.values())
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Web research feature is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Check the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())








