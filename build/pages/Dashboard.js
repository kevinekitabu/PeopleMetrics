import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import { processReport } from '../lib/deepseek';
import toast from 'react-hot-toast';
import DocumentViewer from '../components/DocumentViewer';
import LoadingAnimation from '../components/LoadingAnimation';
import { Link } from 'react-router-dom';
const SUPPORTED_EXTENSIONS = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'xls', 'csv'];
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
function getPreviewText(feedback) {
    if (!feedback)
        return '';
    const lines = feedback.split('\n');
    const firstParagraph = lines.find(line => line.trim().length > 0) || '';
    return firstParagraph.length > 150 ? `${firstParagraph.slice(0, 150)}...` : firstParagraph;
}
function sanitizeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9\-_\.]/g, '-');
}
export default function Dashboard() {
    const { user, signOut } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [reports, setReports] = useState([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedReport, setSelectedReport] = useState(null);
    const [expandedReports, setExpandedReports] = useState(new Set());
    const [viewingDocument, setViewingDocument] = useState(null);
    const [highlightedReport, setHighlightedReport] = useState(null);
    const reportRefs = useRef({});
    const fetchReports = async () => {
        if (!user?.id)
            return;
        try {
            const { data, error } = await supabase
                .from('reports')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error)
                throw error;
            if (data) {
                const updatedReports = data.map(report => ({
                    ...report,
                    created_at: new Date(report.created_at),
                    preview: getPreviewText(report.feedback)
                }));
                setReports(updatedReports);
                if (selectedReport) {
                    const updatedReport = updatedReports.find(r => r.id === selectedReport.id);
                    if (updatedReport?.feedback) {
                        setExpandedReports(prev => new Set([...prev, updatedReport.id]));
                        setHighlightedReport(updatedReport.id);
                        setTimeout(() => {
                            reportRefs.current[updatedReport.id]?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }, 100);
                        setTimeout(() => setHighlightedReport(null), 2000);
                    }
                }
            }
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error fetching reports:', error);
                toast.error(`Failed to fetch reports: ${error.message}`);
            }
        }
    };
    useEffect(() => {
        if (!user?.id)
            return;
        const initializeStorage = async () => {
            try {
                const { data: buckets, error: listError } = await supabase.storage.listBuckets();
                if (listError)
                    throw listError;
                const reportsBucket = buckets?.find(bucket => bucket.name === 'reports');
                if (!reportsBucket) {
                    const { error: createError } = await supabase.storage.createBucket('reports', {
                        public: false,
                        fileSizeLimit: 52428800,
                        allowedMimeTypes: Object.keys(MIME_TYPES)
                    });
                    if (createError)
                        throw createError;
                }
                setIsInitialized(true);
            }
            catch (error) {
                if (error instanceof Error && error.message === 'The resource already exists') {
                    setIsInitialized(true);
                    return;
                }
                console.error('Error initializing storage:', error);
                toast.error('Failed to initialize storage');
            }
        };
        initializeStorage().then(() => fetchReports());
        const channel = supabase
            .channel('reports_changes')
            .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'reports',
            filter: `user_id=eq.${user.id}`
        }, () => fetchReports())
            .subscribe();
        return () => {
            channel.unsubscribe();
        };
    }, [user?.id]);
    const toggleReportExpansion = (reportId) => {
        setExpandedReports(prev => {
            const newSet = new Set(prev);
            if (newSet.has(reportId)) {
                newSet.delete(reportId);
            }
            else {
                newSet.add(reportId);
            }
            return newSet;
        });
    };
    const getFileExtension = (filename) => {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop()?.toLowerCase() || null : null;
    };
    const validateFileExtension = (filename) => {
        const extension = getFileExtension(filename);
        return extension !== null && SUPPORTED_EXTENSIONS.includes(extension);
    };
    const onDrop = useCallback(async (acceptedFiles) => {
        if (!acceptedFiles.length || !user?.id || !isInitialized) {
            if (!isInitialized) {
                toast.error('Storage is not initialized yet. Please try again in a moment.');
            }
            return;
        }
        const file = acceptedFiles[0];
        if (!validateFileExtension(file.name)) {
            const extension = getFileExtension(file.name) || 'unknown';
            toast.error(`Unsupported file type: .${extension}. Please upload a supported file type.`);
            return;
        }
        setIsUploading(true);
        setUploadProgress(0);
        try {
            const sanitizedFileName = sanitizeFileName(file.name);
            const timestamp = Date.now();
            const fileName = `${timestamp}-${sanitizedFileName}`;
            const filePath = `${user.id}/${fileName}`;
            const uploadTask = supabase.storage
                .from('reports')
                .upload(filePath, file);
            const { error: uploadError } = await uploadTask;
            if (uploadError)
                throw uploadError;
            const { error: insertError } = await supabase
                .from('reports')
                .insert({
                user_id: user.id,
                file_path: filePath,
                feedback: null
            });
            if (insertError)
                throw insertError;
            // Fetch reports immediately after successful upload
            await fetchReports();
            toast.success('File uploaded successfully. Click "Generate Report" to analyze it.');
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error uploading file:', error);
                toast.error(error.message || 'Failed to upload file');
            }
        }
        finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    }, [user?.id, isInitialized]);
    const handleGenerateReport = async (report) => {
        try {
            setIsProcessing(true);
            setSelectedReport(report);
            const { data: urlData } = await supabase.storage
                .from('reports')
                .createSignedUrl(report.file_path, 60 * 60);
            if (!urlData?.signedUrl) {
                throw new Error('Failed to get file URL');
            }
            const result = await processReport(urlData.signedUrl);
            const { error: updateError } = await supabase
                .from('reports')
                .update({ feedback: result })
                .eq('id', report.id);
            if (updateError)
                throw updateError;
            // Fetch reports to get the updated data
            await fetchReports();
            setExpandedReports(prev => new Set([...prev, report.id]));
            setHighlightedReport(report.id);
            setTimeout(() => {
                reportRefs.current[report.id]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }, 100);
            toast.success('Report generated successfully');
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error generating report:', error);
                toast.error(error.message || 'Failed to generate report');
            }
        }
        finally {
            setIsProcessing(false);
            setSelectedReport(null);
            setTimeout(() => setHighlightedReport(null), 2000);
        }
    };
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: MIME_TYPES,
        maxSize: 52428800,
        multiple: false
    });
    const handleViewDocument = async (report) => {
        try {
            const { data: urlData } = await supabase.storage
                .from('reports')
                .createSignedUrl(report.file_path, 60 * 60);
            if (!urlData?.signedUrl) {
                throw new Error('Failed to get file URL');
            }
            setViewingDocument(urlData.signedUrl);
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Error getting document URL:', error);
                toast.error('Failed to view document');
            }
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gray-100", children: [_jsx("nav", { className: "bg-white shadow-sm", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [_jsx(Link, { to: "/", className: "text-xl font-semibold text-indigo-600 hover:text-indigo-700", children: "PeopleMetrics" }), _jsx("span", { className: "text-gray-300", children: "|" }), _jsx("h1", { className: "text-xl font-semibold text-gray-900", children: "Dashboard" })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "text-gray-600", children: user?.email }), _jsx("button", { onClick: () => signOut(), className: "px-4 py-2 text-sm text-red-600 hover:text-red-800", children: "Logout" })] })] }) }), _jsx("main", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { ...getRootProps(), className: `border-2 border-dashed rounded-lg p-8 text-center ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}`, children: [_jsx("input", { ...getInputProps() }), isUploading ? (_jsx(LoadingAnimation, { type: "upload", progress: uploadProgress })) : !isInitialized ? (_jsx("p", { className: "text-gray-600", children: "Initializing storage..." })) : isDragActive ? (_jsx("p", { className: "text-indigo-600", children: "Drop the files here..." })) : (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-gray-600", children: "Drag 'n' drop some files here, or click to select files" }), _jsx("p", { className: "text-sm text-gray-500", children: "Supported files: .txt, .csv, .pdf, .xlsx, .xls, .png, .jpg, .jpeg, .docx (max 50MB)" })] }))] }), reports.length > 0 && (_jsxs("div", { className: "mt-8", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Previous Reports" }), _jsx("div", { className: "space-y-4", children: reports.map((report) => (_jsxs("div", { ref: el => reportRefs.current[report.id] = el, className: `bg-gray-50 p-4 rounded-lg transition-all duration-500 ${highlightedReport === report.id
                                            ? 'ring-2 ring-indigo-500 shadow-lg transform scale-[1.02]'
                                            : ''}`, children: [_jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("p", { className: "text-sm text-gray-500", children: report.created_at.toLocaleString() }), _jsx("p", { className: "text-sm text-gray-500", children: report.file_path.split('/').pop()?.split('-').slice(1).join('-') })] }), report.preview && !expandedReports.has(report.id) && (_jsx("p", { className: "text-sm text-gray-600", children: report.preview }))] }), _jsxs("div", { className: "flex gap-2 ml-4", children: [_jsx("button", { onClick: () => handleViewDocument(report), className: "px-3 py-1 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 rounded", children: "View Document" }), report.feedback && (_jsx("button", { onClick: () => toggleReportExpansion(report.id), className: "px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded", children: expandedReports.has(report.id) ? 'Collapse' : 'Expand' })), isProcessing && selectedReport?.id === report.id ? (_jsx("div", { className: "flex-1 flex justify-center", children: _jsx(LoadingAnimation, { type: "generate" }) })) : (_jsx("button", { onClick: () => handleGenerateReport(report), className: "px-3 py-1 text-sm text-white rounded bg-indigo-600 hover:bg-indigo-700", children: report.feedback ? 'Regenerate Report' : 'Generate Report' }))] })] }), expandedReports.has(report.id) && report.feedback && (_jsx("div", { className: "mt-4 border-t pt-4", children: _jsx("pre", { className: "whitespace-pre-wrap text-sm", children: report.feedback }) }))] }, report.id))) })] })), viewingDocument && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg w-full max-w-6xl", children: [_jsxs("div", { className: "p-4 border-b flex justify-between items-center", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Document Viewer" }), _jsx("button", { onClick: () => setViewingDocument(null), className: "text-gray-500 hover:text-gray-700", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsx("div", { className: "p-4", children: _jsx(DocumentViewer, { url: viewingDocument }) })] }) }))] }) })] }));
}
