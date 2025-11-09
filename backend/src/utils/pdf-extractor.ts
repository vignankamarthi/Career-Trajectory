/**
 * PDF Text Extraction Utility
 *
 * Extracts text content from PDF files for use in agent context.
 * Uses Claude API for PDF extraction (more reliable than pdf-parse).
 */

import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import Logger from './logger';

export interface ExtractedFileContent {
  originalname: string;
  filename: string;
  path: string;
  extractedText: string;
  pageCount?: number;
  error?: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Extract text content from a PDF file using Claude API
 * @param filePath - Absolute path to the PDF file
 * @returns Promise<string> - Extracted text content
 */
export async function extractPDFText(filePath: string): Promise<string> {
  try {
    const pdfData = fs.readFileSync(filePath);
    const base64Pdf = pdfData.toString('base64');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            } as any, // Document type is supported by API but not yet in TS types
            {
              type: 'text',
              text: 'Extract all text content from this PDF document. Return only the extracted text, no additional commentary.',
            },
          ],
        },
      ],
    });

    const extractedText = response.content[0].type === 'text' ? response.content[0].text : '';

    Logger.info('PDF text extracted successfully with Claude API', {
      path: filePath,
      textLength: extractedText.length,
    });

    return extractedText.trim();
  } catch (error) {
    Logger.error('Failed to extract PDF text', error instanceof Error ? error : undefined, {
      path: filePath,
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
        result.extractedText = await extractPDFText(file.path);
        Logger.info('PDF processed with Claude API', {
          file: file.originalname,
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
    Logger.error('File extraction failed', error instanceof Error ? error : undefined, {
      file: file.originalname,
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
