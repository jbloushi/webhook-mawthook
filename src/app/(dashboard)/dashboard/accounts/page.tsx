"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Phone } from "lucide-react";

interface Account {
  id: string;
  name: string;
  phoneNumber: string;
  active: boolean;
  createdAt: string;
  _count: { destinations: number; messages: number };
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts || []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Accounts</h1>
        <Link
          href="/dashboard/accounts/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Account
        </Link>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Account
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Phone Number
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Destinations
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Messages
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <Link
                    href={`/dashboard/accounts/${account.id}`}
                    className="flex items-center gap-3"
                  >
                    <div className="p-2 bg-green-50 rounded-lg">
                      <Phone size={16} className="text-green-600" />
                    </div>
                    <span className="font-medium text-gray-900">
                      {account.name}
                    </span>
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {account.phoneNumber}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {account._count.destinations}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {account._count.messages}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      account.active
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {account.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No accounts yet. Add your first WhatsApp account to get
                  started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
