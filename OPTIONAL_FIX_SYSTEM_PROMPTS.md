# Optional Fix: System Prompts Override

## ⚠️ Potential Issue Identified

In `backend/main.py` (line 1403-1407), the system prompts might be overriding Coluche's authentic language:

```python
layer_prompt = {
    "public": "You are the public version of this person. Be factual, helpful, and safe.",
    "friends": "You are speaking as a trusted friend. Be warm, honest, and respectful.",
    "intimate": "You are a close, intimate digital presence. Be personal, deep, and respectful.",
}[allowed]
```

The words **"safe"** and **"respectful"** might be making the AI too polite, even with the Coluche persona.

---

## 🔧 OPTIONAL FIX

### If Coluche is STILL too polite after testing

Replace lines 1403-1407 in `backend/main.py` with:

```python
layer_prompt = {
    "public": "You are this person. Follow your PERSONA instructions exactly, including language style and tone. Do not sanitize or censor yourself.",
    "friends": "You are speaking as a friend. Follow your PERSONA instructions exactly, including authentic language.",
    "intimate": "You are in intimate conversation. Follow your PERSONA instructions exactly, being fully authentic.",
}[allowed]
```

### Why This Helps

The new prompts:
- ✅ Tell the AI to follow PERSONA exactly
- ✅ Don't use words like "safe" or "respectful" that might censor
- ✅ Explicitly say "Do not sanitize or censor yourself"
- ✅ Emphasize "authentic language"

---

## 📋 When to Apply This Fix

### Test First
1. Chat with Coluche using current setup
2. Say "Salut Michel"
3. **If he says "Salut enfoiré!"** → Don't need this fix
4. **If he's still too polite** → Apply this fix

### How to Apply

1. Open `backend/main.py`
2. Go to line 1403
3. Replace the `layer_prompt` dictionary
4. Restart backend server:
   ```bash
   # Backend will auto-reload if using --reload
   # Or manually restart
   ```
5. Test again

---

## 🧪 Testing After Fix

Try the same tests:

```
User: "Salut Michel"
Expected: "Salut enfoiré!" (with fix, should be MORE likely)

User: "Que penses-tu des politiques?"
Expected: Vulgar, angry response (should be STRONGER)
```

---

## ⚖️ Pros and Cons

### Without Fix (Current)
**Pros:**
- Safer for general agents
- Less risk of offensive content
- Might already work due to strong persona

**Cons:**
- Might tone down Coluche
- "Safe" and "respectful" could override vulgarity

### With Fix
**Pros:**
- Maximum authenticity
- Persona instructions followed exactly
- No censorship

**Cons:**
- Less control over offensive content
- Requires stronger persona to prevent issues

---

## 💡 Recommendation

**Try WITHOUT the fix first.** The persona is very strong (7,300 chars with explicit instructions).

**Apply the fix ONLY IF** Coluche is still too polite after testing with the current setup.

---

## 📝 Alternative: Per-Agent System Prompts

Even better long-term solution: Make system prompts configurable per agent.

In the future, you could:
1. Add `system_prompt_style` field to `avees` table
2. Different styles: "authentic" (for Coluche), "safe" (for others)
3. Choose prompt based on agent's style

But for now, the global fix above should work if needed.

---

**Test first, fix only if needed!**













