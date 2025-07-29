interface DocumentViewerProps {
  url: string;
  onTextExtracted?: (text: string) => void;
}

export default function DocumentViewer({ url }: DocumentViewerProps) {
  // Get file extension from URL
  const getFileType = (fileUrl: string) => {
    const extension = fileUrl.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
      case 'png':
        return 'image';
      default:
        return 'other';
    }
  };

  const fileType = getFileType(url);

  if (fileType === 'application/pdf') {
    return (
      <iframe
        src={url}
        className="w-full h-[600px] border border-gray-200 rounded-lg"
        title="PDF Viewer"
      />
    );
  }

  if (fileType === 'image') {
    return (
      <div className="w-full h-[600px] border border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
        <img
          src={url}
          alt="Document Preview"
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] border border-gray-200 rounded-lg flex items-center justify-center bg-gray-50">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
      >
        Download Document
      </a>
    </div>
  );
}