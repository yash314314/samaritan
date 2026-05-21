"use client";

import {
  ResponsiveContainer,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ComposedChart,
  Line
} from "recharts";

const BUCKET_OPTIONS = [
  { label: "Hour", value: 60 },
  { label: "30m", value: 30 },
  { label: "15m", value: 15 },
  { label: "5m", value: 5 },
  { label: "1m", value: 1 }
];

function formatDateLabel(date: string) {
  const d = new Date(date + "T00:00:00");

  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric"
  });
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0]?.payload;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl">
      <div className="text-zinc-200 font-semibold mb-2">
        {point?.displayLabel ?? point?.label ?? point?.date}
      </div>

      <div className="space-y-1 text-zinc-400">
        {point?.focus !== undefined && (
          <div>
            Focus:{" "}
            <span className="text-purple-400">
              {Number(point.focus).toFixed(1)}
            </span>
          </div>
        )}

        {point?.averageBurnout !== undefined && (
          <div>
            Burnout:{" "}
            <span className="text-red-400">
              {Number(point.averageBurnout).toFixed(1)}
            </span>
          </div>
        )}

        {point?.averageEntropy !== undefined && (
          <div>
            Entropy:{" "}
            <span className="text-cyan-400">
              {Number(point.averageEntropy).toFixed(1)}
            </span>
          </div>
        )}

        {point?.deepWorkSeconds !== undefined && (
          <div>
            Deep Work:{" "}
            <span className="text-emerald-400">
              {(point.deepWorkSeconds / 3600).toFixed(1)}h
            </span>
          </div>
        )}

        {point?.duration !== undefined && (
          <div>
            Tracked:{" "}
            <span className="text-zinc-300">
              {Math.round(point.duration / 60000)}m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone = "text-zinc-200"
}: {
  label: string;
  value: any;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs">
      <span className="text-zinc-500">{label}</span>{" "}
      <span className={`font-medium ${tone}`}>{value}</span>
    </div>
  );
}

