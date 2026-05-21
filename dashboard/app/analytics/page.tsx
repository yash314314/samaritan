"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/app/hooks/useApi";
import { analyticsApi, focusApi } from "@/lib/api";
import { useAppContext } from "@/context/AppContext";
import StrictFocusPanel from "../../components/StrictFocusPanel";
import FocusTrendChart from "../../components/FocusTrendChart";
import DeepWorkStats from "../../components/DeepWorkStats";
import AppUsageChart from "../../components/AppUsageChart";
import ContextSwitchStats from "../../components/ContextSwitchStats";
import BurnoutRiskCard from "../../components/BurnoutRiskCard";

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";

export default function AnalyticsPage() {
  const { selectedDate } = useAppContext();

  // ─── DATA FETCHING ───
  const { 
    data: daily, 
    loading: dailyLoading 
  } = useApi(
    async () => {
      const dateString = selectedDate.toLocaleDateString("en-CA");
      const { data } = await analyticsApi.getDaily(dateString);
      return data;
    },
    { enabled: !!selectedDate }
  );

  const { 
    data: weekly 
  } = useApi(
    async () => {
      const dateString = selectedDate.toLocaleDateString("en-CA");
      const { data } = await analyticsApi.getTrend();
      return data;
    },
    { enabled: !!selectedDate }
  );

  const { 
    data: intelligence 
  } = useApi(
    async () => {
      const { data } = await analyticsApi.getDashboard();
      return data;
    }
  );

  const {
    data: activeSession,
    refetch: refetchActive
  } = useApi(
    async () => {
      const { data } = await focusApi.getActive();
      return data;
    },
    { refetchInterval: 5000 }
  );

  // Focus trend with bucket
  const [focusBucketMinutes, setFocusBucketMinutes] = useState(60);
  const [focusMode, setFocusMode] = useState<"daily" | "weekly">("daily");

  const {
    data: dailyFocusTrend,
    loading: focusLoading
  } = useApi(
    async () => {
      // Use the daily timeline data as focus trend
      const dateString = selectedDate.toLocaleDateString("en-CA");
      const { data } = await analyticsApi.getDaily(dateString);
      // Transform activities into time buckets
      return bucketActivities(data?.activities || [], focusBucketMinutes);
    },
    { enabled: !!selectedDate }
  );

  // ─── HELPERS ───
  function bucketActivities(activities: any[], bucketMinutes: number) {
    if (!activities?.length) return [];
    
    const buckets: Record<number, { focus: number; productivity: number; count: number }> = {};
    
    activities.forEach((activity: any) => {
      const hour = new Date(activity.startTime).getHours();
      const minute = new Date(activity.startTime).getMinutes();
      const bucketIndex = Math.floor((hour * 60 + minute) / bucketMinutes);
      
      if (!buckets[bucketIndex]) {
        buckets[bucketIndex] = { focus: 0, productivity: 0, count: 0 };
      }
      
      buckets[bucketIndex].focus += (activity.focusImpact || 0.5) * 100;
      buckets[bucketIndex].productivity += activity.productivityScore || 50;
      buckets[bucketIndex].count += 1;
    });

    return Object.entries(buckets).map(([index, data]) => ({
      time: `${Math.floor(Number(index) * bucketMinutes / 60)}:${String((Number(index) * bucketMinutes) % 60).padStart(2, '0')}`,
      focus: data.count > 0 ? data.focus / data.count : 0,
      productivity: data.count > 0 ? data.productivity / data.count : 0,
    }));
  }

  // ─── LOADING STATE ───
  if (dailyLoading || !daily || !weekly || !intelligence) {
    return (
      <div className="flex justify-center items-center h-64 text-zinc-400">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
        Loading analytics...
      </div>
    );
  }

  // ─── DERIVED DATA ───
  const focusTrendData = focusMode === "daily" ? dailyFocusTrend : weekly;

  const summary = {
    focus: daily.averageFocusScore ?? daily.focusScore ?? 0,
    burnout: daily.averageBurnoutScore ?? daily.burnoutRiskScore ?? 0,
    entropy: daily.averageEntropyScore ?? daily.entropyScore ?? 0,
    switches: daily.totalSwitches ?? daily.switchCount ?? 0,
    deepWorkSessions: daily.deepWorkSessions ?? 0,
  };

  // ─── RENDER ───
  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-zinc-400 mt-1">
            {selectedDate.toLocaleDateString("en-US", { 
              weekday: "long", 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}
          </p>
        </div>
        {activeSession && (
          <div className="bg-blue-600/10 border border-blue-600/20 text-blue-400 px-4 py-2 rounded-lg text-sm">
            🎯 Deep Work Active: {activeSession.goal || "In Progress"}
          </div>
        )}
      </div>

      {/* Focus Trend Chart */}
      <FocusTrendChart
        mode={focusMode}
        onModeChange={setFocusMode}
        data={focusTrendData || []}
        bucketMinutes={focusBucketMinutes}
        onBucketMinutesChange={setFocusBucketMinutes}
        isLoading={focusLoading}
        summary={summary}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StrictFocusPanel 
          userId={USER_ID} 
          activeSession={activeSession}
          onSessionChange={refetchActive}
        />
        <DeepWorkStats data={daily} />
        <BurnoutRiskCard data={daily} />
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ContextSwitchStats data={daily} />
        <AppUsageChart data={daily.appUsage || daily.topApps || []} />
      </div>

      {/* Intelligence Insights */}
      {intelligence?.suggestion && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2">💡 Insight</h3>
          <p className="text-zinc-300">{intelligence.suggestion}</p>
          <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
            <div>
              <div className="text-zinc-500">Productivity</div>
              <div className="text-white font-mono">{intelligence.productivityScore?.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-zinc-500">Focus</div>
              <div className="text-white font-mono">{intelligence.focusScore?.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-zinc-500">Deep Work Ratio</div>
              <div className="text-white font-mono">{intelligence.deepWorkRatio?.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-zinc-500">Cognitive Stability</div>
              <div className="text-white font-mono">{intelligence.cognitiveStability?.toFixed(1)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}