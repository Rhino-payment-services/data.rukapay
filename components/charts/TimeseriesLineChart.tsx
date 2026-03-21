"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

import { hslVar } from "@/lib/chart-theme";
import type { TimeseriesApiItem } from "@/lib/timeseries-aggregate";

function getMetricValue(d: TimeseriesApiItem, metric: "tpv" | "transaction_count"): number {
  if (metric === "tpv") {
    const v = d.tpv;
    return typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
  }
  const v = d.transaction_count;
  if (typeof v === "string") return parseInt(v, 10) || 0;
  return typeof v === "number" ? Math.round(v) : 0;
}

type TimeseriesLineChartProps = {
  data: TimeseriesApiItem[];
  metric?: "tpv" | "transaction_count";
  height?: number;
  /**
   * Optional horizontal reference line (e.g. uniform per-bucket target pace).
   * Shown when value &gt; 0.
   */
  targetReference?: number | null;
};

export function TimeseriesLineChart({
  data,
  metric = "tpv",
  height = 220,
  targetReference = null,
}: TimeseriesLineChartProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return;

    const margin = { top: 22, right: 16, bottom: 36, left: metric === "tpv" ? 56 : 44 };
    const width = ref.current.parentElement?.clientWidth ?? 600;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const parsed = data.map((d) => ({
      date: new Date(d.bucket_start),
      value: getMetricValue(d, metric),
    }));

    const maxVal = d3.max(parsed, (d) => d.value) ?? 0;
    const refVal = targetReference != null && targetReference > 0 ? targetReference : null;
    const yMax = Math.max(maxVal, refVal ?? 0, 1);

    const x = d3
      .scaleTime()
      .domain(d3.extent(parsed, (d) => d.date) as [Date, Date])
      .range([0, innerW]);

    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

    const line = d3
      .line<(typeof parsed)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (metric === "tpv") {
      const area = d3
        .area<(typeof parsed)[0]>()
        .x((d) => x(d.date))
        .y0(innerH)
        .y1((d) => y(d.value))
        .curve(d3.curveMonotoneX);

      const areaFill = hslVar("--chart-area");
      g.append("path")
        .datum(parsed)
        .attr("fill", areaFill)
        .attr("fill-opacity", 0.22)
        .attr("d", area);
    }

    const lineStroke = metric === "tpv" ? hslVar("--chart-line") : hslVar("--chart-5");
    const muted = hslVar("--muted-foreground");

    g.append("path")
      .datum(parsed)
      .attr("fill", "none")
      .attr("stroke", lineStroke)
      .attr("stroke-width", 2.5)
      .attr("d", line);

    if (refVal != null) {
      const strokeTarget = hslVar("--chart-3");
      g.append("line")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", y(refVal))
        .attr("y2", y(refVal))
        .attr("stroke", strokeTarget)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6 4")
        .attr("pointer-events", "none");

      g.append("text")
        .attr("x", innerW)
        .attr("y", y(refVal) - 5)
        .attr("text-anchor", "end")
        .attr("fill", muted)
        .style("font-size", "10px")
        .text("Target pace / bucket");
    }

    const tickFmt =
      metric === "tpv"
        ? (v: d3.NumberValue) => d3.format(",.0f")(v as number)
        : (v: d3.NumberValue) => d3.format(",.0f")(v as number);

    const xAxis = d3.axisBottom(x).ticks(Math.min(8, parsed.length));
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat(tickFmt);

    g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis).selectAll("text").style("fill", muted);

    g.append("g").call(yAxis).selectAll("text").style("fill", muted);

    g.selectAll(".domain, .tick line").style("stroke", hslVar("--border"));
  }, [data, height, metric, targetReference]);

  const aria =
    metric === "tpv"
      ? "Total payment volume over time"
      : "Successful transaction count over time";

  return (
    <div className="w-full overflow-hidden">
      <svg ref={ref} width="100%" height={height} className="block" role="img" aria-label={aria} />
    </div>
  );
}
