# Multi-Agent System Guide

## Overview

The Gabee system now supports multiple agents, each with their own persona and knowledge base. Currently, two agents are available:

1. **Loïc-Gabee** - Your personal digital twin
2. **Victor Hugo** - The renowned French writer's digital twin

## How to Use

### Switching Agents

1. Use the **"Select Agent"** dropdown at the top of the page
2. Choose between "LOÏC-GABEE" or "VICTOR HUGO"
3. The interface will update to show the selected agent's name and title
4. Conversation history is cleared when switching agents

### Adding Books to Victor Hugo Agent

1. Place book files (`.txt` or `.md` format) in:
   ```
   data/victor_hugo/books/
   ```

2. Click the **"🔄 RELOAD KNOWLEDGE BASE"** button in the app

3. The agent will index all books and be able to reference them in conversations

### Adding Contributions

Contributions are saved to the appropriate directory based on the currently selected agent:
- **Loïc-Gabee**: `data/contributions/`
- **Victor Hugo**: `data/victor_hugo/contributions/`

## File Structure

```
data/
├── persona_loic.md                    # Loïc's persona
├── contributions/                      # Loïc's contributions
├── [other Loïc data files]
│
└── victor_hugo/
    ├── persona_victor_hugo.md         # Victor Hugo's persona
    ├── books/                          # Victor Hugo's books (place here)
    │   └── README.md
    └── contributions/                  # Victor Hugo's contributions
```

## Technical Details

### Knowledge Bases

Each agent has its own isolated knowledge base:
- **Loïc**: Indexed from `data/` (excluding persona file)
- **Victor Hugo**: Indexed from `data/victor_hugo/` (excluding persona file)

### Agent Configuration

Agents are configured in `agent.py`:
```python
AGENT_CONFIGS = {
    "loic": {
        "persona_path": "data/persona_loic.md",
        "knowledge_base_id": "loic",
        "name": "LOÏC-GABEE",
        "title": "GABEE // LOÏC TWIN CONSOLE"
    },
    "victor_hugo": {
        "persona_path": "data/victor_hugo/persona_victor_hugo.md",
        "knowledge_base_id": "victor_hugo",
        "name": "VICTOR HUGO",
        "title": "GABEE // VICTOR HUGO CONSOLE"
    }
}
```

## Adding New Agents

To add a new agent:

1. Create a new directory in `data/` (e.g., `data/new_agent/`)
2. Create a persona file (e.g., `data/new_agent/persona_new_agent.md`)
3. Add configuration to `AGENT_CONFIGS` in `agent.py`
4. Update `rag_multi.py` to initialize the new knowledge base
5. The agent will appear in the dropdown automatically

## Notes

- Each agent maintains separate conversation history
- Knowledge bases are built on app startup
- Use "Reload Knowledge Base" after adding new files
- Books and contributions are automatically indexed when reloaded

