import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type Classification = {
  step: string;
  action: string;
  confidence: number;
  actionTaken: boolean;
  needsConfirmation?: boolean;
  contextSummary?: string;
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
};

export default function ChatAssistant({
  projectId,
  currentSection,
  currentStep,
}: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

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
      });

      const data = await response.json();

      // Create the assistant message with classification metadata if available
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        classification: data.classification ? {
          step: data.classification.step,
          action: data.classification.action,
          confidence: data.classification.confidence,
          actionTaken: data.classification.actionTaken,
          needsConfirmation: data.classification.needsConfirmation,
          contextSummary: data.classification.contextSummary
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
      toast({
        title: 'Error',
        description: 'Failed to get a response from the assistant. Please try again.',
        variant: 'destructive',
      });
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
    setIsOpen(prev => !prev);
    
    // If we're opening the chat and there are no messages, add a greeting
    if (!isOpen && messages.length === 0) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Hello! I'm your Ilumina assistant. You can ask questions about the analysis done by Ilumina on your project and suggest improvements on the simulation or refinements. How can I help you today?`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat toggle button */}
      <Button
        onClick={toggleChat}
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>

      {/* Chat window */}
      {isOpen && (
        <Card className="absolute bottom-16 right-0 w-80 sm:w-96 h-[60vh] max-h-[500px] flex flex-col overflow-hidden shadow-xl">
          {/* Chat header */}
          <div className="p-3 border-b bg-primary text-primary-foreground">
            <h3 className="font-medium">Ilumina Assistant</h3>
          </div>

          {/* Messages area */}
          <div className="flex-grow overflow-y-auto p-3 space-y-4">
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
          </div>

          {/* Input area */}
          <div className="p-3 border-t flex items-end gap-2">
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
        </Card>
      )}
    </div>
  );
}
