import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { extractTextFromPDF, createTranslatedPDF, translatePdfInPlace } from '../services/pdfService';
import translateText from '../services/translationService';
import { createImageBasedTranslatedPDF } from '../services/imageBasedPdfService';

// Multer ayarları
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Uploads dizini yoksa oluştur
    const uploadDir = path.join(__dirname, '../../uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Sadece PDF dosyaları
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Sadece PDF dosyaları yüklenebilir!') as any);
    }
  }
});

const router = express.Router();

/**
 * PDF dosyasını alıp içeriğini çıkaran ve çeviren endpoint
 */
router.post('/extract-translate-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi!' });
    }

    const filePath = req.file.path;
    const targetLanguage = req.body.targetLanguage || 'DE'; // Varsayılan olarak Almanca
    
    console.log(`PDF dosyası alındı: ${filePath}`);
    console.log(`Hedef dil: ${targetLanguage}`);
    
    // PDF'den metni çıkar
    const extractedText = await extractTextFromPDF(filePath);
    console.log(`PDF'den metin çıkarıldı, uzunluk: ${extractedText.length}`);
    
    // Metni DeepL API ile çevir
    const translatedText = await translateText(extractedText, targetLanguage);
    console.log(`Metin çevirildi, çevrilmiş metin uzunluğu: ${translatedText.length}`);
    
    // İşlem tamamlandıktan sonra geçici dosyayı sil
    fs.unlinkSync(filePath);
    
    // Sonucu döndür
    res.json({
      originalText: extractedText,
      translatedText: translatedText
    });
  } catch (error) {
    console.error('PDF işleme hatası:', error);
    res.status(500).json({ error: `PDF işlenirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}` });
  }
});

/**
 * Çevrilen metinden PDF oluşturan endpoint
 */
router.post('/generate-pdf', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { originalText, translatedText } = req.body;
    
    if (!originalText || !translatedText) {
      return res.status(400).json({ error: 'Orijinal metin ve çevrilmiş metin gereklidir!' });
    }
    
    console.log('PDF oluşturma isteği alındı');
    console.log(`Orijinal metin uzunluğu: ${originalText.length}`);
    console.log(`Çevrilmiş metin uzunluğu: ${translatedText.length}`);
    
    // PDF oluştur
    const pdfBuffer = await createTranslatedPDF(originalText, translatedText);
    
    // PDF'i döndür
    res.contentType('application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF oluşturma hatası:', error);
    res.status(500).json({ error: `PDF oluşturulurken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}` });
  }
});

/**
 * Orijinal PDF formatını koruyarak çeviri yapan endpoint
 */
router.post('/translate-pdf-inplace', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi!' });
    }

    const filePath = req.file.path;
    const translatedText = req.body.translatedText;
    
    if (!translatedText) {
      return res.status(400).json({ error: 'Çevrilmiş metin gereklidir!' });
    }
    
    console.log(`Orijinal formatta çeviri için PDF dosyası alındı: ${filePath}`);
    console.log(`Çevrilmiş metin uzunluğu: ${translatedText.length}`);
    
    // PDF dosyasını oku
    const pdfBuffer = fs.readFileSync(filePath);
    
    // PDF'i orijinal formatını koruyarak çevir
    const translatedPdfBuffer = await translatePdfInPlace(pdfBuffer, translatedText);
    
    // İşlem tamamlandıktan sonra geçici dosyayı sil
    fs.unlinkSync(filePath);
    
    // PDF'i döndür
    res.contentType('application/pdf');
    res.send(translatedPdfBuffer);
  } catch (error) {
    console.error('PDF çevirme hatası:', error);
    res.status(500).json({ error: `PDF çevrilirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}` });
  }
});

/**
 * YENİ: Görüntü tabanlı PDF çevirisi yapan endpoint
 */
router.post('/translate-pdf-image-based', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi!' });
    }

    const filePath = req.file.path;
    const translatedText = req.body.translatedText;
    
    if (!translatedText) {
      return res.status(400).json({ error: 'Çevrilmiş metin gereklidir!' });
    }
    
    console.log(`Görüntü tabanlı çeviri için PDF dosyası alındı: ${filePath}`);
    console.log(`Çevrilmiş metin uzunluğu: ${translatedText.length}`);
    
    // PDF'ten görüntüler oluştur ve üzerine çeviri ekle
    const translatedPdfBuffer = await createImageBasedTranslatedPDF(filePath, translatedText);
    
    // İşlem tamamlandıktan sonra geçici dosyayı sil
    fs.unlinkSync(filePath);
    
    // PDF'i döndür
    res.contentType('application/pdf');
    res.send(translatedPdfBuffer);
  } catch (error) {
    console.error('Görüntü tabanlı PDF çevirme hatası:', error);
    res.status(500).json({ error: `PDF çevrilirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}` });
  }
});

export default router; 