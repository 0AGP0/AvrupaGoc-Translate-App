# PDF Çeviri Botu

Bu proje, PDF belgelerini (özellikle CV'leri) bir dilden başka bir dile çeviren bir web uygulamasıdır. DeepL API kullanarak yüksek kaliteli çeviriler sağlar ve orijinal belgenin formatını korumaya çalışır.

## Özellikler

- PDF formatını ve düzeni koruyarak metin çevirisi
- DeepL API ile profesyonel kalitede çeviri
- Çoklu dil desteği
- OCR desteği ile taranmış belgeleri çevirebilme
- Kullanıcı dostu web arayüzü
- Sürükle-bırak dosya yükleme desteği

## Kurulum

### Gereksinimler

- Python 3.8+
- DeepL API anahtarı

### Adımlar

1. Repoyu klonlayın:
```
git clone https://github.com/[kullanıcı]/pdf-translator.git
cd pdf-translator
```

2. Sanal ortam oluşturun ve aktifleştirin:
```
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

3. Bağımlılıkları yükleyin:
```
pip install -r requirements.txt
```

4. `.env` dosyasını oluşturun ve DeepL API anahtarınızı ekleyin:
```
cp .env.example .env
# .env dosyasını düzenleyerek DEEPL_API_KEY değerini ekleyin
```

5. OCR desteği için Tesseract kurulumu:
- Windows için: https://github.com/UB-Mannheim/tesseract/wiki
- macOS: `brew install tesseract`
- Linux: `sudo apt-get install tesseract-ocr`

## Kullanım

1. Uygulamayı başlatın:
```
python app.py
```

2. Tarayıcınızda http://localhost:5000 adresine gidin
3. PDF dosyasını yükleyin, kaynak ve hedef dilleri seçin
4. "Çeviriyi Başlat" düğmesine tıklayın
5. Çevrilmiş PDF dosyası otomatik olarak indirilecektir

## Nasıl Çalışır?

1. **PDF İşleme**: PyMuPDF (fitz) kullanarak PDF'ten metin ve konum bilgileri çıkarılır
2. **Metin Gruplandırma**: Yakın metin blokları paragraflar ve cümleler oluşturmak için gruplandırılır
3. **Çeviri**: Anlamlı metin blokları DeepL API kullanılarak çevrilir
4. **PDF Oluşturma**: Orijinal PDF temel alınarak, metin içeriği çevirilerle değiştirilerek yeni bir PDF oluşturulur

## Sorun Giderme

- **Metin karmaşıklığı**: Kompleks belgeler veya karmaşık formatlar için OCR seçeneğini etkinleştirin
- **API Hataları**: DeepL API anahtarınızın doğru olduğunu ve API limitinizin aşılmadığını kontrol edin
- **Bellek Sorunları**: Çok büyük PDF dosyalarında bellek sınırlamaları olabilir. 16MB'dan küçük dosyalar kullanmayı deneyin

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır - Detaylar için LICENSE dosyasına bakın. 