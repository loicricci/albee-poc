# 🎙️ Voice Features Guide

## Overview

Gabee now includes comprehensive voice features for every Avee/Agent, powered by OpenAI's Whisper (STT) and TTS APIs.

## Two Main Features

### 1. **AI-Generated Profile from Voice** (30-second intro)
Quickly create an Avee profile by recording a 30-second voice introduction. AI will generate:
- **Persona** - Detailed personality, communication style, values, and boundaries
- **Bio** - Public-facing 1-2 sentence description
- **Display Name** - Extracted or suggested name
- **Handle Suggestion** - URL-friendly username

### 2. **Voice Chat Features**
- **Voice Input (STT)** - Record voice messages that are transcribed to text
- **Voice Output (TTS)** - Listen to AI responses with natural-sounding speech

---

## 🎯 Feature 1: AI Profile Generation from Voice

### How to Use

1. **Navigate to Agent Editor**
   ```
   /my-agents/[your-agent-handle]
   ```

2. **Find the Voice Profile Generation Card**
   - Located at the top of the editor
   - Purple/pink gradient card with microphone icon
   - Click to expand if collapsed

3. **Record Your Introduction**
   - Click "Start Recording"
   - Speak for 20-30 seconds about yourself:
     - Who you are
     - What you do
     - Your personality traits
     - Your interests and values
     - How you communicate
   - Click "Stop Recording" when done

4. **AI Processing**
   - Whisper transcribes your speech
   - GPT-4o analyzes your intro
   - Generates persona, bio, and display name

5. **Review & Apply**
   - Review the generated profile
   - Click "Apply This Profile" to use it
   - Or click "Discard" to try again

6. **Save Changes**
   - After applying, scroll down
   - Click "Save Persona" and "Save Details"

### Backend Endpoints Used

```bash
POST /avees/{avee_id}/generate-profile-from-voice
Content-Type: multipart/form-data
Body: audio file (webm/mp3/m4a/wav/ogg)

Response:
{
  "ok": true,
  "avee_id": "uuid",
  "transcript": "...",
  "language": "en",
  "updated_fields": {
    "persona": "...",
    "bio": "...",
    "display_name": "..."
  },
  "suggested_handle": "..."
}
```

### Tips for Best Results

✅ **Good practices:**
- Speak clearly and naturally
- Mention your personality traits explicitly
- Talk about what makes you unique
- Include topics you care about
- Describe your communication style

❌ **Avoid:**
- Background noise
- Speaking too fast
- Being too vague ("I'm nice")
- Reading from a script robotically

### Example Intro

> "Hi, I'm Sarah, a software engineer who loves building tools that help people. I'm curious, detail-oriented, and I value clear communication. I tend to be friendly but direct - I'll tell you what I think but always with kindness. I'm passionate about AI, web development, and teaching. In my free time, I read sci-fi and hike. I like to keep things practical and solution-focused."

---

## 🗣️ Feature 2: Voice Chat (Input & Output)

### Voice Input (Speech-to-Text)

#### How to Use

1. **Open Chat with an Agent**
   - Click "Chat" on any agent
   - Chat modal opens

2. **Click Microphone Button**
   - Located next to the send button
   - Microphone icon turns blue when clicked

3. **Record Your Question**
   - Speak your question (up to 60 seconds)
   - Click "Stop Recording" when done

4. **Automatic Transcription**
   - Your speech is transcribed to text
   - Text appears in the input field
   - Edit if needed, then send

#### Backend Endpoint

```bash
POST /voice/transcribe
Content-Type: multipart/form-data
Body: audio file

Response:
{
  "ok": true,
  "transcription": "...",
  "language": "en",
  "duration": 5.2
}
```

### Voice Output (Text-to-Speech)

#### How to Use

1. **Chat with an Agent**
   - Send a message and get a response

2. **Hover Over Assistant Response**
   - A "Listen" button appears below

3. **Click "Listen"**
   - AI response is converted to natural speech
   - Audio plays automatically
   - Button changes to "Stop"

4. **Stop Playback**
   - Click "Stop" button
   - Or start another audio (auto-stops previous)

#### Available Voices

The TTS uses OpenAI's `alloy` voice by default. Backend supports:
- `alloy` - Neutral, balanced (default)
- `echo` - Male, clear
- `fable` - British accent, storytelling
- `onyx` - Deep male voice
- `nova` - Female, energetic
- `shimmer` - Soft female voice

#### Backend Endpoint

