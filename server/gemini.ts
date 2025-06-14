import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Initialize the Google Generative AI SDK with the API key
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

// Create a model instance for Gemini
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash', // Using the Gemini 2.0 Flash model which is optimized for chat applications
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

// Create a separate model for request classification to keep it isolated
const classificationModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

// The defined analysis steps that we support
export type AnalysisStep = 
  | 'analyze_actors' 
  | 'analyze_project' 
  | 'analyze_deployment' 
  | 'verify_deployment_script' 
  | 'unknown';

// The actions that can be taken based on the request
export type RequestAction = 
  | 'refine' 
  | 'clarify' 
  | 'update' 
  | 'run' 
  | 'needs_followup' 
  | 'unknown';

// The type of conversation continuation
export type ConversationType = 
  | 'continue_conversation' 
  | 'new_conversation';

// Result of request classification
export type ClassificationResult = {
  step: AnalysisStep;
  action: RequestAction;
  confidence: number;
  explanation: string;
  isActionable: boolean; // Whether the request requires taking an action vs just answering a question
};

// Result of conversation classification
export type ConversationClassificationResult = {
  type: ConversationType;
  confidence: number;
  explanation: string;
};

// Function to classify a user request
export async function classifyUserRequest(
  userMessage: string,
  context?: {
    projectName?: string;
    section?: string;
    currentStep?: string;
  }
): Promise<ClassificationResult> {
  try {
    const classificationPrompt = `
    You are a blockchain analysis assistant that classifies user requests into specific steps and actions.

    STEPS (choose one):
    - analyze_actors: Request about actors in the smart contract, their roles, permissions, or interactions
    - analyze_project: Request about the overall project, its purpose, architecture, or general questions
    - analyze_deployment: Request about deployment of smart contracts, deployment strategy, infrastructure, deployment script, deployment instructions or implementation details related to deployment
    - verify_deployment_script: Request to verify, validate, or run the deployment script
    - unknown: If the request doesn't clearly fit into any of the above steps

    ACTIONS (choose one):
    - refine: User wants to refine or improve some aspect of the analysis
    - clarify: User is asking for clarification or explanation about existing content
    - update: User is providing additional information to update the context
    - run: User wants to execute or run something (like a verification)
    - needs_followup: User is asking about how to do something or asking for guidance/next steps
    - unknown: If the action isn't clear
    
    IS_ACTIONABLE:
    Determine if the request requires taking some action (modifying something) vs just answering a question.
    - true: The request requires you to make changes or execute something
    - false: The request is just asking for information or explanation with no changes needed

    Project context: ${context?.projectName || 'Unknown'}
    Current section: ${context?.section || 'Unknown'}
    Current step: ${context?.currentStep || 'Unknown'}

    USER REQUEST: "${userMessage}"

    Analyze this request and respond with ONLY a JSON object in this exact format:
    {
      "step": "[one of the STEPS above]",
      "action": "[one of the ACTIONS above]", 
      "confidence": [number between 0 and 1],
      "explanation": "[brief explanation of your classification]",
      "isActionable": true or false
    }
    `;

    const result = await classificationModel.generateContent(classificationPrompt);
    const resultText = result.response.text();
    
    // Extract JSON from the response (in case the model includes any other text)
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not extract JSON from classification response:', resultText);
      return { 
        step: 'unknown', 
        action: 'unknown',
        confidence: 0,
        explanation: 'Failed to classify request',
        isActionable: false // Default to non-actionable when classification fails
      };
    }
    
    try {
      const classification = JSON.parse(jsonMatch[0]) as ClassificationResult;
      console.log('Request classification:', classification);
      return classification;
    } catch (parseError) {
      console.error('Error parsing classification JSON:', parseError);
      return { 
        step: 'unknown', 
        action: 'unknown',
        confidence: 0,
        explanation: 'Failed to parse classification',
        isActionable: false // Default to non-actionable when parsing fails
      };
    }
  } catch (error) {
    console.error('Error classifying user request:', error);
    return { 
      step: 'unknown', 
      action: 'unknown',
      confidence: 0,
      explanation: 'Error during classification',
      isActionable: false // Default to non-actionable when classification fails
    };
  }
}

