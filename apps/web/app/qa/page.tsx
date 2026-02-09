"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import LimitReached from "@/components/LimitReached";
import DataTable from "@/components/DataTable";
import { useAuth } from "@/lib/auth-context";
import { askQuestion } from "@/lib/api";
import type { QAResponse } from "@/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  table?: QAResponse["table"];
  meta?: QAResponse["meta"];
}

export default function QAPage() {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [queriesRemaining, setQueriesRemaining] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated && user?.usageRemaining) {
      setQueriesRemaining(user.usageRemaining.qa);
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await askQuestion(question);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          table: res.table,
          meta: res.meta,
        },
      ]);
      if (res.meta) {
        setQueriesRemaining(res.meta.queriesRemaining);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const isLimitReached = isAuthenticated && queriesRemaining !== null && queriesRemaining <= 0 && user?.plan === "free";

  const suggestedQuestions = [
    "Who leads the league in scoring this season?",
    "Which team has the best defensive rating?",
    "How many triple-doubles does Nikola Jokic have?",
    "Compare LeBron James and Michael Jordan career stats",
  ];

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <PageHeader
        title="AI Q&A"
        subtitle="Ask any NBA stats question in plain English"
        actions={
          !isAuthenticated ? (
            <Link
              href="/login?next=/qa"
              className="rounded-full bg-nba-blue/10 px-3 py-1 text-xs font-medium text-nba-blue hover:bg-nba-blue/20"
            >
              Sign in to track usage and unlock Premium
            </Link>
          ) : queriesRemaining !== null && user?.plan === "free" ? (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              {queriesRemaining} queries remaining today
            </span>
          ) : null
        }
      />

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="text-4xl">💬</div>
            <h3 className="mt-3 text-lg font-bold text-gray-900">Ask anything about NBA stats</h3>
            <p className="mt-1 text-sm text-gray-500">Powered by AI over 2.5M+ shot records and comprehensive box score data</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 transition hover:border-nba-blue/30 hover:bg-nba-blue/5 hover:text-nba-blue"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <div
              className={`inline-block max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-nba-blue text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>

            {msg.table && (
              <div className="mt-2 inline-block max-w-[90%] text-left">
                <Card>
                  <DataTable
                    columns={msg.table.columns.map((col, ci) => ({
                      key: String(ci),
                      header: col,
                      align: ci > 0 ? ("right" as const) : ("left" as const),
                    }))}
                    data={msg.table.rows.map((row) => {
                      const obj: Record<string, unknown> = {};
                      row.forEach((val, ci) => {
                        obj[String(ci)] = val;
                      });
                      return obj;
                    })}
                  />
                </Card>
              </div>
            )}

            {msg.meta && msg.role === "assistant" && isAuthenticated && user?.plan === "free" && (
              <p className="mt-1 text-xs text-gray-400">
                {msg.meta.queriesRemaining} queries remaining today
              </p>
            )}
          </div>
        ))}

        {loading && (
          <div className="mb-4 text-left">
            <div className="inline-block rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="mt-3">
        {isLimitReached ? (
          <LimitReached feature="Q&A queries" />
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about NBA stats..."
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:border-nba-blue focus:outline-none focus:ring-2 focus:ring-nba-blue/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary rounded-xl px-6 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
