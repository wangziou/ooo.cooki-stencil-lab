<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1VanuAQAZD0xemU7AaEombveccpVUMwA9

## Features
- **Smart Stencil Generation**: Convert images to stencils with 'Hollow' (Edge Detect) or 'Solid' (Adaptive Threshold) modes.
- **Customizable Processing**: Adjust threshold, noise reduction (detail level), and line thickness.
- **AI Art Advisor**: Built-in Gemini AI to suggest placement and style improvements.
- **Export Options**: Download as PNG, JPG, or print-ready PDF (A4).
- **Multi-Size Generation**: Automatically create sizing sheets with 3x, 6x, or 9x variants.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
   `npm run dev`

## Deployment

This project is configured to deploy to GitHub Pages using GitHub Actions.

1. Go to your repository **Settings** -> **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Select `gh-pages` branch (this branch is created automatically by the workflow after the first successful run).
4. Save.

The deployment workflow runs automatically on every push to the `main` branch.

### Troubleshooting
If you see a blank page after deployment:
1. Ensure `vite.config.ts` has the correct `base` path (should match your repository name).
2. Ensure a `.nojekyll` file exists in the `public/` directory (this prevents GitHub Pages from ignoring files starting with `_`).
3. Check the browser console (F12) for 404 errors.

