import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function Debug() {
  const [testResult, setTestResult] = useState<string>('');
  const [authResult, setAuthResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const testBasicFetch = async () => {
    setIsLoading(true);
    setTestResult('Testing basic fetch...');
    
    try {
      const response = await fetch('/api/debug/test', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Test response status:', response.status);
      console.log('Test response headers:', Object.fromEntries(response.headers.entries()));
      console.log('Test response bodyUsed before:', response.bodyUsed);
      
      const responseText = await response.text();
      console.log('Test response text:', responseText);
      
      setTestResult(`Success: ${responseText}`);
    } catch (error) {
      console.error('Test fetch error:', error);
      setTestResult(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testAuthFetch = async () => {
    setIsLoading(true);
    setAuthResult('Testing auth fetch...');
    
    try {
      const response = await fetch('/api/debug/auth', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@debug.com',
          password: 'debugpass123'
        })
      });
      
      console.log('Auth response status:', response.status);
      console.log('Auth response headers:', Object.fromEntries(response.headers.entries()));
      console.log('Auth response bodyUsed before:', response.bodyUsed);
      
      const responseText = await response.text();
      console.log('Auth response text:', responseText);
      
      setAuthResult(`Success: ${responseText}`);
    } catch (error) {
      console.error('Auth fetch error:', error);
      setAuthResult(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testActualLogin = async () => {
    setIsLoading(true);
    setAuthResult('Testing actual login...');
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'chiragpoornamath@gmail.com',
          password: 'SecurePass2024!'
        })
      });
      
      console.log('Actual login response status:', response.status);
      console.log('Actual login response headers:', Object.fromEntries(response.headers.entries()));
      console.log('Actual login response bodyUsed before:', response.bodyUsed);
      
      // Check if body is already consumed
      if (response.bodyUsed) {
        setAuthResult('ERROR: Response body already consumed!');
        return;
      }
      
      // Clone the response to avoid consumption issues
      const responseClone = response.clone();
      
      // Try to get as text first
      const responseText = await response.text();
      console.log('Actual login response text:', responseText);
      
      // Try to parse as JSON
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (e) {
        console.error('JSON parse error:', e);
        setAuthResult(`JSON Parse Error: ${e}, Response: ${responseText}`);
        return;
      }
      
      setAuthResult(`Success: ${JSON.stringify(parsedResponse, null, 2)}`);
    } catch (error) {
      console.error('Actual login error:', error);
      setAuthResult(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Debug Response Issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={testBasicFetch} 
                disabled={isLoading}
                variant="outline"
              >
                Test Basic Fetch
              </Button>
              <Button 
                onClick={testAuthFetch} 
                disabled={isLoading}
                variant="outline"
              >
                Test Debug Auth
              </Button>
              <Button 
                onClick={testActualLogin} 
                disabled={isLoading}
                variant="default"
              >
                Test Actual Login
              </Button>
            </div>
            
            {testResult && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Basic Test Result:</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {testResult}
                </pre>
              </div>
            )}
            
            {authResult && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Auth Test Result:</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {authResult}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
