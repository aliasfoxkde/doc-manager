/**
 * OCR Service using Tesseract.js
 * Extracts text from images locally in the browser
 * Supports multiple languages and works offline
 */

import Tesseract from 'tesseract.js';
import { getObservability } from '../core/observability';

const obs = getObservability();

class OCRService {
  private static instance: OCRService;
  private worker: Tesseract.Worker | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Initialize Tesseract worker
   */
  async initialize(language: string = 'eng'): Promise<void> {
    if (this.initialized && this.worker) {
      return;
    }

    try {
      obs.debug('[OCR] Initializing Tesseract worker...');
      this.worker = await Tesseract.createWorker(language, 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            obs.debug(`[OCR] Progress: ${(m.progress * 100).toFixed(1)}%`);
          } else if (m.status === 'loading tesseract core') {
            obs.debug('[OCR] Loading Tesseract core...');
          } else if (m.status === 'initializing tesseract') {
            obs.debug('[OCR] Initializing Tesseract...');
          } else if (m.status === 'initializing api') {
            obs.debug('[OCR] Initializing API...');
          } else if (m.status === 'loading language traineddata') {
            obs.debug(`[OCR] Loading language data: ${language}`);
          }
        }
      });

      this.initialized = true;
      obs.info('[OCR] Tesseract worker initialized');
    } catch (error) {
      obs.error('[OCR] Failed to initialize', error as Error);
      throw error;
    }
  }

  /**
   * Extract text from an image file
   */
  async extractText(file: File, language: string = 'eng'): Promise<{
    text: string;
    confidence: number;
    lines: Array<{ text: string; confidence: number; bbox: number[] }>;
  }> {
    await this.initialize(language);

    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    try {
      obs.debug(`[OCR] Processing image: ${file.name} (${file.size} bytes)`);

      // Recognize text from image
      const result = await this.worker.recognize(file);

      const text = result.data.text;
      const confidence = result.data.confidence;

      // Extract line-level data with bounding boxes
      const lines = (result.data as any).lines?.map((line: any) => ({
        text: line.text,
        confidence: line.confidence,
        bbox: line.bbox
      })) || [];

      obs.debug(`[OCR] Extraction complete: ${text.length} chars, ${confidence.toFixed(2)}%, ${lines.length} lines`);

      return { text, confidence, lines };
    } catch (error) {
      obs.error('[OCR] Failed to extract text', error as Error);
      throw error;
    }
  }

  /**
   * Extract text from an image URL
   */
  async extractTextFromUrl(url: string, language: string = 'eng'): Promise<{
    text: string;
    confidence: number;
    lines: Array<{ text: string; confidence: number; bbox: number[] }>;
  }> {
    await this.initialize(language);

    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    try {
      obs.debug(`[OCR] Processing image URL: ${url}`);

      const result = await this.worker.recognize(url);

      const text = result.data.text;
      const confidence = result.data.confidence;
      const lines = (result.data as any).lines?.map((line: any) => ({
        text: line.text,
        confidence: line.confidence,
        bbox: line.bbox
      })) || [];

      obs.debug('[OCR] Extraction complete from URL');

      return { text, confidence, lines };
    } catch (error) {
      obs.error('[OCR] Failed to extract text from URL', error as Error);
      throw error;
    }
  }

  /**
   * Extract text with PDF support
   * Note: Requires PDF.js to be loaded separately
   */
  async extractTextFromPDF(file: File): Promise<{
    text: string;
    pages: Array<{ pageNum: number; text: string }>;
    note?: string;
  }> {
    // For now, return a message about PDF support
    // Full PDF OCR would require additional setup
    obs.debug(`[OCR] PDF support - file: ${file.name}`);

    return {
      text: '',
      pages: [],
      note: 'PDF OCR support requires additional setup with PDF.js'
    };
  }

  /**
   * Get available languages
   */
  static getSupportedLanguages(): string[] {
    return [
      'eng', // English
      'spa', // Spanish
      'fra', // French
      'deu', // German
      'ita', // Italian
      'por', // Portuguese
      'chi_sim', // Chinese Simplified
      'chi_tra', // Chinese Traditional
      'jpn', // Japanese
      'kor', // Korean
      'rus', // Russian
      'ara' // Arabic
    ];
  }

  /**
   * Terminate worker and free resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      obs.info('[OCR] Worker terminated');
    }
  }

  /**
   * Check if OCR is ready
   */
  isReady(): boolean {
    return this.initialized && this.worker !== null;
  }
}

// Export singleton instance
export const ocrService = OCRService.getInstance();
