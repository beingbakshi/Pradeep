# Pradeep Electronics - Inventory & POS

A React-based inventory management and point-of-sale system for electrical retail stores.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for production
```bash
npm run build
```

### 4. Preview production build
```bash
npm run preview
```

## Deploy to Vercel

Vercel auto-detects Vite projects. Deploy in one of these ways:

### Option A: Vercel CLI
```bash
npm i -g vercel
vercel
```
Follow the prompts to link and deploy.

### Option B: GitHub + Vercel Dashboard
1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your repo
4. Vercel will auto-detect Vite — click **Deploy**

### Option C: Drag & Drop
1. Run `npm run build`
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Drag the `dist` folder onto the deploy area

## Demo Login

- **Owner:** owner@pradeepelec.com
- **Manager:** rahul@pradeepelec.com  
- **Sales:** amit@pradeepelec.com  
- **Password:** password123 (all users)

## Google Sheet sync (Sales + Products)

This project can optionally append **Sales** and **Product changes** to Google Sheets using a **Google Apps Script Web App**.

### 1) Create the Web App endpoint

- Open a Google Sheet (any name).
- Go to **Extensions → Apps Script**.
- Copy/paste the code from `google-apps-script.gs`.
- **Deploy → New deployment → Web app**
  - **Execute as**: Me
  - **Who has access**: Anyone (or Anyone with the link)
- Copy the **Web App URL** (ends with `/exec`).

### 2) Configure your app

Create a `.env` file (you can copy `.env.example`) and set:

```bash
VITE_GOOGLE_SHEETS_SYNC_ENABLED=true
VITE_GOOGLE_SHEETS_WEBAPP_URL=YOUR_WEB_APP_URL_HERE
```

Restart `npm run dev` after changing `.env`.