```bash
POST /chat/tts
Content-Type: application/json
Body: { "text": "...", "voice": "alloy" }

Response: audio/mpeg (mp3 stream)
```

---

## 🏗️ Technical Architecture

### Frontend Components

#### `VoiceRecorder.tsx`
Reusable voice recording component with:
- MediaRecorder API integration
- Real-time recording timer
- Max duration enforcement
- Browser microphone permission handling
- Visual feedback (pulsing animation)

**Props:**
```typescript
type VoiceRecorderProps = {
  onRecordingComplete: (audioBlob: Blob) => void;
  maxDuration?: number; // seconds (default 30)
  className?: string;
};
```

#### `ChatModal.tsx` - Voice Features
- Voice input button (microphone icon)
- Voice recorder modal
- Transcription loading state
- TTS playback buttons on messages
- Audio player management

#### Agent Editor - Voice Profile Generation
- Collapsible voice generation card
- Recording interface
- Profile preview
- Apply/discard actions

### Backend Services

#### `voice_service.py`
Core voice processing module:

```python
async def transcribe_audio(audio_file: UploadFile) -> dict
def generate_profile_from_transcript(transcript: str) -> dict
def text_to_speech(text: str, voice: str = "alloy") -> bytes
def text_to_speech_hd(text: str, voice: str = "alloy") -> bytes
```

#### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/voice/transcribe` | POST | Transcribe audio to text |
| `/voice/generate-profile` | POST | Generate profile from voice (no save) |
| `/avees/{id}/generate-profile-from-voice` | POST | Generate & update Avee profile |
| `/chat/tts` | POST | Convert text to speech |
| `/chat/{conv_id}/tts` | POST | Convert message to speech |

### Database Schema

Voice-related fields added in migration `005_voice_features.sql`:

