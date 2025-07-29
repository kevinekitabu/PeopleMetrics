import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import { processReport } from '../lib/deepseek';
import toast from 'react-hot-toast';
import DocumentViewer from '../components/DocumentViewer';
import LoadingAnimation from '../components/LoadingAnimation';
import TypingAnimation from '../components/TypingAnimation';
import { Link } from 'react-router-dom';
import { generateAndDownloadDocx } from '../utils/documentGenerator';
import ThemeToggle from '../components/ThemeToggle';

interface Report {
  id: string;
  user_id: string;
  title: string;
  description: string;
  files: {
    path: string;
    name: string;
    type: string;
  }[];
  feedback: string | null;
  created_at: Date;
  updated_at: Date;
  preview?: string;
  context?: string;
  regeneration_count: number;
}

interface FileUploadProgress {
  [key: string]: {
    loaded: number;
    total: number;
  };
}

const SUPPORTED_EXTENSIONS = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'xls', 'csv'];
const MAX_FILES = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const MIME_TYPES = {
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls']
};

function getPreviewText(feedback: string | null): string {
  if (!feedback) return '';
  const lines = feedback.split('\n');
  const firstParagraph = lines.find(line => line.trim().length > 0) || '';
  return firstParagraph.length > 150 ? `${firstParagraph.slice(0, 150)}...` : firstParagraph;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9\-_\.]/g, '-');
}

function Dashboard() {
  const { user, signOut } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress>({});
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);
  const [highlightedReport, setHighlightedReport] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const reportRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const processingReports = useRef<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [editingContext, setEditingContext] = useState<string | null>(null);
  const [contextInput, setContextInput] = useState('');

  // ... rest of the component implementation remains the same until handleGenerateReport

  const handleGenerateReport = async (report: Report, newContext?: string) => {
    if (processingReports.current.has(report.id)) {
      toast.error('This report is already being processed');
      return;
    }

    // Check regeneration limit
    if (report.regeneration_count >= 5) {
      toast.error('Maximum regeneration limit reached for this report');
      return;
    }

    try {
      setIsProcessing(true);
      setSelectedReport(report);
      processingReports.current.add(report.id);

      // Update context if provided
      if (newContext !== undefined) {
        const { error: contextError } = await supabase
          .from('reports')
          .update({ 
            context: newContext,
            regeneration_count: report.regeneration_count + 1 
          })
          .eq('id', report.id);

        if (contextError) throw contextError;
      }

      // Process all files and combine their content
      const processPromises = report.files.map(async (file) => {
        const { data: urlData, error: urlError } = await supabase.storage
          .from('reports')
          .createSignedUrl(file.path, 3600);

        if (urlError) throw urlError;
        if (!urlData?.signedUrl) throw new Error('Failed to get file URL');

        return processReport(urlData.signedUrl);
      });

      const results = await Promise.all(processPromises);
      const combinedFeedback = results.join('\n\n---\n\n');

      // Add context to feedback if available
      const finalFeedback = report.context 
        ? `Context: ${report.context}\n\n${combinedFeedback}`
        : combinedFeedback;

      const { error: updateError } = await supabase
        .from('reports')
        .update({ 
          feedback: finalFeedback,
          regeneration_count: report.regeneration_count + 1
        })
        .eq('id', report.id);

      if (updateError) throw updateError;

      // Update local state
      setReports(prev => prev.map(r => 
        r.id === report.id 
          ? { 
              ...r, 
              feedback: finalFeedback, 
              preview: getPreviewText(finalFeedback),
              context: newContext ?? r.context,
              regeneration_count: r.regeneration_count + 1
            }
          : r
      ));

      setExpandedReports(prev => new Set([...prev, report.id]));
      setHighlightedReport(report.id);
      
      setTimeout(() => {
        reportRefs.current[report.id]?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);

      toast.success('Report generated successfully!');
    } catch (error: any) {
      console.error('Error generating report:', error);
      
      if (error.code === 'INSUFFICIENT_FUNDS') {
        toast.error('Subscription limit reached. Please upgrade your plan.');
      } else if (error.code === 'UNSUPPORTED_FILE_TYPE') {
        toast.error('Unsupported file type. Please try a different format.');
      } else {
        toast.error(error.message || 'Failed to generate report');
      }

      const { error: updateError } = await supabase
        .from('reports')
        .update({ feedback: null })
        .eq('id', report.id);

      if (!updateError) {
        setReports(prev => prev.map(r => 
          r.id === report.id 
            ? { ...r, feedback: null, preview: '' }
            : r
        ));
      }
    } finally {
      setIsProcessing(false);
      setSelectedReport(null);
      processingReports.current.delete(report.id);
      setTimeout(() => setHighlightedReport(null), 2000);
    }
  };

  // ... rest of the component implementation remains the same

  return (
    // ... existing JSX remains the same until the report feedback section
    {report.feedback && (
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Context:
            </span>
            {editingContext === report.id ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value.slice(0, 100))}
                  className="px-2 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Add context (max 100 chars)"
                  maxLength={100}
                />
                <button
                  onClick={() => {
                    handleGenerateReport(report, contextInput);
                    setEditingContext(null);
                    setContextInput('');
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Save & Regenerate
                </button>
                <button
                  onClick={() => {
                    setEditingContext(null);
                    setContextInput('');
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {report.context || 'None'}
                </span>
                <button
                  onClick={() => {
                    setEditingContext(report.id);
                    setContextInput(report.context || '');
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Edit
                </button>
              </>
            )}
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Regenerations: {report.regeneration_count}/5
          </span>
        </div>
      </div>
    )}
    // ... rest of the JSX remains the same
  );
}

export default Dashboard;