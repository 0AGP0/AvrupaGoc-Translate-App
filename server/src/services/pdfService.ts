import PDFDocument from 'pdfkit';
import fs from 'fs';
import pdf from 'pdf-parse';
import path from 'path';
import puppeteer from 'puppeteer';

export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF metin çıkarma hatası:', error);
    throw new Error('PDF dosyasından metin çıkarılırken bir hata oluştu');
  }
}

export const createTranslatedPDF = async (originalText: string, translatedText: string): Promise<Buffer> => {
  try {
    // Karakterleri düzelt
    const sanitizedText = translatedText
      .replace(/[ıİğĞüÜşŞöÖçÇ]/g, char => {
        const replacements: { [key: string]: string } = {
          'ı': 'i',
          'İ': 'I',
          'ğ': 'g',
          'Ğ': 'G',
          'ü': 'u',
          'Ü': 'U',
          'ş': 's',
          'Ş': 'S',
          'ö': 'o',
          'Ö': 'O',
          'ç': 'c',
          'Ç': 'C'
        };
        return replacements[char] || char;
      })
      .replace(/[äöüßÄÖÜ]/g, char => {
        const replacements: { [key: string]: string } = {
          'ä': 'ae',
          'ö': 'oe',
          'ü': 'ue',
          'ß': 'ss',
          'Ä': 'Ae',
          'Ö': 'Oe',
          'Ü': 'Ue'
        };
        return replacements[char] || char;
      })
      .replace(/[âêîôûÂÊÎÔÛ]/g, char => {
        const replacements: { [key: string]: string } = {
          'â': 'a',
          'ê': 'e',
          'î': 'i',
          'ô': 'o',
          'û': 'u',
          'Â': 'A',
          'Ê': 'E',
          'Î': 'I',
          'Ô': 'O',
          'Û': 'U'
        };
        return replacements[char] || char;
      });

    // HTML şablonunu oluştur
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>Lebenslauf</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
          }
          .container {
            width: 210mm;
            margin: 0 auto;
            padding: 20mm;
            box-sizing: border-box;
            border: 1px solid #ccc;
          }
          header {
            text-align: center;
            margin-bottom: 20px;
          }
          header h1 {
            font-size: 32px;
            margin: 0;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
            text-transform: uppercase;
          }
          .row {
            display: flex;
            flex-direction: row;
            gap: 20px;
          }
          .column {
            flex: 1;
          }
          .field {
            margin-bottom: 15px;
          }
          .field label {
            font-weight: bold;
            display: block;
            margin-bottom: 3px;
          }
          .content {
            padding: 8px;
            min-height: 25px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>ALI AKIN</h1>
            <div class="field">
              <div class="content">${sanitizedText.split('\n').slice(0, 3).join('<br>')}</div>
            </div>
          </header>

          <div class="field">
            <div class="section-title">ÜBER MICH</div>
            <div class="content">${findSectionContent(sanitizedText, 'ÜBER MICH') || ''}</div>
          </div>

          <div class="row">
            <div class="column">
              <div class="field">
                <div class="section-title">SPRACHKENNTNISSE</div>
                <div class="content">${findSectionContent(sanitizedText, 'SPRACHKENNTNISSE') || ''}</div>
              </div>
              <div class="field">
                <div class="section-title">PERSÖNLICHE DATEN</div>
                <div class="content">${findSectionContent(sanitizedText, 'PERSÖNLICHE DATEN') || ''}</div>
              </div>
            </div>

            <div class="column">
              <div class="field">
                <div class="section-title">AUSBILDUNG UND PRAKTIKA</div>
                <div class="content">${findSectionContent(sanitizedText, 'AUSBILDUNG') || ''}</div>
              </div>
              <div class="field">
                <div class="section-title">BERUFLICHE ERFAHRUNG</div>
                <div class="content">${findSectionContent(sanitizedText, 'BERUFLICHE ERFAHRUNG') || ''}</div>
              </div>
              <div class="field">
                <div class="section-title">HOBBIES UND INTERESSEN</div>
                <div class="content">${findSectionContent(sanitizedText, 'HOBBIES') || ''}</div>
              </div>
              <div class="field">
                <div class="section-title">ERFOLGE UND AUSZEICHNUNGEN</div>
                <div class="content">${findSectionContent(sanitizedText, 'ERFOLGE') || ''}</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // HTML'i geçici dosyaya kaydet
    const tempHtmlPath = path.join(__dirname, 'temp.html');
    fs.writeFileSync(tempHtmlPath, htmlTemplate);

    // Puppeteer ile PDF oluştur
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlTemplate);
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    await browser.close();

    // Geçici dosyayı sil
    fs.unlinkSync(tempHtmlPath);

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('PDF oluşturma hatası:', error);
    throw error;
  }
};

// Bölüm içeriğini bulmak için yardımcı fonksiyon
function findSectionContent(text: string, sectionTitle: string): string | null {
  const sections = text.split('\n\n');
  for (const section of sections) {
    const lines = section.split('\n');
    const firstLine = lines[0].trim().toUpperCase();
    
    // Bölüm başlıklarını kontrol et
    if (firstLine.includes(sectionTitle.toUpperCase()) || 
        firstLine.includes(sectionTitle.replace(' ', '_').toUpperCase()) ||
        firstLine.includes(sectionTitle.replace(' ', '').toUpperCase())) {
      return lines.slice(1).join('\n');
    }
    
    // Eğer başlık tam eşleşmiyorsa, içeriğe göre kontrol et
    const content = lines.join(' ').toUpperCase();
    if (content.includes(sectionTitle.toUpperCase())) {
      return lines.join('\n');
    }
  }
  return null;
}

function splitTextIntoLines(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  try {
    const paragraphs = text.split('\n');
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        lines.push('');
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = word;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  } catch (error) {
    console.error('Metin satırlara bölünürken hata:', error);
    throw new Error('Metin satırlara bölünürken bir hata oluştu');
  }
}
