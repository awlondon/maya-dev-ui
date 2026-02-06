# Maya Dev UI

This repository contains a simple prototype for an embeddable development sandbox designed for integration with a research preview application. It allows users to edit and render HTML/CSS/JS in an isolated iframe, either embedded in a host page or popped out into a separate window.


## Project structure

```
maya-dev-ui/
├── index.html         # Entry point for the dev iframe
├── styles.css         # Minimal styling for the dev iframe
├── app.js             # Core logic for running and resetting code and handling messages
├── host-sample.html   # Example host page showing how to embed and control the iframe
└── README.md          # This file
```

## Running locally

You can preview the dev iframe and host integration by opening `host-sample.html` in a local web server. For example:

```bash
python -m http.server -d maya-dev-ui 8080
```

Then navigate to http://localhost:8080/host-sample.html in your browser.

## GitHub Pages setup

To publish this UI on GitHub Pages and map it to `dev.sesame.com`:

1. Create a new public GitHub repository (e.g. `maya-dev-ui`).
2. Push the contents of this folder to the `main` branch.
3. In the repository settings, enable **GitHub Pages**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/root` (the root of the repository)
4. After saving, GitHub will provide a pages URL like `https://yourusername.github.io/maya-dev-ui`. Configure your DNS and any reverse proxies to point `dev.sesame.com` at that pages URL.

## Embedding in a host application

The `host-sample.html` file demonstrates how a host application can embed the dev iframe, provide UI controls for docking/popping out, and communicate via `window.postMessage`.

Key integration points:

- Use `<iframe id="dev-iframe" src="https://dev.sesame.com"></iframe>` to embed.
- Use `window.open('https://dev.sesame.com', 'MayaDevTools', ...)` to pop out the dev UI.
- Send updates to the dev iframe via `postMessage` with `{ type: 'UPDATE_FROM_HOST', payload: yourData }`.
- Receive code execution results via `window.addEventListener('message', ...)` and handle messages where `type === 'RUN_CODE_RESULT'`.

Refer to the inline comments in `host-sample.html` for further details.
