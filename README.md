# Metfone Express Agent Contract Filler — Next.js + Supabase on Vercel

Full-stack TypeScript / Next.js implementation of the Metfone Express Agent Contract Filler, connected to **Supabase** for persistence and ready to deploy on **Vercel**.

## 1. Features
- **Server-Side Rendered (SSR)** using Next.js App Router (`web/app/page.tsx`).
- **Postgres on Supabase**:
  - `branches`: Branches table with director names (Khmer & Latin) and auto-incrementing contract running numbers.
  - `agents`: Party B database with automatic transliteration, phone/ID normalization, and Excel/CSV import & export.
  - `contracts`: Generated contract history and metadata.
  - `settings`: Per-template digit style settings (`khmer` or `latin`).
  - Storage bucket `contracts`: Stores generated `.docx` and `.pdf` files.
- **Word (.docx) Generation on Serverless Node.js**:
  - Uses `docxtemplater` + `pizzip` with original template assets (`new_agreement_template.docx` and `old_agreement_template.docx`).
  - All tags, fonts, tables, checkboxes (☑/☐), and embedded imagery preserved.
- **PDF Export**:
  - Supports external PDF converter API (e.g., Gotenberg or ConvertAPI) via `PDF_CONVERTER_URL` environment variable.
- **Red & Cream Theme**: Follows the `#E2424A` red and `#F3E8D2` white/cream design without emojis.

## 2. Environment Variables for Vercel

In your Vercel Project Settings > **Environment Variables**, add:


## 3. Local Development

```bash
cd web
npm install
npm run dev
```
Open `http://localhost:3000`.

## 4. Deploying to Vercel

```bash
cd web
vercel
```
Or push the repository to GitHub and import the `web` root directory in the Vercel Dashboard.
