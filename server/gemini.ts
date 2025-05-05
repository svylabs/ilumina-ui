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
  | 'implement_deployment_script' 
  | 'verify_deployment_script' 
  | 'unknown';

// The actions that can be taken based on the request
export type RequestAction = 
  | 'refine' 
  | 'clarify' 
  | 'update' 
  | 'run' 
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
    - analyze_deployment: Request about deployment of smart contracts, deployment strategy or infrastructure
    - implement_deployment_script: Request about the deployment script implementation itself
    - verify_deployment_script: Request to verify, validate, or run the deployment script
    - unknown: If the request doesn't clearly fit into any of the above steps

    ACTIONS (choose one):
    - refine: User wants to refine or improve some aspect of the analysis
    - clarify: User is asking for clarification or explanation
    - update: User is providing additional information to update the context
    - run: User wants to execute or run something (like a verification)
    - unknown: If the action isn't clear

    Project context: ${context?.projectName || 'Unknown'}
    Current section: ${context?.section || 'Unknown'}
    Current step: ${context?.currentStep || 'Unknown'}

    USER REQUEST: "${userMessage}"

    Analyze this request and respond with ONLY a JSON object in this exact format:
    {
      "step": "[one of the STEPS above]",
      "action": "[one of the ACTIONS above]", 
      "confidence": [number between 0 and 1],
      "explanation": "[brief explanation of your classification]"
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
        explanation: 'Failed to classify request'
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
        explanation: 'Failed to parse classification'
      };
    }
  } catch (error) {
    console.error('Error classifying user request:', error);
    return { 
      step: 'unknown', 
      action: 'unknown',
      confidence: 0,
      explanation: 'Error during classification'
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

export async function generateChatResponse(
  messages: ChatMessage[],
  context?: {
    projectName?: string;
    section?: string;
    analysisStep?: string;
    projectMetadata?: Record<string, any>;
  }
): Promise<string> {
  try {
    // Create a system prompt with context information
    let systemPrompt = `You are a blockchain smart contract analysis assistant for Ilumina, a platform that helps users analyze their blockchain projects. 

You must only answer questions related to the user's current project. Do not answer questions unrelated to blockchain, smart contracts, or the user's current project.

User's current project: ${context?.projectName || 'Unknown'}
Current section: ${context?.section || 'Main Analysis'}
Current analysis step: ${context?.analysisStep || 'Unknown'}`;

    // Add metadata if available
    if (context?.projectMetadata) {
      systemPrompt += '\n\nProject metadata:\n';
      for (const [key, value] of Object.entries(context.projectMetadata)) {
        systemPrompt += `${key}: ${value}\n`;
      }
    }

    // Add instructions based on the current section
    if (context?.section === 'project_summary') {
      systemPrompt += '\n\nYou are now focusing on the project summary. Help the user understand the overall project, its purpose, and architecture.';
    } else if (context?.section === 'actor_summary') {
      systemPrompt += '\n\nYou are now focusing on actor analysis. Help the user understand different actors in the smart contract ecosystem and their interactions.';
    } else if (context?.section === 'deployment_instructions') {
      systemPrompt += '\n\nYou are now focusing on deployment instructions. Help the user understand how to deploy the contracts and any potential issues they might face.';
    } else if (context?.section === 'implementation') {
      systemPrompt += '\n\nYou are now focusing on implementation details. Help the user understand the code implementation and suggest best practices.';
    } else if (context?.section === 'validation_rules') {
      systemPrompt += '\n\nYou are now focusing on validation rules. Help the user understand how to validate their smart contracts and what security measures to take.';
    }

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
