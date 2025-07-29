import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import OpenAI from 'openai';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

// Initialize DeepSeek client
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: 'sk-5433c183d970441aacc1ad0d33cc2451',
  dangerouslyAllowBrowser: true
});

interface ProcessError extends Error {
  code?: string;
  details?: string;
  isInsufficientFunds?: boolean;
}

interface ColumnStats {
  type: 'numeric' | 'text' | 'date' | 'boolean';
  uniqueValues: Set<any>;
  min?: number | Date;
  max?: number | Date;
  nullCount: number;
  totalCount: number;
}

function inferColumnType(values: any[]): 'numeric' | 'text' | 'date' | 'boolean' {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNullValues.length === 0) return 'text';

  const allNumbers = nonNullValues.every(v => !isNaN(Number(v)));
  if (allNumbers) return 'numeric';

  const allBooleans = nonNullValues.every(v => v === 'true' || v === 'false' || v === true || v === false);
  if (allBooleans) return 'boolean';

  const allDates = nonNullValues.every(v => !isNaN(Date.parse(v)));
  if (allDates) return 'date';

  return 'text';
}

function calculateColumnStatistics(data: any[], column: string): ColumnStats {
  const values = data.map(row => row[column]);
  const type = inferColumnType(values);
  
  const stats: ColumnStats = {
    type,
    uniqueValues: new Set(),
    nullCount: 0,
    totalCount: values.length
  };

  values.forEach(value => {
    if (value === null || value === undefined || value === '') {
      stats.nullCount++;
      return;
    }

    stats.uniqueValues.add(value);

    if (type === 'numeric') {
      const num = Number(value);
      stats.min = stats.min === undefined ? num : Math.min(stats.min as number, num);
      stats.max = stats.max === undefined ? num : Math.max(stats.max as number, num);
    } else if (type === 'date') {
      const date = new Date(value);
      stats.min = stats.min === undefined ? date : (date < stats.min ? date : stats.min);
      stats.max = stats.max === undefined ? date : (date > stats.max ? date : stats.max);
    }
  });

  return stats;
}

async function analyzeTextWithDeepSeek(text: string): Promise<string> {
  try {
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-reasoner',
      messages: [
        {
          role: 'system',
          content: `You are an expert HR analyst and consultant with extensive experience in human resources management, employee assessment, and organizational development. Your task is to analyze HR-related documents and provide professional, structured reports that include:

1. Executive Summary
   - Brief overview of key findings
   - Critical insights and recommendations

2. Document Analysis
   - Main themes and topics identified
   - Key HR metrics and indicators
   - Compliance considerations

3. Employee/Team Assessment (if applicable)
   - Performance indicators
   - Skills and competencies
   - Development opportunities
   - Team dynamics

4. Organizational Impact
   - Implications for company culture
   - Resource allocation recommendations
   - Risk assessment

5. Action Items
   - Prioritized recommendations
   - Implementation suggestions
   - Timeline considerations

6. Compliance and Best Practices
   - Legal considerations
   - Industry standards alignment
   - Policy recommendations

Format your response in a clear, professional manner using appropriate HR terminology. Focus on actionable insights while maintaining confidentiality and professional ethics.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.2,
      max_tokens: 2500
    });

    return completion.choices[0].message.content || 'No analysis generated';
  } catch (error) {
    console.error('Error analyzing text with DeepSeek:', error);
    throw error;
  }
}

async function extractTextFromPDF(url: string): Promise<string> {
  try {
    console.log('Starting PDF extraction from:', url);
    const response = await fetch(url);
    if (!response.ok) {
      const error = new Error(`Failed to fetch PDF file: ${response.statusText}`) as ProcessError;
      error.code = 'PDF_FETCH_ERROR';
      throw error;
    }
    const arrayBuffer = await response.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });
    
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
    
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Processing page ${pageNum}`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
      
      const viewport = page.getViewport({ scale: 1.0 });
      console.log(`Page ${pageNum} viewport: ${viewport.width}x${viewport.height}`);
    }
    
    fullText = fullText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    if (!fullText.trim()) {
      const error = new Error('No text content found in PDF') as ProcessError;
      error.code = 'PDF_EMPTY_CONTENT';
      throw error;
    }
    
    console.log('PDF text extraction completed successfully');
    return fullText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    const processError = new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`) as ProcessError;
    processError.code = (error as ProcessError).code || 'PDF_PROCESSING_ERROR';
    processError.details = error instanceof Error ? error.stack : undefined;
    throw processError;
  }
}

async function extractTextFromDOCX(url: string): Promise<string> {
  try {
    console.log('Starting DOCX extraction from:', url);
    const response = await fetch(url);
    if (!response.ok) {
      const error = new Error(`Failed to fetch DOCX file: ${response.statusText}`) as ProcessError;
      error.code = 'DOCX_FETCH_ERROR';
      throw error;
    }
    const arrayBuffer = await response.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (!result.value.trim()) {
      const error = new Error('No text content found in DOCX') as ProcessError;
      error.code = 'DOCX_EMPTY_CONTENT';
      throw error;
    }
    
    console.log('DOCX text extraction completed successfully');
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    const processError = new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`) as ProcessError;
    processError.code = (error as ProcessError).code || 'DOCX_PROCESSING_ERROR';
    processError.details = error instanceof Error ? error.stack : undefined;
    throw processError;
  }
}

