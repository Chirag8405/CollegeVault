import { RequestHandler } from 'express';

// Debug endpoint to test response handling
export const handleDebugTest: RequestHandler = (req, res) => {
  try {
    console.log('Debug test endpoint called');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    
    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const response = {
      success: true,
      message: 'Debug test successful',
      timestamp: new Date().toISOString(),
      requestInfo: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
      }
    };
    
    console.log('Sending debug response:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('Debug test error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Test auth simulation
export const handleDebugAuth: RequestHandler = (req, res) => {
  try {
    console.log('Debug auth endpoint called');
    
    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    const { email, password } = req.body;
    
    const response = {
      success: true,
      message: 'Debug auth successful',
      user: {
        id: 'debug-user-123',
        name: 'Debug User',
        email: email || 'debug@test.com'
      },
      token: 'debug-token-' + Date.now(),
      debug: {
        requestMethod: req.method,
        receivedEmail: email,
        receivedPassword: password ? '[HIDDEN]' : 'Not provided'
      }
    };
    
    console.log('Sending debug auth response:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('Debug auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug auth failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
