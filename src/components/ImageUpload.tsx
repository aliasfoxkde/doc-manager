/**
 * Image Upload Component with OCR Support
 * Allows uploading images and extracting text using Tesseract.js
 */

import { useState, useRef, useCallback } from 'react';
import { ocrService } from '../services/ocrService';

interface ImageUploadProps {
  onTextExtracted: (text: string, metadata: {
    confidence: number;
    fileName: string;
    timestamp: number;
  }) => void;
  language?: string;
}

interface ImagePreview {
  id: string;
  file: File;
  preview: string;
  extracted?: boolean;
}

export function ImageUpload({ onTextExtracted, language = 'eng' }: ImageUploadProps) {
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    );

    handleFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    const newImages: ImagePreview[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file)
    }));

    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) {
        URL.revokeObjectURL(img.preview);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const processImages = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Initialize OCR
      setStatus('Initializing OCR engine...');
      await ocrService.initialize(language);

      let allText = '';
      const totalImages = images.length;

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const progressPercent = ((i + 1) / totalImages) * 100;
        setProgress(progressPercent);
        setStatus(`Processing image ${i + 1} of ${totalImages}...`);

        try {
          const result = await ocrService.extractText(image.file, language);

          allText += result.text + '\n\n';

          // Mark as extracted
          setImages(prev => prev.map(img =>
            img.id === image.id ? { ...img, extracted: true } : img
          ));

          // Notify parent
          onTextExtracted(result.text, {
            confidence: result.confidence,
            fileName: image.file.name,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error(`Failed to process ${image.file.name}:`, error);
        }
      }

      setStatus('Processing complete!');
    } catch (error) {
      console.error('OCR processing failed:', error);
      setStatus('Processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setProgress(0);
    setStatus('');
  };

  return (
    <div className="image-upload-container">
      {/* Upload Zone */}
      <div
        className={`image-upload-zone ${dragActive ? 'dragover' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <div className="image-upload-icon">📷</div>
        <div className="image-upload-text">
          Drop images here or click to upload
        </div>
        <div className="image-upload-hint">
          Supports PNG, JPG, GIF, WebP • Max 10MB per image
        </div>
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="image-preview-container">
          {images.map(image => (
            <div key={image.id} className="image-preview">
              <img src={image.preview} alt={image.file.name} />
              <button
                className="image-preview-remove"
                onClick={() => removeImage(image.id)}
                disabled={isProcessing}
              >
                ×
              </button>
              {image.extracted && (
                <div className="image-preview-badge">✓</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* OCR Progress */}
      {(isProcessing || status) && (
        <div className={`ocr-progress ${isProcessing ? 'active' : ''}`}>
          <div className="ocr-progress-text">{status}</div>
          {isProcessing && (
            <>
              <div className="ocr-progress-bar">
                <div
                  className="ocr-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="ocr-progress-text">
                {Math.round(progress)}% complete
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {images.length > 0 && (
        <div className="image-upload-actions">
          <button
            className="btn-primary"
            onClick={processImages}
            disabled={isProcessing || images.every(i => i.extracted)}
          >
            {isProcessing ? 'Processing...' : 'Extract Text'}
          </button>
          <button
            className="btn-secondary"
            onClick={clearAll}
            disabled={isProcessing}
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}

export default ImageUpload;
