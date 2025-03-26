import axios from 'axios';
import dotenv from 'dotenv';

// .env dosyasını yükle
dotenv.config();

// DeepL API anahtarı
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

/**
 * DeepL API kullanarak metin çevirisi yapar
 */
export async function translateText(text: string, targetLang: string = 'DE'): Promise<string> {
  try {
    if (!DEEPL_API_KEY) {
      console.error('DeepL API anahtarı bulunamadı! .env dosyasını kontrol edin.');
      return `[Çeviri hatası: DeepL API anahtarı bulunamadı]`;
    }

    // DeepL API'ye istek at
    const response = await axios({
      method: 'post',
      url: DEEPL_API_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: new URLSearchParams({
        auth_key: DEEPL_API_KEY,
        text: text,
        target_lang: targetLang,
      }),
    });

    // Yanıtı kontrol et
    if (response.data && response.data.translations && response.data.translations.length > 0) {
      return response.data.translations[0].text;
    } else {
      throw new Error('Çeviri sonuçları alınamadı');
    }
  } catch (error) {
    console.error('DeepL API çeviri hatası:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      
      console.error('DeepL API yanıt detayları:', {
        status,
        data: errorData
      });
      
      // API anahtarı veya kota sorunu
      if (status === 403 || status === 401) {
        return `[Çeviri hatası: DeepL API erişimi reddedildi. API anahtarınızı kontrol edin.]`;
      }
      // Rate limit aşıldı
      else if (status === 429) {
        return `[Çeviri hatası: DeepL API istek limiti aşıldı. Lütfen daha sonra tekrar deneyin.]`;
      }
    }
    
    return `[Çeviri hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}]`;
  }
}

export default translateText;