// Function to generate a chat response
// Function to generate a checklist from user request using Gemini
export async function generateChecklist(
  allMessages: ChatMessage[],
  context?: {
    projectName?: string;
    section?: string;
    analysisStep?: string;
    sectionData?: any;
    submissionId?: string;
  }
): Promise<string> {
  try {
    // Extract all user messages to understand the full context
    const userMessages = allMessages.filter(msg => msg.role === 'user');
    
    if (userMessages.length === 0) {
      return "I couldn't find any user messages to summarize.";
    }
    
    // Format the full conversation history with roles for better context
    const conversationHistory = allMessages.map(msg => 
      `${msg.role.toUpperCase()}: ${msg.content}`
    ).join('\n');
    
    // Create a better structured section context when available
    let sectionContext = '';
    
    // Try to extract structured data from the section context if available
    if (context?.section && context?.sectionData) {
      try {
        console.log('Section data available for checklist generation:', {
          section: context.section,
          hasData: !!context.sectionData,
          dataKeys: context.sectionData ? Object.keys(context.sectionData) : []
        });
        
        // Include relevant section data as context with proper formatting
        if (context.section === 'actor_summary' && context.sectionData.actors) {
          sectionContext = '\n\nCURRENT ACTORS IN SYSTEM:\n';
          
          if (Array.isArray(context.sectionData.actors)) {
            sectionContext += context.sectionData.actors
              .map((actor: any) => `- ${actor.name}: ${actor.summary}`)
              .join('\n');
          }
        } else if (context.section === 'project_summary' && context.sectionData.project_summary) {
          sectionContext = `\n\nCURRENT PROJECT SUMMARY:\n${context.sectionData.project_summary}`;
        } else if (context.section === 'deployment_instructions' && context.sectionData.deployment_instructions) {
          // Extract just the beginning of deployment instructions to avoid too much text
          const instructionsPreview = typeof context.sectionData.deployment_instructions === 'string' 
            ? context.sectionData.deployment_instructions.substring(0, 200) + '...' 
            : 'Available but not shown in full due to length';
            
          sectionContext = `\n\nCURRENT DEPLOYMENT INSTRUCTIONS PREVIEW:\n${instructionsPreview}`;
        }
      } catch (err) {
        console.error('Error processing section data for checklist generation:', err);
        // Continue without section context if there's an error
      }
    }
    
    // Create an improved prompt that clearly guides the model to analyze the full conversation
    const checklistPrompt = `
    You are an expert assistant helping with blockchain smart contract analysis.
    
    TASK: Create a concise, actionable checklist that summarizes ALL the user's requests across the ENTIRE conversation history below.
    
    CONTEXT INFORMATION:
    - Submission ID: ${context?.submissionId || 'Unknown'}
    - Project: ${context?.projectName || 'Unknown'}
    - Current section: ${context?.section || 'Unknown'}
    - Current analysis step: ${context?.analysisStep || 'Unknown'}
    ${sectionContext}
    
    IMPORTANT FORMATTING INSTRUCTIONS:
    1. Start with the title "Here's a summary of what you're asking me to do:"
    2. List each action as a bullet point with "- " prefix
    3. Include ALL the user's requests and intended actions from the ENTIRE conversation
    4. Respond ONLY with the checklist - no preamble, explanations or questions
    5. If the user has asked for multiple things, group related items together
    6. Be specific and actionable in each bullet point
    
    FULL CONVERSATION HISTORY:
    ${conversationHistory}
    
    Now create the checklist summarizing ALL user requests from the ENTIRE conversation:
    `;
    
    console.log('Generating checklist with conversation context from', userMessages.length, 'user messages');
    
    // Start a chat session with the model initialized at the top of the file (gemini-2.0-flash)
    const chat = model.startChat();
    
    // Send the improved checklist prompt to the model
    const result = await chat.sendMessage(checklistPrompt);
    const response = result.response.text();
    
    console.log('Generated checklist response with length:', response.length);
    
    // Simple validation to make sure we got proper checklist format
    if (!response.includes("Here's a summary") || !response.includes('-')) {
      console.warn('Checklist response missing expected format, falling back to default format');
      
      // Create a simpler list if the model didn't follow the format properly
      const summaryPoints = userMessages.map(m => `- ${m.content.split('.')[0]}.`).slice(-3);
      return `Here's a summary of what you're asking me to do:\n\n${summaryPoints.join('\n')}\n\nWould you like me to proceed with these changes?`;
    }
    
    return response;
  } catch (error) {
    console.error('Error generating checklist from user request:', error);
    return "Here's a summary of what you're asking me to do:\n\n- Process your request (I couldn't generate a detailed checklist due to a technical issue)\n\nWould you like me to proceed?";
  }
}

