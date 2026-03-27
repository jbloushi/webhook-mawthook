"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Webhook, Trash2, MessageSquare, Globe, Zap } from "lucide-react";

interface Destination {
  id: string;
  name: string;
  type: string;
  url: string;
  active: boolean;
  createdAt: string;
  _count: { accounts: number };
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Webhook }> = {
  chatwoot: { label: "Chatwoot", color: "green", icon: MessageSquare },
  custom: { label: "Custom", color: "purple", icon: Webhook },
  n8n: { label: "n8n", color: "orange", icon: Zap },
  zapier: { label: "Zapier", color: "orange", icon: Zap },
  make: { label: "Make", color: "blue", icon: Zap },
  other: { label: "Other", color: "gray", icon: Globe },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.other;
}

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    fetch("/api/destinations")
      .then((r) => r.json())
      .then((data) => setDestinations(data.destinations || []));
  }, []);

  async function deleteDestination(id: string) {
    if (!confirm("Delete this destination?")) return;
    await fetch(`/api/destinations/${id}`, { method: "DELETE" });
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Webhook Destinations
        </h1>
        <Link
          href="/dashboard/destinations/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Destination
        </Link>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                URL
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Accounts
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {destinations.map((dest) => {
              const typeConf = getTypeConfig(dest.type);
              const Icon = typeConf.icon;
              return (
                <tr key={dest.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-${typeConf.color}-50 rounded-lg`}>
                        <Icon size={16} className={`text-${typeConf.color}-600`} />
                      </div>
                      <span className="font-medium text-gray-900">
                        {dest.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${typeConf.color}-50 text-${typeConf.color}-700`}>
                      {typeConf.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {dest.url}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {dest._count.accounts}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        dest.active
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {dest.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => deleteDestination(dest.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {destinations.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No destinations yet. Add your first webhook destination.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
