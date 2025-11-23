"use client";

import { useEffect, useState, useRef } from "react";
import { socket } from "@/lib/socket";
import api from "@/lib/api";
import { useDebouncedCallback } from "use-debounce";
import { useRouter } from "next/navigation";

interface EditorProps {
  documentId: string;
  initialContent: string;
  initialVersion: number;
}

interface DocumentSummary {
  id: string;
  updatedAt: string;
}

export default function Editor({ documentId, initialContent, initialVersion }: EditorProps) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [version, setVersion] = useState(initialVersion);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [userCount, setUserCount] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);

  // We use a ref to track if the update is coming from the socket to avoid loops
  const isRemoteUpdate = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Fetch all documents for the switcher
    const fetchDocuments = async () => {
      try {
        const res = await api.get("/documents");
        setDocuments(res.data);
      } catch (err) {
        console.error("Failed to fetch documents:", err);
      }
    };
    fetchDocuments();

    // Connect to socket
    socket.connect();
    socket.emit("join-document", documentId);

    // Listen for updates
    socket.on("document-updated", (data: { content: string; version: number }) => {
      console.log("Received update:", data);

      // Update local state
      isRemoteUpdate.current = true;
      setContent(data.content);
      setVersion(data.version);
      setStatus("saved");
      setIsTyping(false); // Clear typing indicator on update

      // Reset flag after a short delay to allow render
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 50);
    });

    socket.on("active-users", (count: number) => {
      setUserCount(count);
    });

    socket.on("user-typing", () => {
      setIsTyping(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to hide indicator
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 2000);
    });

    socket.on("error", (msg) => {
      console.error("Socket error:", msg);
      setStatus("unsaved");
    });

    return () => {
      socket.off("document-updated");
      socket.off("active-users");
      socket.off("user-typing");
      socket.off("error");
      socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [documentId]);

  const emitChange = useDebouncedCallback((newContent: string, baseVersion: number) => {
    console.log(`Emitting change based on v${baseVersion}`);
    setStatus("saving");
    socket.emit("edit-document", {
      documentId,
      content: newContent,
      version: baseVersion,
    });
  }, 500);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    if (!isRemoteUpdate.current) {
      setStatus("unsaved");
      // Emit typing event
      socket.emit("typing", { documentId });

      // We send the change based on the CURRENT version we have.
      // If the server has a newer version, it will reject this and send us the latest.
      emitChange(newContent, version);
    }
  };

  const handleSwitchDocument = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    if (newId && newId !== documentId) {
      router.push(`/docs/${newId}`);
    }
  };

  const handleCreateNew = async () => {
    try {
      const res = await api.post("/documents");
      router.push(`/docs/${res.data.id}`);
    } catch (err) {
      console.error("Failed to create document:", err);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await api.delete(`/documents/${documentId}`);
      // Redirect to the first available document or home
      const remaining = documents.filter(d => d.id !== documentId);
      if (remaining.length > 0) {
        router.push(`/docs/${remaining[0].id}`);
      } else {
        router.push("/");
      }
    } catch (err: any) {
      console.error("Failed to delete document:", err);
      if (err.response && err.response.status === 409) {
        alert("Cannot delete document because other users are currently editing it.");
      } else {
        alert("Failed to delete document. Please try again.");
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Status: <span className={`font-medium ${status === "saved" ? "text-green-600" :
              status === "saving" ? "text-yellow-600" : "text-red-600"
              }`}>{status.toUpperCase()}</span>
          </div>
          <div className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-full flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            {userCount} Active User{userCount !== 1 ? 's' : ''}
          </div>
          {isTyping && (
            <div className="text-xs text-gray-500 italic animate-pulse">
              Someone is typing...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateNew}
            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
          >
            + New
          </button>
          <button
            onClick={handleDelete}
            className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
          <select
            value={documentId}
            onChange={handleSwitchDocument}
            className="text-xs border rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                Doc: {doc.id.substring(0, 8)}...
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-400">
            v{version}
          </div>
        </div>
      </div>

      <textarea
        value={content}
        onChange={handleChange}
        className="w-full h-[70vh] p-6 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm leading-relaxed text-gray-900 bg-white"
        placeholder="Start typing..."
      />

      <div className="mt-4 text-xs text-gray-400">
        Document ID: {documentId}
      </div>
    </div>
  );
}
