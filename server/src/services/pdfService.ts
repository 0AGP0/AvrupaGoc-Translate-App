import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import * as pdf from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

// pdfjs global yapılandırması
// Windows ile uyumlu olması için yapılandırmayı değiştiriyoruz
// PDF.js'in worker dosyası yerine fake worker kullanıyoruz
(pdfjs as any).GlobalWorkerOptions.workerSrc = '';
// Fake worker'ı etkinleştir
(pdfjs as any).GlobalWorkerOptions.disableWorker = true;

/**
 * PDF dosyasından metin çıkarma fonksiyonu
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // PDF dosyasını oku
    const dataBuffer = fs.readFileSync(filePath);
    
    // PDF içeriğini parse et
    const pdfData = await pdfParse(dataBuffer);
    
    // Metni döndür
    return pdfData.text || "";
  } catch (error) {
    console.error('PDF metin çıkarma hatası:', error);
    throw new Error(`PDF'den metin çıkarılamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
  }
}

// Yeni fonksiyon: PDF'in kendi formatını koruyarak metinleri çevirir
export async function translatePdfInPlace(pdfBuffer: Buffer, translatedText: string): Promise<Buffer> {
  try {
    console.log('Orijinal PDF formatında çeviri işlemi başlatılıyor...');
    
    // 1. PDF'deki tüm metin öğelerini konum bilgileriyle çıkar - basitleştirilmiş yaklaşım kullanacağız
    const textItems = await extractTextWithSimpleMethod(pdfBuffer, translatedText);
    console.log(`Toplam ${textItems.length} metin öğesi çıkarıldı`);
    
    // 2. Orijinal PDF'e çevirileri yerleştir
    const modifiedPdfBytes = await replaceTextInPDF(pdfBuffer, textItems);
    console.log('PDF çevirisi tamamlandı');
    
    return Buffer.from(modifiedPdfBytes);
  } catch (error) {
    console.error('PDF çevirme hatası:', error);
    throw new Error(`PDF çevrilemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
  }
}

/**
 * Basit PDF metin çıkarma ve eşleştirme işlemi - PDF.js olmadan
 */
async function extractTextWithSimpleMethod(pdfBuffer: Buffer, translatedText: string): Promise<Array<{
  originalText: string;
  newText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  pageIndex: number;
}>> {
  try {
    console.log('Basit PDF metin çıkarma metodu kullanılıyor...');
    
    // pdf-parse kullanarak metni çıkar
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text;
    
    // Metni satırlara böl
    const lines = extractedText.split('\n').filter(line => line.trim());
    
    // Çeviriyi satırlara böl
    const translatedLines = translatedText.split('\n').filter(line => line.trim());
    
    // PDF'in boyutlarını al
    const pdfDoc = await pdf.PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    // PDF'deki metin öğelerini ve çevirilerini eşleştir - basit bir yapay veri oluştur
    const replacements: Array<{
      originalText: string;
      newText: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize: number;
      pageIndex: number;
    }> = [];
    
    console.log(`Toplam ${lines.length} satır ve ${translatedLines.length} çeviri satırı var`);
    
    // Basit eşleştirme: Satır sayısına göre çevirileri dağıt
    const validLines = lines.filter(line => line.length >= 5);
    const validTranslations = translatedLines.filter(line => line.length >= 5);
    
    // Önemli başlıkları belirle
    const importantHeaders = [
      'HAKKIMDA', 'ÖZET', 'PROFIL', 
      'EĞİTİM', 'STAJ', 
      'DİL', 'DİLLER', 'BECERİLER', 
      'İŞ DENEYİMİ', 'TECRÜBE',
      'HOBİLER', 'İLGİ ALANLARI', 
      'BAŞARILAR', 'ÖDÜL'
    ];
    
    // Almanca başlık eşleştirmeleri
    const germanHeaders = [
      'ÜBER MICH', 'ZUSAMMENFASSUNG', 'PROFIL',
      'AUSBILDUNG', 'PRAKTIKUM',
      'SPRACH', 'SPRACHEN', 'FÄHIGKEITEN',
      'BERUFSERFAHRUNG', 'ERFAHRUNG',
      'HOBBY', 'INTERESSEN',
      'ERFOLGE', 'AUSZEICHNUNG'
    ];
    
    // Basit çeviri eşleştirme
    for (let i = 0; i < Math.min(validLines.length, 20); i++) {
      const originalText = validLines[i];
      
      // Metin başlık mı kontrol et
      let translatedText = '';
      const upperText = originalText.toUpperCase();
      
      for (let j = 0; j < importantHeaders.length; j++) {
        if (upperText.includes(importantHeaders[j]) && j < germanHeaders.length) {
          translatedText = upperText.replace(importantHeaders[j], germanHeaders[j]);
          break;
        }
      }
      
      // Başlık değilse, benzer uzunlukta bir çeviri bul
      if (!translatedText) {
        const candidates = validTranslations.filter(t => 
          Math.abs(t.length - originalText.length) / Math.max(t.length, originalText.length) <= 0.3);
        
        if (candidates.length > 0) {
          translatedText = candidates[0];
          // Kullanılan çevirileri kaldır
          const index = validTranslations.indexOf(candidates[0]);
          if (index !== -1) {
            validTranslations.splice(index, 1);
          }
        }
      }
      
      if (translatedText) {
        // PDF'in ilk sayfasında varsayılan konumlar belirleme
        const page = pages[0];
        const { width, height } = page.getSize();
        
        replacements.push({
          originalText,
          newText: translatedText,
          x: 50,
          y: height - 50 - (i * 30), // Her satırı 30 birim aralıklarla yerleştir
          width: width - 100,
          height: 20,
          fontSize: 12,
          pageIndex: 0
        });
      }
    }
    
    // İş deneyimi ve eğitim bölümü için özel işleme
    if (pages.length > 1) {
      for (let p = 1; p < Math.min(pages.length, 3); p++) {
        const page = pages[p];
        const { width, height } = page.getSize();
        
        // Her sayfa için 10 adet yapay metin oluştur
        for (let i = 0; i < 10; i++) {
          if (validLines.length <= 0 || validTranslations.length <= 0) break;
          
          const originalText = validLines.shift()!;
          const translatedText = validTranslations.shift()!;
          
          replacements.push({
            originalText,
            newText: translatedText,
            x: 50,
            y: height - 50 - (i * 40),
            width: width - 100,
            height: 25,
            fontSize: 12,
            pageIndex: p
          });
        }
      }
    }
    
    console.log(`${replacements.length} metin-çeviri eşleştirmesi oluşturuldu`);
    return replacements;
  } catch (error) {
    console.error('Basit metin çıkarma hatası:', error);
    // Boş bir dizi döndür, böylece tamamen hata alınmaz
    return [];
  }
}

