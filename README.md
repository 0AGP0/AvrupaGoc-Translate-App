# CV Çeviri Botu

Bu proje, CV'leri otomatik olarak Almancaya çeviren ve düzenlenebilir bir arayüz sunan bir web uygulamasıdır.

## Özellikler

- PDF CV yükleme
- Otomatik çeviri
- Yan yana düzenleme arayüzü
- Özelleştirilmiş CV formatında PDF çıktısı

## Teknolojiler

- Frontend: React.js + TypeScript + Material-UI
- Backend: Node.js + Express.js + TypeScript
- PDF İşleme: pdf-parse, pdf-lib
- Çeviri: DeepL API

## Kurulum

### Gereksinimler

- Node.js (v14 veya üzeri)
- npm veya yarn

### Backend Kurulumu

```bash
cd server
npm install
npm run dev
```

### Frontend Kurulumu

```bash
cd client
npm install
npm start
```

## Kullanım

1. Web arayüzünden PDF CV'nizi yükleyin
2. Çevirinin tamamlanmasını bekleyin
3. Gerekli düzenlemeleri yapın
4. "Tamamla" butonuna basarak çevrilmiş CV'nizi indirin

## Lisans

MIT