"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

interface Analytics {
  range: string;
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  successRate: number;
  deliveryBreakdown: Record<string, number>;
  dailyVolume: { date: string; count: number }[];
  messagesPerAccount: { accountName: string; count: number }[];
}

const PIE_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6b7280"];

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [range, setRange] = useState("7d");

  useEffect(() => {
    fetch(`/api/analytics?range=${range}`)
      .then((r) => r.json())
      .then(setAnalytics);
  }, [range]);

  if (!analytics) {
    return <p className="text-gray-500">Loading...</p>;
  }

  const deliveryPieData = Object.entries(analytics.deliveryBreakdown).map(
    ([name, value]) => ({ name, value })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white text-gray-700"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Messages", value: analytics.totalMessages },
          { label: "Inbound", value: analytics.inboundCount },
          { label: "Outbound", value: analytics.outboundCount },
          { label: "Delivery Rate", value: `${analytics.successRate}%` },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Message volume chart */}
      {analytics.dailyVolume.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Message Volume
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.dailyVolume}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#2563eb"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery status pie chart */}
        {deliveryPieData.length > 0 && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Delivery Status
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={deliveryPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {deliveryPieData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Messages per account bar chart */}
        {analytics.messagesPerAccount.length > 0 && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Messages per Account
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.messagesPerAccount}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="accountName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
