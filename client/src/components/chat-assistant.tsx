import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, RefreshCw, PlusCircle, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

type Classification = {
  step: string;
  action: string;
  confidence: number;
  actionTaken: boolean;
  needsConfirmation?: boolean;
  contextSummary?: string;
  isActionable?: boolean; // Whether the request requires action vs just answering a question
  needsGuidance?: boolean; // Whether the user is asking for guidance (needs_followup classification)
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  classification?: Classification;
};

type ChatAssistantProps = {
  projectId?: string | number;
  currentSection?: string;
  currentStep?: string;
  submissionId?: string;
  analysisData?: any; // Analysis data to check step completion status
};

export default function ChatAssistant({
  projectId,
  currentSection,
  currentStep,
  submissionId,
  analysisData,
}: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Function to determine if tooltip should be shown and what message
  const getTooltipMessage = () => {
    // Don't show tooltip if it's been dismissed
    if (tooltipDismissed) return null;
    
    // Only show tooltip in actors section
    if (currentSection !== 'actors') return null;
    
    // Check if we have analysis data and completed steps
    if (!analysisData?.completedSteps) return null;
    
    const completedSteps = analysisData.completedSteps || [];
    const actorsCompleted = completedSteps.some((step: any) => 
      step.step === 'analyze_actors' && (step.status === 'completed' || step.status === 'success')
    );
    const deploymentStarted = completedSteps.some((step: any) => 
      step.step === 'analyze_deployment'
    );
    
    // Show tooltip when analyze_deployment hasn't started
    if (!deploymentStarted) {
      return "You can refine the analysis with our AI assistant by describing what you want";
    }
    
    // Show tooltip when analyze actors is completed but analyze deployment is not complete
    if (actorsCompleted && !deploymentStarted) {
      return "You can refine the analysis with our AI assistant by describing what you want";
    }
    
    return null;
  };

  const tooltipMessage = getTooltipMessage(); // Get current authenticated user

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);
  
  // Define conversation-related functions outside of useEffect so they can be called from anywhere
  const getSubmissionIdFromProjectId = async (): Promise<string | null> => {
    if (!projectId) return null;
    
    try {
      const response = await apiRequest('GET', `/api/project/${projectId}`);
      const projectData = await response.json();
      
      // Find linked submissions
      const submissionsResponse = await apiRequest('GET', `/api/project/${projectId}/submissions`);
      const submissions = await submissionsResponse.json();
      
      if (submissions && submissions.length > 0) {
        // Return the most recent submission ID
        return submissions[0].id;
      }
    } catch (error) {
      console.error('Error getting submission ID from project:', error);
    }
    
    return null;
  };
  
  // Function to load chat history
  const loadChatHistory = async (sessionId?: string) => {
    if (!projectId) return;
    
    try {
      setLoadingHistory(true);
      
      // Get the submission ID from props or try to get it via project ID
      const subId = submissionId || await getSubmissionIdFromProjectId();
      if (!subId) return;
      
      const queryParams = new URLSearchParams({
        section: currentSection || 'general'
      });
      
      // Add conversation ID to query params if available
      if (sessionId || conversationId) {
        queryParams.append('conversationId', sessionId || conversationId!);
      }
      
      // Fetch chat history
      const response = await apiRequest('GET', `/api/chat/history/${subId}?${queryParams}`);
      const historyMessages = await response.json();
      
      if (historyMessages && historyMessages.length > 0) {
        // Transform API messages to our Message format
        const formattedMessages = historyMessages.map((msg: any) => ({
          id: crypto.randomUUID(),
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          classification: msg.classification ? {
            step: msg.classification.step,
            action: msg.classification.action,
            confidence: msg.classification.confidence,
            actionTaken: msg.classification.actionTaken,
            needsConfirmation: msg.classification.needsConfirmation,
            contextSummary: msg.classification.contextSummary,
            isActionable: msg.classification.isActionable,
            needsGuidance: msg.classification.needsGuidance
          } : undefined
        }));
        
        setMessages(formattedMessages);
      } else if (messages.length === 0) {
        // Add a greeting if we don't have any history
        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Hello! I'm your Ilumina assistant. You can ask questions about the analysis done by Ilumina on your project and suggest improvements on the simulation or refinements. How can I help you today?`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // Continue even if loading history fails, but show a toast
      toast({
        title: 'Error',
        description: 'Failed to load chat history. Starting a new conversation.',
        variant: 'destructive',
      });
      
      // Add a greeting if loading history fails
      if (messages.length === 0) {
        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Hello! I'm your Ilumina assistant. You can ask questions about the analysis done by Ilumina on your project and suggest improvements on the simulation or refinements. How can I help you today?`,
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setLoadingHistory(false);
    }
  };

  // Function to create a new conversation session
  const createConversationSession = async () => {
    if (!projectId || loadingHistory) return;
    
    // If we already have a conversation ID, skip creating a new one
    if (conversationId) {
      await loadChatHistory();
      return;
    }
    
    try {
      setLoadingHistory(true);
      
      // Get the submission ID from props or try to get it via project ID
      const subId = submissionId || await getSubmissionIdFromProjectId();
      if (!subId) {
        // Add a greeting if we don't have a submission ID yet
        if (messages.length === 0) {
          setMessages([
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Hello! I'm your Ilumina assistant. You can ask questions about the analysis done by Ilumina on your project and suggest improvements on the simulation or refinements. How can I help you today?`,
              timestamp: new Date(),
            },
          ]);
        }
        return;
      }
      
      // Create a new conversation session
      const response = await apiRequest('POST', `/api/chat/session/${subId}`, {
        section: currentSection || 'general'
      });
      
      const data = await response.json();
      console.log('Created new conversation session:', data.conversationId);
      
      // Store the conversation ID
      setConversationId(data.conversationId);
      
      // Now load chat history with the new conversation ID
      await loadChatHistory(data.conversationId);
    } catch (error) {
      console.error('Error creating conversation session:', error);
      toast({
        title: 'Error',
        description: 'Failed to create a conversation session. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Initialize conversation session when component loads
  useEffect(() => {
    if (isOpen && !conversationId && !loadingHistory) {
      createConversationSession();
    }
  }, [isOpen, projectId, submissionId, conversationId, currentSection, loadingHistory]);

  // Helper function to parse user request into a checklist format
  const createChecklistFromRequest = (request: string): string => {
    const lines = request.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Try to identify action items in the request
    const actionItems: string[] = [];
    
    // Look for phrases that indicate actions
    const removeKeywords = ['remove', 'eliminate', 'delete', 'get rid of', 'don\'t need', 'not needed'];
    const addKeywords = ['add', 'include', 'create', 'insert', 'implement', 'need'];
    const updateKeywords = ['change', 'modify', 'update', 'edit', 'adjust', 'fix'];
    
    for (const line of lines) {
      // Check if the line contains any of our keywords
      const hasRemoveKeyword = removeKeywords.some(keyword => line.toLowerCase().includes(keyword));
      const hasAddKeyword = addKeywords.some(keyword => line.toLowerCase().includes(keyword));
      const hasUpdateKeyword = updateKeywords.some(keyword => line.toLowerCase().includes(keyword));
      
      if (hasRemoveKeyword || hasAddKeyword || hasUpdateKeyword) {
        actionItems.push(line);
      }
    }
    
    // If we couldn't identify specific action items, use the entire request
    if (actionItems.length === 0) {
      actionItems.push(request);
    }
    
    // Generate the checklist
    let checklist = "Here's a summary of what you're asking for:\n\n";
    actionItems.forEach(item => {
      checklist += `- ${item}\n`;
    });
    
    return checklist + "\nWould you like me to proceed with these changes?";
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Generate a unique ID for the message
    const messageId = crypto.randomUUID();

    // Create the user message
    const userMessage: Message = {
      id: messageId,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    // Add the user message to the messages list
    setMessages(prev => [...prev, userMessage]);
    
    // Clear the input
    setInputValue('');
    
    // Set loading state
    setIsLoading(true);

    try {
      // Send the message to the server
      const response = await apiRequest('POST', '/api/assistant/chat', {
        messages: [...messages, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        projectId,
        section: currentSection,
        analysisStep: currentStep,
        conversationId: conversationId || undefined,  // Include conversationId if available
      });

      const data = await response.json();
      
      // If we received a conversation ID in the response, store it
      if (data.conversationId && (!conversationId || data.conversationId !== conversationId)) {
        console.log(`Received conversation ID from server: ${data.conversationId}`);
        setConversationId(data.conversationId);
      }
      
      // Check if this is an action that needs confirmation and no confirmation has been given yet
      let content = data.response;
      let needsConfirmation = data.classification?.needsConfirmation;
      
      // Log classification information for debugging
      console.log('Checking if we need to show a checklist confirmation:', {
        action: data.classification?.action,
        needsConfirmation,
        hasActionTaken: data.classification?.actionTaken,
        confidence: data.classification?.confidence,
        isPositiveConfirmation: inputValue.toLowerCase().includes('yes') || inputValue.toLowerCase().includes('proceed')
      });
      
      // Check if the server response already contains a checklist format
      const hasServerGeneratedChecklist = 
        content.includes("Here's a summary of what you're asking") && 
        content.includes('-');
        
      console.log('Server response has checklist format:', hasServerGeneratedChecklist);
      
      // Only show checklists for actions that modify content, not for clarification/explanation/guidance
      const actionsThatNeedConfirmation = ['update', 'refine', 'run'];
      const actionsExemptFromChecklist = ['clarify', 'explain', 'needs_followup'];
      
      // Detect if this message is a confirmation message (yes/proceed/etc)
      const isConfirmationMessage = inputValue.toLowerCase().includes('yes') || 
                                   inputValue.toLowerCase().includes('proceed') || 
                                   inputValue.toLowerCase().includes('confirm') ||
                                   inputValue.toLowerCase().includes('agree') ||
                                   inputValue.toLowerCase().includes('go ahead');
      
      // If this is a confirmation message, we should never show a checklist again
      if (isConfirmationMessage) {
        console.log('Detected confirmation message - suppressing any further checklists');
      }
      
      const isSignificantAction = data.classification && 
          actionsThatNeedConfirmation.includes(data.classification.action) && 
          data.classification.confidence >= 0.7;
      
      const isExemptAction = data.classification && 
          (actionsExemptFromChecklist.includes(data.classification.action) ||
           data.classification.needsGuidance === true);
      
      // Check if the request is actionable based on the classification from the server
      const isActionable = data.classification?.isActionable === true;
      
      // If the response has a checklist format but is not actionable or it's a response to a confirmation,
      // completely transform it to a regular response
      if ((hasServerGeneratedChecklist && !isActionable) || isConfirmationMessage) {
        console.log('Removing checklist format from non-actionable response');
        
        // Extract just the bullet points without the checklist format or confirmation question
        const bulletPoints: string[] = content.match(/- (.+)/g) || [];
        
        if (bulletPoints && bulletPoints.length > 0) {
          // Get the actual information without checklist formatting
          // and compose a more natural response
          const taskDescription = bulletPoints
            .map((point: string) => point.replace('- ', ''))
            .join(' ');
            
          // Based on the question/command type, format an appropriate response
          if (inputValue.toLowerCase().startsWith('what') || 
              inputValue.toLowerCase().startsWith('explain') || 
              inputValue.toLowerCase().startsWith('tell me') || 
              inputValue.toLowerCase().startsWith('can you tell')) {
            content = taskDescription.charAt(0).toUpperCase() + taskDescription.slice(1) + '.';
          } else if (isConfirmationMessage) {
            // Format differently for confirmation responses
            content = `I'll proceed with that right away. ${taskDescription.charAt(0).toUpperCase() + taskDescription.slice(1)}.`;
          } else {
            content = `I'm happy to help with that. ${taskDescription.charAt(0).toUpperCase() + taskDescription.slice(1)}.`;
          }
        } else {
          // Fallback if we can't extract bullet points
          if (isConfirmationMessage) {
            // For confirmation messages, provide a clearer action message
            content = "I'll proceed with your request right away.";
          } else {
            content = content
              .replace("Here's a summary of what you're asking for:\n\n", "")
              .replace("\nWould you like me to proceed with these changes?", "")
              .replace("\nWould you like me to proceed?", "");
          }
        }
      }
      
      // Don't require confirmation for clarification/explanation requests or non-actionable requests
      const needsUserConfirmation = isSignificantAction && 
          !isExemptAction &&
          isActionable && // Only require confirmation for actionable requests
          !isConfirmationMessage && // Never show confirmation for confirmation messages
          !data.classification?.actionTaken;
      
      // IMPORTANT: Only show checklist for actions that modify content
      if (needsUserConfirmation) {
        if (!hasServerGeneratedChecklist) {
          console.log('No server checklist found. Creating client-side checklist for confirmation');
          content = createChecklistFromRequest(userMessage.content);
          needsConfirmation = true;
        } else {
          // If the server response already has checklist format, check if it should be treated as a confirmation
          if (!isExemptAction && isActionable) {
            console.log('Using server-generated checklist for confirmation');
            needsConfirmation = true;
          } else {
            console.log('Server generated a checklist, but action is exempt from confirmation or is not actionable');
            needsConfirmation = false;
          }
        }
      } else if (isExemptAction) {
        // Explicitly set needsConfirmation to false for exempt actions
        console.log('Action is exempt from confirmation:', data.classification?.action);
        needsConfirmation = false;
      }

      // Create the assistant message with classification metadata if available
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: content,
        timestamp: new Date(),
        classification: data.classification ? {
          step: data.classification.step,
          action: data.classification.action,
          confidence: data.classification.confidence,
          actionTaken: data.classification.actionTaken,
          needsConfirmation: needsConfirmation,
          contextSummary: data.classification.contextSummary,
          isActionable: data.classification.isActionable,
          needsGuidance: data.classification.needsGuidance
        } : undefined
      };

      // Add the assistant message to the messages list
      setMessages(prev => [...prev, assistantMessage]);
      
      // If an action was taken, we might want to refresh the current page
      // to show updated content after a brief delay
      if (data.classification?.actionTaken) {
        setTimeout(() => {
          // Use window.location.reload() to refresh the page after a delay
          // This will ensure that any updated content from the external API is displayed
          window.location.reload();
        }, 5000); // Give the external API some time to process
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Check if this is a 429 error (credit limit reached)
      if (error instanceof Error && error.message.includes('429')) {
        // Show upgrade message for credit limit reached
        const upgradeMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `You've reached your monthly limit of 10 free chat messages. Upgrade to Pro or Teams to continue using the AI assistant with unlimited messages, plus get personalized help with your project analysis and smart contract suggestions.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, upgradeMessage]);
      } else {
        // Show generic error for other issues
        toast({
          title: 'Error',
          description: 'Failed to get a response from the assistant. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press for sending messages with Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle the chat window
  const toggleChat = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // If we're opening the chat
    if (newIsOpen) {
      // First try to load existing session
      if (submissionId && !loadingHistory) {
        console.log(`Loading chat history for submission ${submissionId}`);
        // If the conversationId is already set, use it to load specific conversation
        if (conversationId) {
          loadChatHistory(conversationId);
        } else {
          // Otherwise, try to create a new session
          createConversationSession();
        }
      } else if (messages.length === 0) {
        // If no submission ID or we're already loading, just show the greeting
        setMessages([
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Hello! I'm your Ilumina assistant. You can ask questions about the analysis done by Ilumina on your project and suggest improvements on the simulation or refinements. How can I help you today?`,
            timestamp: new Date(),
          },
        ]);
      }
    }
  };

  // Check if user is on free tier
  const isFreeUser = user?.plan === 'free';

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat toggle button with tooltip */}
      <div className="relative group">
        <Button
          onClick={toggleChat}
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        >
          {isOpen ? <X className="h-6 w-6" /> : isFreeUser ? <Lock className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </Button>
        
        {/* Tooltip - always available on hover, with special guidance messages when appropriate */}
        <div className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground px-4 py-3 rounded-md shadow-lg border w-80 z-50 transition-opacity duration-200 ${
          tooltipMessage ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm flex-1 leading-relaxed">
              {tooltipMessage || "You can refine the analysis with our AI assistant by describing what you want"}
            </p>
            {tooltipMessage && (
              <button
                onClick={() => setTooltipDismissed(true)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 -mt-0.5 -mr-0.5 flex-shrink-0"
                aria-label="Close tooltip"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {/* Arrow pointing to the button */}
          <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-popover"></div>
        </div>
      </div>

      {/* Chat window */}
      {isOpen && (
        <Card className="absolute bottom-16 right-0 w-80 sm:w-96 h-[60vh] max-h-[500px] flex flex-col overflow-hidden shadow-xl">
          {/* Chat header */}
          <div className="p-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Ilumina Assistant</h3>
              <div className="flex items-center gap-2">
                {/* Plus button to start a new conversation */}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Clear conversation state and create a new session
                    setConversationId(null);
                    setMessages([]);
                    createConversationSession();
                    toast({
                      title: "New Conversation",
                      description: "Started a new conversation thread.",
                    });
                  }}
                  title="Start new conversation"
                >
                  <PlusCircle className="h-4 w-4 mr-1" />
                  <span className="text-xs">New Chat</span>
                </Button>
                
                {conversationId && (
                  <div className="text-xs text-primary-foreground/70 bg-primary-foreground/10 px-2 py-1 rounded">
                    <span>Session: {conversationId.substring(0, 6)}...</span>
                  </div>
                )}
              </div>
            </div>
            {loadingHistory && (
              <div className="flex items-center mt-1 text-xs text-primary-foreground/70">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                <span>Loading conversation history...</span>
              </div>
            )}
          </div>

          {/* Messages area */}
          <div className="flex-grow overflow-y-auto p-3 space-y-4">
            {isFreeUser ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <Lock className="h-16 w-16 mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">AI Chat Assistance</h3>
                <p className="text-muted-foreground mb-2">
                  This feature is available exclusively for Pro and Teams plans.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Upgrade your plan to get personalized assistance with analyzing and improving your smart contracts.
                </p>
                <Button variant="default" onClick={() => window.location.href = '/pricing'}>
                  Upgrade Your Plan
                </Button>
              </div>
            ) : (
              <>
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex flex-col max-w-[85%] rounded-lg p-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted mr-auto'
                    )}
                  >
                    <div className="break-words whitespace-pre-wrap">{message.content}</div>
                    
                    {/* Show confirmation buttons if the message needs user confirmation */}
                    {message.role === 'assistant' && message.classification?.needsConfirmation && (
                      <div className="mt-3 flex gap-2">
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => {
                            // Confirm the action
                            setInputValue(`Yes, please proceed with ${message.classification?.step} step.`);
                            setTimeout(handleSendMessage, 100);
                          }}
                        >
                          Proceed
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            // Cancel the action
                            setInputValue("No, let's hold off on that change for now.");
                            setTimeout(handleSendMessage, 100);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    
                    <div
                      className={cn(
                        'text-xs mt-1',
                        message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center space-x-2 bg-muted rounded-lg p-3 max-w-[85%]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm">Thinking...</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input area */}
          <div className="p-3 border-t">
            {isFreeUser ? (
              <div className="text-center text-sm text-muted-foreground px-4 py-2">
                <p>Upgrade to a Pro or Teams plan to access AI chat assistance</p>
                <Button
                  variant="default"
                  size="sm"
                  className="mt-2"
                  onClick={() => window.location.href = '/pricing'}
                >
                  View Pricing Plans
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <Textarea
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  className="resize-none min-h-[60px] max-h-[120px]"
                  disabled={isLoading}
                />
                <Button
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputValue.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
