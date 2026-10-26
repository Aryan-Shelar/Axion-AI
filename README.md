# AXION AI — React + Vite Frontend

A React single-page frontend for the AXION AI brand-governance dashboard. It uses Vite, Tailwind CSS, and client-side demo data.

## Requirements

- Node.js 18 or newer (Node.js 20 LTS is a good choice)
- npm
- VS Code (optional, recommended)

## Run locally on Windows

1. Extract this project folder.
2. Open the `axion-ai` folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Run:

```bash
npm install
npm run dev
```

5. Open the local URL printed by Vite, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

The production files are created in `dist/`.

## Main files

- `src/App.jsx` — application shell, demo sign-in, navigation and shared state
- `src/pages.jsx` — dashboard and feature pages
- `src/ui.jsx` — reusable UI components
- `src/data.js` — sample brand rules, scans, audit events and analysis logic
- `src/index.css` — Tailwind entry point and responsive global styles
- `src/ParticleBackground.jsx` — animated background
- `tailwind.config.js` — theme colors and font family

## Important limitations

- Sign-in is a **frontend demo only**. It accepts a valid-looking email and a password of at least six characters; it does not authenticate users securely.
- Dashboard content and changes are stored in React state. They are not persisted to a database and may reset when the page is refreshed.
- The content scanner uses local rule-based checks in `src/data.js`; it does not call an AI model or backend yet.
- Do not enter real passwords or sensitive business information into this demo.

## Next production steps

1. Connect a backend API and database for accounts, scans, guidelines and audit logs.
2. Implement real authentication and role-based permissions.
3. Add persistent storage and server-side validation.
4. Connect an AI service for content analysis, with secrets kept on the backend.
5. Test the layout on mobile, tablet and desktop after each UI change.
