# ⚡ CORRECT BACKEND RESTART COMMAND

## The Issue
The backend imports fail because Python can't find the modules when running from the root directory.

## ✅ Solution 1: Run from backend directory

```bash
cd /Users/loicricci/gabee-poc/backend
source ../venv/bin/activate
uvicorn main:app --reload --port 8000
```

## ✅ Solution 2: Use full paths from root

```bash
cd /Users/loicricci/gabee-poc
cd backend && source ../venv/bin/activate && uvicorn main:app --reload --port 8000
```

## ✅ Solution 3: One-liner with full venv path

```bash
cd /Users/loicricci/gabee-poc/backend && /Users/loicricci/gabee-poc/venv/bin/python -m uvicorn main:app --reload --port 8000
```

## Why This Happens

The imports in `backend/main.py` use relative imports like:
```python
from models import Document, DocumentChunk
```

These only work when running from the `backend` directory, where Python can find `models.py`.

## Copy-Paste Ready Command

```bash
cd /Users/loicricci/gabee-poc/backend && ../venv/bin/python -m uvicorn main:app --reload --port 8000
```

This will:
1. Navigate to the backend directory
2. Use the venv Python
3. Start uvicorn
4. Enable auto-reload
5. Run on port 8000

The backend should start successfully and the auto-post endpoints will be available! 🚀

