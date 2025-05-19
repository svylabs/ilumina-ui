import { useState, useEffect } from "react";
import { Loader2, RefreshCcw, Globe, FileBadge, Copy, GitCommit, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type GitHubFile = {
  name: string;
  path: string;
  content?: string;
  type: string;
  size: number;
  html_url: string;
};

type GitHubCommit = {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  html_url: string;
};

type GitHubCodeViewerProps = {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  showBreadcrumb?: boolean;
  onFileSelect?: (file: GitHubFile) => void;
  showCommits?: boolean;
};

export default function GitHubCodeViewer({
  owner,
  repo,
  branch = "main",
  path = "",
  showBreadcrumb = true,
  onFileSelect,
  showCommits = true
}: GitHubCodeViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contents, setContents] = useState<GitHubFile[]>([]);
  const [currentFile, setCurrentFile] = useState<GitHubFile | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [fileContent, setFileContent] = useState<string>("");
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);

  // Function to fetch directory contents
  const fetchContents = async (contentPath: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // We'll implement a server proxy endpoint for GitHub API calls
      const res = await apiRequest("GET", `/api/github/contents/${owner}/${repo}/${contentPath}?ref=${branch}`);
      const data = await res.json();
      setContents(Array.isArray(data) ? data : [data]);

      // Update breadcrumb
      const pathParts = contentPath.split('/').filter(Boolean);
      setBreadcrumb(pathParts);
    } catch (err) {
      setError("Failed to fetch repository contents. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch file content
  const fetchFileContent = async (file: GitHubFile) => {
    if (file.type !== "file") return;

    setIsLoading(true);
    try {
      const res = await apiRequest("GET", `/api/github/content/${owner}/${repo}/${file.path}?ref=${branch}`);
      const data = await res.json();
      setFileContent(atob(data.content)); // GitHub API returns base64 encoded content
      setCurrentFile(file);
      
      if (onFileSelect) {
        onFileSelect({...file, content: atob(data.content)});
      }
    } catch (err) {
      setError("Failed to fetch file content. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch commit history
  const fetchCommits = async (filePath: string = "") => {
    if (!showCommits) return;
    
    setIsLoadingCommits(true);
    try {
      // Using the new commit history API endpoint
      const res = await apiRequest("GET", `/api/github/commits/${owner}/${repo}?ref=${branch}${filePath ? `&path=${filePath}` : ''}`);
      const data = await res.json();
      setCommits(data);
    } catch (err) {
      console.error("Failed to fetch commit history:", err);
      // We don't set error state here to not disrupt the main UI
    } finally {
      setIsLoadingCommits(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchContents(path);
    // Fetch commits for the current path on initial load
    fetchCommits(path);
  }, [owner, repo, branch, path, showCommits]);

  // Handle navigation
  const navigateToPath = (index: number) => {
    if (index < 0) {
      fetchContents("");
      return;
    }

    const newPath = breadcrumb.slice(0, index + 1).join('/');
    fetchContents(newPath);
  };

  const handleItemClick = (item: GitHubFile) => {
    if (item.type === "dir") {
      fetchContents(item.path);
    } else if (item.type === "file") {
      fetchFileContent(item);
    }
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/90 rounded-md overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex justify-between items-center p-2 bg-gray-900 shrink-0">
        <div className="flex items-center">
          <Globe className="h-4 w-4 mr-2 text-blue-400" />
          <span className="text-sm text-white font-medium truncate">
            {owner}/{repo}
          </span>
          {branch && (
            <span className="ml-2 px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded-full">
              {branch}
            </span>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            fetchContents(breadcrumb.join('/'));
            fetchCommits(breadcrumb.join('/'));
          }}
          disabled={isLoading}
        >
          <RefreshCcw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Breadcrumb - Fixed */}
      {showBreadcrumb && (
        <div className="flex items-center overflow-x-auto whitespace-nowrap p-2 bg-gray-900/50 border-t border-gray-800 shrink-0">
          <button 
            onClick={() => navigateToPath(-1)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            root
          </button>
          {breadcrumb.map((part, index) => (
            <div key={index} className="flex items-center">
              <span className="mx-1 text-gray-600">/</span>
              <button 
                onClick={() => navigateToPath(index)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {part}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tabs container - Takes remaining height */}
      <div className="flex-grow min-h-0 flex flex-col">
        <Tabs defaultValue="files" className="flex flex-col h-full">
          {/* Tab headers - Fixed */}
          <TabsList className={`grid w-full ${showCommits ? 'grid-cols-3' : 'grid-cols-2'} bg-gray-900/30 shrink-0`}>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="code" disabled={!currentFile}>Code Viewer</TabsTrigger>
            {showCommits && <TabsTrigger value="commits">Commits</TabsTrigger>}
          </TabsList>
          
          {/* Files Tab - Scrollable content */}
          <TabsContent value="files" className="flex-grow overflow-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-400">Loading...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-red-400">{error}</div>
            ) : contents.length === 0 ? (
              <div className="p-4 text-gray-400">No files found</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {contents.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleItemClick(item)}
                    className="w-full text-left p-2 hover:bg-gray-800/50 flex items-center"
                  >
                    {item.type === "dir" ? (
                      <svg
                        className="h-4 w-4 mr-2 text-blue-400"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    ) : (
                      <FileBadge className="h-4 w-4 mr-2 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-300">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Code Tab - Scrollable content */}
          <TabsContent value="code" className="flex-grow min-h-0 flex flex-col overflow-hidden">
            {currentFile && (
              <>
                <div className="bg-gray-900/30 px-3 py-2 flex justify-between items-center border-b border-gray-800 shrink-0">
                  <span className="text-sm text-gray-300 font-mono truncate">
                    {currentFile.path}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="overflow-auto flex-grow min-h-0">
                  <pre className="p-4 text-sm font-mono text-green-400 whitespace-pre-wrap">
                    {fileContent || "No content available"}
                  </pre>
                </div>
              </>
            )}
          </TabsContent>

          {/* Commits Tab - Scrollable content */}
          {showCommits && (
            <TabsContent value="commits" className="flex-grow min-h-0 flex flex-col overflow-hidden">
              <div className="p-3 bg-gray-900/30 border-b border-gray-800 flex items-center sticky top-0 z-10 shrink-0">
                <GitCommit className="h-4 w-4 mr-2 text-blue-400" />
                <span className="text-sm text-white font-medium">Recent Commits</span>
                {currentFile && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {currentFile.path}
                  </Badge>
                )}
              </div>
              
              {isLoadingCommits ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-400 text-sm">Loading commit history...</span>
                </div>
              ) : commits.length === 0 ? (
                <div className="p-4 text-gray-400 text-center">No commit history available</div>
              ) : (
                <div className="divide-y divide-gray-800 overflow-y-auto flex-grow min-h-0">
                  {commits.map((commit) => (
                    <div key={commit.sha} className="p-3 hover:bg-gray-800/30">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium line-clamp-2">
                            {commit.message}
                          </p>
                          <div className="flex flex-wrap items-center mt-1 text-xs text-gray-400">
                            <span className="mr-2">
                              {commit.author.name}
                            </span>
                            <span>
                              {format(new Date(commit.author.date), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                        </div>
                        <a 
                          href={commit.html_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-400 hover:text-blue-300 shrink-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      <div className="mt-1 flex items-center">
                        <Badge variant="secondary" className="text-xs bg-gray-800">
                          {commit.sha.substring(0, 7)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}