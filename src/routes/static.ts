import express, { Router } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Locate static directory (prefer dist/web, fallback to src/web)
let webDir = path.resolve(process.cwd(), 'dist/web');
if (!fs.existsSync(webDir)) {
  webDir = path.resolve(process.cwd(), 'src/web');
}

router.use(express.static(webDir));

// Fallback to index.html for SPA routes
router.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/v1') || req.originalUrl.startsWith('/v1beta') || req.originalUrl.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(webDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Web management interface not found. Please build the project.');
});

export default router;
