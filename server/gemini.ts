import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Initialize the Google Generative AI SDK with the API key
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

// Create a model instance for Gemini
const model = genAI.getGenerativeModel({
  model: 'gemini-pro', // Using the Gemini Pro model which is optimized for chat applications
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

// Function to generate a chat response
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
