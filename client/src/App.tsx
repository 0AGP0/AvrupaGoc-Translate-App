import { useState } from 'react';
import { Box, Typography, TextField, Button, Tooltip } from '@mui/material';
import FileUpload from './components/FileUpload';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GetAppIcon from '@mui/icons-material/GetApp';

const theme = createTheme({
  palette: {
    primary: {
      main: '#3b82f6',
    }
  }
});

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    width: '100%',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  logo: {
    height: '32px'
  },
  title: {
    color: '#0f172a',
    fontSize: '18px',
    fontWeight: 600
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '24px',
    overflow: 'auto'
  },
  uploadSection: {
    flex: '0 0 auto'
  },
  panels: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    minHeight: '500px'
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    display: 'flex',
    flexDirection: 'column',
    height: 'auto',
    minHeight: '500px'
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '12px'
  },
  textField: {
    flex: 1,
    '& .MuiOutlinedInput-root': {
      height: '100%',
      backgroundColor: '#fff',
      '& textarea': {
        height: '100% !important',
        minHeight: '450px !important',
        padding: '12px',
        fontSize: '14px',
        lineHeight: 1.6,
        color: '#1e293b',
        overflowY: 'auto'
      },
      '& fieldset': {
        borderColor: '#e2e8f0'
      },
      '&:hover fieldset': {
        borderColor: '#94a3b8'
      },
      '&.Mui-focused fieldset': {
        borderColor: '#3b82f6'
      }
    }
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px 0',
    backgroundColor: '#fff',
    borderTop: '1px solid #e2e8f0',
    position: 'sticky',
    bottom: 0
  },
  button: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    padding: '8px 24px',
    borderRadius: '6px',
    textTransform: 'none',
    fontSize: '14px',
    fontWeight: 500,
    '&:hover': {
      backgroundColor: '#2563eb'
    }
  },
  loadingContainer: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: '12px',
    minHeight: '500px'
  }
};

function App() {
  const [originalText, setOriginalText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleFileUpload = async (file: File) => {
    try {
      if (!file.type.includes('pdf')) {
        throw new Error('Lütfen sadece PDF dosyası yükleyin.');
      }

      setIsLoading(true);
      const formData = new FormData();
      formData.append('pdf', file);

      console.log('Dosya yükleniyor...', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      let errorData;

      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { error: 'Sunucu hatası' };
      }

      if (!response.ok) {
        console.error('Yükleme hatası:', errorData);
        throw new Error(errorData.error || errorData.details || 'Dosya yükleme hatası');
      }

      const data = errorData;
      if (!data.originalText || !data.translatedText) {
        throw new Error('Sunucudan geçersiz veri alındı');
      }

      console.log('Dosya başarıyla yüklendi', {
        originalTextLength: data.originalText.length,
        translatedTextLength: data.translatedText.length
      });

      setOriginalText(data.originalText);
      setTranslatedText(data.translatedText);
    } catch (error) {
      console.error('Dosya yükleme hatası:', error);
      alert('Dosya yüklenirken bir hata oluştu: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslatedTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranslatedText(event.target.value);
  };

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      console.log('PDF indirme isteği gönderiliyor...', {
        originalTextLength: originalText?.length || 0,
        translatedTextLength: translatedText?.length || 0
      });
      
      const response = await fetch('http://localhost:5000/api/download-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalText,
          translatedText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('İndirme hatası:', errorData);
        throw new Error(errorData.error || errorData.details || 'PDF indirme hatası');
      }

      const blob = await response.blob();
      console.log('PDF alındı', {
        size: blob.size,
        type: blob.type
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'translated.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      console.log('PDF indirme işlemi tamamlandı');
    } catch (error) {
      console.error('PDF indirme hatası:', error);
      alert('PDF indirirken bir hata oluştu: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadInOriginalFormat = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Kullanıcının PDF dosyasını seçmesini iste
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'application/pdf';
      
      fileInput.onchange = async (event: Event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        
        if (!file) {
          setIsLoading(false);
          return;
        }
        
        console.log('Orijinal format için dosya yükleniyor...', file);
        
        // Form verisini oluştur
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('translatedText', translatedText);
        
        try {
          // Yeni görüntü tabanlı API endpoint'ini kullan
          const response = await fetch('http://localhost:5000/api/translate-pdf-image-based', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            throw new Error('Sunucu hatası');
          }
          
          // PDF'i indir
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `translated-${file.name}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          
          setIsLoading(false);
        } catch (error: any) {
          console.error('Görüntü tabanlı PDF indirme hatası:', error);
          setError(`Görüntü tabanlı PDF indirme hatası: ${error.message}`);
          setIsLoading(false);
        }
      };
      
      fileInput.click();
    } catch (error: any) {
      console.error('Görüntü tabanlı PDF işleme hatası:', error);
      setError(`Görüntü tabanlı PDF işleme hatası: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={styles.container}>
        <Box sx={styles.header}>
          <img src="/Avrupag.png" alt="Şirket Logo" style={styles.logo} />
          <Typography sx={styles.title}>
            CV Çeviri Uygulaması
          </Typography>
        </Box>

        <Box sx={styles.main}>
          <Box sx={styles.uploadSection}>
            <FileUpload onFileUpload={handleFileUpload} />
          </Box>

          {isLoading ? (
            <Box sx={styles.loadingContainer}>
              <Typography>Yükleniyor...</Typography>
            </Box>
          ) : (
            <>
              <Box sx={styles.panels}>
                <Box sx={styles.panel}>
                  <Typography sx={styles.panelTitle}>
                    Orijinal Metin
                  </Typography>
                  <TextField
                    multiline
                    fullWidth
                    value={originalText}
                    InputProps={{
                      readOnly: true,
                    }}
                    variant="outlined"
                    sx={styles.textField}
                  />
                </Box>

                <Box sx={styles.panel}>
                  <Typography sx={styles.panelTitle}>
                    Almanca Çeviri
                  </Typography>
                  <TextField
                    multiline
                    fullWidth
                    value={translatedText}
                    onChange={handleTranslatedTextChange}
                    variant="outlined"
                    sx={styles.textField}
                  />
                </Box>
              </Box>

              {/* İndirme düğmeleri */}
              {translatedText && (
                <Box mt={4} display="flex" justifyContent="center" gap={2}>
                  <Tooltip title="Çevrilen metni şablonlu PDF'e dönüştür">
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleDownload}
                      startIcon={<GetAppIcon />}
                      disabled={isLoading}
                    >
                      Çeviriyi İndir
                    </Button>
                  </Tooltip>
                  
                  <Tooltip title="Orijinal PDF'i koruyarak üzerine çeviriyi ekle">
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={handleDownloadInOriginalFormat}
                      startIcon={<PictureAsPdfIcon />}
                      disabled={isLoading}
                    >
                      Yan Yana Görüntülü PDF
                    </Button>
                  </Tooltip>
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
