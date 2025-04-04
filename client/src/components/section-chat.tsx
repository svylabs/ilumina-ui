import { useState, useRef, useEffect } from "react";
import { Loader2, ArrowUpCircle, Bot, User, MessageSquare, X } from "lucide-react";
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
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Ensure messages container is scrolled into view
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.closest('.chat-messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

  // Function to generate a unique message ID
  const generateMessageId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  // Send a message and get a response
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: generateMessageId(),
      role: "user",
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // In a real implementation, we would call an API endpoint here
      // For now, simulate a response after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate a response based on the section type
      let responseText = getDefaultResponse(sectionType, sectionName);
      let codeSnippet = "";
      
      // Add assistant message
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        codeSnippet
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

  // Generate a default response based on section type
  const getDefaultResponse = (type: string, name: string) => {
    switch(type) {
      case "project_summary":
        return `I'll help you refine the project summary. What aspects would you like to improve?`;
      case "actor_summary":
        return `I'll help you refine the actor summary for "${name}". What changes would you like to make?`;
      case "deployment_instructions":
        return `I'll help you modify the deployment instructions. What specific changes are you looking for?`;
      case "implementation":
        return `I'll help you modify the implementation for "${name}". What functionality would you like to change?`;
      case "validation_rules":
        return `I'll help you modify the validation rules for "${name}". What rules would you like to add or change?`;
      default:
        return `I'll help you with your request. What would you like to modify?`;
    }
  };

  // If chat is not open, don't render
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 text-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col border border-gray-700 shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
          <h3 className="font-semibold flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-blue-400" />
            {sectionType === "project_summary" && "Refine Project Summary"}
            {sectionType === "actor_summary" && `Refine Actor: ${sectionName}`}
            {sectionType === "deployment_instructions" && "Refine Deployment Instructions"}
            {sectionType === "implementation" && `Modify Implementation: ${sectionName}`}
            {sectionType === "validation_rules" && `Modify Validation Rules: ${sectionName}`}
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
                  "mb-4 p-3 rounded-lg max-w-[80%]",
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
    </div>
  );
}