# 💰 Akili Pesa — Netlify Deployment Guide

## Hatua za Deploy kwenye Netlify

### 1. Pakia GitHub
```bash
git init
git add .
git commit -m "AkiliPesa initial deploy"
git remote add origin https://github.com/username/akili-pesa.git
git push -u origin main
```

### 2. Netlify Setup
1. Nenda [netlify.com](https://netlify.com) → "Add new site" → "Import from Git"
2. Chagua repo yako ya GitHub
3. Build settings zitajaza zenyewe kutoka `netlify.toml`

### 3. ⚠️ Weka API Key (MUHIMU SANA)
1. Netlify Dashboard → Site → **Environment variables**
2. Add variable:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** API key yako kutoka [console.anthropic.com](https://console.anthropic.com)
3. Redeploy site

### 4. Matatizo Yaliyorekebishwa
- ✅ CORS — API inaitwa kupitia Netlify Function (backend), si browser moja kwa moja
- ✅ API Key iko salama kwenye server-side tu, haionekani kwa mtumiaji
- ✅ `window.storage` imebadilishwa na `localStorage` fallback (inafanya kazi nje ya Claude.ai)

## Muundo wa Files
```
akili-pesa/
├── src/
│   ├── main.jsx          ← React entry point
│   └── AkiliPesa.jsx     ← App yako (ilirekebishwa)
├── netlify/
│   └── functions/
│       └── claude.js     ← API proxy (mpya!)
├── index.html
├── package.json
├── vite.config.js
└── netlify.toml
```