export default function FocusTrendChart({
  data,
  mode = "daily",
  onModeChange,
  bucketMinutes = 60,
  onBucketMinutesChange,
  isLoading = false,
  summary
}: any) {
  if (!Array.isArray(data)) return null;

  const isWeekly = mode === "weekly";

  const chartData = isWeekly
    ? data.map((d: any) => ({
        ...d,
        label: formatDateLabel(d.date),
        displayLabel: new Date(d.date + "T00:00:00").toDateString(),
        focus: d.averageFocus ?? 0
      }))
    : data.map((d: any) => ({
        ...d,
        activeMinutes: Math.round((d.duration ?? 0) / 60000)
      }));

  const activePoints = chartData.filter((d: any) =>
    isWeekly ? d.focus > 0 : d.duration > 0
  );

  const averageFocus =
    activePoints.length > 0
      ? activePoints.reduce((sum: number, d: any) => sum + d.focus, 0) /
        activePoints.length
      : 0;

  const peak = activePoints.reduce(
    (best: any, point: any) =>
      point.focus > (best?.focus ?? -1) ? point : best,
    null
  );

  const pointWidth =
    bucketMinutes <= 1
      ? 14
      : bucketMinutes <= 5
      ? 22
      : bucketMinutes <= 15
      ? 32
      : 42;

  const chartWidth =
    !isWeekly && bucketMinutes < 60
      ? Math.max(1200, chartData.length * pointWidth)
      : "100%";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">
            Focus Trend
          </h2>

          <div className="text-[11px] text-zinc-500 mt-1">
            {isLoading
              ? "Updating focus curve..."
              : isWeekly
              ? "Day-by-day focus, burnout, entropy and deep work"
              : bucketMinutes >= 60
              ? "Hourly work-focus for selected day"
              : `${bucketMinutes}-minute work-focus intervals`}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-1">
            {["daily", "weekly"].map(option => {
              const active = option === mode;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onModeChange?.(option)}
                  className={`px-2.5 py-1 text-[11px] rounded transition capitalize ${
                    active
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {!isWeekly && (
            <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-1">
              {BUCKET_OPTIONS.map(option => {
                const active = option.value === bucketMinutes;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      onBucketMinutesChange?.(option.value)
                    }
                    className={`px-2.5 py-1 text-[11px] rounded transition ${
                      active
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <SummaryChip
          label="Avg"
          value={averageFocus.toFixed(1)}
          tone="text-purple-400"
        />

        {peak && (
          <SummaryChip
            label="Peak"
            value={`${peak.focus.toFixed(1)} @ ${
              peak.label ?? peak.displayLabel
            }`}
            tone="text-emerald-400"
          />
        )}

        {summary?.burnout !== undefined && (
          <SummaryChip
            label="Burnout"
            value={Number(summary.burnout).toFixed(0)}
            tone="text-red-400"
          />
        )}

        {summary?.entropy !== undefined && (
          <SummaryChip
            label="Entropy"
            value={Number(summary.entropy).toFixed(0)}
            tone="text-cyan-400"
          />
        )}

        {summary?.switches !== undefined && (
          <SummaryChip
            label="Switches"
            value={summary.switches}
            tone="text-zinc-200"
          />
        )}
      </div>

      <div className="overflow-x-auto">
        <div
          className="h-72"
          style={{
            width: chartWidth
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{
                top: 8,
                right: 12,
                left: -10,
                bottom: 0
              }}
            >
              <defs>
                <linearGradient
                  id="focusGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#8b5cf6"
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="95%"
                    stopColor="#8b5cf6"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="#27272a"
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="label"
                interval={
                  !isWeekly && bucketMinutes < 60
                    ? Math.ceil(60 / bucketMinutes) - 1
                    : 0
                }
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />

              <YAxis
                yAxisId="focus"
                domain={[0, 100]}
                tick={{ fill: "#a1a1aa", fontSize: 12 }}
                axisLine={{ stroke: "#3f3f46" }}
                tickLine={false}
              />

              {!isWeekly && (
                <YAxis
                  yAxisId="active"
                  orientation="right"
                  hide
                  domain={[0, bucketMinutes]}
                />
              )}

              <Tooltip content={<CustomTooltip />} />

              <ReferenceLine
                yAxisId="focus"
                y={75}
                stroke="#22c55e"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
              />

              <ReferenceLine
                yAxisId="focus"
                y={50}
                stroke="#71717a"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
              />

              <ReferenceLine
                yAxisId="focus"
                y={25}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeOpacity={0.35}
              />

              {!isWeekly && (
                <Bar
                  yAxisId="active"
                  dataKey="activeMinutes"
                  fill="#3f3f46"
                  opacity={0.35}
                  radius={[2, 2, 0, 0]}
                />
              )}

              <Area
                yAxisId="focus"
                type="monotone"
                dataKey="focus"
                stroke="#8b5cf6"
                strokeWidth={3}
                fill="url(#focusGradient)"
                dot={
                  isWeekly || bucketMinutes >= 60
                    ? { r: 3, fill: "#8b5cf6" }
                    : false
                }
                activeDot={{ r: 5 }}
              />

              {isWeekly && (
                <>
                  <Line
                    yAxisId="focus"
                    type="monotone"
                    dataKey="averageBurnout"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />

                  <Line
                    yAxisId="focus"
                    type="monotone"
                    dataKey="averageEntropy"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-[11px] text-zinc-500 mt-3">
        <span>Purple = work focus</span>

        {!isWeekly && (
          <span>Gray bars = tracked activity</span>
        )}

        {isWeekly && (
          <>
            <span>Red = burnout</span>
            <span>Cyan = entropy</span>
          </>
        )}

        <span>Green line = deep work threshold</span>
      </div>
    </div>
  );
}