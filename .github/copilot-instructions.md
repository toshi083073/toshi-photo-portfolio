# Copilot Instructions for AI Agents

## Project Overview
- This is an Astro-based photography portfolio site. Content is sourced from both local markdown/JPG files and (optionally) a Strapi backend.
- The main app is in `toshi-photo-portfolio/`. Key folders:
  - `public/photos/`: Raw photo files (JPGs)
  - `content/photos/`: Markdown files for photo metadata (frontmatter)
  - `content/posts/`: Blog post markdown
  - `src/lib/data.ts`: Data access layer (reads local files or Strapi)
  - `src/pages/`, `src/components/`, `src/layouts/`: Astro UI code

## Data Flow & Architecture
- **Photo and post data** is loaded via functions in `src/lib/data.ts`:
  - If `DATA_SOURCE=markdown` (default):
    - Photos: Scans `public/photos/` for images, overlays metadata from `content/photos/*.md` if present.
    - Posts: Reads `content/posts/*.md`.
  - If `DATA_SOURCE=strapi`: Fetches from Strapi API (`STRAPI_URL`).
- All URLs for images and assets are normalized with the site `BASE` (for GitHub Pages compatibility).
- EXIF data is extracted from images using `exifr`.

## Developer Workflows
- **Install dependencies:** `npm install` (run in `toshi-photo-portfolio/`)
- **Start dev server:** `npm run dev`
- **Build for production:** `npm run build`
- **Preview build:** `npm run preview`
- **Astro CLI:** `npm run astro ...`
- **Add new photos:** Place JPGs in `public/photos/`. Optionally add a matching `.md` in `content/photos/` for metadata.
- **Add new posts:** Add `.md` files to `content/posts/`.

## Project Conventions
- All photo slugs are derived from filenames (lowercase, no extension).
- Metadata in markdown (`.md`) files overrides EXIF and filename-derived data.
- Use the `withBase()` utility for any asset URLs to ensure correct paths.
- Data access is always via exported async functions in `src/lib/data.ts`.
- No direct file system access in UI components—always use the data layer.

## External Integrations
- [exifr](https://github.com/MikeKovarik/exifr) for EXIF extraction
- [gray-matter](https://github.com/jonschlinkert/gray-matter) for markdown frontmatter
- Optional: Strapi headless CMS (set `DATA_SOURCE=strapi` and `STRAPI_URL`)

## Examples
- To get all photos: `await listPhotos()` from `src/lib/data.ts`
- To get a single post: `await getArticleBySlug(slug)`

## References
- See `src/lib/data.ts` for all data access patterns and conventions.
- See `README.md` for basic Astro project commands.

---
If you are unsure about a workflow or convention, check `src/lib/data.ts` and the `README.md` first.
