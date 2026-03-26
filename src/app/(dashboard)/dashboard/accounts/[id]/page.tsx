"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Destination {
  id: string;
  name: string;
  url: string;
  active: boolean;
}

interface Account {
  id: string;
  name: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  chatwootInboxId: string | null;
  active: boolean;
  verifyToken: string;
  webhookUrl: string;
  destinations: { destination: Destination; active: boolean }[];
  _count: { messages: number };
}

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/accounts/${id}`).then((r) => r.json()),
      fetch("/api/destinations").then((r) => r.json()),
    ]).then(([accData, destData]) => {
      setAccount(accData.account);
      setAllDestinations(destData.destinations || []);
    });
  }, [id]);

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }

  async function toggleDestination(destId: string, linked: boolean) {
    if (linked) {
      await fetch(`/api/accounts/${id}/destinations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId: destId }),
      });
    } else {
      await fetch(`/api/accounts/${id}/destinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationId: destId }),
      });
    }
    // Refresh
    const res = await fetch(`/api/accounts/${id}`);
    const data = await res.json();
    setAccount(data.account);
  }

  async function deleteAccount() {
    if (!confirm("Are you sure you want to delete this account?")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    router.push("/dashboard/accounts");
  }

  if (!account) {
    return <p className="text-gray-500">Loading...</p>;
  }

  const linkedIds = new Set(
    account.destinations.map((d) => d.destination.id)
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/accounts"
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {account.name}
            </h1>
            <p className="text-sm text-gray-500">{account.phoneNumber}</p>
          </div>
        </div>
        <button
          onClick={deleteAccount}
          className="p-2 text-red-400 hover:text-red-600"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Webhook Config */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Webhook Configuration
        </h2>
        <p className="text-sm text-gray-500">
          Use these values in your Meta Developer Console:
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Callback URL
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-gray-50 rounded-lg text-sm break-all">
              {account.webhookUrl}
            </code>
            <button
              onClick={() => copyToClipboard(account.webhookUrl, "url")}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              {copied === "url" ? (
                <Check size={18} className="text-green-600" />
              ) : (
                <Copy size={18} />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Verify Token
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-gray-50 rounded-lg text-sm break-all">
              {account.verifyToken}
            </code>
            <button
              onClick={() => copyToClipboard(account.verifyToken, "token")}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              {copied === "token" ? (
                <Check size={18} className="text-green-600" />
              ) : (
                <Copy size={18} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Linked Destinations */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Linked Destinations
        </h2>
        <p className="text-sm text-gray-500">
          Toggle which destinations receive webhooks from this account.
        </p>

        {allDestinations.length === 0 ? (
          <p className="text-sm text-gray-400">
            No destinations created yet.{" "}
            <Link
              href="/dashboard/destinations/new"
              className="text-blue-600 hover:underline"
            >
              Create one
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            {allDestinations.map((dest) => {
              const isLinked = linkedIds.has(dest.id);
              return (
                <label
                  key={dest.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {dest.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-md">
                      {dest.url}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isLinked}
                    onChange={() => toggleDestination(dest.id, isLinked)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900">Statistics</h2>
        <p className="text-sm text-gray-500 mt-1">
          Total messages: {account._count.messages}
        </p>
      </div>
    </div>
  );
}
