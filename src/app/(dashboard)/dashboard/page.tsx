"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Phone, Webhook, CheckCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Stats {
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  successRate: number;
  dailyVolume: { date: string; count: number }[];
  messagesPerAccount: { accountName: string; count: number }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [accountCount, setAccountCount] = useState(0);
  const [destCount, setDestCount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics?range=7d").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/destinations").then((r) => r.json()),
    ]).then(([analytics, accounts, destinations]) => {
      setStats(analytics);
      setAccountCount(accounts.accounts?.length || 0);
      setDestCount(destinations.destinations?.length || 0);
    });
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const cards = [
    {
      label: "Messages (7d)",
      value: stats.totalMessages,
      icon: MessageSquare,
      color: "blue",
    },
    {
      label: "Active Accounts",
      value: accountCount,
      icon: Phone,
      color: "green",
    },
    {
      label: "Destinations",
      value: destCount,
      icon: Webhook,
      color: "purple",
    },
    {
      label: "Delivery Rate",
      value: `${stats.successRate}%`,
      icon: CheckCircle,
      color: "emerald",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border p-5 flex items-start justify-between"
          >
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {card.value}
              </p>
            </div>
            <div className={`p-2 rounded-lg bg-${card.color}-50`}>
              <card.icon size={20} className={`text-${card.color}-600`} />
            </div>
          </div>
        ))}
      </div>

      {stats.dailyVolume.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Message Volume (Last 7 Days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.dailyVolume}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
