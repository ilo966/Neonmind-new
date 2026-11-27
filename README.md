# Neonmind AI — Redesigned UI

A clean, minimalistic, mobile-responsive AI interface built with modular design tokens, smooth transitions, Markdown rendering, syntax-highlighted code blocks, chat history sidebar, and a settings modal.

## Structure
- `index.html` — Semantic layout (sidebar, topbar, chat scroll area, input dock, settings modal)
- `css/tokens.css` — Centralized dark-mode color, spacing, radius, and typography tokens
- `css/styles.css` — Component and responsive layout styles
- `js/app.js` — State management, Markdown/code-block renderer, and `sendToAIProvider()` integration hook

## Connecting Your Existing Backend
1. Open **Settings** in the UI and enter your API Endpoint URL & API Key, **or**
2. Edit `sendToAIProvider(messages, model)` inside `js/app.js` to call your existing API wrapper.