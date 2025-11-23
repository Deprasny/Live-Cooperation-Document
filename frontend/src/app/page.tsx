"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const createDocument = async () => {
    try {
      setIsLoading(true);
      const response = await api.post("/documents");
      const { id } = response.data;
      router.push(`/docs/${id}`);
    } catch (error) {
      console.error("Failed to create document", error);
      alert("Failed to create document. Please check if the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-8">
        <h1 className="text-4xl font-bold text-center">Live Docs</h1>
        <p className="text-center text-gray-500">
          A simple real-time collaborative note editor.
        </p>

        <button
          onClick={createDocument}
          disabled={isLoading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create New Document"
          )}
        </button>
      </div>
    </main>
  );
}
