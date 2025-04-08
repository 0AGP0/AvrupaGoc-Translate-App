import os
import logging
from flask import Flask, render_template, request, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename
from pdf_translator import translate_pdf
from dotenv import load_dotenv
import time

# Loglama ayarları
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ortam değişkenlerini yükle
load_dotenv()

app = Flask(__name__)

# Konfigürasyon
UPLOAD_FOLDER = 'uploads'
DOWNLOAD_FOLDER = 'downloads'
ALLOWED_EXTENSIONS = {'pdf'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['DOWNLOAD_FOLDER'] = DOWNLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB

# Dizinlerin var olduğundan emin ol
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        try:
            # Dosya kontrolü
            if 'file' not in request.files:
                logger.warning("Dosya parçası yok")
                return render_template('index.html', error="Lütfen bir dosya seçin")
            
            file = request.files['file']
            if file.filename == '':
                logger.warning("Dosya seçilmedi")
                return render_template('index.html', error="Lütfen bir dosya seçin")
            
            if not allowed_file(file.filename):
                logger.warning(f"İzin verilmeyen dosya türü: {file.filename}")
                return render_template('index.html', error="Sadece PDF dosyaları kabul edilir")
            
            # Dosyayı kaydet
            filename = secure_filename(file.filename)
            unique_filename = f"{time.time():.0f}_{filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(file_path)
            
            # Form parametrelerini al
            source_lang = request.form.get('source_lang', 'TR')
            target_lang = request.form.get('target_lang', 'DE')
            use_ocr = request.form.get('use_ocr', 'true') == 'true'  # Varsayılan olarak OCR etkin
            
            logger.info(f"Çeviri başlatılıyor: {file_path}")
            logger.info(f"Kaynak dil: {source_lang}, Hedef dil: {target_lang}, OCR: {use_ocr}")
            
            # PDF'i çevir
            translated_path = translate_pdf(
                file_path, 
                source_lang=source_lang, 
                target_lang=target_lang,
                output_dir=app.config['DOWNLOAD_FOLDER'],
                use_ocr=use_ocr
            )
            
            # Dosya adını çıkartmak için
            translated_filename = os.path.basename(translated_path)
            logger.info(f"Çeviri tamamlandı: {translated_path}")
            
            return render_template('success.html', filename=translated_filename)
            
        except Exception as e:
            logger.error(f"İşlem sırasında hata: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return render_template('index.html', error=f"İşlem sırasında bir hata oluştu: {str(e)}")
    
    return render_template('index.html')

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(app.config['DOWNLOAD_FOLDER'], filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True) 