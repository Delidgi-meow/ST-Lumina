# Lumina Search

**Ambient Glow UI** — creative AI search extension for SillyTavern.

Search for anything: settings, plot twists, character arcs, world-building ideas — and inject the AI-generated results directly into your prompt.


## Features

- **Creative AI Search** — type any query, get AI-generated creative suggestions
- **Prompt Injection** — one-click inject results into the active prompt at configurable depth/position
- **Separate API** — uses its own OpenAI-compatible endpoint, doesn't interfere with main chat API
- **Search History** — recent queries saved as clickable chips
- **Copy to Clipboard** — quick copy result text
- **Slash Command** — `/lumina <query>` for inline use in STscript
- **Mobile Responsive** — bottom sheet on mobile, side panel on desktop
- **Ctrl+Enter** to send query


## Configuration

Click the toggle button, then expand **Settings**:

| Setting | Description |
|---------|-------------|
| **API URL** | OpenAI-compatible endpoint (e.g., `http://127.0.0.1:5001/v1`) |
| **API Key** | Bearer token (optional, depends on your API) |
| **Model** | Model name (leave empty for auto) |
| **System Prompt** | Instructions for the search AI |
| **Inject Position** | Before or after chat messages |
| **Depth** | Injection depth (0 = end of prompt) |
| **Max Tokens** | Response length limit |
| **Temperature** | Creativity level (0.0–2.0) |

### Compatible APIs

Any OpenAI-compatible `/v1/chat/completions` endpoint:
- **Ollama** (http://127.0.0.1:11434/v1)
- **text-generation-webui** (http://127.0.0.1:5000/v1)
- **LM Studio** (http://127.0.0.1:1234/v1)
- **KoboldCpp** with OpenAI wrapper
- **OpenAI / OpenRouter** with API key
- **Any vLLM / llama.cpp server**

## Usage

1. Click the Lumina icon to open the panel
2. Type your creative question
3. Click **Generate** (or Ctrl+Enter)
4. Read the result
5. Click **Inject** to add it to the next prompt
6. Or **Copy** to clipboard

The injection wraps the result in a context note that tells the AI to use it creatively.

## Slash Command

```
/lumina What dark secret could this character reveal?
```

Returns the AI response as text — can be piped into other STscript commands.