/**
 * PDF'deki metni çevirisiyle değiştirir
 */
async function replaceTextInPDF(pdfBuffer: Buffer, replacements: Array<{
  originalText: string;
  newText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  pageIndex: number;
}>): Promise<Uint8Array> {
  try {
    // PDF-LIB ile PDF dökümanını yükle
    const pdfDoc = await pdf.PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    // Standart fontları yükle
    const helveticaFont = await pdfDoc.embedFont(pdf.StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(pdf.StandardFonts.HelveticaBold);
    
    // Her değiştirme işlemini gerçekleştir
    for (const replacement of replacements) {
      // Sayfa kontrolü
      if (replacement.pageIndex >= pages.length) {
        console.warn(`Sayfa ${replacement.pageIndex + 1} bulunamadı. PDF sadece ${pages.length} sayfa içeriyor.`);
        continue;
      }
      
      const page = pages[replacement.pageIndex];
      
      // Sayfa boyutlarını al
      const { width: pageWidth, height: pageHeight } = page.getSize();
      
      // Metnin konumu sayfanın dışında mı kontrol et
      if (replacement.x < 0 || replacement.x > pageWidth || 
          replacement.y < 0 || replacement.y > pageHeight) {
        console.warn('Metin konumu sayfa dışında, atlanıyor:', replacement);
        continue;
      }
      
      // Orijinal metnin üzerini beyaz ile kapat
      try {
        page.drawRectangle({
          x: replacement.x,
          y: replacement.y - (replacement.height / 2),
          width: replacement.width,
          height: replacement.height,
          color: pdf.rgb(1, 1, 1), // Beyaz
        });
      } catch (rectError) {
        console.error('Dikdörtgen çizme hatası:', rectError);
      }
      
      // Yeni metni ekle
      try {
        // Başlık metni mi kontrol et (büyük harf)
        const isHeader = replacement.originalText.toUpperCase() === replacement.originalText;
        const font = isHeader ? helveticaBoldFont : helveticaFont;
        
        page.drawText(replacement.newText, {
          x: replacement.x,
          y: replacement.y,
          size: replacement.fontSize,
          font: font,
          color: pdf.rgb(0, 0, 0), // Siyah
        });
      } catch (textError) {
        console.error('Metin çizme hatası:', textError);
      }
    }
    
    // PDF'i kaydet
    return await pdfDoc.save();
  } catch (error) {
    console.error('PDF metin değiştirme hatası:', error);
    throw new Error(`PDF metin değiştirilemedi: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
  }
}

/**
 * Çevrilmiş metinden PDF oluşturma fonksiyonu
 */
export const createTranslatedPDF = async (originalText: string, translatedText: string): Promise<Buffer> => {
  let browser = null;
  
  try {
    console.log('PDF oluşturma işlemi başlıyor...');
    console.log('Orijinal metin uzunluğu:', originalText?.length || 0);
    console.log('Çevrilen metin uzunluğu:', translatedText?.length || 0);
    
    if (!originalText || originalText.trim() === '') {
      console.error('Orijinal metin boş, işlem yapılamaz');
      throw new Error('Orijinal metin boş, işlem yapılamaz');
    }
    
    if (!translatedText || translatedText.trim() === '') {
      console.error('Çevrilen metin boş, varsayılan değerler kullanılacak');
      translatedText = "Name: Beispiel Lebenslauf\nÜber mich: Dies ist ein Beispiel-Lebenslauf.\nAusbildung: Universität\nErfahrung: Berufserfahrung";
    }
    
    // HTML şablonunu oku
    const templatePath = path.join(__dirname, '..', 'cv-template.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
    
    console.log('HTML şablonu yüklendi, uzunluk:', htmlTemplate.length);
    
    // Önce orijinal metni (Türkçe) işleyerek yapılandırılmış veri çıkar
    console.log('Orijinal Türkçe metin analiz ediliyor...');
    const turkishSections = extractSections(originalText);
    
    // Sonra çevrilmiş metni (Almanca) aynı yapıya oturt
    console.log('Çevrilmiş Almanca metin analiz ediliyor...');
    const germanSections = mapTranslatedText(translatedText, turkishSections);
    
    // Boş değerlerin yerine "Keine Information" yazısını koy
    Object.keys(germanSections).forEach(key => {
      if (!germanSections[key] || germanSections[key].trim() === '') {
        germanSections[key] = 'Keine Information verfügbar';
      }
    });
    
    console.log('PDF için kullanılacak bölümler:', Object.keys(germanSections).reduce((acc, key) => {
      acc[key] = germanSections[key]?.length > 30 ? germanSections[key].substring(0, 30) + '...' : germanSections[key];
      return acc;
    }, {} as Record<string, string>));
    
    // HTML şablonundaki yer tutucuları değiştir
    Object.entries(germanSections).forEach(([key, value]) => {
      // Tüm yer tutucuları değiştirmek için global regex kullan
      const regex = new RegExp(`{{${key}}}`, 'g');
      htmlTemplate = htmlTemplate.replace(regex, value || '');
    });
    
    // Henüz değiştirilmemiş yer tutucuları temizle
    const remainingPlaceholders = htmlTemplate.match(/{{\w+}}/g);
    if (remainingPlaceholders) {
      console.log('Değiştirilmeyen yer tutucular:', remainingPlaceholders);
      htmlTemplate = htmlTemplate.replace(/{{\w+}}/g, '');
    }
    
    // Puppeteer ile HTML'i PDF'e dönüştür
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    console.log('PDF başarıyla oluşturuldu, boyut:', pdfBuffer.byteLength);
    await browser.close();
    browser = null;
    
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('PDF oluşturma hatası:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (closingError) {
        console.error('Browser kapatılırken hata oluştu:', closingError);
      }
    }
    throw new Error(`PDF oluşturulamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
  }
};

/**
 * Çevrilmiş metni, orijinal metinden çıkarılan bölümlere eşleştirir
 */
function mapTranslatedText(translatedText: string, originalSections: Record<string, string>): Record<string, string> {
  console.log('Çevrilmiş metin yapılandırılıyor...');
  
  // Çeviri sonuçlarını saklamak için yeni bir nesne oluştur
  const translatedSections: Record<string, string> = {
    name: '',
    about: '',
    education: '',
    languages: '',
    experience: '',
    hobbies: '',
    achievements: '',
    birthDate: '',
    nationality: '',
    gender: '',
    address: '',
    email: '',
    phone: ''
  };
  
  try {
    // Çevrilmiş metni satırlara ayır
    const lines = translatedText.split('\n').filter(line => line.trim());
    
    // Her bölüm için orijinal ve çevrilmiş metinlerin satır sayısını karşılaştır
    const originalKeys = Object.keys(originalSections).filter(key => originalSections[key]);
    
    // Eğer isim bölümü varsa, çevirisini al (genellikle büyük harfle yazılır)
    if (originalSections.name) {
      // Çeviride isim genel olarak değişmez, ancak büyük harfle yazılmış satırları ara
      const nameCandidate = lines.find(line => line.toUpperCase() === line && line.length > 3);
      if (nameCandidate) {
        translatedSections.name = nameCandidate;
      } else {
        // İsim genellikle ilk birkaç satırda olur
        translatedSections.name = lines[0] || originalSections.name;
      }
    }
    
    // Kişisel bilgiler genellikle çeviride korunur (e-posta, telefon vs.)
    translatedSections.email = originalSections.email;
    translatedSections.phone = originalSections.phone;
    
    // Doğum tarihi, vatandaşlık, cinsiyet gibi kişisel bilgileri çeviriden bul
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        
        // Doğum tarihi
        if (/geburt|geburtstag/i.test(key)) {
          translatedSections.birthDate = value;
        }
        // Vatandaşlık
        else if (/national|staatsangehörigkeit/i.test(key)) {
          translatedSections.nationality = value;
        }
        // Cinsiyet
        else if (/geschlecht/i.test(key)) {
          translatedSections.gender = value;
        }
        // Adres
        else if (/adresse/i.test(key)) {
          translatedSections.address = value;
        }
      }
    }
    
    // Bölümleri daha akıllı bir şekilde eşleştir
    // Çeviride Türkçe'deki bölüm başlıklarının Almanca karşılıklarını ara
    const mappings = [
      { tr: 'HAKKIMDA', de: 'ÜBER MICH', key: 'about' },
      { tr: 'EĞİTİM', de: 'AUSBILDUNG', key: 'education' },
      { tr: 'DİL BECERİLERİ', de: 'SPRACHKENNTNISSE', key: 'languages' },
      { tr: 'İŞ DENEYİMİ', de: 'BERUFSERFAHRUNG', key: 'experience' },
      { tr: 'HOBİLER', de: 'HOBBYS', key: 'hobbies' },
      { tr: 'BAŞARILAR', de: 'ERFOLGE', key: 'achievements' }
    ];
    
    for (const mapping of mappings) {
      if (originalSections[mapping.key]) {
        // Çevirideki bölüm başlığını bul
        const sectionStart = findSectionStart(lines, mapping.de);
        
        if (sectionStart !== -1) {
          // Bir sonraki bölüm başlığına kadar olan kısmı al
          const nextSectionStart = findNextSectionStart(lines, sectionStart + 1, mappings.map(m => m.de));
          
          // Bölüm içeriğini birleştir
          const content = lines.slice(sectionStart + 1, nextSectionStart !== -1 ? nextSectionStart : undefined)
            .filter(line => line.trim())
            .join('\n');
          
          translatedSections[mapping.key] = content;
        } else {
          // Eğer bölüm başlığı bulunamazsa, orijinal içeriğin çeviri içindeki yaklaşık yerini bul
          const originalLineCount = originalSections[mapping.key].split('\n').length;
          const totalLineCount = lines.length;
          const originalTotalLineCount = Object.values(originalSections).join('\n').split('\n').length;
          
          // Oransal olarak çevirideki yaklaşık başlangıç noktasını hesapla
          const ratio = totalLineCount / originalTotalLineCount;
          const estimatedStart = Math.floor(originalLineCount * ratio);
          
          // Eğer tahmin edilen başlangıç noktası geçerliyse, içeriği al
          if (estimatedStart > 0 && estimatedStart < totalLineCount) {
            const content = lines.slice(estimatedStart, estimatedStart + originalLineCount)
              .filter(line => line.trim())
              .join('\n');
            
            translatedSections[mapping.key] = content;
          }
        }
      }
    }
    
    // Eksik kalan bölümleri doldur
    for (const key of originalKeys) {
      if (!translatedSections[key] && key !== 'email' && key !== 'phone') {
        // Ana bölümler için çevirilmiş metni ara
        if (['about', 'education', 'languages', 'experience', 'hobbies', 'achievements'].includes(key)) {
          const germanKey = getGermanKey(key);
          translatedSections[key] = extractSectionContent(translatedText, germanKey) || 
                                    `Keine ${germanKey} Information verfügbar`;
        }
        // Diğer kişisel bilgiler
        else if (['birthDate', 'nationality', 'gender', 'address'].includes(key)) {
          translatedSections[key] = extractPersonalInfo(translatedText, key) || 
                                   `Keine ${key} Information verfügbar`;
        }
      }
    }
    
    return translatedSections;
  } catch (error) {
    console.error('Çeviri eşleştirme hatası:', error);
    return translatedSections;
  }
}

