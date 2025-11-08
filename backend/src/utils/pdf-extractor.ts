/**
 * PDF Text Extraction Utility
 *
 * Extracts text content from PDF files for use in agent context.
 * Uses dynamic imports to avoid CommonJS compatibility issues with tsx.
 */

import fs from 'fs';
import Logger from './logger';

export interface ExtractedFileContent {
  originalname: string;
  filename: string;
  path: string;
  extractedText: string;
  pageCount?: number;
  error?: string;
}

// Lazy-load pdf-parse to avoid CommonJS import issues with tsx
let pdfParse: any = null;

async function getPdfParser() {
  if (!pdfParse) {
    // Use dynamic import to load pdf-parse
    const module = await import('pdf-parse');
    pdfParse = module.default || module;
  }
  return pdfParse;
}

/**
 * Extract text content from a PDF file
 * @param filePath - Absolute path to the PDF file
 * @returns Promise<string> - Extracted text content
 */
export async function extractPDFText(filePath: string): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdf = await getPdfParser();
    const data = await pdf(dataBuffer);

    Logger.info('PDF text extracted successfully', {
      path: filePath,
      pages: data.numpages,
      textLength: data.text.length,
    });

    return data.text.trim();
  } catch (error) {
    Logger.error('Failed to extract PDF text', {
      path: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Extract text from various file types
 * Currently supports: PDF, TXT
 * @param file - Multer file object
 * @returns Promise<ExtractedFileContent> - File metadata with extracted text
 */
export async function extractFileContent(
  file: Express.Multer.File
): Promise<ExtractedFileContent> {
  const result: ExtractedFileContent = {
    originalname: file.originalname,
    filename: file.filename,
    path: file.path,
    extractedText: '',
  };

  try {
    const ext = file.originalname.toLowerCase().split('.').pop();

    switch (ext) {
      case 'pdf':
        const pdfData = fs.readFileSync(file.path);
        const pdf = await getPdfParser();
        const parsed = await pdf(pdfData);
        result.extractedText = parsed.text.trim();
        result.pageCount = parsed.numpages;
        Logger.info('PDF processed', {
          file: file.originalname,
          pages: parsed.numpages,
          chars: result.extractedText.length,
        });
        break;

      case 'txt':
        result.extractedText = fs.readFileSync(file.path, 'utf-8').trim();
        Logger.info('Text file processed', {
          file: file.originalname,
          chars: result.extractedText.length,
        });
        break;

      case 'doc':
      case 'docx':
        // TODO: Add docx support with mammoth or similar library
        result.error = 'DOCX files not yet supported. Please convert to PDF.';
        Logger.info('Unsupported file type', {
          file: file.originalname,
          type: ext,
        });
        break;

      default:
        result.error = `Unsupported file type: ${ext}`;
        Logger.info('Unsupported file type', {
          file: file.originalname,
          type: ext,
        });
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    Logger.error('File extraction failed', {
      file: file.originalname,
      error: result.error,
    });
  }

  return result;
}

/**
 * Process multiple uploaded files and extract their text content
 * @param files - Array of Multer file objects
 * @returns Promise<ExtractedFileContent[]> - Array of file metadata with extracted text
 */
export async function processUploadedFiles(
  files: Express.Multer.File[]
): Promise<ExtractedFileContent[]> {
  Logger.info('Processing uploaded files', { count: files.length });

  const results = await Promise.all(
    files.map((file) => extractFileContent(file))
  );

  const successCount = results.filter((r) => !r.error).length;
  const failCount = results.filter((r) => r.error).length;

  Logger.info('File processing complete', {
    total: files.length,
    success: successCount,
    failed: failCount,
  });

  return results;
}