// Function to determine if a message should create a new conversation or continue an existing one
export async function classifyConversationType(
  newMessage: string,
  previousMessages: ChatMessage[] = [],
  context?: {
    projectName?: string;
    section?: string;
  }
): Promise<ConversationClassificationResult> {
  try {
    // If there are no previous messages, it's always a new conversation
    if (previousMessages.length === 0) {
      return {
        type: 'new_conversation',
        confidence: 1,
        explanation: 'No previous conversation exists'
      };
    }

    const classificationPrompt = `
    You are an AI assistant analyzing conversation continuity. Determine if the new message below should continue the existing conversation or start a new unrelated conversation.

    PREVIOUS CONVERSATION:
    ${previousMessages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}

    NEW MESSAGE: "${newMessage}"

    Project context: ${context?.projectName || 'Unknown'}
    Current section: ${context?.section || 'Unknown'}

    Is this new message continuing the previous conversation or starting a completely new topic?
    Analyze factors like:
    1. Topic continuity and relevance to previous messages
    2. Whether it refers to concepts, questions, or context from previous messages
    3. If it's a completely new request or topic unrelated to previous conversation

    Respond with ONLY a JSON object in this exact format:
    {
      "type": "continue_conversation" or "new_conversation",
      "confidence": [number between 0 and 1],
      "explanation": "[brief explanation of your classification]"
    }
    `;

    const result = await classificationModel.generateContent(classificationPrompt);
    const resultText = result.response.text();
    
    // Extract JSON from the response
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not extract JSON from conversation classification response:', resultText);
      return { 
        type: 'continue_conversation', 
        confidence: 0.5,
        explanation: 'Failed to classify conversation type, defaulting to continuation'
      };
    }
    
    try {
      const classification = JSON.parse(jsonMatch[0]) as ConversationClassificationResult;
      console.log('Conversation type classification:', classification);
      return classification;
    } catch (parseError) {
      console.error('Error parsing conversation classification JSON:', parseError);
      return { 
        type: 'continue_conversation', 
        confidence: 0.5,
        explanation: 'Failed to parse conversation classification, defaulting to continuation'
      };
    }
  } catch (error) {
    console.error('Error classifying conversation type:', error);
    return { 
      type: 'continue_conversation', 
      confidence: 0.5,
      explanation: 'Error during classification, defaulting to conversation continuation'
    };
  }
}

