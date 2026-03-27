"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Check } from "lucide-react";
import Link from "next/link";

export default function NewAccountPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    phoneNumberId: "",
    wabaId: "",
    accessToken: "",
    appSecret: "",
    chatwootInboxId: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{
    webhookUrl: string;
    verifyToken: string;
  } | null>(null);
  const [copied, setCopied] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setCreated({
        webhookUrl: data.account.webhookUrl,
        verifyToken: data.account.verifyToken,
      });
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }

  if (created) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Account Created</h1>
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Configure these values in your Meta Developer Console webhook
            settings:
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Callback URL
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-gray-50 rounded-lg text-sm break-all">
                {created.webhookUrl}
              </code>
              <button
                onClick={() =>
                  copyToClipboard(created.webhookUrl, "url")
                }
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
                {created.verifyToken}
              </code>
              <button
                onClick={() =>
                  copyToClipboard(created.verifyToken, "token")
                }
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

          <button
            onClick={() => router.push("/dashboard/accounts")}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Go to Accounts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/accounts"
          className="p-2 text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Add WhatsApp Account
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border p-6 space-y-4"
      >
        {error && (
          <div className="p-3 text-sm bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Sales Line"
            required
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="text"
            value={form.phoneNumber}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
            placeholder="+966 5x xxx xxxx"
            required
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number ID
          </label>
          <input
            type="text"
            value={form.phoneNumberId}
            onChange={(e) =>
              setForm({ ...form, phoneNumberId: e.target.value })
            }
            placeholder="From Meta Developer Console"
            required
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp Business Account ID
          </label>
          <input
            type="text"
            value={form.wabaId}
            onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
            placeholder="WABA ID"
            required
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access Token
          </label>
          <input
            type="password"
            value={form.accessToken}
            onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            placeholder="Permanent access token"
            required
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            App Secret
          </label>
          <input
            type="password"
            value={form.appSecret}
            onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
            placeholder="Meta App Secret (for signature verification)"
            required
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chatwoot Inbox ID{" "}
            <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={form.chatwootInboxId}
            onChange={(e) =>
              setForm({ ...form, chatwootInboxId: e.target.value })
            }
            placeholder="For bidirectional Chatwoot integration"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}
