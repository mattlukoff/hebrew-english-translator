# Hebrew to English Translator

## Overview
A web application that translates Hebrew text into clear, high-quality English using AI (OpenAI via Replit AI Integrations). Users can browse the Sefaria library or upload custom Hebrew text, then view translations in interlinear or side-by-side format with export options. Translation uses parallel batch processing for speed.

## Tech Stack
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + wouter routing
- **Backend**: Express.js API routes
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI (gpt-5-mini) via Replit AI Integrations
- **External API**: Sefaria public API for text retrieval

## Project Structure
- `client/src/pages/home.tsx` - Main page with text selection and translation display
- `client/src/components/` - All UI components
  - `sefaria-browser.tsx` - Browse entire Sefaria library with breadcrumb navigation
  - `file-upload.tsx` - Upload/paste custom Hebrew text
  - `translation-display.tsx` - Interlinear and side-by-side views
  - `translation-skeleton.tsx` - Loading state
  - `history-list.tsx` - Recent translation history
  - `header.tsx` / `theme-toggle.tsx` / `theme-provider.tsx` - Layout and theming
- `server/routes.ts` - API endpoints for Sefaria proxy, translation, and export
- `server/storage.ts` - Database operations for saved translations
- `server/db.ts` - Database connection
- `shared/schema.ts` - Drizzle schema and TypeScript types

## Key API Endpoints
- `GET /api/translations` - List saved translations
- `GET /api/sefaria/library` - Full Sefaria library index (cached 1hr)
- `GET /api/sefaria/index/:title` - Proxy Sefaria index metadata
- `GET /api/sefaria/shape/:title` - Get chapter/verse structure for a text
- `POST /api/translate/sefaria` - Translate Sefaria text (body: { ref, title } or { refs: string[], title } for multi-chapter)
- `POST /api/translate/custom` - Translate custom Hebrew text (body: { text, title })
- `POST /api/export/pdf` - Export translation as formatted text file

## Features
- Multi-chapter selection: Click chapters to toggle-select multiple, double-click to drill into verses
- Export: CSV (client-side), Text file (server-side), PDF (client-side via jspdf)
- Complex text support: Handles Sefaria texts with nested hierarchies (Tanya, Pri Etz Chaim, Sefer Etz Chaim, Zohar) including flat-shape fallback using index schema nodes for texts where the Shape API returns numeric arrays instead of titled sections

## Fonts
- Hebrew text: Frank Ruhl Libre, David Libre (serif)
- English text: Crimson Pro, Source Serif 4 (serif)
- UI: Inter (sans-serif)

## Database Schema
- `translations` table: id, title, source_ref, verses (JSONB), created_at

## Running
- `npm run dev` starts both frontend and backend on port 5000
- `npm run db:push` to push schema changes
