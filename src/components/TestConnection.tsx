import { useState } from 'react';
import toast from 'react-hot-toast';

export default function TestConnection() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testEdgeFunction = async () => {
    setTesting(true);
    setResult(null);

    try {
      console.log('Testing edge function...');
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-connection`;
      console.log('Test URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ test: 'data' })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      setResult(data);
      
      if (data.success) {
        toast.success('Edge function is working!');
      } else {
        toast.error('Edge function returned error');
      }

    } catch (error) {
      console.error('Test error:', error);
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error('Edge function test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Test Supabase Edge Functions
      </h3>
      
      <div className="space-y-4">
        <button
          onClick={testEdgeFunction}
          disabled={testing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {testing ? 'Testing...' : 'Test Edge Function'}
        </button>

        {result && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Test Result:
            </h4>
            <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p><strong>Supabase URL:</strong> {import.meta.env.VITE_SUPABASE_URL || 'Not set'}</p>
          <p><strong>Supabase Key:</strong> {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing'}</p>
        </div>
      </div>
    </div>
  );
}