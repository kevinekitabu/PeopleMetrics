import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export async function generateAndDownloadDocx(text: string, fileName: string) {
  try {
    // Split text into sections
    const sections = text.split('\n\n').filter(section => section.trim());

    // Create document with optimized structure
    const doc = new Document({
      sections: [{
        properties: {},
        children: sections.map(section => {
          const isHeading = /^[\d\.\-\*]\s+/.test(section) || 
                           section.toUpperCase() === section;

          return new Paragraph({
            heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
            spacing: {
              before: 200,
              after: 200
            },
            children: [
              new TextRun({
                text: section.trim(),
                size: isHeading ? 28 : 24,
                bold: isHeading
              })
            ]
          });
        })
      }]
    });

    // Generate blob with optimized memory usage
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${fileName.replace(/[^a-zA-Z0-9-_]/g, '_')}.docx`);
    return true;
  } catch (error) {
    console.error('Error generating document:', error);
    throw new Error('Failed to generate document');
  }
}