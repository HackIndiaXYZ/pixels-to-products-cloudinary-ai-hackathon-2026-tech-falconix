# Cloudinary AI Media Pipeline

Automated media pipeline: **Upload → AI Analysis → Moderation → Processing → Metadata → Search → Optimization → Delivery**, powered by Cloudinary.

## Features

- 📤 Signed upload via Cloudinary Upload API (images & video, `resource_type: auto`)
- 🏷️ AI auto-tagging (Google Tagging / Imagga add-ons) + object detection (COCO v2)
- 🛡️ Content moderation (AWS Rekognition add-on) with auto quarantine on rejection
- ✂️ Content-aware smart cropping (`crop: auto, gravity: auto`)
- 🖼️ AI background removal add-on
- 🎬 Responsive image & video transformations with `f_auto` + `q_auto`
- 🗂️ Structured metadata written back as Cloudinary `context`, plus mirrored in MongoDB
- 🔎 Smart Search API querying by tag, category, moderation status, dimensions
- ⚡ Async webhook consumer so uploads never block on AI/moderation processing

## Project structure

```
cloudinary-ai-media/
├── config/
│   ├── cloudinary.js       # Cloudinary SDK config
│   └── db.js               # MongoDB connection
├── models/
│   └── Media.js            # Mongoose schema for processed media
├── routes/
│   ├── upload.js           # POST /api/upload, GET/DELETE /api/media
│   ├── webhook.js          # POST /api/webhook (Cloudinary async notifications)
│   └── search.js           # GET /api/search
├── services/
│   ├── transform.js        # Smart crop / bg removal / responsive URL builders
│   └── metadata.js         # Structured context write-back helpers
├── public/
│   └── index.html          # Minimal demo console (upload + search + gallery)
├── server.js                # App entry point
├── package.json
├── .env.example
└── .gitignore
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — from the [Cloudinary console](https://console.cloudinary.com)
- `MONGODB_URI` — local or hosted MongoDB (e.g. MongoDB Atlas)
- `CLOUDINARY_WEBHOOK_URL` — a publicly reachable URL pointing at `/api/webhook`. For local dev, use [ngrok](https://ngrok.com):
  ```bash
  ngrok http 3000
  # then set CLOUDINARY_WEBHOOK_URL=https://<subdomain>.ngrok.io/api/webhook
  ```

### 3. Enable required Cloudinary add-ons

These are **metered add-ons**, not default features — enable what you need from your Cloudinary console's Add-ons page before running:

| Add-on | Purpose | Used for |
|---|---|---|
| Google AI Vision Tagging or Imagga Auto Tagging | AI auto-tagging | `categorization` param |
| Cloudinary AI Content Analysis (COCO v2) | Object detection | `detection: coco_v2` |
| AWS Rekognition AI Moderation (or WebPurify) | Inappropriate content detection | `moderation` param |
| Cloudinary AI Background Removal | Background removal | `effect: background_removal` |

If an add-on isn't enabled, that specific param is silently ignored or the upload will error depending on plan — check the Cloudinary dashboard for confirmation after test uploads.

### 4. Run

```bash
npm run dev   # with nodemon
# or
npm start
```

Visit `http://localhost:3000` for the demo console, or use the API directly.

## API Reference

### `POST /api/upload`
`multipart/form-data` — fields: `file` (required), `userId` (optional).

Returns immediately with `status: "processing"`; AI tagging/moderation results land later via webhook.

### `POST /api/webhook`
Cloudinary calls this automatically once async AI/moderation finishes. Not meant to be called directly. Verifies `x-cld-signature` in production.

### `GET /api/media?userId=&page=&limit=`
List stored media records.

### `GET /api/media/:publicId`
Fetch one record plus a ready-to-use delivery URL bundle (thumbnail, responsive sizes, bg-removed).

### `DELETE /api/media/:publicId?resourceType=image`
Deletes from both Cloudinary and MongoDB.

### `GET /api/search?tag=&category=&minWidth=&approvedOnly=true&query=`
Wraps the Cloudinary Search API, scoped to approved content by default.

## Notes on production hardening

- Put `express.raw()` **before** `express.json()` for the webhook route only (already done in `server.js`) — Cloudinary's signature check needs the exact raw bytes.
- Set `NODE_ENV=production` to enforce webhook signature verification (`routes/webhook.js`).
- Consider queuing (e.g. BullMQ + Redis) between webhook receipt and DB writes if you expect high upload volume.
- Add authentication/authorization middleware to `/api/upload` and `/api/media` — this project intentionally ships unauthenticated for clarity.
- For rejected content, `webhook.js` currently just tags it `rejected`; uncomment the `cloudinary.uploader.destroy` line to auto-delete instead of quarantine.
