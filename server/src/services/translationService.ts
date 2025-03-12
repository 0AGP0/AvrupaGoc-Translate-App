import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

export async function translateText(text: string): Promise<string> {
  try {
    const response = await axios.post(
      DEEPL_API_URL,
      {
        text: [text],
        target_lang: 'DE',
      },
      {
        headers: {
          Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.translations[0].text;
  } catch (error) {
    console.error('Çeviri hatası:', error);
    throw new Error('Metin çevrilirken bir hata oluştu');
  }
}