```sql
-- Avees table
ALTER TABLE avees ADD COLUMN voice_sample_url TEXT;
ALTER TABLE avees ADD COLUMN preferred_tts_voice VARCHAR(20) DEFAULT 'alloy';
ALTER TABLE avees ADD COLUMN voice_generated_at TIMESTAMPTZ;

-- Voice transcriptions tracking (analytics)
CREATE TABLE voice_transcriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  avee_id UUID,
  audio_duration INTEGER,
  transcription_text TEXT NOT NULL,
  detected_language VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎨 UI/UX Design Decisions

### Voice Profile Generation Card
- **Placement**: Top of agent editor (most important for setup)
- **Color**: Purple/pink gradient (distinctive from other sections)
- **Collapsible**: Doesn't clutter interface after use
- **Clear Instructions**: Step-by-step guide visible
- **Preview**: Shows all generated content before applying

### Chat Voice Features
- **Microphone Button**: Always visible next to send button
- **Non-intrusive**: Doesn't replace text input, enhances it
- **Hover-activated TTS**: Appears only on hover to reduce clutter
- **Visual Feedback**: Loading spinners, recording animations
- **Stop Controls**: Easy to cancel at any point

### Recording UX
- **Timer Display**: Shows elapsed time and max duration
- **Pulsing Animation**: Visual feedback that recording is active
- **Error Handling**: Clear messages for permission errors
- **Audio Waveform**: (Future) Real-time visualization

---

## 🔐 Security & Privacy

### Microphone Permissions
- Browser requests permission on first use
- Clear error messages if denied
- Audio never stored client-side
- Temporary server-side storage only

### Audio Processing
- Audio files deleted after transcription
- No persistent audio storage (unless explicitly saved as `voice_sample_url`)
- OpenAI API calls use secure HTTPS
- Audio data encrypted in transit

### Rate Limiting
- Consider adding rate limits for voice endpoints
- Prevent abuse of OpenAI API

---

## 💰 Cost Considerations

### OpenAI API Costs (as of Dec 2024)

**Whisper (Speech-to-Text):**
- $0.006 per minute of audio
- 30-second intro = $0.003
- 100 profiles = $0.30

**GPT-4o (Profile Generation):**
- ~$0.005 per 1K input tokens
- ~$0.015 per 1K output tokens
- Profile generation ≈ $0.01-0.02 per profile

**TTS (Text-to-Speech):**
- Standard (tts-1): $0.015 per 1K characters
- HD (tts-1-hd): $0.030 per 1K characters
- 200-word response ≈ $0.002-0.004

**Example Usage:**
- 1,000 voice profiles = ~$20-30
- 10,000 voice messages = ~$60
- 10,000 TTS playbacks = ~$20-40

---

## 🚀 Future Enhancements

### Voice Cloning (Custom TTS)
- Use voice sample to create custom TTS voice
- Each Avee speaks with owner's actual voice
- Requires ElevenLabs or similar service

### Real-time Voice Chat
- WebRTC streaming
- Live STT + LLM + TTS pipeline
- Sub-second latency

### Voice Commands
- "Hey Gabee" wake word
- Intent detection
- Direct actions (create agent, search, etc.)

### Multi-language Support
- Detect language from recording
- Generate profiles in user's language
- Multi-lingual TTS

### Voice Analytics
- Track voice usage metrics
- Measure engagement improvement
- A/B test voice vs text

### Advanced TTS Options
- Emotion/tone control
- Speed adjustment
- Pitch variation
- Multiple voices per agent

---

## 🐛 Troubleshooting

### "Microphone Access Required" Error
**Solution:**
- Check browser permissions: Settings → Privacy → Microphone
- Ensure HTTPS (required for microphone access)
- Try different browser

### Transcription Fails
**Solution:**
- Check audio quality (no heavy noise)
- Ensure audio is under 25MB
- Verify OpenAI API key is set
- Check backend logs for errors

### TTS Doesn't Play
**Solution:**
- Check browser audio settings
- Ensure audio isn't muted
- Try different browser
- Check network connection

### Profile Generation is Too Generic
**Solution:**
- Record a longer, more detailed intro
- Be more specific about personality traits
- Mention unique characteristics
- Try recording again with different content

---

## 📊 Testing Checklist

### Manual Testing

#### Voice Profile Generation
- [ ] Can record 30-second audio
- [ ] Recording stops at max duration
- [ ] Transcription appears correctly
- [ ] Persona is generated and displayed
- [ ] Apply button updates agent fields
- [ ] Save buttons persist changes

#### Voice Input (Chat)
- [ ] Microphone button is visible
- [ ] Can start/stop recording
- [ ] Transcription populates input field
- [ ] Can edit transcribed text
- [ ] Can send transcribed message

#### Voice Output (Chat)
- [ ] Listen button appears on assistant messages
- [ ] TTS plays audio
- [ ] Can stop playback
- [ ] Multiple messages don't overlap
- [ ] Audio quality is clear

### Error Cases
- [ ] Microphone permission denied
- [ ] Network error during transcription
- [ ] Audio file too large
- [ ] Invalid audio format
- [ ] Empty recording

---

## 🎓 User Guidance

### Best Practices for Voice Profiles

**Be Authentic:**
> Don't try to sound professional or rehearsed. Your natural speaking style is what makes the AI persona unique.

**Include Personality:**
> Mention traits like "I'm enthusiastic about..." or "I tend to be analytical and methodical..."

**Talk About Values:**
> What matters to you? What boundaries do you have? This helps the AI maintain consistency.

**Mention Knowledge Areas:**
> "I know a lot about web development and startups" helps the AI understand your expertise.

### When to Use Voice vs Text

**Use Voice Input When:**
- You're on mobile
- Typing is inconvenient
- You want to be expressive
- You have a complex question

**Use Text Input When:**
- You need precise wording
- Including code or technical terms
- Privacy concerns (voice in public)
- Editing is important

---

## 🔗 Related Documentation

- [AI_ENHANCEMENTS.md](./AI_ENHANCEMENTS.md) - GPT-4o, streaming, context management
- [AGENT_FOLLOWING_SYSTEM.md](./AGENT_FOLLOWING_SYSTEM.md) - Agent discovery and social features
- [PRODUCTION_ROADMAP.md](./PRODUCTION_ROADMAP.md) - Deployment and scaling
- [backend/voice_service.py](./backend/voice_service.py) - Voice processing implementation
- [frontend/src/lib/upload.ts](./frontend/src/lib/upload.ts) - Voice API client functions

---

## 📝 Summary

Voice features make Gabee more accessible, expressive, and engaging:

1. **30-second voice intro** creates complete AI profiles instantly
2. **Voice input** makes chatting hands-free and natural
3. **Voice output** brings AI responses to life with speech

These features are built on OpenAI's industry-leading Whisper (STT) and TTS models, ensuring high quality and reliability.

**Next Steps:**
1. Try creating an agent with voice profile generation
2. Test voice chat with your agent
3. Gather user feedback on voice quality
4. Consider implementing voice analytics
5. Explore advanced features (voice cloning, real-time)

---

**Questions or Issues?**
Check the backend logs at `/backend/main.py` and frontend console for debugging. API docs available at `http://localhost:8000/docs`







