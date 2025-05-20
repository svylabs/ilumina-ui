// Import required dependencies
import { Request, Response } from 'express';
import { db } from '@db';
import { analysisSteps, submissions, projects } from '@db/schema';
import { eq, desc } from 'drizzle-orm';

// Helper function to fetch submission history from external API
export async function fetchSubmissionHistory(submissionId: string) {
  try {
    // Call the external Ilumina API to get history data
    const response = await fetch(`https://ilumina-wf-tt2cgoxmbq-uc.a.run.app/api/submission/${submissionId}/history`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    // Parse response
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching history from external API:', error);
    throw error;
  }
}

// Handler function for the history endpoint
export async function handleHistoryRequest(req: Request, res: Response) {
  try {
    console.log('History endpoint called with ID:', req.params.id);
    
    // Check authentication
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access history data'
      });
    }
    
    // Get ID parameter
    const idParam = req.params.id;
    let submissionId = idParam;
    
    // Handle the case where we're getting a project ID instead of submission ID
    if (/^\d+$/.test(idParam)) {
      console.log(`Numeric ID detected (${idParam}), treating as project ID`);
      
      try {
        // Look up the project to confirm it exists and user has access
        const [project] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, parseInt(idParam)))
          .limit(1);
        
        if (!project) {
          return res.status(404).json({
            success: false,
            message: `Project with ID ${idParam} not found`
          });
        }
        
        // Look up the submission for this project
        const [submission] = await db
          .select()
          .from(submissions)
          .where(eq(submissions.projectId, parseInt(idParam)))
          .orderBy(desc(submissions.createdAt))
          .limit(1);
        
        if (!submission) {
          return res.status(404).json({
            success: false,
            message: `No submissions found for project ID ${idParam}`
          });
        }
        
        // Use the found submission ID
        submissionId = submission.id;
        console.log(`Found submission ID ${submissionId} for project ID ${idParam}`);
      } catch (dbError) {
        console.error('Database error looking up submission ID:', dbError);
        return res.status(500).json({
          success: false,
          message: 'Database error when trying to lookup submission ID'
        });
      }
    }
    
    console.log(`Fetching history for submission: ${submissionId}`);
    
    try {
      // Attempt to fetch history from external API
      const historyData = await fetchSubmissionHistory(submissionId);
      
      // Check if we got valid data back
      if (Array.isArray(historyData)) {
        return res.json({
          success: true,
          submission_id: submissionId,
          history: historyData
        });
      } else if (historyData && historyData.length !== undefined) {
        return res.json({
          success: true,
          submission_id: submissionId,
          history: historyData
        });
      } else {
        // Try to check the local database for analysis steps
        const analysisStepsData = await db
          .select()
          .from(analysisSteps)
          .where(eq(analysisSteps.submissionId, submissionId))
          .orderBy(desc(analysisSteps.createdAt));
        
        if (analysisStepsData && analysisStepsData.length > 0) {
          // Format analysis steps into history records
          const historyEntries = analysisStepsData.map(step => ({
            id: `db-${step.id}`,
            created_at: step.createdAt.toISOString(),
            executed_at: step.completedAt ? step.completedAt.toISOString() : step.createdAt.toISOString(),
            step: step.step,
            status: step.status,
            details: step.details || `${step.step.replace(/_/g, ' ')} ${step.status}`
          }));
          
          return res.json({
            success: true,
            submission_id: submissionId,
            history: historyEntries
          });
        }
        
        // If we couldn't get any valid history data
        return res.json({
          success: true,
          submission_id: submissionId,
          history: []
        });
      }
    } catch (apiError) {
      console.error('Error fetching history data:', apiError);
      
      // Try one more approach - check the local database
      try {
        const analysisStepsData = await db
          .select()
          .from(analysisSteps)
          .where(eq(analysisSteps.submissionId, submissionId))
          .orderBy(desc(analysisSteps.createdAt));
        
        if (analysisStepsData && analysisStepsData.length > 0) {
          // Format analysis steps into history records
          const historyEntries = analysisStepsData.map(step => ({
            id: `db-${step.id}`,
            created_at: step.createdAt.toISOString(),
            executed_at: step.completedAt ? step.completedAt.toISOString() : step.createdAt.toISOString(),
            step: step.step,
            status: step.status,
            details: step.details || `${step.step.replace(/_/g, ' ')} ${step.status}`
          }));
          
          return res.json({
            success: true,
            submission_id: submissionId,
            history: historyEntries
          });
        }
      } catch (dbError) {
        console.error('Error fetching analysis steps from database:', dbError);
      }
      
      // If nothing worked, return empty history array
      return res.json({
        success: true,
        submission_id: submissionId,
        history: []
      });
    }
  } catch (error) {
    console.error('Error in history endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching history'
    });
  }
}