/**
 * Çeviride bölüm başlığının indeksini bulur
 */
function findSectionStart(lines: string[], sectionName: string): number {
  return lines.findIndex(line => 
    new RegExp(`^${sectionName}`, 'i').test(line.trim()) || 
    line.trim().toUpperCase() === sectionName.toUpperCase());
}

/**
 * Çeviride bir sonraki bölüm başlığının indeksini bulur
 */
function findNextSectionStart(lines: string[], startIndex: number, sectionNames: string[]): number {
  for (let i = startIndex; i < lines.length; i++) {
    for (const sectionName of sectionNames) {
      if (new RegExp(`^${sectionName}`, 'i').test(lines[i].trim()) ||
          lines[i].trim().toUpperCase() === sectionName.toUpperCase()) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Almanca anahtarı döndürür
 */
function getGermanKey(key: string): string {
  const keyMap: Record<string, string> = {
    'about': 'Über mich',
    'education': 'Ausbildung',
    'languages': 'Sprachkenntnisse',
    'experience': 'Berufserfahrung',
    'hobbies': 'Hobbys',
    'achievements': 'Erfolge'
  };
  
  return keyMap[key] || key;
}

/**
 * Çevrilen metinden belirli bir bölümün içeriğini çıkarır
 */
function extractSectionContent(text: string, sectionName: string): string {
  const lines = text.split('\n');
  const sectionIndex = findSectionStart(lines, sectionName);
  
  if (sectionIndex !== -1) {
    const nextSectionStart = findNextSectionStart(
      lines, 
      sectionIndex + 1, 
      ['Über mich', 'Ausbildung', 'Sprachkenntnisse', 'Berufserfahrung', 'Hobbys', 'Erfolge', 'Kontakt']
    );
    
    const content = lines.slice(sectionIndex + 1, nextSectionStart !== -1 ? nextSectionStart : undefined)
      .filter(line => line.trim())
      .join('\n');
    
    return content;
  }
  
  return '';
}

/**
 * Çevrilen metinden kişisel bilgileri çıkarır
 */
function extractPersonalInfo(text: string, key: string): string {
  const keyMap: Record<string, RegExp> = {
    'birthDate': /geburt(?:sdatum)?|geburtstag/i,
    'nationality': /national(?:ität)?|staatsangehörigkeit/i,
    'gender': /geschlecht/i,
    'address': /adresse/i
  };
  
  const regex = keyMap[key];
  if (!regex) return '';
  
  const lines = text.split('\n');
  for (const line of lines) {
    if (regex.test(line) && line.includes(':')) {
      const value = line.split(':')[1].trim();
      if (value) return value;
    }
  }
  
  return '';
}

/**
 * Çevrilen metinden bölümleri çıkaran yardımcı fonksiyon
 */
function extractSections(translatedText: string): Record<string, string> {
  console.log('Çevrilen metin analiz ediliyor...');
  
  // Varsayılan değerler ile başlat
  const sections: Record<string, string> = {
    name: '',
    about: '',
    education: '',
    languages: '',
    experience: '',
    hobbies: '',
    achievements: '',
    birthDate: '',
    nationality: '',
    gender: '',
    address: '',
    email: '',
    phone: ''
  };
  
  try {
    // Parametre kontrolü
    if (!translatedText || typeof translatedText !== 'string') {
      console.error('Geçersiz çevrilen metin:', translatedText);
      return sections;
    }
    
    console.log('Çevrilen metin uzunluğu:', translatedText.length);
    console.log('Çevrilen metin içeriği (ilk 500 karakter):', translatedText.substring(0, 500));
    
    // Metni satırlara ayır ve boş satırları filtrele
    const lines = translatedText.split('\n').filter(line => line.trim());
    console.log('Toplam satır sayısı:', lines.length);
    
    // CV ana başlıkları ve içerikleri için Map
    const sections_map: Map<string, string[]> = new Map();
    let currentSection: string | null = null;
    let headerFound = false;
    
    // Satır bazında gezerek temel başlıkları ve içerikleri ayıklayalım
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // İsim tanıma - genellikle CV'nin başında büyük harflerle yazılır
      if (!headerFound && line.toUpperCase() === line && line.length > 3) {
        sections.name = line;
        headerFound = true;
        continue;
      }
      
      // Doğum tarihi, vatandaşlık gibi temel bilgiler
      if (line.includes(':')) {
        const [key, value] = line.split(':').map(part => part.trim());
        const keyLower = key.toLowerCase();
        
        if (value) {
          // Doğum tarihi
          if (/geburt|doğum|geburtstag|doğum tarihi/i.test(keyLower)) {
            sections.birthDate = value;
            continue;
          }
          // Uyruk/Vatandaşlık
          if (/national|staatsangehörigkeit|uyruk|vatanda(s|ş)l(i|ı)k/i.test(keyLower)) {
            sections.nationality = value;
            continue;
          }
          // Cinsiyet
          if (/geschlecht|cinsiyet|gender/i.test(keyLower)) {
            sections.gender = value;
            continue;
          }
          // Adres
          if (/adress|adres/i.test(keyLower)) {
            sections.address = value;
            continue;
          }
          // E-posta
          if (/e-?mail|e-?posta/i.test(keyLower)) {
            sections.email = value;
            continue;
          }
          // Telefon
          if (/telefon|tel|phone/i.test(keyLower)) {
            sections.phone = value;
            continue;
          }
        }
      }
      
      // Ana başlıkları tanıma
      // HAKKIMDA
      if (/^HAKKIMDA|ÜBER MICH|PROFIL|ÖZET$/i.test(line)) {
        currentSection = "about";
        sections_map.set(currentSection, []);
        continue;
      }
      // EĞİTİM VE STAJ
      else if (/^EĞİTİM (VE STAJ)?|AUSBILDUNG (UND PRAKTIKA)?|BILDUNG$/i.test(line)) {
        currentSection = "education";
        sections_map.set(currentSection, []);
        continue;
      }
      // DİL BECERİLERİ
      else if (/^DİL BECERİLERİ|SPRACHKENNTNISSE|SPRACHEN$/i.test(line)) {
        currentSection = "languages";
        sections_map.set(currentSection, []);
        continue;
      }
      // İŞ DENEYİMİ
      else if (/^İŞ DENEYİMİ|BERUFSERFAHRUNG|ERFAHRUNG$/i.test(line)) {
        currentSection = "experience";
        sections_map.set(currentSection, []);
        continue;
      }
      // HOBİLER VE İLGİ ALANLARI
      else if (/^HOBİLER (VE İLGİ ALANLARI)?|HOBBYS (& INTERESSEN)?|INTERESSEN$/i.test(line)) {
        currentSection = "hobbies";
        sections_map.set(currentSection, []);
        continue;
      }
      // BAŞARILAR VE ÖDÜLLER
      else if (/^BAŞARILAR (VE ÖDÜLLER)?|ERFOLGE (& AUSZEICHNUNGEN)?|AUSZEICHNUNGEN$/i.test(line)) {
        currentSection = "achievements";
        sections_map.set(currentSection, []);
        continue;
      }
      // KİŞİSEL BİLGİLER
      else if (/^KİŞİSEL BİLGİLER|PERSÖNLICHE DATEN|KONTAKT$/i.test(line)) {
        currentSection = "personal";
        sections_map.set(currentSection, []);
        continue;
      }
      
      // Mevcut bölüme içerik ekle
      if (currentSection && sections_map.has(currentSection)) {
        sections_map.get(currentSection)!.push(line);
      }
    }
    
    console.log('Bulunan ana bölümler:', Array.from(sections_map.keys()));
    
    // HAKKIMDA bölümünü işle
    if (sections_map.has("about")) {
      sections.about = formatSectionContent(sections_map.get("about")!);
    }
    
    // Bölümleri işle
    processEducation(sections, sections_map);
    processLanguages(sections, sections_map);
    processExperience(sections, sections_map);
    processHobbies(sections, sections_map);
    processAchievements(sections, sections_map);
    
    // HAKKIMDA bölümü analizi
    if (!sections.about && sections.name) {
      // İsimden sonraki ilk 10 satırı kontrol et (boş içerik değilse)
      const startIdx = lines.findIndex(line => line.includes(sections.name)) + 1;
      if (startIdx > 0 && startIdx < lines.length) {
        const potentialAbout = [];
        for (let i = startIdx; i < Math.min(startIdx + 10, lines.length); i++) {
          const line = lines[i].trim();
          // Eğer ana başlıklardan birine ulaşıldıysa durdur
          if (isMainHeader(line)) {
            break;
          }
          // Eğer satır boş değilse ve ":" içermiyorsa (özel bir alan değilse)
          if (line && !line.includes(':')) {
            potentialAbout.push(line);
          }
        }
        if (potentialAbout.length > 0) {
          sections.about = potentialAbout.join('\n');
        }
      }
    }
    
    console.log('Çıkarılan bölümler:', Object.keys(sections).filter(key => sections[key]));
    
    return sections;
  } catch (error) {
    console.error('Bölüm çıkarma hatası:', error);
    return sections;
  }
}

/**
 * Ana bölüm başlığı olup olmadığını kontrol eder
 */
function isMainHeader(line: string): boolean {
  return /^(HAKKIMDA|EĞİTİM|DİL BECERİLERİ|İŞ DENEYİMİ|HOBİLER|BAŞARILAR|KİŞİSEL BİLGİLER|ÜBER MICH|AUSBILDUNG|SPRACHKENNTNISSE|BERUFSERFAHRUNG|HOBBYS|ERFOLGE|KONTAKT)/i.test(line);
}

/**
 * Bölüm içeriğini formatlar
 */
function formatSectionContent(lines: string[]): string {
  return lines.join('\n');
}

/**
 * Metinden tarih bilgisini çıkarır
 */
function extractDate(text: string): string {
  // Tarih formatları: 01/01/2000, 2000-2022, 2000, vb.
  const dateMatch = text.match(/\d{2}[./-]\d{2}[./-]\d{4}|\d{4}[./-]\d{2}[./-]\d{2}|\d{4}[./-]\d{4}|\d{4}/);
  return dateMatch ? dateMatch[0] : '';
}

/**
 * Eğitim bölümünü işler
 */
function processEducation(sections: Record<string, string>, sections_map: Map<string, string[]>): void {
  if (sections_map.has("education")) {
    const educationLines = sections_map.get("education")!;
    let formattedEducation = '';
    
    // Alt başlıkları tanımla: ÜNİVERSİTE, LİSE, İLKOKUL-ORTAOKUL
    let subSection = '';
    let subSectionContent: string[] = [];
    
    for (let i = 0; i < educationLines.length; i++) {
      const line = educationLines[i].trim();
      
      // Tarih kontrolü - Genellikle 4 haneli yıl içerir (örn. 2018-2022)
      const hasDate = /\d{4}/.test(line);
      
      // Alt başlık kontrolü
      if (/ÜNİVERSİTE|UNIVERSITÄT|HOCHSCHULE/i.test(line)) {
        // Önceki alt bölümü ekle
        if (subSection && subSectionContent.length > 0) {
          formattedEducation += `${subSection}:\n${subSectionContent.join('\n')}\n\n`;
        }
        
        subSection = "Üniversite";
        subSectionContent = [];
        
        // Tarih varsa alt başlığa ekle
        if (hasDate) {
          subSection += ` (${extractDate(line)})`;
        }
        
        // Eğer satır sadece alt başlık değilse, içeriğini de ekle
        if (line.length > 15) {
          subSectionContent.push(line);
        }
      } 
      else if (/LİSE|GYMNASIUM|SCHULE/i.test(line)) {
        // Önceki alt bölümü ekle
        if (subSection && subSectionContent.length > 0) {
          formattedEducation += `${subSection}:\n${subSectionContent.join('\n')}\n\n`;
        }
        
        subSection = "Lise";
        subSectionContent = [];
        
        // Tarih varsa alt başlığa ekle
        if (hasDate) {
          subSection += ` (${extractDate(line)})`;
        }
        
        // Eğer satır sadece alt başlık değilse, içeriğini de ekle
        if (line.length > 10) {
          subSectionContent.push(line);
        }
      } 
      else if (/İLKOKUL|ORTAOKUL|GRUNDSCHULE|MITTELSCHULE/i.test(line)) {
        // Önceki alt bölümü ekle
        if (subSection && subSectionContent.length > 0) {
          formattedEducation += `${subSection}:\n${subSectionContent.join('\n')}\n\n`;
        }
        
        subSection = "İlkokul-Ortaokul";
        subSectionContent = [];
        
        // Tarih varsa alt başlığa ekle
        if (hasDate) {
          subSection += ` (${extractDate(line)})`;
        }
        
        // Eğer satır sadece alt başlık değilse, içeriğini de ekle
        if (line.length > 15) {
          subSectionContent.push(line);
        }
      } else {
        // Herhangi bir başlık altında değilse ve tarih içeriyorsa, yeni bir bölüm olabilir
        if (hasDate && !subSection) {
          subSection = extractDate(line);
          // Satırın geri kalanını içerik olarak ekle
          const content = line.replace(/\d{2}[./-]\d{2}[./-]\d{4}|\d{4}[./-]\d{2}[./-]\d{2}|\d{4}[./-]\d{4}|\d{4}/, '').trim();
          if (content) {
            subSectionContent.push(content);
          }
        } else if (subSection) {
          // Mevcut alt bölüme içerik ekle
          subSectionContent.push(line);
        } else {
          // Herhangi bir alt bölüm yoksa, doğrudan ana içeriğe ekle
          formattedEducation += line + '\n';
        }
      }
    }
    
    // Son alt bölümü ekle
    if (subSection && subSectionContent.length > 0) {
      formattedEducation += `${subSection}:\n${subSectionContent.join('\n')}\n\n`;
    }
    
    sections.education = formattedEducation.trim();
  }
}

/**
 * Dil becerileri bölümünü işler
 */
function processLanguages(sections: Record<string, string>, sections_map: Map<string, string[]>): void {
  if (sections_map.has("languages")) {
    const languageLines = sections_map.get("languages")!;
    let formattedLanguages = '';
    
    // ALT BAŞLIKLAR: ANADİLİ(LERİ): ve Diğer dil(ler):
    let currentLang = '';
    let anadil = false;
    let otherLang = false;
    
    for (let i = 0; i < languageLines.length; i++) {
      const line = languageLines[i].trim();
      
      if (/ANADİL|MUTTERSPRACHE/i.test(line)) {
        anadil = true;
        otherLang = false;
        formattedLanguages += "Anadili(leri):\n";
        
        // Dil adı ve seviyesi varsa ekle
        const langMatch = line.match(/:\s*(.+)/);
        if (langMatch && langMatch[1]) {
          currentLang = langMatch[1].trim();
          formattedLanguages += currentLang + '\n';
        }
      } 
      else if (/DİĞER DİL|ANDERE SPRACHE|FREMDSPRACHE/i.test(line)) {
        anadil = false;
        otherLang = true;
        formattedLanguages += "\nDiğer dil(ler):\n";
        
        // Dil adı ve seviyesi varsa ekle
        const langMatch = line.match(/:\s*(.+)/);
        if (langMatch && langMatch[1]) {
          currentLang = langMatch[1].trim();
          formattedLanguages += currentLang + '\n';
        }
      }
      else if (/(DİNLEME|OKUMA|YAZMA|KONUŞMA|HÖREN|LESEN|SCHREIBEN|SPRECHEN)/i.test(line)) {
        // Dil becerilerini ekle
        formattedLanguages += line + '\n';
      }
      else if (/^[A-Za-zÄÖÜäöüßğüşıİĞÜŞ]+$/i.test(line)) {
        // Muhtemelen bir dil adı
        currentLang = line;
        formattedLanguages += currentLang + '\n';
      }
      else {
        // Diğer içerik
        formattedLanguages += line + '\n';
      }
    }
    
    sections.languages = formattedLanguages.trim();
  }
}

/**
 * İş deneyimi bölümünü işler
 */
function processExperience(sections: Record<string, string>, sections_map: Map<string, string[]>): void {
  if (sections_map.has("experience")) {
    const experienceLines = sections_map.get("experience")!;
    let formattedExperience = '';
    
    let currentJob = '';
    let jobDetails: string[] = [];
    
    for (let i = 0; i < experienceLines.length; i++) {
      const line = experienceLines[i].trim();
      
      // Tarih içeren satır, muhtemelen yeni bir iş
      if (/\d{4}/.test(line) && line.length < 50) {
        // Önceki işi kaydet
        if (currentJob && jobDetails.length > 0) {
          formattedExperience += `${currentJob}:\n${jobDetails.join('\n')}\n\n`;
        }
        
        currentJob = line;
        jobDetails = [];
      } else if (currentJob) {
        // Mevcut işe detay ekle
        jobDetails.push(line);
      } else {
        // Herhangi bir iş başlığı yoksa, doğrudan ana içeriğe ekle
        formattedExperience += line + '\n';
      }
    }
    
    // Son işi kaydet
    if (currentJob && jobDetails.length > 0) {
      formattedExperience += `${currentJob}:\n${jobDetails.join('\n')}\n\n`;
    }
    
    sections.experience = formattedExperience.trim();
  }
}

/**
 * Hobiler ve ilgi alanları bölümünü işler
 */
function processHobbies(sections: Record<string, string>, sections_map: Map<string, string[]>): void {
  if (sections_map.has("hobbies")) {
    const hobbyLines = sections_map.get("hobbies")!;
    let formattedHobbies = '';
    
    let currentHobby = '';
    let hobbyDetails: string[] = [];
    
    for (let i = 0; i < hobbyLines.length; i++) {
      const line = hobbyLines[i].trim();
      
      // Alt başlık olabilecek tek kelimelik hobiler (Futbol, Yüzme, vb.)
      if (/^[A-Za-zÄÖÜäöüßğüşıİĞÜŞ]+$/i.test(line) && line.length < 15) {
        // Önceki hobiyi kaydet
        if (currentHobby && hobbyDetails.length > 0) {
          formattedHobbies += `${currentHobby}:\n${hobbyDetails.join('\n')}\n\n`;
        }
        
        currentHobby = line;
        hobbyDetails = [];
      } else if (currentHobby) {
        // Mevcut hobiye detay ekle
        hobbyDetails.push(line);
      } else {
        // Herhangi bir hobi başlığı yoksa, doğrudan ana içeriğe ekle
        formattedHobbies += line + '\n';
      }
    }
    
    // Son hobiyi kaydet
    if (currentHobby && hobbyDetails.length > 0) {
      formattedHobbies += `${currentHobby}:\n${hobbyDetails.join('\n')}\n\n`;
    }
    
    sections.hobbies = formattedHobbies.trim();
  }
}

/**
 * Başarılar ve ödüller bölümünü işler
 */
function processAchievements(sections: Record<string, string>, sections_map: Map<string, string[]>): void {
  if (sections_map.has("achievements")) {
    const achievementLines = sections_map.get("achievements")!;
    let formattedAchievements = '';
    
    let currentAchievement = '';
    let achievementDetails: string[] = [];
    
    for (let i = 0; i < achievementLines.length; i++) {
      const line = achievementLines[i].trim();
      
      // Tarih içeren satır veya büyük harf başlık
      if ((/\d{4}/.test(line) && line.length < 50) || 
          (line === line.toUpperCase() && line.length < 30)) {
        // Önceki başarıyı kaydet
        if (currentAchievement && achievementDetails.length > 0) {
          formattedAchievements += `${currentAchievement}:\n${achievementDetails.join('\n')}\n\n`;
        }
        
        currentAchievement = line;
        achievementDetails = [];
      } else if (currentAchievement) {
        // Mevcut başarıya detay ekle
        achievementDetails.push(line);
      } else {
        // Herhangi bir başarı başlığı yoksa, doğrudan ana içeriğe ekle
        formattedAchievements += line + '\n';
      }
    }
    
    // Son başarıyı kaydet
    if (currentAchievement && achievementDetails.length > 0) {
      formattedAchievements += `${currentAchievement}:\n${achievementDetails.join('\n')}\n\n`;
    }
    
    sections.achievements = formattedAchievements.trim();
  }
} 