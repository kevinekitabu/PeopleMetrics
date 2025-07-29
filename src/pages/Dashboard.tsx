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
import { useLocalStorage } from '../utils/localStorage';

const Tour = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to the Dashboard!',
      description: 'This is your main hub for managing reports and files.',
      target: null,
    },
    {
      title: 'Upload Files',
      description: 'Drag and drop files here to upload and start generating reports.',
      target: '.dropzone',
    },
    {
      title: 'Reports List',
      description: 'View and manage your reports here. You can edit, regenerate, or delete them.',
      target: '.reports-list',
    },
    {
      title: 'Theme Toggle',
      description: 'Switch between light and dark mode using this toggle.',
      target: '.theme-toggle',
    },
    {
      title: 'Sign Out',
      description: 'Click here to sign out of your account.',
      target: '.sign-out-button',
    },
  ];

  const currentStep = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="tour-overlay">
      <div className="tour-content" style={{ position: 'relative' }}>
        <h2>{currentStep.title}</h2>
        <p>{currentStep.description}</p>
        <button onClick={handleNext}>
          {step < steps.length - 1 ? 'Next' : 'Finish'}
        </button>
      </div>
      {currentStep.target && (
        <div
          className="tour-highlight"
          style={{
            position: 'absolute',
            border: '2px solid #4F46E5',
            borderRadius: '8px',
            padding: '4px',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            zIndex: 1000,
          }}
        >
          {/* Highlight logic can be implemented here */}
        </div>
      )}
    </div>
  );
};

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
  context: string;
  regeneration_count: number;
  is_generating: boolean;
  stop_requested: boolean;
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
  const [editingContext, setEditingContext] = useState<string | null>(null);
  const [contextInput, setContextInput] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const reportRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const processingReports = useRef<Set<string>>(new Set());

  const [isFirstTime, setIsFirstTime] = useLocalStorage('isFirstTimeUser', true);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (isFirstTime) {
      setShowTour(true);
    }
  }, [isFirstTime]);

  const handleCloseTour = () => {
    setShowTour(false);
    setIsFirstTime(false);
  };

  const handleStopGeneration = async (report: Report) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          stop_requested: true,
          is_generating: false
        })
        .eq('id', report.id);

      if (error) throw error;

      setReports(prev => prev.map(r => 
        r.id === report.id 
          ? { ...r, stop_requested: true, is_generating: false }
          : r
      ));

      processingReports.current.delete(report.id);
      setSelectedReport(null);
      setIsProcessing(false);
      toast.success('Report generation stopped');
    } catch (error) {
      console.error('Error stopping generation:', error);
      toast.error('Failed to stop report generation');
    }
  };

  const handleGenerateReport = async (report: Report, newContext?: string) => {
    if (processingReports.current.has(report.id)) {
      toast.error('This report is already being processed');
      return;
    }

    if (report.regeneration_count >= 5) {
      toast.error('Maximum regeneration limit reached for this report');
      return;
    }

    try {
      // Update generation status
      const { error: statusError } = await supabase
        .from('reports')
        .update({ is_generating: true })
        .eq('id', report.id);

      if (statusError) throw statusError;

      setIsProcessing(true);
      setSelectedReport(report);
      processingReports.current.add(report.id);

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

      // Process files with stop check
      const processPromises = report.files.map(async (file) => {
        // Check if stop was requested
        const { data: reportStatus } = await supabase
          .from('reports')
          .select('stop_requested')
          .eq('id', report.id)
          .single();

        if (reportStatus?.stop_requested) {
          throw new Error('Generation stopped by user');
        }

        const { data: urlData, error: urlError } = await supabase.storage
          .from('reports')
          .createSignedUrl(file.path, 3600);

        if (urlError) throw urlError;
        if (!urlData?.signedUrl) throw new Error('Failed to get file URL');

        return processReport(urlData.signedUrl);
      });

      const results = await Promise.all(processPromises);
      const combinedFeedback = results.join('\n\n---\n\n');

      const finalFeedback = report.context 
        ? `Context: ${report.context}\n\n${combinedFeedback}`
        : combinedFeedback;

      const { error: updateError } = await supabase
        .from('reports')
        .update({ 
          feedback: finalFeedback,
          regeneration_count: report.regeneration_count + 1,
          is_generating: false
        })
        .eq('id', report.id);

      if (updateError) throw updateError;

      setReports(prev => prev.map(r => 
        r.id === report.id 
          ? { 
              ...r, 
              feedback: finalFeedback, 
              preview: getPreviewText(finalFeedback),
              context: newContext ?? r.context,
              regeneration_count: r.regeneration_count + 1,
              is_generating: false
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
      
      if (error.message === 'Generation stopped by user') {
        toast.success('Report generation stopped');
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        toast.error('Subscription limit reached. Please upgrade your plan.');
      } else if (error.code === 'UNSUPPORTED_FILE_TYPE') {
        toast.error('Unsupported file type. Please try a different format.');
      } else {
        toast.error(error.message || 'Failed to generate report');
      }

      // Reset generation status
      const { error: updateError } = await supabase
        .from('reports')
        .update({ 
          is_generating: false,
          stop_requested: false
        })
        .eq('id', report.id);

      if (!updateError) {
        setReports(prev => prev.map(r => 
          r.id === report.id 
            ? { ...r, is_generating: false, stop_requested: false }
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

  const fetchReports = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reportsWithPreviews = data.map(report => ({
        ...report,
        preview: getPreviewText(report.feedback),
        created_at: new Date(report.created_at),
        updated_at: new Date(report.updated_at)
      }));

      setReports(reportsWithPreviews);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to fetch reports');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchReports();
  }, [user, fetchReports]);

  const handleDeleteReport = async (report: Report) => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete the report (this will trigger the storage cleanup via database trigger)
      const { error: deleteError } = await supabase
        .from('reports')
        .delete()
        .eq('id', report.id);

      if (deleteError) throw deleteError;

      // Update local state
      setReports(prev => prev.filter(r => r.id !== report.id));
      toast.success('Report deleted successfully');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) return;

    try {
      const files = acceptedFiles.slice(0, MAX_FILES);
      setIsUploading(true);

      const uploadPromises = files.map(async (file) => {
        const fileName = sanitizeFileName(file.name);
        const filePath = `${user.id}/${Date.now()}-${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(filePath, file);

        if (!uploadError) {
          setUploadProgress(prev => ({
            ...prev,
            [fileName]: { loaded: file.size, total: file.size }
          }));
        }

        if (uploadError) throw uploadError;

        return {
          path: filePath,
          name: fileName,
          type: file.type
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      const { data: report, error: insertError } = await supabase
        .from('reports')
        .insert([
          {
            user_id: user.id,
            files: uploadedFiles,
            title: 'New Report',
            description: '',
            context: '',
            regeneration_count: 0,
            is_generating: false,
            stop_requested: false
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      const newReport = {
        ...report,
        preview: '',
        created_at: new Date(report.created_at),
        updated_at: new Date(report.updated_at)
      };

      setReports(prev => [newReport, ...prev]);
      toast.success('Files uploaded successfully');
      
    } catch (error: any) {
      console.error('Error uploading files:', error);
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: MIME_TYPES,
    maxFiles: MAX_FILES,
    maxSize: MAX_FILE_SIZE,
    multiple: true
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleDownload = async (report: Report) => {
    if (!report.feedback) return;
    
    try {
      const fileName = report.title || 'report';
      await generateAndDownloadDocx(report.feedback, fileName);
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    }
  };

  const handleViewDocument = async (filePath: string) => {
    try {
      // Verify file exists before generating URL
      const { data: exists, error: existsError } = await supabase.storage
        .from('reports')
        .list(filePath.split('/').slice(0, -1).join('/'));

      if (existsError) throw existsError;

      const fileName = filePath.split('/').pop();
      if (!exists.some(file => file.name === fileName)) {
        throw new Error('File not found');
      }

      const { data, error } = await supabase.storage
        .from('reports')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      setViewingDocument(data.signedUrl);
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('File not found or access denied');
    }
  };

  const handleUpdateReport = async (report: Report, updates: Partial<Report>) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update(updates)
        .eq('id', report.id);

      if (error) throw error;

      setReports(prev => prev.map(r => 
        r.id === report.id 
          ? { ...r, ...updates }
          : r
      ));

      toast.success('Report updated successfully');
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Failed to update report');
    }
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--background))]">
      {showTour && <Tour onClose={handleCloseTour} />}
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
                PeopleMetrics
              </Link>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-gray-600 dark:text-gray-300">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 sign-out-button"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 mb-8 text-center cursor-pointer transition-all dropzone
            ${isDragActive 
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10' 
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="space-y-4">
              <LoadingAnimation type="upload" progress={Object.values(uploadProgress)[0]?.loaded / Object.values(uploadProgress)[0]?.total * 100} />
            </div>
          ) : isProcessing ? (
            <div className="space-y-4">
              <LoadingAnimation type="generate" />
            </div>
          ) : (
            <div>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                Drag & drop files here, or click to select
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Supported formats: {SUPPORTED_EXTENSIONS.join(', ')}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4 reports-list">
          {!isInitialized ? (
            <div className="text-center py-8">
              <LoadingAnimation type="upload" />
              <p className="text-gray-500 dark:text-gray-400 mt-4">Loading your reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No reports yet. Upload files to get started!
            </div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                ref={el => reportRefs.current[report.id] = el}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300
                  ${highlightedReport === report.id ? 'ring-2 ring-indigo-500' : ''}`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {report.title}
                        </h3>
                        <button
                          onClick={() => handleDeleteReport(report)}
                          className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {report.files.map((file, index) => (
                          <button
                            key={index}
                            onClick={() => handleViewDocument(file.path)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            {file.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">
                      {report.created_at.toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mb-4 flex items-center justify-between">
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

                  {report.feedback ? (
                    <>
                      <div className="prose dark:prose-invert max-w-none mb-4">
                        {expandedReports.has(report.id) ? (
                          <pre className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300 font-mono">
                            {report.feedback}
                          </pre>
                        ) : (
                          <p className="text-gray-600 dark:text-gray-300">{report.preview}</p>
                        )}
                      </div>
                      <div className="flex space-x-4">
                        <button
                          onClick={() => setExpandedReports(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(report.id)) {
                              newSet.delete(report.id);
                            } else {
                              newSet.add(report.id);
                            }
                            return newSet;
                          })}
                          className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          {expandedReports.has(report.id) ? 'Show Less' : 'Show More'}
                        </button>
                        <button
                          onClick={() => handleDownload(report)}
                          className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Download Report
                        </button>
                        {report.regeneration_count < 5 && (
                          <button
                            onClick={() => handleGenerateReport(report)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                            disabled={report.is_generating}
                          >
                            {report.is_generating ? (
                              <div className="flex items-center space-x-2">
                                <TypingAnimation text="Generating..." />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStopGeneration(report);
                                  }}
                                  className="ml-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              'Regenerate'
                            )}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      {report.is_generating ? (
                        <div className="flex items-center space-x-2">
                          <TypingAnimation text="Generating report..." />
                          <button
                            onClick={() => handleStopGeneration(report)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-gray-600 dark:text-gray-300">No report generated yet</span>
                          <button
                            onClick={() => handleGenerateReport(report)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            Generate Report
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {viewingDocument && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Document Preview</h2>
                <button
                  onClick={() => setViewingDocument(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 h-[calc(90vh-8rem)] overflow-auto">
                <DocumentViewer url={viewingDocument} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;