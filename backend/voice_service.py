"""
Voice Service for Gabee
Handles voice recording upload, transcription, and text-to-speech conversion.
"""

import uuid
import tempfile
import os
from pathlib import Path
from typing import Optional
from openai import OpenAI
from fastapi import UploadFile, HTTPException

client = OpenAI()


# Constants
MAX_AUDIO_SIZE_MB = 25  # OpenAI Whisper limit
ALLOWED_AUDIO_FORMATS = [
    "audio/mpeg",  # mp3
    "audio/mp4",   # m4a
    "audio/wav",
    "audio/webm",
    "audio/ogg",
]


async def transcribe_audio(audio_file: UploadFile) -> dict:
    """
    Transcribe audio file using OpenAI Whisper.
    
    Args:
        audio_file: FastAPI UploadFile object
        
    Returns:
        dict with keys: text (transcription), language, duration
    """
    # Validate file size
    file_size = 0
    content = await audio_file.read()
    file_size = len(content)
    
    if file_size > MAX_AUDIO_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"Audio file too large. Maximum size is {MAX_AUDIO_SIZE_MB}MB"
        )
    
    # Validate file type
    if audio_file.content_type not in ALLOWED_AUDIO_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid audio format. Allowed formats: {', '.join(ALLOWED_AUDIO_FORMATS)}"
        )
    
    # Save to temporary file for OpenAI API
    # (Whisper API requires a file path, not bytes)
    suffix = Path(audio_file.filename or "audio.mp3").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
        # Call OpenAI Whisper API
        with open(tmp_path, "rb") as audio:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio,
                response_format="verbose_json",  # includes language detection
            )
        
        return {
            "text": transcript.text,
            "language": getattr(transcript, "language", "unknown"),
            "duration": getattr(transcript, "duration", None),
        }
    
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def generate_profile_from_transcript(transcript: str) -> dict:
    """
    Generate an Avee profile (persona, bio, display_name) from voice transcript.
    
    Args:
        transcript: Text transcription of the voice recording
        
    Returns:
        dict with keys: persona, bio, display_name, suggested_handle
    """
    if not transcript or len(transcript.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Transcript too short. Please provide at least 20 characters of speech."
        )
    
    prompt = f"""You are analyzing a 30-second voice recording where someone introduces themselves to create their AI persona/agent profile. 

Here's what they said:
"{transcript}"

Based on this, generate a complete profile with:

1. **PERSONA** (400-800 words): A detailed first-person character description that captures:
   - Their communication style, tone, and personality traits
   - Their values, beliefs, and boundaries
   - Topics they're knowledgeable about
   - How they interact with others
   - Any unique quirks or characteristics
   Write this as if YOU are them speaking about yourself.

2. **BIO** (1-2 sentences): A concise third-person bio suitable for a public profile.

3. **DISPLAY_NAME**: Their preferred name (extract from transcript or suggest based on context).

4. **SUGGESTED_HANDLE**: A lowercase handle (no spaces, letters/numbers/underscores only).

Format your response as JSON:
{{
  "persona": "I am...",
  "bio": "Short bio here",
  "display_name": "Name",
  "suggested_handle": "username123"
}}

IMPORTANT: 
- Make the persona detailed and authentic based on their actual words
- Capture their unique voice and personality
- If they mention specific expertise or interests, emphasize that
- The persona should help an AI assistant mimic their style accurately"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",  # Use GPT-4o for better quality
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at analyzing speech patterns and creating authentic persona profiles. You extract personality, values, and communication style from transcripts."
                },
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,  # Some creativity but stay grounded
            max_tokens=1500,
        )
        
        import json
        result = json.loads(response.choices[0].message.content or "{}")
        
        # Validate required fields
        required_fields = ["persona", "bio", "display_name", "suggested_handle"]
        for field in required_fields:
            if field not in result or not result[field]:
                raise ValueError(f"Missing or empty field: {field}")
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate profile: {str(e)}"
        )


def text_to_speech(text: str, voice: str = "alloy") -> bytes:
    """
    Convert text to speech using OpenAI TTS.
    
    Args:
        text: Text to convert to speech
        voice: Voice to use (alloy, echo, fable, onyx, nova, shimmer)
        
    Returns:
        Audio bytes (mp3 format)
    """
    if not text or len(text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Empty text provided")
    
    if len(text) > 4096:
        raise HTTPException(
            status_code=400,
            detail="Text too long. Maximum 4096 characters for TTS."
        )
    
    valid_voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    if voice not in valid_voices:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid voice. Choose from: {', '.join(valid_voices)}"
        )
    
    try:
        response = client.audio.speech.create(
            model="tts-1",  # or tts-1-hd for higher quality
            voice=voice,
            input=text,
            response_format="mp3",
        )
        
        return response.content
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate speech: {str(e)}"
        )


def text_to_speech_hd(text: str, voice: str = "alloy") -> bytes:
    """
    Convert text to speech using OpenAI TTS HD (higher quality, slower).
    
    Args:
        text: Text to convert to speech
        voice: Voice to use (alloy, echo, fable, onyx, nova, shimmer)
        
    Returns:
        Audio bytes (mp3 format)
    """
    if not text or len(text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Empty text provided")
    
    if len(text) > 4096:
        raise HTTPException(
            status_code=400,
            detail="Text too long. Maximum 4096 characters for TTS."
        )
    
    valid_voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
    if voice not in valid_voices:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid voice. Choose from: {', '.join(valid_voices)}"
        )
    
    try:
        response = client.audio.speech.create(
            model="tts-1-hd",  # HD quality
            voice=voice,
            input=text,
            response_format="mp3",
        )
        
        return response.content
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate speech: {str(e)}"
        )

