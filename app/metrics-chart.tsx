"use client";
import { useEffect, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  BrushComponent,
  ToolboxComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { TimeseriesChart } from "@cloudflare/kumo/components/chart";
import { formatBytes, formatCount } from "@/lib/format";
import type { ChartSeries } from "@/lib/metric-charts";
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  BrushComponent,
  ToolboxComponent,
  SVGRenderer,
]);
const tick = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});
const full = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default function MetricsChart({
  data,
  bytes,
  label,
  type = "line",
}: {
  data: ChartSeries[];
  bytes?: boolean;
  label: string;
  type?: "line" | "bar";
}) {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.dataset.mode === "dark");
    sync();
    const o = new MutationObserver(sync);
    o.observe(root, { attributes: true, attributeFilter: ["data-mode"] });
    return () => o.disconnect();
  }, []);
  const format = bytes ? formatBytes : formatCount;
  return (
    <TimeseriesChart
      echarts={echarts}
      data={data}
      type={type}
      height={280}
      isDarkMode={dark}
      xAxisName="Time (UTC)"
      xAxisTickCount={5}
      xAxisTickFormat={(t) => tick.format(t)}
      yAxisName={bytes ? "Bytes" : "Operations"}
      yAxisTickCount={5}
      yAxisMinInterval={bytes ? undefined : 1}
      yAxisTickFormat={format}
      tooltipValueFormat={format}
      tooltipTimestampFormat={(t) => `${full.format(t)} UTC`}
      ariaDescription={label}
    />
  );
}
