import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
async function extractTextFromPDF(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF file: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true
        });
        const pdf = await loadingTask.promise;
        console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
        let fullText = '';
        // Process each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            console.log(`Processing page ${pageNum}`);
            const page = await pdf.getPage(pageNum);
            // Get page text content
            const textContent = await page.getTextContent();
            // Extract text from the page
            const pageText = textContent.items
                .map((item) => item.str)
                .join(' ');
            fullText += pageText + '\n\n';
            // Get page viewport for potential future use (e.g., canvas rendering)
            const viewport = page.getViewport({ scale: 1.0 });
            console.log(`Page ${pageNum} viewport: ${viewport.width}x${viewport.height}`);
        }
        // Clean up the text
        fullText = fullText
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
            .trim(); // Remove leading/trailing whitespace
        if (!fullText.trim()) {
            throw new Error('No text content found in PDF');
        }
        console.log('PDF text extraction completed successfully');
        return fullText;
    }
    catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
}
async function extractTextFromDOCX(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch DOCX file: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (!result.value.trim()) {
            throw new Error('No text content found in DOCX');
        }
        return result.value;
    }
    catch (error) {
        console.error('Error extracting text from DOCX:', error);
        throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
}
async function extractTextFromImage(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image file: ${response.statusText}`);
        }
        const blob = await response.blob();
        const worker = await createWorker();
        const { data: { text } } = await worker.recognize(blob);
        await worker.terminate();
        if (!text.trim()) {
            throw new Error('No text content found in image');
        }
        return text;
    }
    catch (error) {
        console.error('Error extracting text from image:', error);
        throw new Error(`Failed to extract text from image: ${error.message}`);
    }
}
function inferColumnType(values) {
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
    if (nonNullValues.length === 0)
        return 'text';
    const allNumbers = nonNullValues.every(v => !isNaN(Number(v)));
    if (allNumbers)
        return 'numeric';
    const allBooleans = nonNullValues.every(v => v === 'true' || v === 'false' || v === true || v === false);
    if (allBooleans)
        return 'boolean';
    const allDates = nonNullValues.every(v => !isNaN(Date.parse(v)));
    if (allDates)
        return 'date';
    return 'text';
}
function calculateColumnStatistics(data, column) {
    const values = data.map(row => row[column]);
    const type = inferColumnType(values);
    const stats = {
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
            stats.min = stats.min === undefined ? num : Math.min(stats.min, num);
            stats.max = stats.max === undefined ? num : Math.max(stats.max, num);
        }
        else if (type === 'date') {
            const date = new Date(value);
            stats.min = stats.min === undefined ? date : (date < stats.min ? date : stats.min);
            stats.max = stats.max === undefined ? date : (date > stats.max ? date : stats.max);
        }
    });
    return stats;
}
async function extractTextFromCSV(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV file: ${response.statusText}`);
        }
        const csvText = await response.text();
        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn('CSV parsing warnings:', results.errors);
                    }
                    if (!results.data || results.data.length === 0) {
                        reject(new Error('No data found in CSV file'));
                        return;
                    }
                    const data = results.data;
                    const headers = Object.keys(data[0]);
                    let formattedText = `CSV Analysis Report\n\n`;
                    // Basic Information
                    formattedText += `1. Basic Information\n`;
                    formattedText += `   - Total Records: ${data.length}\n`;
                    formattedText += `   - Total Columns: ${headers.length}\n\n`;
                    // Column Analysis
                    formattedText += `2. Column Analysis\n`;
                    headers.forEach(column => {
                        const stats = calculateColumnStatistics(data, column);
                        formattedText += `\n   ${column}:\n`;
                        formattedText += `   - Type: ${stats.type}\n`;
                        formattedText += `   - Unique Values: ${stats.uniqueValues.size}\n`;
                        formattedText += `   - Null/Empty: ${stats.nullCount} (${((stats.nullCount / stats.totalCount) * 100).toFixed(1)}%)\n`;
                        if (stats.type === 'numeric') {
                            formattedText += `   - Min: ${stats.min}\n`;
                            formattedText += `   - Max: ${stats.max}\n`;
                        }
                        else if (stats.type === 'date') {
                            formattedText += `   - Earliest: ${stats.min}\n`;
                            formattedText += `   - Latest: ${stats.max}\n`;
                        }
                    });
                    // Sample Records
                    formattedText += `\n3. Sample Records (First 5)\n`;
                    data.slice(0, 5).forEach((record, index) => {
                        formattedText += `\n   Record ${index + 1}:\n`;
                        headers.forEach(header => {
                            formattedText += `   - ${header}: ${record[header]}\n`;
                        });
                    });
                    // Data Quality
                    const qualityIssues = [];
                    headers.forEach(column => {
                        const stats = calculateColumnStatistics(data, column);
                        if (stats.nullCount > 0) {
                            qualityIssues.push(`Column "${column}" has ${stats.nullCount} null/empty values`);
                        }
                        if (stats.uniqueValues.size === 1) {
                            qualityIssues.push(`Column "${column}" has only one unique value`);
                        }
                    });
                    if (qualityIssues.length > 0) {
                        formattedText += `\n4. Data Quality Issues\n`;
                        qualityIssues.forEach((issue) => {
                            formattedText += `   - ${issue}\n`;
                        });
                    }
                    resolve(formattedText);
                },
                error: (error) => {
                    reject(new Error(`Failed to parse CSV: ${error.message}`));
                }
            });
        });
    }
    catch (error) {
        console.error('Error extracting text from CSV:', error);
        throw new Error(`Failed to extract text from CSV: ${error.message}`);
    }
}
async function extractTextFromExcel(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch Excel file: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let formattedText = 'Excel Analysis Report\n\n';
        // Workbook Overview
        formattedText += `1. Workbook Overview\n`;
        formattedText += `   - Total Sheets: ${workbook.SheetNames.length}\n`;
        formattedText += `   - Sheet Names: ${workbook.SheetNames.join(', ')}\n\n`;
        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            if (jsonData.length === 0)
                continue;
            formattedText += `2. Sheet: ${sheetName}\n`;
            formattedText += `   - Total Records: ${jsonData.length}\n`;
            const headers = Object.keys(jsonData[0]);
            formattedText += `   - Total Columns: ${headers.length}\n\n`;
            // Column Analysis
            formattedText += `3. Column Analysis\n`;
            headers.forEach(column => {
                const stats = calculateColumnStatistics(jsonData, column);
                formattedText += `\n   ${column}:\n`;
                formattedText += `   - Type: ${stats.type}\n`;
                formattedText += `   - Unique Values: ${stats.uniqueValues.size}\n`;
                formattedText += `   - Null/Empty: ${stats.nullCount} (${((stats.nullCount / stats.totalCount) * 100).toFixed(1)}%)\n`;
                if (stats.type === 'numeric') {
                    formattedText += `   - Min: ${stats.min}\n`;
                    formattedText += `   - Max: ${stats.max}\n`;
                }
                else if (stats.type === 'date') {
                    formattedText += `   - Earliest: ${stats.min}\n`;
                    formattedText += `   - Latest: ${stats.max}\n`;
                }
            });
            // Sample Records
            formattedText += `\n4. Sample Records (First 5)\n`;
            jsonData.slice(0, 5).forEach((record, index) => {
                formattedText += `\n   Record ${index + 1}:\n`;
                headers.forEach(header => {
                    formattedText += `   - ${header}: ${record[header]}\n`;
                });
            });
            formattedText += '\n---\n\n';
        }
        return formattedText;
    }
    catch (error) {
        console.error('Error extracting text from Excel:', error);
        throw new Error(`Failed to extract text from Excel: ${error.message}`);
    }
}
export async function processReport(content) {
    try {
        if (!content || typeof content !== 'string') {
            throw new Error('Invalid content provided');
        }
        let textContent = content;
        if (content.startsWith('http')) {
            const url = new URL(content);
            const urlPath = url.pathname;
            const fileExtension = urlPath.split('.').pop()?.toLowerCase();
            if (!fileExtension) {
                throw new Error('Could not determine file type from URL');
            }
            console.log('Processing file with extension:', fileExtension);
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
                        throw new Error(`Failed to fetch text file: ${response.statusText}`);
                    }
                    textContent = await response.text();
                    if (!textContent.trim()) {
                        throw new Error('Text file is empty');
                    }
                    break;
                default:
                    throw new Error(`Unsupported file type: .${fileExtension}`);
            }
        }
        if (!textContent.trim()) {
            throw new Error('No text content to process');
        }
        return textContent;
    }
    catch (error) {
        console.error('Error in processReport:', error);
        throw error;
    }
}
