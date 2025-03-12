import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0].code === 'file-too-large') {
          alert('Dosya boyutu çok büyük. Maksimum 10MB yükleyebilirsiniz.');
        } else if (rejection.errors[0].code === 'file-invalid-type') {
          alert('Lütfen sadece PDF dosyası yükleyin.');
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        onFileUpload(acceptedFiles[0]);
      }
    }
  });

  return (
    <Box
      sx={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
      }}
    >
      <Box
        {...getRootProps()}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          backgroundColor: '#f8fafc',
          border: '2px dashed',
          borderColor: isDragActive ? '#3b82f6' : '#e2e8f0',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: '#3b82f6',
            backgroundColor: '#f1f5f9'
          }
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon 
          sx={{ 
            fontSize: '48px',
            color: isDragActive ? '#3b82f6' : '#64748b',
            marginBottom: '16px',
            transition: 'color 0.2s ease'
          }} 
        />
        <Typography 
          sx={{ 
            fontSize: '18px',
            fontWeight: 500,
            color: isDragActive ? '#3b82f6' : '#0f172a',
            marginBottom: '8px',
            textAlign: 'center',
            transition: 'color 0.2s ease'
          }}
        >
          {isDragActive
            ? 'PDF dosyasını buraya bırakın'
            : 'PDF dosyasını yüklemek için tıklayın veya sürükleyin'}
        </Typography>
        <Typography 
          sx={{ 
            fontSize: '14px',
            color: '#64748b',
            textAlign: 'center'
          }}
        >
          Maksimum dosya boyutu: 10MB
        </Typography>
      </Box>
    </Box>
  );
};

export default FileUpload;