async function extractTextFromImage(url: string): Promise<string> {
  try {
    console.log('Starting image text extraction from:', url);
    const response = await fetch(url);
    if (!response.ok) {
      const error = new Error(`Failed to fetch image file: ${response.statusText}`) as ProcessError;
      error.code = 'IMAGE_FETCH_ERROR';
      throw error;
    }
    
    const blob = await response.blob();
    const worker = await createWorker();
    const { data: { text } } = await worker.recognize(blob);
    await worker.terminate();
    
    if (!text.trim()) {
      const error = new Error('No text content found in image') as ProcessError;
      error.code = 'IMAGE_EMPTY_CONTENT';
      throw error;
    }
    
    console.log('Image text extraction completed successfully');
    return text;
  } catch (error) {
    console.error('Error extracting text from image:', error);
    const processError = new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`) as ProcessError;
    processError.code = (error as ProcessError).code || 'IMAGE_PROCESSING_ERROR';
    processError.details = error instanceof Error ? error.stack : undefined;
    throw processError;
  }
}

async function extractTextFromCSV(url: string): Promise<string> {
  try {
    console.log('Starting CSV extraction from:', url);

    const urlWithNocache = new URL(url);
    urlWithNocache.searchParams.append('_', Date.now().toString());

    const response = await fetch(urlWithNocache.toString(), {
      headers: {
        'Accept': 'text/csv,text/plain,application/octet-stream',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      const error = new Error(`Failed to fetch CSV file (${response.status} ${response.statusText})`) as ProcessError;
      error.code = 'CSV_FETCH_ERROR';
      error.details = `URL: ${url}\nStatus: ${response.status}\nStatusText: ${response.statusText}`;
      throw error;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/csv') && !contentType?.includes('text/plain')) {
      console.warn('Unexpected content type:', contentType);
    }

    const csvText = await response.text();
    if (!csvText.trim()) {
      const error = new Error('CSV file is empty') as ProcessError;
      error.code = 'CSV_EMPTY_CONTENT';
      throw error;
    }

    return new Promise<string>((resolve, reject) => {
      const qualityIssues: string[] = [];

      const config: Papa.ParseConfig = {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<Record<string, unknown>>) => {
          try {
            if (results.errors.length > 0) {
              console.warn('CSV parsing warnings:', results.errors);
              
              const criticalErrors = results.errors.filter(err => err.type === 'Quotes' || err.type === 'Delimiter');
              if (criticalErrors.length > 0) {
                const error = new Error(`CSV parsing failed: ${criticalErrors[0].message}`) as ProcessError;
                error.code = 'CSV_PARSE_ERROR';
                error.details = JSON.stringify(criticalErrors);
                reject(error);
                return;
              }
            }

            if (!results.data || results.data.length === 0) {
              const error = new Error('No data found in CSV file') as ProcessError;
              error.code = 'CSV_EMPTY_CONTENT';
              reject(error);
              return;
            }

            const data = results.data;
            const headers = Object.keys(data[0] as Record<string, unknown>);
            let formattedText = `HR Data Analysis Report\n\n`;

            formattedText += `1. Data Overview\n`;
            formattedText += `   - Total Records: ${data.length}\n`;
            formattedText += `   - Total Fields: ${headers.length}\n\n`;

            formattedText += `2. Field Analysis\n`;
            headers.forEach(column => {
              const stats = calculateColumnStatistics(data, column);
              formattedText += `\n   ${column}:\n`;
              formattedText += `   - Data Type: ${stats.type}\n`;
              formattedText += `   - Unique Values: ${stats.uniqueValues.size}\n`;
              formattedText += `   - Missing Data: ${stats.nullCount} (${((stats.nullCount/stats.totalCount)*100).toFixed(1)}%)\n`;
              
              if (stats.type === 'numeric') {
                formattedText += `   - Range: ${stats.min} to ${stats.max}\n`;
              } else if (stats.type === 'date') {
                formattedText += `   - Date Range: ${stats.min} to ${stats.max}\n`;
              }

              if (stats.nullCount > 0) {
                qualityIssues.push(`Field "${column}" has ${stats.nullCount} missing values`);
              }
              if (stats.uniqueValues.size === 1) {
                qualityIssues.push(`Field "${column}" has no variation (single value)`);
              }
            });

            formattedText += `\n3. Sample Records\n`;
            data.slice(0, 5).forEach((record, index) => {
              formattedText += `\n   Record ${index + 1}:\n`;
              headers.forEach(header => {
                formattedText += `   - ${header}: ${record[header]}\n`;
              });
            });

            if (qualityIssues.length > 0) {
              formattedText += `\n4. Data Quality Concerns\n`;
              qualityIssues.forEach(issue => {
                formattedText += `   - ${issue}\n`;
              });
            }

            console.log('CSV analysis completed successfully');
            resolve(formattedText);
          } catch (error) {
            console.error('Error processing CSV results:', error);
            const processError = new Error(`Failed to process CSV results: ${error instanceof Error ? error.message : 'Unknown error'}`) as ProcessError;
            processError.code = 'CSV_PROCESSING_ERROR';
            processError.details = error instanceof Error ? error.stack : undefined;
            reject(processError);
          }
        }
      };

      Papa.parse(csvText, config);
    });
  } catch (error) {
    console.error('Error extracting text from CSV:', error);
    if ((error as ProcessError).code) {
      throw error;
    }
    const processError = new Error(`Failed to extract text from CSV: ${error instanceof Error ? error.message : 'Unknown error'}`) as ProcessError;
    processError.code = 'CSV_PROCESSING_ERROR';
    processError.details = error instanceof Error ? error.stack : undefined;
    throw processError;
  }
}

async function extractTextFromExcel(url: string): Promise<string> {
  try {
    console.log('Starting Excel extraction from:', url);
    const response = await fetch(url);
    if (!response.ok) {
      const error = new Error(`Failed to fetch Excel file: ${response.statusText}`) as ProcessError;
      error.code = 'EXCEL_FETCH_ERROR';
      throw error;
    }
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    let formattedText = 'HR Data Analysis Report\n\n';
    
    formattedText += `1. Workbook Overview\n`;
    formattedText += `   - Total Sheets: ${workbook.SheetNames.length}\n`;
    formattedText += `   - Sheet Names: ${workbook.SheetNames.join(', ')}\n\n`;
    
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (!Array.isArray(jsonData) || jsonData.length === 0) continue;
      
      formattedText += `2. Sheet Analysis: ${sheetName}\n`;
      formattedText += `   - Total Records: ${jsonData.length}\n`;
      
      const firstRow = jsonData[0] as Record<string, unknown>;
      const headers = Object.keys(firstRow);
      formattedText += `   - Total Fields: ${headers.length}\n\n`;
      
      formattedText += `3. Field Analysis\n`;
      headers.forEach(column => {
        const stats = calculateColumnStatistics(jsonData as Record<string, unknown>[], column);
        formattedText += `\n   ${column}:\n`;
        formattedText += `   - Data Type: ${stats.type}\n`;
        formattedText += `   - Unique Values: ${stats.uniqueValues.size}\n`;
        formattedText += `   - Missing Data: ${stats.nullCount} (${((stats.nullCount/stats.totalCount)*100).toFixed(1)}%)\n`;
        
        if (stats.type === 'numeric') {
          formattedText += `   - Range: ${stats.min} to ${stats.max}\n`;
        } else if (stats.type === 'date') {
          formattedText += `   - Date Range: ${stats.min} to ${stats.max}\n`;
        }
      });
      
      formattedText += `\n4. Sample Records\n`;
      jsonData.slice(0, 5).forEach((record, index) => {
        formattedText += `\n   Record ${index + 1}:\n`;
        headers.forEach(header => {
          formattedText += `   - ${header}: ${(record as Record<string, unknown>)[header]}\n`;
        });
      });
      
      formattedText += '\n---\n\n';
    }
    
    console.log('Excel analysis completed successfully');
    return formattedText;
  } catch (error) {
    console.error('Error extracting text from Excel:', error);
    const processError = new Error(`Failed to extract text from Excel: ${error instanceof Error ? error.message : 'Unknown error'}`) as ProcessError;
    processError.code = (error as ProcessError).code || 'EXCEL_PROCESSING_ERROR';
    processError.details = error instanceof Error ? error.stack : undefined;
    throw processError;
  }
}

export async function processReport(content: string): Promise<string> {
  try {
    console.log('Starting report processing');
    
    if (!content || typeof content !== 'string') {
      const error = new Error('Invalid content provided') as ProcessError;
      error.code = 'INVALID_CONTENT';
      throw error;
    }

    let textContent = content;
    if (content.startsWith('http')) {
      const url = new URL(content);
      const urlPath = url.pathname.toLowerCase();
      const fileExtension = urlPath.split('.').pop();
      
      if (!fileExtension) {
        const error = new Error('Could not determine file type from URL') as ProcessError;
        error.code = 'INVALID_FILE_TYPE';
        throw error;
      }

      console.log('Processing file with extension:', fileExtension);

      try {
        switch (fileExtension) {
          case 'pdf':
            textContent = await extractTextFromPDF(content);
            break;
          case 'docx':
            textContent = await extractTextFromDOCX(content);
            break;
          case 'png':
          case 'jpg':
          case 'jpeg':
            textContent = await extractTextFromImage(content);
            break;
          case 'csv':
            textContent = await extractTextFromCSV(content);
            break;
          case 'xlsx':
          case 'xls':
            textContent = await extractTextFromExcel(content);
            break;
          case 'txt':
            const response = await fetch(content);
            if (!response.ok) {
              const error = new Error(`Failed to fetch text file: ${response.statusText}`) as ProcessError;
              error.code = 'TEXT_FETCH_ERROR';
              throw error;
            }
            textContent = await response.text();
            if (!textContent.trim()) {
              const error = new Error('Text file is empty') as ProcessError;
              error.code = 'TEXT_EMPTY_CONTENT';
              throw error;
            }
            break;
          default:
            const error = new Error(`Unsupported file type: .${fileExtension}`) as ProcessError;
            error.code = 'UNSUPPORTED_FILE_TYPE';
            throw error;
        }
      } catch (error) {
        if ((error as any).response?.status === 402 || (error as any).message?.includes('insufficient funds')) {
          const insufficientFundsError = new Error('Insufficient funds to process this request. Please check your subscription.') as ProcessError;
          insufficientFundsError.code = 'INSUFFICIENT_FUNDS';
          insufficientFundsError.isInsufficientFunds = true;
          throw insufficientFundsError;
        }
        throw error;
      }
    }

    if (!textContent.trim()) {
      const error = new Error('No text content to process') as ProcessError;
      error.code = 'EMPTY_CONTENT';
      throw error;
    }

    // Process the text content with DeepSeek
    const analysis = await analyzeTextWithDeepSeek(textContent);
    console.log('Report processing completed successfully');
    return analysis;
  } catch (error) {
    console.error('Error in processReport:', error);
    
    if ((error as ProcessError).code) {
      throw error;
    }
    
    const processError = new Error(`Failed to process report: ${error instanceof Error ? error.message : 'Unknown error'}`) as ProcessError;
    processError.code = 'PROCESSING_ERROR';
    processError.details = error instanceof Error ? error.stack : undefined;
    throw processError;
  }
}