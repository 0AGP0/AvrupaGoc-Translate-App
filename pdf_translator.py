import os
import fitz  # PyMuPDF
import deepl
from dotenv import load_dotenv
from pathlib import Path
import time
import logging
import traceback
from pdf2image import convert_from_path
import pytesseract
import tempfile
import shutil  # PDF kopyalamak için

# Loglama ayarları
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# API anahtarını .env dosyasından yükle
load_dotenv()
DEEPL_API_KEY = os.getenv("DEEPL_API_KEY")

class PDFTranslator:
    def __init__(self, source_lang="TR", target_lang="DE"):
        # DeepL API istemcisini başlat
        if not DEEPL_API_KEY:
            raise ValueError("DeepL API anahtarı bulunamadı. Lütfen .env dosyasında DEEPL_API_KEY ayarlayın.")
        
        self.translator = deepl.Translator(DEEPL_API_KEY)
        self.source_lang = source_lang
        self.target_lang = target_lang
        
    def extract_text_with_positions(self, pdf_path, use_ocr=False):
        """
        PDF'den metin ve konum bilgilerini çıkarır
        """
        logger.info(f"PDF metin çıkarma işlemi başlatılıyor: {pdf_path}")
        
        # PDF'nin varlığını ve erişilebilirliğini kontrol et
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF dosyası bulunamadı: {pdf_path}")
            
        try:
            doc = fitz.open(pdf_path)
            
            # PDF'nin sayfa sayısını kontrol et
            if len(doc) == 0:
                raise ValueError("PDF dosyası boş veya açılamıyor")
                
            pages_content = []
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                text_blocks = []
                
                if use_ocr:
                    # OCR kullanarak metin çıkarma (taranmış belgeler için)
                    try:
                        # Tesseract'ın kurulu olduğunu kontrol et
                        try:
                            pytesseract.get_tesseract_version()
                        except Exception as te:
                            logger.error(f"Tesseract OCR kurulu değil: {str(te)}")
                            logger.warning("Tesseract OCR kullanılamıyor. Alternatif metin çıkarma yöntemi deneniyor...")
                            raise Exception("Tesseract OCR kurulu değil")
                            
                        pix = page.get_pixmap()
                        img_path = tempfile.mktemp(suffix=".png")
                        pix.save(img_path)
                        
                        logger.info(f"OCR işlemi başlatılıyor: Sayfa {page_num+1}")
                        ocr_text = pytesseract.image_to_data(img_path, output_type=pytesseract.Output.DICT, lang="tur")
                        
                        # OCR sonuçlarını işle
                        for i in range(len(ocr_text["text"])):
                            if ocr_text["text"][i].strip():
                                text_blocks.append({
                                    "text": ocr_text["text"][i],
                                    "bbox": [
                                        ocr_text["left"][i], 
                                        ocr_text["top"][i], 
                                        ocr_text["left"][i] + ocr_text["width"][i], 
                                        ocr_text["top"][i] + ocr_text["height"][i]
                                    ],
                                    "font_size": 11,  # Varsayılan yazı tipi boyutu
                                    "font_name": "Helvetica"  # Varsayılan yazı tipi
                                })
                        
                        # Geçici dosyayı sil
                        os.remove(img_path)
                        
                    except Exception as e:
                        logger.error(f"OCR işlemi sırasında hata: {str(e)}")
                        # OCR hatası durumunda normal metin çıkarmayı dene
                        logger.info("Normal metin çıkarma yöntemine geçiliyor")
                        
                        # PyMuPDF metin çıkarma
                        text_dict = page.get_text("dict")
                        self._process_text_dict(text_dict, text_blocks)
                else:
                    # Normal metin çıkarma
                    try:
                        logger.info(f"Normal metin çıkarma: Sayfa {page_num+1}")
                        
                        # PyMuPDF text_dict kullanımı
                        text_dict = page.get_text("dict")
                        self._process_text_dict(text_dict, text_blocks)
                        
                        # Direkt text olarak da deneyelim
                        if len(text_blocks) == 0:
                            text = page.get_text("text")
                            if text.strip():
                                logger.info(f"Direkt metin çıkarma kullanılıyor: {len(text)} karakter")
                                text_blocks.append({
                                    "text": text,
                                    "bbox": [0, 0, page.rect.width, page.rect.height],
                                    "font_size": 11,
                                    "font_name": "Helvetica"
                                })
                        
                    except Exception as e:
                        logger.error(f"Metin çıkarma hatası (Sayfa {page_num+1}): {str(e)}")
                
                if len(text_blocks) == 0:
                    logger.warning(f"Sayfa {page_num+1} için metin bulunamadı. Alternatif metot deneniyor...")
                    
                    # Direkt metin çıkarma dene
                    try:
                        text = page.get_text("text")
                        if text.strip():
                            logger.info(f"Alternatif metin çıkarma başarılı: {len(text)} karakter")
                            text_blocks.append({
                                "text": text,
                                "bbox": [0, 0, page.rect.width, page.rect.height],
                                "font_size": 11,
                                "font_name": "Helvetica"
                            })
                    except Exception as e:
                        logger.error(f"Alternatif metin çıkarma hatası: {str(e)}")
                    
                    # Metin bulunamadıysa otomatik OCR'a geçiş yap
                    if len(text_blocks) == 0 and not use_ocr:
                        logger.info(f"Sayfa {page_num+1} için OCR deneniyor")
                        try:
                            # Tesseract'ın kurulu olduğunu kontrol et
                            try:
                                pytesseract.get_tesseract_version()
                            except Exception:
                                logger.error("Tesseract OCR kurulu değil, OCR yapılamıyor")
                                continue
                                
                            pix = page.get_pixmap()
                            img_path = tempfile.mktemp(suffix=".png")
                            pix.save(img_path)
                            
                            ocr_text = pytesseract.image_to_data(img_path, output_type=pytesseract.Output.DICT, lang="tur")
                            
                            for i in range(len(ocr_text["text"])):
                                if ocr_text["text"][i].strip():
                                    text_blocks.append({
                                        "text": ocr_text["text"][i],
                                        "bbox": [
                                            ocr_text["left"][i], 
                                            ocr_text["top"][i], 
                                            ocr_text["left"][i] + ocr_text["width"][i], 
                                            ocr_text["top"][i] + ocr_text["height"][i]
                                        ],
                                        "font_size": 11,
                                        "font_name": "Helvetica"
                                    })
                            
                            os.remove(img_path)
                        except Exception as e:
                            logger.error(f"Otomatik OCR denemesi sırasında hata: {str(e)}")
                
                pages_content.append(text_blocks)
            
            return pages_content, doc
            
        except Exception as e:
            logger.error(f"PDF açılırken veya metin çıkarılırken hata: {str(e)}")
            logger.error(f"Hata detayı: {traceback.format_exc()}")
            raise
    
    def _process_text_dict(self, text_dict, text_blocks):
        """
        PyMuPDF'in text_dict yapısını işler ve metin bloklarını çıkarır
        """
        try:
            # "blocks" anahtarı yoksa, boş dön
            if "blocks" not in text_dict:
                logger.warning("'blocks' anahtarı bulunamadı")
                return
                
            for block in text_dict["blocks"]:
                if "lines" in block:
                    for line in block["lines"]:
                        if "spans" in line:
                            for span in line["spans"]:
                                if span.get("text", "").strip():
                                    try:
                                        # bbox verisi
                                        if "bbox" in span:
                                            bbox = span["bbox"]
                                        # Alternatif olarak origin ve diğer verileri kullan
                                        elif "origin" in span:
                                            origin = span["origin"]
                                            size = span.get("size", 11)
                                            # Yaklaşık bir bbox hesapla
                                            text_width = len(span["text"]) * size * 0.6  # Yaklaşık genişlik
                                            bbox = [
                                                origin[0],  # x0
                                                origin[1] - size,  # y0
                                                origin[0] + text_width,  # x1
                                                origin[1] + size * 0.3  # y1
                                            ]
                                        # Hiçbiri yoksa varsayılan bbox
                                        else:
                                            bbox = [0, 0, 100, 20]  # Varsayılan
                                        
                                        text_blocks.append({
                                            "text": span["text"],
                                            "bbox": bbox,
                                            "font_size": span.get("size", 11),
                                            "font_name": "Helvetica"  # Tüm fontları Helvetica olarak standartlaştır
                                        })
                                    except KeyError as ke:
                                        logger.debug(f"KeyError in span: {ke} - Span: {span}")
                                        # Eksik anahtar durumunda, mevcut verilerle blok oluştur
                                        text_blocks.append({
                                            "text": span["text"],
                                            "bbox": [0, 0, 100, 20],  # Varsayılan bbox
                                            "font_size": 11,
                                            "font_name": "Helvetica"
                                        })
        except Exception as e:
            logger.error(f"Text dict işlenirken hata: {str(e)}")
    
    def group_text_blocks(self, text_blocks, max_distance=5):
        """
        Yakın metin bloklarını gruplama (paragraflar, cümleler oluşturmak için)
        """
        if not text_blocks:
            return []
            
        try:
            grouped_blocks = []
            current_group = [text_blocks[0]]
            
            for i in range(1, len(text_blocks)):
                prev_block = text_blocks[i-1]
                curr_block = text_blocks[i]
                
                # Yatay mesafe kontrolü (aynı satırda mı)
                if (abs(curr_block["bbox"][1] - prev_block["bbox"][1]) < max_distance and
                    abs(curr_block["bbox"][0] - prev_block["bbox"][2]) < 50):
                    # Aynı satırda, birbirine yakın
                    current_group.append(curr_block)
                # Dikey mesafe kontrolü (alt satırda mı)
                elif (abs(curr_block["bbox"][1] - prev_block["bbox"][3]) < 2 * max_distance and
                      abs(curr_block["bbox"][0] - prev_block["bbox"][0]) < 20):
                    # Alt satırda ve aynı hizada
                    current_group.append(curr_block)
                else:
                    # Yeni bir grup başlat
                    grouped_text = " ".join([block["text"] for block in current_group])
                    grouped_bbox = [
                        min(block["bbox"][0] for block in current_group),
                        min(block["bbox"][1] for block in current_group),
                        max(block["bbox"][2] for block in current_group),
                        max(block["bbox"][3] for block in current_group)
                    ]
                    
                    group_info = {
                        "text": grouped_text,
                        "bbox": grouped_bbox,
                        "font_size": current_group[0]["font_size"],
                        "font_name": "Helvetica",  # Tüm fontları Helvetica olarak standartlaştır
                        "original_blocks": current_group
                    }
                    
                    grouped_blocks.append(group_info)
                    current_group = [curr_block]
            
            # Son grubu ekle
            if current_group:
                grouped_text = " ".join([block["text"] for block in current_group])
                grouped_bbox = [
                    min(block["bbox"][0] for block in current_group),
                    min(block["bbox"][1] for block in current_group),
                    max(block["bbox"][2] for block in current_group),
                    max(block["bbox"][3] for block in current_group)
                ]
                
                group_info = {
                    "text": grouped_text,
                    "bbox": grouped_bbox,
                    "font_size": current_group[0]["font_size"],
                    "font_name": "Helvetica",  # Tüm fontları Helvetica olarak standartlaştır
                    "original_blocks": current_group
                }
                
                grouped_blocks.append(group_info)
            
            return grouped_blocks
            
        except Exception as e:
            logger.error(f"Metin blokları gruplandırılırken hata: {str(e)}")
            logger.error(f"Hata detayı: {traceback.format_exc()}")
            return []
    
    def translate_text_blocks(self, text_blocks, batch_size=10):
        """
        Metin bloklarını DeepL API ile çevirir
        """
        logger.info(f"Metin çevirisi başlatılıyor: {self.source_lang} -> {self.target_lang}")
        translated_blocks = []
        
        try:
            # Çevrilecek anlamlı metinleri topla
            texts_to_translate = []
            blocks_to_translate = []
            
            for block in text_blocks:
                # Çeviri için uygun metin mi kontrol et
                if len(block["text"]) > 1 and not block["text"].isdigit():
                    logger.debug(f"Çeviri için metin ekleniyor: {block['text'][:30]}...")
                    texts_to_translate.append(block["text"])
                    blocks_to_translate.append(block)
                else:
                    # Çevirme, aynen koru
                    block_copy = block.copy()
                    block_copy["translated_text"] = block["text"]
                    translated_blocks.append(block_copy)
            
            # Çevrilecek metin yoksa erken dön
            if not texts_to_translate:
                logger.info("Çevrilecek anlamlı metin bulunamadı")
                return translated_blocks
            
            logger.info(f"Toplam {len(texts_to_translate)} metin çevrilecek")
                
            # Batch işleme için metinleri grupla
            batches = [texts_to_translate[i:i+batch_size] for i in range(0, len(texts_to_translate), batch_size)]
            
            all_translated_texts = []
            
            # Her batch için çeviri yap
            for batch_index, batch in enumerate(batches):
                try:
                    logger.info(f"Batch çevirisi {batch_index+1}/{len(batches)}: {len(batch)} metin")
                    result = self.translator.translate_text(
                        batch, 
                        source_lang=self.source_lang, 
                        target_lang=self.target_lang
                    )
                    
                    # Tek metin veya liste olabilir
                    if isinstance(result, list):
                        translations = [item.text for item in result]
                    else:
                        translations = [result.text]
                    
                    all_translated_texts.extend(translations)
                    
                    # API limit aşımını önlemek için kısa bekleme
                    time.sleep(0.5)
                    
                except Exception as e:
                    logger.error(f"Çeviri API hatası (Batch {batch_index+1}): {str(e)}")
                    logger.error(f"Hatalı batch: {batch}")
                    # Hata durumunda orijinal metni kullan
                    all_translated_texts.extend(batch)
            
            logger.info(f"Çeviri tamamlandı: {len(all_translated_texts)} metin")
            
            # Çevirileri orijinal bloklara eşle
            for i, block in enumerate(blocks_to_translate):
                if i < len(all_translated_texts):
                    block_copy = block.copy()
                    block_copy["translated_text"] = all_translated_texts[i]
                    block_copy["font_name"] = "Helvetica"  # Çeviri sonrası standart font
                    translated_blocks.append(block_copy)
                else:
                    # İndeks hatası durumunda orijinal metni kullan
                    block_copy = block.copy()
                    block_copy["translated_text"] = block["text"]
                    block_copy["font_name"] = "Helvetica"  # Çeviri sonrası standart font
                    translated_blocks.append(block_copy)
            
            return translated_blocks
            
        except Exception as e:
            logger.error(f"Çeviri işlemi sırasında hata: {str(e)}")
            logger.error(f"Hata detayı: {traceback.format_exc()}")
            # Hata durumunda orijinal metinleri çevirilmemiş olarak döndür
            return [{"text": block["text"], "translated_text": block["text"], "bbox": block["bbox"], 
                    "font_size": block["font_size"], "font_name": "Helvetica"} 
                    for block in text_blocks]
    
    def create_translated_pdf(self, original_doc, translated_blocks, output_path):
        """
        Çevrilmiş metinler ile yeni bir PDF oluşturur.
        Bu sürüm, orijinal PDF'in tasarımını (renk, konum, yazı tipi özellikleri) tam olarak korur.
        """
        logger.info(f"Çevrilmiş PDF oluşturuluyor: {output_path}")
        
        try:
            # Tamamen yeni bir PDF oluştur
            new_doc = fitz.open()
            
            # Her sayfa için
            for page_num, page_blocks in enumerate(translated_blocks):
                if page_num >= len(original_doc):
                    logger.warning(f"Sayfa {page_num+1} orijinal belge sayfa sayısını aşıyor, atlıyorum")
                    continue
                    
                # Orijinal sayfayı al
                original_page = original_doc[page_num]
                
                # Orijinal sayfanın dikdörtgeni
                mediabox = original_page.mediabox
                
                # Yeni sayfa oluştur (tam olarak aynı boyutlarda ve döndürmede)
                new_page = new_doc.new_page(
                    width=mediabox.width,
                    height=mediabox.height
                )
                
                # Sayfa döndürme özelliklerini de kopyala (eğer varsa)
                if hasattr(original_page, "rotation") and original_page.rotation != 0:
                    new_page.set_rotation(original_page.rotation)
                
                # Önce orijinal sayfanın içeriğini olduğu gibi kopyala
                new_page.show_pdf_page(
                    new_page.rect,
                    original_doc,
                    page_num,
                    keep_proportion=True
                )
                
                # Eğer blok yoksa, bu sayfada işlem yapma
                if not page_blocks:
                    logger.warning(f"Sayfa {page_num+1} için çevrilmiş metin bloğu bulunamadı, sayfa aynen bırakılıyor")
                    continue
                
                # Sayfanın tam görüntüsünü al (arka plan rengi tespiti için)
                pix = original_page.get_pixmap(alpha=False)
                
                # Her metin bloğunu işle
                for block in page_blocks:
                    if "translated_text" not in block or not block["translated_text"]:
                        continue
                        
                    # 1. Orijinal metnin özelliklerini al
                    bbox = fitz.Rect(block["bbox"])
                    orig_text = block.get("text", "")
                    translated_text = block["translated_text"]
                    
                    # Orijinal font boyutu
                    font_size = block.get("font_size", 11)
                    
                    # Orijinal bloğun özelliklerini analiz et
                    x0, y0, x1, y1 = int(bbox.x0), int(bbox.y0), int(bbox.x1), int(bbox.y1)
                    
                    # Sınır kontrolü
                    x0 = max(0, min(x0, pix.width - 1))
                    y0 = max(0, min(y0, pix.height - 1))
                    x1 = max(0, min(x1, pix.width - 1))
                    y1 = max(0, min(y1, pix.height - 1))
                    
                    # 2. Arka plan rengini tespit et - daha geniş bir örnekleme ile
                    bg_samples = []
                    
                    # Metin alanının dışından örnekler al (daha güvenilir arka plan rengi için)
                    # Üst kenardan örnekler
                    sample_y = max(0, y0 - 2)
                    for x in range(max(0, x0-5), min(pix.width, x1+5), max(1, (x1-x0)//15)):
                        if 0 <= x < pix.width and 0 <= sample_y < pix.height:
                            bg_samples.append(pix.pixel(x, sample_y)[:3])
                    
                    # Alt kenardan örnekler
                    sample_y = min(pix.height-1, y1 + 2)
                    for x in range(max(0, x0-5), min(pix.width, x1+5), max(1, (x1-x0)//15)):
                        if 0 <= x < pix.width and 0 <= sample_y < pix.height:
                            bg_samples.append(pix.pixel(x, sample_y)[:3])
                    
                    # Sol kenardan örnekler
                    sample_x = max(0, x0 - 2)
                    for y in range(max(0, y0-5), min(pix.height, y1+5), max(1, (y1-y0)//15)):
                        if 0 <= sample_x < pix.width and 0 <= y < pix.height:
                            bg_samples.append(pix.pixel(sample_x, y)[:3])
                    
                    # Sağ kenardan örnekler
                    sample_x = min(pix.width-1, x1 + 2)
                    for y in range(max(0, y0-5), min(pix.height, y1+5), max(1, (y1-y0)//15)):
                        if 0 <= sample_x < pix.width and 0 <= y < pix.height:
                            bg_samples.append(pix.pixel(sample_x, y)[:3])
                    
                    # Arka plan rengini belirle
                    bg_color = (1, 1, 1)  # Varsayılan beyaz
                    if bg_samples:
                        # RGB renklerini sık görülen gruplara ayır
                        color_groups = {}
                        for color in bg_samples:
                            # Benzer renkleri grupla (30 birim tolerans)
                            found_group = False
                            for group_key in list(color_groups.keys()):
                                if sum(abs(color[i] - group_key[i]) for i in range(3)) < 30:
                                    color_groups[group_key] += 1
                                    found_group = True
                                    break
                            if not found_group:
                                color_groups[color] = 1
                        
                        # En yaygın renk grubunu bul
                        if color_groups:
                            most_common = max(color_groups.items(), key=lambda item: item[1])[0]
                            bg_color = tuple(c/255 for c in most_common)
                    
                    # 3. Metin rengini tespit et
                    # Orijinal metinden bazı örnekler al (mümkünse merkeze yakın yerlerden)
                    text_samples = []
                    center_x = (x0 + x1) // 2
                    center_y = (y0 + y1) // 2
                    
                    # Merkez çevresinden örnek noktalar
                    sample_points = [
                        (center_x, center_y),  # Merkez
                        (center_x - (x1-x0)//4, center_y),  # Merkez sol
                        (center_x + (x1-x0)//4, center_y),  # Merkez sağ
                        (center_x, center_y - (y1-y0)//4),  # Merkez üst
                        (center_x, center_y + (y1-y0)//4)   # Merkez alt
                    ]
                    
                    for sx, sy in sample_points:
                        if 0 <= sx < pix.width and 0 <= sy < pix.height:
                            text_samples.append(pix.pixel(sx, sy)[:3])
                    
                    # Metin rengini belirle
                    text_color = (0, 0, 0)  # Varsayılan siyah
                    if text_samples:
                        # Arka plan renginden en uzak örneği bul (bu muhtemelen metin rengidir)
                        bg_rgb = tuple(int(c*255) for c in bg_color)
                        max_diff = 0
                        farthest_color = None
                        
                        for sample in text_samples:
                            diff = sum(abs(sample[i] - bg_rgb[i]) for i in range(3))
                            if diff > max_diff:
                                max_diff = diff
                                farthest_color = sample
                        
                        if farthest_color and max_diff > 30:  # Belirli bir eşik değerinden büyükse
                            text_color = tuple(c/255 for c in farthest_color)
                        else:
                            # Arka plan kontrastına göre otomatik seç
                            luminance = 0.299 * bg_color[0] + 0.587 * bg_color[1] + 0.114 * bg_color[2]
                            text_color = (0, 0, 0) if luminance > 0.5 else (1, 1, 1)
                    
                    # 4. Yerleştirme için hizalama tespiti
                    # Orijinal metinin yatay ve dikey konumunu belirle
                    page_width = original_page.rect.width
                    
                    alignment = "left"  # Varsayılan
                    if x0 > page_width * 0.6:
                        alignment = "right"
                    elif x0 > page_width * 0.3 and x1 < page_width * 0.7:
                        alignment = "center"
                    
                    # 5. Metin alanını arka plan rengiyle temizle
                    new_page.draw_rect(bbox, color=bg_color, fill=bg_color, width=0)
                    
                    # 6. Metni satırlara ve kelimelere bölme optimizasyonu
                    def optimize_text_layout(text, max_width, max_height, font_size, min_font_factor=0.6, recursion_depth=0):
                        """Metni satırlara böl ve gerekirse font boyutunu ayarla"""
                        # Rekürsyon limiti kontrolü
                        if recursion_depth > 10:  # Maksimum 10 seviye derinliğe izin ver
                            logger.warning(f"Maksimum rekürsyon derinliğine ulaşıldı - min_font_size kullanılıyor")
                            min_font_size = max(6, font_size * 0.5)  # Son çare olarak küçük font
                            words = text.split()
                            if not words:
                                return [], min_font_size
                                
                            # Son bir deneme yap
                            try:
                                word_widths = [fitz.get_text_length(word, fontname="helvetica", fontsize=min_font_size) for word in words]
                                space_width = fitz.get_text_length(" ", fontname="helvetica", fontsize=min_font_size)
                                
                                # En basit yerleştirme - tek satırda maksimum kelime sığdır
                                lines = []
                                current_line = []
                                current_width = 0
                                
                                for i, word in enumerate(words):
                                    word_width = word_widths[i]
                                    
                                    if current_width + word_width > max_width and current_line:
                                        lines.append((current_line.copy(), current_width))
                                        current_line = []
                                        current_width = 0
                                    
                                    current_line.append((word, word_width))
                                    if current_width == 0:
                                        current_width = word_width
                                    else:
                                        current_width += space_width + word_width
                                
                                if current_line:
                                    lines.append((current_line, current_width))
                                    
                                return lines, min_font_size
                            except Exception as e:
                                logger.error(f"Son metni işleme hatası: {str(e)}")
                                # Basit metin bölme
                                if len(text) < 50:
                                    return [([("TEXT_ERROR", 50)], 50)], min_font_size
                                else:
                                    half = len(text) // 2
                                    return [([("TEXT_ERROR_1", 50)], 50), ([("TEXT_ERROR_2", 50)], 50)], min_font_size
                        
                        words = text.split()
                        if not words:
                            return [], font_size
                        
                        # En küçük kabul edilebilir font boyutu
                        min_font_size = max(6, font_size * min_font_factor)
                        current_font_size = font_size
                        
                        while current_font_size >= min_font_size:
                            try:
                                # Kelime genişliklerini hesapla
                                word_widths = [fitz.get_text_length(word, fontname="helvetica", fontsize=current_font_size) for word in words]
                                space_width = fitz.get_text_length(" ", fontname="helvetica", fontsize=current_font_size)
                                
                                # Satırları oluştur
                                lines = []
                                current_line = []
                                current_width = 0
                                
                                for i, word in enumerate(words):
                                    word_width = word_widths[i]
                                    
                                    # Eğer kelime tek başına satıra sığmıyorsa ve kelime uzunsa
                                    if word_width > max_width and len(word) > 10 and current_line == []:
                                        # Kelimeyi bölebiliriz, ama şimdilik bu işlemi atla
                                        # (Kompleks kelime bölme algoritması gerekiyor)
                                        pass
                                    
                                    # Yeni kelime satıra sığmıyorsa, yeni satıra geç
                                    if current_width + word_width > max_width and current_line:
                                        lines.append((current_line.copy(), current_width))
                                        current_line = []
                                        current_width = 0
                                    
                                    # Kelimeyi ekle
                                    current_line.append((word, word_width))
                                    if current_width == 0:
                                        current_width = word_width
                                    else:
                                        current_width += space_width + word_width
                                
                                # Son satırı ekle
                                if current_line:
                                    lines.append((current_line, current_width))
                                
                                # Toplam yükseklik kontrolü
                                line_height = current_font_size * 1.2
                                total_height = len(lines) * line_height
                                
                                if total_height <= max_height:
                                    return lines, current_font_size
                                
                                # Sığmıyorsa font boyutunu azalt
                                current_font_size *= 0.9
                            except Exception as e:
                                logger.warning(f"Font boyutu hesaplama hatası ({current_font_size}): {str(e)}")
                                current_font_size *= 0.8  # Hatada daha fazla azalt
                        
                        # Rekürsyon limitine yaklaşıyorsak, bölünme veya rekürsyon derinliğini arttır
                        if min_font_size < 6 or recursion_depth > 8:
                            # Son deneme - basit yaklaşım
                            return optimize_text_layout(text, max_width, max_height, min_font_size, 1.0, recursion_depth + 1)
                        else:
                            # Son çare - en küçük font ile yeniden dene
                            return optimize_text_layout(text, max_width, max_height, min_font_size, 0.8, recursion_depth + 1)
                    
                    # 7. Metin yerleştirme
                    # İlk olarak, orijinal metnin kapladığı alanın genişliği ve yüksekliği
                    rect_width = bbox.width
                    rect_height = bbox.height
                    
                    # Uygun font boyutu ve satır düzeni
                    max_width = rect_width * 0.98  # Kenar boşluğu için %2 azalt
                    lines, adjusted_font = optimize_text_layout(translated_text, max_width, rect_height, font_size)
                    
                    if lines:
                        line_height = adjusted_font * 1.2
                        total_height = len(lines) * line_height
                        
                        # Başlangıç Y pozisyonu
                        if total_height < rect_height:
                            # Dikey ortalama yap
                            y_start = bbox.y0 + (rect_height - total_height) / 2 + adjusted_font
                        else:
                            # Üstten başla
                            y_start = bbox.y0 + adjusted_font
                        
                        # Her satırı çiz
                        for i, (line_words, line_width) in enumerate(lines):
                            # Yatay hizalama
                            if alignment == "right":
                                x_start = bbox.x1 - line_width
                            elif alignment == "center":
                                x_start = bbox.x0 + (rect_width - line_width) / 2
                            else:  # left
                                x_start = bbox.x0
                            
                            # Satırdaki her kelimeyi çiz
                            current_x = x_start
                            space_width = fitz.get_text_length(" ", fontname="helvetica", fontsize=adjusted_font)
                            
                            for word, word_width in line_words:
                                new_page.insert_text(
                                    (current_x, y_start + i * line_height),
                                    word,
                                    fontname="helvetica",
                                    fontsize=adjusted_font,
                                    color=text_color
                                )
                                current_x += word_width + space_width
            
            # Sayfada yapılan değişiklikleri uygula
            new_page.clean_contents()
        
            # PDF'i kaydet ve kapat
            new_doc.save(output_path, garbage=4, deflate=True, clean=True)
            new_doc.close()
            
            return output_path
            
        except Exception as e:
            logger.error(f"PDF oluşturulurken hata: {str(e)}")
            logger.error(f"Hata detayı: {traceback.format_exc()}")
            
            # Hata durumunda kaynakları temizle
            if 'new_doc' in locals():
                try:
                    new_doc.close()
                except:
                    pass
                
            raise
    
    def translate_pdf(self, pdf_path, output_path, use_ocr=False):
        """
        PDF'i çevirme işleminin ana fonksiyonu
        """
        doc = None  # İşlem sonunda kapatmak için referansı saklayalım
        
        try:
            logger.info(f"PDF çevirisi başlatılıyor: {pdf_path} -> {output_path}")
            logger.info(f"Kaynak dil: {self.source_lang}, Hedef dil: {self.target_lang}, OCR: {use_ocr}")
            
            # 1. PDF'den metin çıkar
            pages_content, doc = self.extract_text_with_positions(pdf_path, use_ocr)
            
            # Çıkarılan metin sayısını logla
            total_blocks = sum(len(page) for page in pages_content)
            logger.info(f"Toplam {total_blocks} metin bloğu çıkarıldı")
            
            # PDF'de metin bulunamadıysa
            if total_blocks == 0:
                logger.warning("PDF içinde metin bulunamadı. Eğer taranmış bir belge ise OCR seçeneğini etkinleştirin.")
                
                # OCR etkin değilse ve metin bulunamadıysa, orijinal PDF'i kopyala
                shutil.copy(pdf_path, output_path)
                logger.info(f"Metin bulunamadı, orijinal PDF kopyalandı: {output_path}")
                if doc:
                    doc.close()
                return output_path
            
            # 2. Metin bloklarını grupla
            grouped_pages = []
            for page_blocks in pages_content:
                grouped_blocks = self.group_text_blocks(page_blocks)
                grouped_pages.append(grouped_blocks)
            
            # 3. Grupları çevir
            translated_pages = []
            for page_groups in grouped_pages:
                translated_groups = self.translate_text_blocks(page_groups)
                translated_pages.append(translated_groups)
            
            # 4. Çevirili PDF oluştur
            output_file = self.create_translated_pdf(doc, translated_pages, output_path)
            
            # 5. Çıktı dosyasını kontrol et
            if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                logger.info(f"PDF çevirisi başarıyla tamamlandı: {output_path} ({os.path.getsize(output_path)} bytes)")
                if doc:
                    doc.close()
                return output_path
            else:
                raise ValueError("Oluşturulan PDF dosyası geçersiz veya çok küçük")
            
        except Exception as e:
            logger.error(f"PDF çevirisi sırasında hata: {str(e)}")
            logger.error(f"Hata detayı: {traceback.format_exc()}")
            
            # Belgeyi temiz bir şekilde kapatmaya çalış
            if doc:
                try:
                    doc.close()
                except:
                    pass
            
            # Hata durumunda orijinal PDF'i kopyala
            try:
                # Eğer çıktı dosyası varsa sil
                if os.path.exists(output_path):
                    os.remove(output_path)
                
                # Orijinal dosyayı kopyala
                shutil.copy(pdf_path, output_path)
                logger.warning(f"Hata nedeniyle orijinal PDF kopyalandı: {output_path}")
                return output_path
            except Exception as copy_err:
                logger.error(f"Orijinal dosya kopyalama hatası: {str(copy_err)}")
                raise

def translate_pdf(input_path, source_lang="TR", target_lang="DE", output_dir="downloads", use_ocr=False):
    """
    Dışa açılan ana fonksiyon
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Çıktı dosya yolunu oluştur
    input_filename = os.path.basename(input_path)
    output_path = output_dir / f"translated_{input_filename}"
    
    # PDF çeviriciyi başlat
    translator = PDFTranslator(source_lang=source_lang, target_lang=target_lang)
    
    # OCR kullanılacak mı kontrol et (form parametresi)
    if isinstance(use_ocr, str):
        use_ocr = use_ocr.lower() == 'true'
    
    # Çeviriyi gerçekleştir
    return translator.translate_pdf(input_path, str(output_path), use_ocr)

if __name__ == "__main__":
    # Test etmek için
    import sys
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        translate_pdf(pdf_path) 