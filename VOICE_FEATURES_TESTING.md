# Voice Features Testing Guide

## Quick Start Testing

### Prerequisites
```bash
# 1. Ensure backend is running
cd backend
uvicorn main:app --reload --port 8000

# 2. Ensure frontend is running
cd frontend
npm run dev

# 3. Verify environment variables
# backend/.env should have:
OPENAI_API_KEY=sk-...

# frontend/.env.local should have:
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

### Test Scenario 1: Voice Profile Generation

**Steps:**
1. Navigate to `http://localhost:3000/my-agents`
2. Create a new agent (or select existing)
3. Click on agent to open editor
4. Expand "AI Profile Generation from Voice" card (purple card at top)
5. Click "Start Recording"
6. Speak for 20-30 seconds:
   ```
   "Hi, I'm [name], a [profession] who loves [interests]. 
   I'm [personality traits]. I value [values]. 
   I tend to be [communication style]. 
   I'm passionate about [topics]."
   ```
7. Click "Stop Recording"
8. Wait for transcription and generation (~5-10 seconds)
9. Review generated profile:
   - Check transcript accuracy
   - Review persona detail
   - Verify bio makes sense
   - Confirm display name
10. Click "Apply This Profile"
11. Verify fields are populated:
    - Display Name field
    - Bio field
    - Persona textarea
12. Click "Save Details" and "Save Persona"

**Expected Results:**
- ✅ Recording works smoothly
- ✅ Transcript is accurate (90%+ word accuracy)
- ✅ Persona is 400-800 words
- ✅ Bio is 1-2 sentences
- ✅ Display name is appropriate
- ✅ Fields populate correctly
- ✅ Save succeeds

**Common Issues:**
- Microphone permission denied → Check browser settings
- Transcription fails → Check OPENAI_API_KEY
- Profile too generic → Record more detailed intro
- Network error → Check backend is running

---

### Test Scenario 2: Voice Input in Chat

**Steps:**
1. Navigate to `http://localhost:3000/my-agents`
2. Click "Chat" on any agent
3. Click microphone button (next to send button)
4. Speak a question:
   ```
   "What are the key benefits of using RAG 
   for AI applications?"
   ```
5. Click "Stop Recording"
6. Wait for transcription (~2-3 seconds)
7. Verify text appears in input field
8. Edit if needed (test editing)
9. Click send button
10. Wait for streaming response

**Expected Results:**
- ✅ Microphone button is visible
- ✅ Recording interface appears
- ✅ Can record audio
- ✅ Transcription populates input
- ✅ Can edit transcribed text
- ✅ Can send message
- ✅ Response streams normally

**Edge Cases to Test:**
- Very short recording (< 2 seconds)
- Very long recording (> 60 seconds - should stop)
- Background noise
- Different accents
- Technical terminology

---

### Test Scenario 3: Voice Output (TTS)

**Steps:**
1. Chat with agent (from Test Scenario 2)
2. Wait for assistant response
3. Hover over assistant message
4. Look for "Listen" button below message
5. Click "Listen" button
6. Audio should play
7. While playing, click "Stop" button
8. Start another message's audio
9. Verify previous audio stops

**Expected Results:**
- ✅ Listen button appears on hover
- ✅ Audio loads quickly
- ✅ Audio plays with good quality
- ✅ Can stop playback
- ✅ Starting new audio stops previous
- ✅ Loading spinner shows during load

**Voice Quality Checks:**
- Clear pronunciation
- Natural intonation
- Appropriate speed
- No artifacts or glitches

---

## API Testing (Backend)

### Test Voice Transcription API

```bash
# Record a test audio file (use your voice recorder app)
# Save as test_audio.webm or test_audio.mp3

# Test transcription
curl -X POST http://localhost:8000/voice/transcribe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "audio=@test_audio.webm"

# Expected response:
{
  "ok": true,
  "transcription": "Your transcribed text...",
  "language": "en",
  "duration": 5.2
}
```

### Test Profile Generation API

```bash
# Generate profile from voice
curl -X POST http://localhost:8000/voice/generate-profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "audio=@test_audio.webm"

# Expected response:
{
  "ok": true,
  "transcript": "...",
  "language": "en",
  "profile": {
    "persona": "...",
    "bio": "...",
    "display_name": "...",
    "suggested_handle": "..."
  }
}
```

### Test TTS API

```bash
# Generate speech from text
curl -X POST http://localhost:8000/chat/tts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test of text to speech.", "voice": "alloy"}' \
  --output test_output.mp3

# Play the audio
open test_output.mp3  # macOS
# or
xdg-open test_output.mp3  # Linux
# or
start test_output.mp3  # Windows
```

---

## Performance Testing

### Voice Profile Generation
- **Target:** < 10 seconds total time
  - Transcription: ~2-5 seconds
  - GPT-4o generation: ~3-7 seconds
  - File upload/download: ~1 second

### Voice Input (STT)
- **Target:** < 5 seconds for 30-second audio
  - Upload: ~1 second
  - Whisper transcription: ~2-4 seconds
  - Display: instant

### Voice Output (TTS)
- **Target:** < 3 seconds to start playback
  - Request: ~1 second
  - TTS generation: ~1-2 seconds
  - Audio load: ~0.5 seconds

---

## Browser Compatibility Testing

### Desktop Browsers
- [x] Chrome 90+ (recommended)
- [x] Firefox 88+
- [x] Safari 14+
- [x] Edge 90+

### Mobile Browsers
- [x] Chrome Mobile (Android)
- [x] Safari Mobile (iOS)
- [ ] Firefox Mobile
- [ ] Samsung Internet

### Features to Test Per Browser
- Microphone permission flow
- MediaRecorder API support
- Audio playback
- UI responsiveness
- Recording quality

