"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Message {
  id: string;
  direction: string;
  fromNumber: string | null;
  toNumber: string | null;
  type: string;
  content: Record<string, unknown>;
  status: string;
  createdAt: string;
  account: { name: string };
  deliveryAttempts: {
    id: string;
    status: string;
    statusCode: number | null;
    attemptNumber: number;
    destination: { name: string; url: string };
    errorMessage: string | null;
    createdAt: string;
  }[];
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState({ direction: "", status: "" });
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("skip", String(page * pageSize));
    params.set("take", String(pageSize));
    if (filter.direction) params.set("direction", filter.direction);
    if (filter.status) params.set("status", filter.status);

    fetch(`/api/messages?${params}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []));
  }, [page, filter]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Messages</h1>

      <div className="flex gap-3">
        <select
          value={filter.direction}
          onChange={(e) =>
            setFilter({ ...filter, direction: e.target.value })
          }
          className="px-3 py-2 border rounded-lg text-sm text-gray-700 bg-white"
        >
          <option value="">All Directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select
          value={filter.status}
          onChange={(e) =>
            setFilter({ ...filter, status: e.target.value })
          }
          className="px-3 py-2 border rounded-lg text-sm text-gray-700 bg-white"
        >
          <option value="">All Statuses</option>
          <option value="received">Received</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="read">Read</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-8 px-4 py-3" />
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Direction
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                From
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                To
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Account
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {messages.map((msg) => (
              <>
                <tr
                  key={msg.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setExpanded(expanded === msg.id ? null : msg.id)
                  }
                >
                  <td className="px-4 py-3">
                    {expanded === msg.id ? (
                      <ChevronDown size={14} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-400" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        msg.direction === "inbound"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      {msg.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {msg.fromNumber || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {msg.toNumber || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {msg.type}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        msg.status === "received" || msg.status === "delivered"
                          ? "bg-green-50 text-green-700"
                          : msg.status === "failed"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {msg.account?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(msg.createdAt).toLocaleString()}
                  </td>
                </tr>
                {expanded === msg.id && (
                  <tr key={`${msg.id}-detail`}>
                    <td colSpan={8} className="px-6 py-4 bg-gray-50">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
                            Content
                          </h4>
                          <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-40">
                            {JSON.stringify(msg.content, null, 2)}
                          </pre>
                        </div>
                        {msg.deliveryAttempts?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
                              Delivery Attempts
                            </h4>
                            <div className="space-y-1">
                              {msg.deliveryAttempts.map((attempt) => (
                                <div
                                  key={attempt.id}
                                  className="flex items-center gap-3 text-xs bg-white p-2 rounded border"
                                >
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-medium ${
                                      attempt.status === "success"
                                        ? "bg-green-50 text-green-700"
                                        : attempt.status === "failed"
                                        ? "bg-red-50 text-red-700"
                                        : "bg-yellow-50 text-yellow-700"
                                    }`}
                                  >
                                    {attempt.status}
                                  </span>
                                  <span className="text-gray-600">
                                    {attempt.destination?.name}
                                  </span>
                                  {attempt.statusCode && (
                                    <span className="text-gray-400">
                                      HTTP {attempt.statusCode}
                                    </span>
                                  )}
                                  {attempt.errorMessage && (
                                    <span className="text-red-500 truncate max-w-xs">
                                      {attempt.errorMessage}
                                    </span>
                                  )}
                                  <span className="text-gray-400">
                                    #{attempt.attemptNumber}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {messages.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  No messages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 text-gray-700"
        >
          Previous
        </button>
        <button
          onClick={() => setPage(page + 1)}
          disabled={messages.length < pageSize}
          className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 text-gray-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}
