"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Editor from "@/components/Editor";
import { Loader2 } from "lucide-react";

export default function DocumentPage({ params }: { params: { id: string } }) {
  const [document, setDocument] = useState<{ content: string; version: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await api.get(`/documents/${params.id}`);
        setDocument(response.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load document. It might not exist.");
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  if (!document) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-8">
        <div className="mb-8 px-4">
          <h1 className="text-2xl font-bold text-gray-800">Document Editor</h1>
          <p className="text-sm text-gray-500">ID: {params.id}</p>
        </div>

        <Editor
          documentId={params.id}
          initialContent={document.content}
          initialVersion={document.version}
        />
      </div>
    </main>
  );
}