---

## Security Testing

### Test Permission Handling
1. Deny microphone permission
   - Should show clear error message
   - Should not crash
   - Should allow retry

2. Revoke permission during recording
   - Should stop recording gracefully
   - Should clean up resources

### Test Input Validation
1. Upload very large audio file (> 25MB)
   - Should reject with clear message
2. Upload invalid file type
   - Should reject with error
3. Send empty audio
   - Should handle gracefully

### Test Authentication
1. Try API without token
   - Should return 401 Unauthorized
2. Try API with expired token
   - Should return 401 and prompt login

---

## Load Testing

### Simulate Concurrent Voice Requests

```python
# load_test.py
import asyncio
import aiohttp

async def test_voice_profile(session, audio_file, token):
    url = "http://localhost:8000/voice/generate-profile"
    data = aiohttp.FormData()
    data.add_field('audio', open(audio_file, 'rb'))
    
    async with session.post(url, data=data, headers={
        'Authorization': f'Bearer {token}'
    }) as response:
        return await response.json()

async def main():
    token = "YOUR_TOKEN"
    audio_file = "test_audio.webm"
    
    async with aiohttp.ClientSession() as session:
        tasks = [
            test_voice_profile(session, audio_file, token)
            for _ in range(10)  # 10 concurrent requests
        ]
        results = await asyncio.gather(*tasks)
        print(f"Completed {len(results)} requests")

if __name__ == "__main__":
    asyncio.run(main())
```

**Target Metrics:**
- 10 concurrent requests complete in < 30 seconds
- No failures or timeouts
- Memory usage stays stable

---

## Accessibility Testing

### Screen Reader Compatibility
- Test with NVDA (Windows)
- Test with JAWS (Windows)
- Test with VoiceOver (macOS/iOS)
- Test with TalkBack (Android)

**Check:**
- All buttons have aria-labels
- Recording status is announced
- Transcription result is announced
- Playback status is announced

### Keyboard Navigation
- Tab through voice recorder controls
- Space to start/stop recording
- Enter to submit transcribed text
- Escape to close voice recorder

---

## Error Recovery Testing

### Test Scenario: Network Interruption
1. Start voice recording
2. Turn off network
3. Stop recording
4. Verify error message
5. Turn on network
6. Retry - should work

### Test Scenario: Backend Down
1. Stop backend server
2. Try to use voice feature
3. Verify user-friendly error
4. Start backend
5. Retry - should work

### Test Scenario: OpenAI API Error
1. Set invalid OPENAI_API_KEY
2. Try voice profile generation
3. Verify error is caught and displayed
4. Fix API key
5. Retry - should work

---

## Regression Testing

After any code changes, verify:

### Core Functionality
- [ ] Can still create agents normally
- [ ] Regular text chat works
- [ ] Image upload works
- [ ] Training documents work
- [ ] Permissions work

### Voice Features
- [ ] Voice profile generation works
- [ ] Voice input works
- [ ] Voice output (TTS) works
- [ ] All buttons are clickable
- [ ] No console errors

---

## Monitoring & Analytics

### Metrics to Track

**Usage:**
- Voice profiles created per day
- Voice messages sent per day
- TTS playbacks per day
- Success rate for each feature

**Performance:**
- Average transcription time
- Average TTS generation time
- Error rate by feature

**Quality:**
- User satisfaction (surveys)
- Feature retention rate
- Voice vs text usage ratio

### Logging

Check backend logs for:
```bash
# Search for voice-related logs
grep "voice" backend/logs/*.log

# Look for errors
grep "ERROR.*voice" backend/logs/*.log

# Check API response times
grep "POST /voice" backend/logs/access.log
```

---

## Sign-off Checklist

Before marking voice features as production-ready:

### Functionality
- [x] Voice profile generation works end-to-end
- [x] Voice input (STT) works in chat
- [x] Voice output (TTS) works in chat
- [x] Error handling is robust
- [x] UI is intuitive

### Performance
- [ ] Response times meet targets
- [ ] No memory leaks
- [ ] Handles concurrent requests
- [ ] Mobile performance is acceptable

### Quality
- [ ] Code reviewed
- [ ] No linting errors
- [ ] Documentation complete
- [ ] User guide written

### Security
- [ ] Authentication required
- [ ] Input validation in place
- [ ] File size limits enforced
- [ ] No sensitive data exposed

### User Experience
- [ ] Clear instructions provided
- [ ] Error messages are helpful
- [ ] Loading states are visible
- [ ] Success feedback is given

---

## Next Steps After Testing

1. **Gather User Feedback**
   - Beta test with 10-20 users
   - Collect qualitative feedback
   - Track usage metrics

2. **Optimize Based on Data**
   - Identify slow endpoints
   - Improve error handling
   - Refine UI based on feedback

3. **Add Advanced Features**
   - Voice cloning
   - Real-time voice chat
   - Multi-language support
   - Custom TTS voices per agent

4. **Scale Infrastructure**
   - Add Redis caching for TTS
   - Implement queue for heavy processing
   - CDN for audio files
   - Rate limiting

---

## Troubleshooting Guide

### Issue: "Microphone not found"
**Solution:** Check browser settings, ensure HTTPS, try different browser

### Issue: Transcription is gibberish
**Solution:** Speak clearly, reduce background noise, check audio quality

### Issue: TTS doesn't play
**Solution:** Check audio isn't muted, verify network, try different browser

### Issue: Profile generation too slow
**Solution:** Check OpenAI API status, verify API key, check network latency

### Issue: "Invalid audio format"
**Solution:** Use supported formats (webm, mp3, m4a, wav, ogg), convert if needed

---

**Testing Complete?** ✅

Mark all checkboxes above and document any issues in GitHub Issues or your project tracker.


