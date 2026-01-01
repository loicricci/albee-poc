#!/usr/bin/env python3
"""
Generate an image based on Elton John's persona and a trending topic
"""
import os
import sys
from datetime import datetime
from pathlib import Path
import requests
from dotenv import load_dotenv

# Load environment
load_dotenv("backend/.env", override=True)

# Elton John's persona summary
ELTON_PERSONA = """
Sir Elton John - Iconic musician known for:
- Flamboyant, theatrical style with outrageous costumes and famous glasses
- Warm, witty, and authentic personality
- Passionate about music, LGBTQ+ activism, and AIDS Foundation work
- British charm and humor
- Over 300 million records sold worldwide
- Legendary stage presence with pianos and extravagant performances
"""

# Trending topic from December 28, 2025
TRENDING_TOPIC = "Stranger Things Season 5 mid-season release on Netflix"

# Image generation prompt combining Elton's persona with the trending topic
IMAGE_PROMPT = """
Create a vibrant, theatrical image of Elton John in his signature flamboyant style performing 
on a levitating neon-lit piano in the Upside Down dimension from Stranger Things. 
He's wearing one of his iconic outrageous sequined costumes with his famous oversized glasses, 
but with a supernatural twist - the glasses reflect the eerie red lightning of the Upside Down. 
His piano is surrounded by floating vines and particles, while Demogorgons in the shadowy 
background appear mesmerized by his performance. The scene combines his legendary stage presence 
with the supernatural atmosphere of Stranger Things, bathed in dramatic neon pinks, purples, 
and the eerie red glow of the Upside Down. Photorealistic, cinematic lighting, highly detailed.
"""

def generate_image_with_openai(prompt: str, size: str = "1024x1024") -> str:
    """Generate image using OpenAI DALL-E API"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")
    
    print("🎨 Generating image with OpenAI DALL-E...")
    print(f"📝 Prompt: {prompt[:100]}...")
    
    # Using DALL-E 3 API
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": size,
        "quality": "hd",  # Use HD quality for best results
        "style": "vivid"  # Vivid style for more dramatic, theatrical images
    }
    
    response = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers=headers,
        json=data,
        timeout=60
    )
    
    if response.status_code != 200:
        raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
    
    result = response.json()
    image_url = result["data"][0]["url"]
    print(f"✅ Image generated successfully!")
    
    return image_url


def download_and_save_image(image_url: str, output_dir: str = "generated_images") -> str:
    """Download image from URL and save locally"""
    # Create output directory if it doesn't exist
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"eltonjohn_strangerthings_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    
    print(f"💾 Downloading image...")
    
    # Download the image
    response = requests.get(image_url, timeout=30)
    if response.status_code != 200:
        raise Exception(f"Failed to download image: {response.status_code}")
    
    # Save to file
    with open(filepath, 'wb') as f:
        f.write(response.content)
    
    print(f"✅ Image saved to: {filepath}")
    return filepath


def main():
    """Main execution"""
    print("=" * 80)
    print("🎹 ELTON JOHN x STRANGER THINGS - AI IMAGE GENERATOR")
    print("=" * 80)
    
    print("\n📋 Profile Summary:")
    print(ELTON_PERSONA)
    
    print(f"\n🔥 Trending Topic: {TRENDING_TOPIC}")
    
    print("\n🎨 Starting image generation...")
    print("=" * 80)
    
    try:
        # Generate image
        image_url = generate_image_with_openai(IMAGE_PROMPT, size="1792x1024")  # Wide format for dramatic scene
        
        # Save image locally
        filepath = download_and_save_image(image_url)
        
        print("\n" + "=" * 80)
        print("✨ SUCCESS!")
        print("=" * 80)
        print(f"\n📍 Image Location: {os.path.abspath(filepath)}")
        print(f"🔗 Original URL (valid for ~1 hour): {image_url}")
        
        # Also save metadata
        metadata_file = filepath.replace('.png', '_metadata.txt')
        with open(metadata_file, 'w') as f:
            f.write(f"Elton John AI Generated Image\n")
            f.write(f"=" * 50 + "\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"Persona:\n{ELTON_PERSONA}\n\n")
            f.write(f"Trending Topic: {TRENDING_TOPIC}\n\n")
            f.write(f"Prompt:\n{IMAGE_PROMPT}\n\n")
            f.write(f"Original URL: {image_url}\n")
        
        print(f"📝 Metadata saved: {os.path.abspath(metadata_file)}")
        print("=" * 80)
        
        return filepath
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()


