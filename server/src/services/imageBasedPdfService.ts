import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import pdfParse from 'pdf-parse';

/**
 * PDF'e çeviri ekleyen fonksiyon - basitleştirilmiş yaklaşım
 */
export async function createImageBasedTranslatedPDF(
  pdfPath: string,
  translatedText: string
): Promise<Buffer> {
  try {
    console.log('Görüntü tabanlı PDF çevirisi başlatılıyor...');
    
    // PDF dosyasını oku
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Standart font yükle
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Orijinal PDF'ten metin çıkar
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;
    
    // Metni satırlara ayır
    const originalLines = extractedText.split('\n').filter(line => line.trim());
    const translatedLines = translatedText.split('\n').filter(line => line.trim());
    
    console.log(`Orijinal metin satır sayısı: ${originalLines.length}`);
    console.log(`Çevrilmiş metin satır sayısı: ${translatedLines.length}`);
    
    // Çeviri satırlarını sayfa sayısına göre böl
    const pageCount = pdfDoc.getPageCount();
    console.log(`PDF dosyası ${pageCount} sayfa içeriyor`);
    
    const linesPerPage = Math.ceil(translatedLines.length / pageCount);
    
    // Her sayfaya çevirileri ekle
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      
      // Bu sayfa için çeviri satırlarını al
      const startIdx = i * linesPerPage;
      const endIdx = Math.min(startIdx + linesPerPage, translatedLines.length);
      const pageTranslations = translatedLines.slice(startIdx, endIdx);
      
      // Çevirilerin başlayacağı konum - sağ taraf
      const startX = width * 0.55;
      const startY = height - 50;
      const lineHeight = 15;
      
      // Arka plan çiz - çevirilerin arka planı için yarı saydam beyaz
      page.drawRectangle({
        x: startX - 10,
        y: 20,
        width: width - startX,
        height: height - 40,
        color: rgb(1, 1, 1) // Beyaz
      });
      
      // Başlık ekle
      page.drawText("ALMANCA ÇEVİRİ", {
        x: startX,
        y: startY,
        size: 14,
        font: font,
        color: rgb(0, 0, 0.7) // Koyu mavi
      });
      
      // Çevirileri ekle
      for (let j = 0; j < pageTranslations.length; j++) {
        // Satır çok uzunsa kısalt
        let line = pageTranslations[j];
        if (line.length > 60) {
          line = line.substring(0, 57) + '...';
        }
        
        page.drawText(line, {
          x: startX,
          y: startY - ((j + 2) * lineHeight), // +2 başlıktan sonra boşluk için
          size: 10,
          font: font,
          color: rgb(0, 0, 0.5) // Mavi
        });
        
        // Sayfadan taşmayı önle
        if (startY - ((j + 3) * lineHeight) < 30) {
          break;
        }
      }
    }
    
    // PDF'i kaydet
    const modifiedPdfBytes = await pdfDoc.save();
    console.log('PDF çevirisi tamamlandı');
    
    return Buffer.from(modifiedPdfBytes);
  } catch (error) {
    console.error('PDF çevirme hatası:', error);
    throw new Error(`PDF çevrilemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
  }
} 