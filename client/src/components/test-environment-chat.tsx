import { useState, useRef, useEffect } from "react";
import { Loader2, ArrowUpCircle, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  codeSnippet?: string;
};

type TestEnvironmentChatProps = {
  submissionId: string;
  projectName: string;
  onCodeUpdate?: (code: string, path?: string) => void;
  initialMessages?: Message[];
};

export default function TestEnvironmentChat({
  submissionId,
  projectName,
  onCodeUpdate,
  initialMessages = []
}: TestEnvironmentChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Ensure messages end is scrolled into view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Function to generate a unique message ID
  const generateMessageId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  // Simulate sending a message and getting a response
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
      // For now, we'll simulate a response after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Example responses based on keywords in the user message
      let responseText = "I'll help you modify the test environment. What specifically would you like to change?";
      let codeSnippet = "";
      
      const lowercaseInput = input.toLowerCase();
      
      if (lowercaseInput.includes("new test") || lowercaseInput.includes("add test")) {
        responseText = "I've created a new test case for you:";
        codeSnippet = `describe("New Test Case", function() {
  it("should verify the expected behavior", async function() {
    // Arrange: Setup test conditions
    const testValue = await setupTestConditions();
    
    // Act: Execute the operation being tested
    const result = await performTestOperation(testValue);
    
    // Assert: Verify the results
    expect(result).to.equal(expectedOutput);
  });
});`;

        // If onCodeUpdate is provided, trigger it with the new code
        if (onCodeUpdate) {
          onCodeUpdate(codeSnippet, `test/new-test-case.js`);
        }
      } else if (lowercaseInput.includes("price manipulation") || lowercaseInput.includes("oracle")) {
        responseText = "I've added a price manipulation check to the test:";
        codeSnippet = `it("should be resilient against price manipulation attacks", async function() {
  // Setup price oracle
  const mockOracle = await deployMockPriceOracle();
  await setupOracle(mockOracle.address);
  
  // Record initial state
  const initialState = await getSystemState();
  
  // Execute price manipulation
  await mockOracle.setPrice(token.address, manipulatedPrice);
  
  // Attempt attack
  await expect(
    attackerContract.executeAttack(mockOracle.address)
  ).to.be.revertedWith("Price manipulation detected");
  
  // Verify system state hasn't been compromised
  const finalState = await getSystemState();
  expect(finalState).to.deep.equal(initialState);
});`;

        if (onCodeUpdate) {
          onCodeUpdate(codeSnippet, `test/security.test.js`);
        }
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        codeSnippet: codeSnippet
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive"
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/90 rounded-md overflow-hidden">
      <div className="p-2 bg-gray-900 flex items-center border-b border-gray-800">
        <Bot className="h-4 w-4 text-blue-400 mr-2" />
        <span className="font-medium text-white text-sm">Test Environment Assistant</span>
        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-900/50 text-blue-300 rounded-full truncate max-w-[150px]">
          {projectName}
        </span>
      </div>

      <div className="flex-grow overflow-auto p-2 space-y-3" style={{ height: "calc(100% - 120px)" }}>
        {/* Messages */}
        {messages.length === 0 ? (
          <div className="text-center py-4 text-gray-400">
            <Bot className="h-10 w-10 mx-auto mb-2 text-gray-600" />
            <p className="text-xs">
              I can help you customize your test environment. Ask me to create new tests or implement specific test scenarios.
            </p>
          </div>
        ) : (
          messages.map(message => (
            <div 
              key={message.id} 
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`
                  max-w-[90%] rounded-lg p-2
                  ${message.role === "user" 
                    ? "bg-gray-700 text-white" 
                    : "bg-blue-900/50 text-blue-100"
                  }
                `}
              >
                <div className="flex items-center mb-1">
                  {message.role === "assistant" ? (
                    <Bot className="h-3 w-3 mr-1 text-blue-300" />
                  ) : (
                    <User className="h-3 w-3 mr-1 text-gray-300" />
                  )}
                  <span className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs whitespace-pre-wrap">{message.content}</p>
                
                {message.codeSnippet && (
                  <div className="mt-2 bg-black/60 p-2 rounded-md overflow-auto max-h-[150px]">
                    <pre className="text-xs text-green-400 whitespace-pre">
                      {message.codeSnippet}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 bg-gray-900/40 border-t border-gray-800">
        <div className="flex space-x-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your request here..."
            className="min-h-[50px] max-h-[80px] w-full bg-gray-800 text-white border-gray-700 focus-visible:ring-blue-500 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading}
          />
          <Button 
            onClick={handleSendMessage} 
            size="icon" 
            disabled={isLoading || !input.trim()}
            className="shrink-0 h-auto aspect-square"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpCircle className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}