// Verification log helper functions
import { classifyUserRequest } from './gemini';

/**
 * Parses logs from the step_metadata field in the API response
 * Specifically handles the verify_deployment_script data format
 * @param stepMetadata The raw step_metadata content from the API
 * @returns Formatted log string
 */
export function parseVerificationLogs(stepMetadata: any): { logs: string, error?: string, returnCode?: number, contractAddresses?: any } {
  if (!stepMetadata || !stepMetadata.verify_deployment_script) {
    return { logs: 'No verification logs found.', error: 'Missing verify_deployment_script data' };
  }
  
  try {
    let verificationData = stepMetadata.verify_deployment_script;
    
    // If it's a string, try to parse it as JSON
    if (typeof verificationData === 'string') {
      try {
        if (verificationData.trim().startsWith('[') || verificationData.trim().startsWith('{')) {
          verificationData = JSON.parse(verificationData);
        }
      } catch (jsonError) {
        console.warn('Could not parse verification data as JSON, using as-is');
      }
    }
    
    // Handle array format: [returnCode, contractaddressmapping, stdout, stderr]
    if (Array.isArray(verificationData)) {
      const [returnCode, contractAddresses, stdout, stderr] = verificationData;
      
      // Combine stdout and stderr for logs
      let combinedLogs = '';
      
      if (stdout) {
        combinedLogs += `=== STDOUT ===\n${stdout}\n\n`;
      }
      
      if (stderr) {
        combinedLogs += `=== STDERR ===\n${stderr}`;
      }
      
      // If there's no output in either stream, provide a basic message based on return code
      if (!combinedLogs) {
        if (returnCode === 0) {
          combinedLogs = 'Verification completed successfully with no output.';
        } else {
          combinedLogs = `Verification failed with return code ${returnCode}.`;
        }
      }
      
      return { 
        logs: combinedLogs, 
        returnCode: Number(returnCode),
        contractAddresses,
        error: returnCode !== 0 ? `Verification failed with code ${returnCode}` : undefined
      };
    }
    
    // Handle object format with log property
    if (verificationData && verificationData.log) {
      // Format log data consistently
      if (Array.isArray(verificationData.log)) {
        return { logs: verificationData.log.join('\n') };
      } else {
        return { logs: String(verificationData.log) };
      }
    }
    
    // If it's just a string, return it directly
    if (typeof verificationData === 'string') {
      return { logs: verificationData };
    }
    
    return { logs: 'Verification logs format is invalid', error: 'Invalid log format' };
  } catch (parseError: any) {
    console.error('Error parsing verification logs:', parseError);
    return { 
      logs: `Error parsing verification data: ${parseError.message}`, 
      error: parseError.message 
    };
  }
}

/**
 * Extracts error messages from verification logs
 * @param logs Verification logs as a string
 * @returns The most relevant error message
 */
export function extractErrorMessage(logs: string): string {
  // Look for known error patterns in the logs
  const errorPatterns = [
    /SyntaxError: ([^\n]+)/,
    /Error: ([^\n]+)/,
    /TypeError: ([^\n]+)/,
    /\berror\b.*?([^\n]+)/i
  ];
  
  for (const pattern of errorPatterns) {
    const match = logs.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // If no specific error pattern was found, return a generic message
  // or a segment of the logs if it's short enough
  if (logs.length < 100) {
    return logs;
  }
  
  return 'Verification failed. Check the logs for detailed error information.';
}

/**
 * Format user-friendly explanation of verification errors
 * @param logs Verification logs
 * @returns Explanation of the error
 */
export function explainVerificationError(logs: string): string {
  const errorMessage = extractErrorMessage(logs);
  
  // Check for specific error types and provide helpful explanations
  if (errorMessage.includes('SyntaxError')) {
    return `The deployment script has a syntax error: ${errorMessage}. This is likely a JavaScript syntax issue in the deployment code.`;
  }
  
  if (errorMessage.includes('already been declared')) {
    return `The deployment script has a duplicate variable declaration: ${errorMessage}. You need to rename one of the variables or remove the duplicate declaration.`;
  }
  
  if (errorMessage.includes('is not defined') || errorMessage.includes('is not a function')) {
    return `The deployment script references a function or variable that doesn't exist: ${errorMessage}. Make sure all dependencies are properly imported and variables are correctly defined.`;
  }
  
  // Default explanation if no specific pattern matches
  return `The verification failed with error: ${errorMessage}. Please review the detailed logs for more information.`;
}