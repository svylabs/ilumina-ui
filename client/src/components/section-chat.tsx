import { useState, useRef, useEffect } from "react";
import { Loader2, ArrowUpCircle, Bot, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  codeSnippet?: string;
};

type SectionChatProps = {
  sectionType: "project_summary" | "actor_summary" | "deployment_instructions" | "implementation" | "validation_rules";
  sectionName: string;
  projectId: string;
  actorId?: string;
  actionId?: string;
  onClose: () => void;
  initialMessages?: Message[];
  isOpen: boolean;
};

export default function SectionChat({
  sectionType,
  sectionName,
  projectId,
  actorId,
  actionId,
  onClose,
  initialMessages = [],
  isOpen
}: SectionChatProps) {
  // Generate the welcome message content based on section type
  const getWelcomeMessage = () => {
    switch(sectionType) {
      case "project_summary":
        return `I see you want to refine the project summary for this project. I'll help you improve it.\n\nThe current summary describes the overall purpose and key components of the project. What specific aspects would you like to enhance or modify?`;
      case "actor_summary":
        return `I see you want to refine the actor summary for "${sectionName}". I'll help you update it.\n\nThis actor represents a key role in the system that interacts with the smart contracts. What specific details about this actor would you like to change or add?`;
      case "deployment_instructions":
        return `I see you want to modify the deployment instructions for this project. I'll help you update them.\n\nThese instructions outline the steps to deploy the smart contracts in the correct sequence. What specific parts would you like to change or add more detail to?`;
      case "implementation":
        return `I see you want to modify the implementation for action "${sectionName}". I'll help you improve it.\n\nThis implementation defines how the action will be executed in the simulation. What specific functionality would you like to change or enhance?`;
      case "validation_rules":
        return `I see you want to modify the validation rules for action "${sectionName}". I'll help you refine them.\n\nThese validation rules ensure the action produces the expected results and maintains the system's integrity. What specific rules would you like to add, remove, or modify?`;
      default:
        return `I'll help you with your request. What would you like to modify?`;
    }
  };

  // Function to create initial messages
  const createInitialMessages = () => {
    if (initialMessages.length > 0) return initialMessages;
    
    // Add welcome message from assistant
    return [{
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: getWelcomeMessage(),
      timestamp: new Date()
    }];
  };
  
  const [messages, setMessages] = useState<Message[]>(createInitialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.closest('.chat-messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

  // Send a message and get a response
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Create user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date()
    };
    
    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // In a real implementation, we would call an API endpoint here
      // For now, simulate a response after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate a simple response
      const responseText = `Thank you for your input about ${sectionType.replace('_', ' ')}. In a full implementation, I would process your request and make the requested changes. What else would you like to modify?`;
      
      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: responseText,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if chat is not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex md:block">
      {/* Desktop: Right sidebar layout - Mobile: Full screen layout */}
      <div className="md:absolute md:right-0 md:top-0 md:bottom-0 bg-gray-900 text-white w-full md:w-1/3 max-w-full md:max-w-md flex flex-col border-l border-gray-700 shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
          <h3 className="font-semibold flex items-center">
            <Bot className="h-5 w-5 mr-2 text-blue-400" />
            AI Assistant
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 chat-messages-container">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 my-4">
              <p>No previous conversations for this section.</p>
              <p className="text-sm mt-2">Start by describing what changes you'd like to make to {sectionName}.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div 
                key={message.id} 
                className={cn(
                  "mb-4 p-3 rounded-lg max-w-[85%]",
                  message.role === "user" 
                    ? "ml-auto bg-blue-600 text-white" 
                    : "mr-auto bg-gray-800 text-gray-100"
                )}
              >
                <div className="flex items-start mb-1">
                  <div className="p-1 rounded-full bg-gray-700 mr-2">
                    {message.role === "user" ? (
                      <User className="h-4 w-4 text-blue-300" />
                    ) : (
                      <Bot className="h-4 w-4 text-green-300" />
                    )}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                <div className="pl-7">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.codeSnippet && (
                    <pre className="mt-2 p-2 bg-gray-900 rounded text-xs font-mono overflow-x-auto">
                      {message.codeSnippet}
                    </pre>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Describe how you want to modify the ${sectionType.replace('_', ' ')}...`}
              className="min-h-[80px] bg-gray-800 border-gray-700 text-white resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={isLoading || !input.trim()} 
              className="self-end"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="h-5 w-5" />
              )}
            </Button>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Press Ctrl+Enter to send
          </div>
        </div>
      </div>
      
      {/* Semi-transparent backdrop area that allows closing the chat when clicked */}
      <div 
        className="hidden md:block absolute inset-0 right-[33.333%] md:right-[400px]" 
        onClick={onClose}
      />
    </div>
  );
}