export async function generateChatResponse(
  messages: ChatMessage[],
  context?: {
    projectName?: string;
    section?: string;
    analysisStep?: string;
    projectMetadata?: Record<string, any>;
    submissionData?: any;
  }
): Promise<string> {
  try {
    // Create a comprehensive system prompt with Ilumina information
    let systemPrompt = `You are a blockchain smart contract analysis assistant for Ilumina, an AI agent platform for creating and running smart contract simulations.

**About Ilumina:**
Ilumina is an AI agent that helps users analyze their smart contract repositories. Users provide a GitHub link to their smart contract repository, and Ilumina executes a comprehensive analysis pipeline to understand the project, create simulations, and validate functionality.

**Technical Framework:**
Ilumina uses an open source framework called @svylabs/ilumina developed by the team to create simulations. A simulation repository (in TypeScript) is created in GitHub, and the Ilumina analysis pipeline analyzes and implements various actors, actions, and snapshots. Snapshots are used to validate any modifications to contract state during execution of various actions. Once implemented, users can run simulations based on what their plan supports.

**Ilumina Analysis Pipeline Steps:**
1. **Analyze Project** (analyze_project): Understands the project from README, contract list, and codebase structure
2. **Analyze Actors** (analyze_actors): Identifies market participants and actions they can take in the system
3. **Analyze Deployment** (analyze_deployment): Requires user input to describe the correct sequence for deploying contracts for testing
4. **Implement Deployment Script** (implement_deployment_script): Creates deployment scripts based on the analysis
5. **Verify Deployment** (verify_deployment_script): Validates that deployment scripts run correctly
6. **Analyze Actions** (analyze_all_actions): Analyzes identified actions, state updates, and validation requirements
7. **Analyze Snapshot** (analyze_all_snapshots): Determines how to capture contract state based on deployments and actions
8. **Implement Snapshot** (implement_snapshots): Creates snapshot logic for contract state capture
9. **Implement Action** (implement_all_actions): Implements all actions with parameter generation and validation rules

**Subscription Tiers:**
- **Free**: 1 repo, 10 AI assistant credits/month, additional credits at $1 per 10 credits
- **Pro**: 1 repo, unlimited AI assistant credits, 20 simulation runs/day
- **Teams**: 1 repo, unlimited AI assistant credits, unlimited simulation runs/day

**Your Role:**
You are an AI assistant that helps users navigate and optimize their Ilumina analysis experience. You can assist with:

**Analysis & Refinement:**
- Refine analysis results from any of the 9 pipeline steps
- Suggest improvements to project summaries, actor definitions, or deployment instructions
- Help interpret analysis results and explain what they mean for your project

**Implementation Guidance:**
- Describe what you want implemented in deployment scripts, snapshots, or actions
- Request specific modifications to generated code or simulation logic
- Guide you through the implementation process step by step

**Project Understanding:**
- Answer questions about your project's smart contracts and their functionality
- Explain actor relationships and how they interact in your system
- Clarify deployment requirements and testing strategies

**Platform Navigation:**
- Explain Ilumina's 9-step analysis pipeline and where you are in the process
- Help you understand subscription tiers and simulation capabilities
- Guide you through next steps in your analysis journey

**Technical Support:**
- Troubleshoot issues with deployment scripts or simulation runs
- Explain error messages and suggest solutions
- Provide best practices for smart contract testing and validation

You must only answer questions related to the user's current project, Ilumina's functionality, or blockchain/smart contract topics. Do not answer questions unrelated to these areas.

**Current Context:**
- User's project: ${context?.projectName || 'Unknown'}
- Current section: ${context?.section || 'Main Analysis'}
- Current analysis step: ${context?.analysisStep || 'Unknown'}`;

    // Add submission analysis data if available
    if (context?.submissionData) {
      systemPrompt += '\n\n**Project Analysis Data:**';
      
      // Add project summary
      if (context.submissionData.project_summary) {
        try {
          const projectSummary = typeof context.submissionData.project_summary === 'string' 
            ? JSON.parse(context.submissionData.project_summary)
            : context.submissionData.project_summary;
          
          systemPrompt += `\n\n**Project Summary:**`;
          systemPrompt += `\n- Name: ${projectSummary.name || 'Unknown'}`;
          systemPrompt += `\n- Type: ${projectSummary.type || 'Unknown'}`;
          systemPrompt += `\n- Summary: ${projectSummary.summary || 'No summary available'}`;
          
          if (projectSummary.contracts && Array.isArray(projectSummary.contracts)) {
            systemPrompt += `\n\n**Smart Contracts (${projectSummary.contracts.length}):**`;
            projectSummary.contracts.forEach((contract: any, index: number) => {
              systemPrompt += `\n${index + 1}. **${contract.name}** (${contract.type})`;
              systemPrompt += `\n   - Path: ${contract.path}`;
              systemPrompt += `\n   - Summary: ${contract.summary}`;
            });
          }
        } catch (error) {
          systemPrompt += `\n- Project Summary: ${context.submissionData.project_summary}`;
        }
      }

      // Add actors analysis
      if (context.submissionData.actors_summary) {
        try {
          const actorsSummary = typeof context.submissionData.actors_summary === 'string'
            ? JSON.parse(context.submissionData.actors_summary)
            : context.submissionData.actors_summary;
          
          if (actorsSummary.actors && Array.isArray(actorsSummary.actors)) {
            systemPrompt += `\n\n**System Actors (${actorsSummary.actors.length}):**`;
            actorsSummary.actors.forEach((actor: any, index: number) => {
              systemPrompt += `\n${index + 1}. **${actor.name}**`;
              systemPrompt += `\n   - Role: ${actor.summary}`;
              if (actor.actions && actor.actions.length > 0) {
                systemPrompt += `\n   - Actions: ${actor.actions.slice(0, 3).map((a: any) => a.name).join(', ')}${actor.actions.length > 3 ? '...' : ''}`;
              }
            });
          }
        } catch (error) {
          systemPrompt += `\n- Actors Summary: ${context.submissionData.actors_summary}`;
        }
      }

      // Add deployment instructions if available
      if (context.submissionData.deployment_instructions) {
        systemPrompt += `\n\n**Deployment Instructions:**\n${context.submissionData.deployment_instructions}`;
      }

      // Add completed analysis steps
      if (context.submissionData.completed_steps && Array.isArray(context.submissionData.completed_steps)) {
        systemPrompt += `\n\n**Completed Analysis Steps:**`;
        context.submissionData.completed_steps.forEach((step: any) => {
          systemPrompt += `\n- ${step.step} (completed ${step.updatedAt})`;
        });
      }
    }

    // Add metadata if available
    if (context?.projectMetadata) {
      systemPrompt += '\n\nProject metadata:\n';
      for (const [key, value] of Object.entries(context.projectMetadata)) {
        // Don't include log data directly in metadata section, we'll add it separately
        if (key !== 'submissionLogs') {
          systemPrompt += `${key}: ${value}\n`;
        }
      }
      
      // For informational requests, add specific instructions
      if (context.projectMetadata.isInformational) {
        // If it's a specific guidance request (needs_followup classification)
        if (context.projectMetadata.needsGuidance) {
          systemPrompt += `\n\nIMPORTANT: This is a guidance request. \nThe user is asking for guidance on how to do something or what steps to take next. \nProvide helpful, step-by-step instructions or guidance on how to proceed. \nBe clear, thorough, and actionable in your guidance. \nIf there are multiple approaches, explain the trade-offs of each approach. \nDo not ask if the user wants to proceed with any changes.`;
        } else {
          // Regular informational requests
          systemPrompt += `\n\nIMPORTANT: This is an informational request, not a request for action. \nThe user is asking for information, explanation, or clarification. \nRespond in a direct, clear manner without using a checklist format. \nDo not ask if the user wants to proceed with any changes.`;
        }
        
        // If we have submission logs, include them to help answer the question
        if (context.projectMetadata.submissionLogs) {
          // Special handling for verification logs vs regular logs
          const isVerificationLog = context.analysisStep === 'verify_deployment_script';
          const logHeading = isVerificationLog 
            ? '\n\nHere are the verification logs that may help answer the question:'
            : '\n\nHere are relevant logs and data from the submission that may help answer the question:';
          
          systemPrompt += logHeading + `\n\n${context.projectMetadata.submissionLogs}`;
          
          // Add a reminder about how to interpret the logs if this is a verification step
          if (isVerificationLog) {
            systemPrompt += '\n\nNOTE: Verification logs format: [returnCode, contractAddressMapping, stdout, stderr]. The returnCode 0 indicates success, any other value indicates an error. Look for error patterns in the logs such as compiler errors, duplicate declarations, etc.';
          }
          
          systemPrompt += '\n\nUse the above information to help answer questions if relevant. If the information doesn\'t directly address the user\'s question, use your knowledge to provide a helpful response.';
        }
      }
    }

    // Add instructions based on the current section
    if (context?.section === 'project_summary') {
      systemPrompt += '\n\nYou are now focusing on the project summary. Help the user understand the overall project, its purpose, and architecture.';
    } else if (context?.section === 'actor_summary') {
      systemPrompt += '\n\nYou are now focusing on actor analysis. Help the user understand different actors in the smart contract ecosystem and their interactions.';
    } else if (context?.section === 'deployment_instructions' || context?.analysisStep === 'analyze_deployment') {
      systemPrompt += '\n\nYou are now focusing on deployment instructions and implementation. Help the user understand how to deploy the contracts, the deployment script details, and any potential issues they might face.';
    } else if (context?.section === 'implementation') {
      systemPrompt += '\n\nYou are now focusing on implementation details. Help the user understand the code implementation and suggest best practices.';
    } else if (context?.section === 'validation_rules') {
      systemPrompt += '\n\nYou are now focusing on validation rules. Help the user understand how to validate their smart contracts and what security measures to take.';
    }
    
    // Add special instruction for guidance requests
    systemPrompt += '\n\nGUIDANCE REQUESTS: For requests where the user is asking for guidance or explanations (classified as "needs_followup"):\n1. Focus on providing clear, direct information\n2. Do NOT include a checklist format for information-seeking questions\n3. Always format guidance responses in a conversational manner, not as a task list\n4. Tailor your response to the specific guidance being sought';

    // Format the chat history for Gemini
    const chatHistory = messages.map(message => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }]
    }));

    // Add the system prompt as the first message
    const formattedMessages = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'I understand my role as a blockchain smart contract analysis assistant. I will only answer questions related to the user\'s current project and the specific context provided.' }] },
      ...chatHistory.slice(0, -1) // all but the last message
    ];

    // Start a chat session
    const chat = model.startChat({
      history: formattedMessages,
    });

    // Send the last message to get a response
    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response.text();
    
    return response;
  } catch (error) {
    console.error('Error generating chat response:', error);
    return 'Sorry, I encountered an error while processing your question. Please try again later.';
  }
}
