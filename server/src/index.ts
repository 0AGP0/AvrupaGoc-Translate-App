import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { extractTextFromPDF, createTranslatedPDF } from './services/pdfService';
import { translateText } from './services/translationService';

// Environment variables
dotenv.config();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer configuration for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Sadece PDF dosyaları yüklenebilir.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Routes
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenemedi.' });
    }

    console.log('Dosya yüklendi:', req.file.path);
    const originalText = await extractTextFromPDF(req.file.path);
    console.log('Metin çıkarıldı, çeviri başlıyor...');
    const translatedText = await translateText(originalText);
    console.log('Çeviri tamamlandı');

    // İşlem tamamlandıktan sonra geçici dosyayı sil
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'İşlem başarılı.',
      originalText,
      translatedText
    });
  } catch (error) {
    console.error('Hata:', error);
    // Hata durumunda da dosyayı silmeye çalış
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    res.status(500).json({ 
      error: 'Sunucu hatası',
      details: errorMessage
    });
  }
});

// PDF indirme endpoint'i
app.post('/api/download-pdf', async (req, res) => {
  try {
    console.log('PDF indirme isteği alındı');
    const { originalText, translatedText } = req.body;

    console.log('Gelen veriler:', {
      originalTextLength: originalText?.length || 0,
      translatedTextLength: translatedText?.length || 0
    });

    if (!originalText || !translatedText) {
      console.error('Eksik veri:', { originalText: !!originalText, translatedText: !!translatedText });
      return res.status(400).json({ error: 'Orijinal metin ve çeviri gerekli' });
    }

    console.log('PDF oluşturma başlıyor...');
    const pdfBuffer = await createTranslatedPDF(originalText, translatedText);
    console.log('PDF oluşturuldu, boyut:', pdfBuffer.length);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=translated.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    console.log('PDF gönderiliyor...');
    res.send(pdfBuffer);
    console.log('PDF gönderildi');
  } catch (error) {
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : {
      name: 'UnknownError',
      message: 'Bilinmeyen bir hata oluştu',
      stack: undefined
    };

    console.error('PDF indirme hatası:', error);
    console.error('Hata detayları:', errorDetails);

    res.status(500).json({ 
      error: 'PDF oluşturulurken bir hata oluştu',
      details: errorDetails.message,
      errorType: errorDetails.name
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Hata:', err);
  res.status(500).json({
    error: 'Sunucu hatası',
    details: err.message || 'Bilinmeyen bir hata oluştu'
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server ${port} portunda çalışıyor.`);
});