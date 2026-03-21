"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

import { formatYAxisCompact, timeTickFormatForSpan } from "@/lib/chart-axis-format";
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
  height = 280,
  targetReference = null,
}: TimeseriesLineChartProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return;

    const margin = { top: 24, right: 20, bottom: 56, left: metric === "tpv" ? 62 : 50 };
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

    const [tStart, tEnd] = x.domain();
    const xTickFmt = timeTickFormatForSpan(tStart, tEnd);
    const xAxis = d3
      .axisBottom(x)
      .ticks(6)
      .tickFormat(xTickFmt as (d: Date | d3.NumberValue, i: number) => string);

    const yTickFmt =
      metric === "tpv"
        ? (v: d3.NumberValue) => formatYAxisCompact(v as number)
        : (v: d3.NumberValue) => d3.format(",.0f")(v as number);

    const xAxisG = g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis);
    xAxisG.selectAll("text").style("fill", muted).style("font-size", "12px").attr("dy", "0.71em");

    const yAxisG = g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(yTickFmt));
    yAxisG.selectAll("text").style("fill", muted).style("font-size", "11px");

    g.selectAll(".domain, .tick line").style("stroke", hslVar("--border"));

    const dateFmt = d3.timeFormat("%b %d, %Y");
    const valueFmt =
      metric === "tpv"
        ? (v: number) => d3.format(",.2f")(v)
        : (v: number) => d3.format(",.0f")(v);

    const bisect = d3.bisector((d: (typeof parsed)[0]) => d.date).left;

    const overlay = g
      .append("rect")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("cursor", "crosshair");

    const focus = g
      .append("g")
      .attr("class", "chart-tooltip-layer")
      .style("opacity", "0")
      .style("pointer-events", "none");

    focus
      .append("line")
      .attr("class", "focus-line")
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", hslVar("--border"))
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 3");

    focus
      .append("circle")
      .attr("class", "focus-dot")
      .attr("r", 5)
      .attr("fill", lineStroke)
      .attr("stroke", hslVar("--background"))
      .attr("stroke-width", 2);

    const tipBg = hslVar("--popover");
    const tipFg = hslVar("--popover-foreground");
    const tipBorder = hslVar("--border");

    const tip = focus.append("g").attr("class", "chart-tooltip-inner");
    tip.append("rect")
      .attr("class", "tip-bg chart-tooltip-shadow")
      .attr("rx", 8)
      .attr("fill", tipBg)
      .attr("stroke", tipBorder)
      .attr("stroke-width", 1);
    const tipDate = tip.append("text").attr("class", "tip-date").attr("fill", tipFg).style("font-size", "12px");
    const tipVal = tip.append("text").attr("class", "tip-val").attr("fill", tipFg).style("font-size", "13px").style("font-weight", "600");

    overlay
      .on("mousemove", function (event) {
        const [mx, my] = d3.pointer(event, this);
        if (mx < 0 || mx > innerW) return;
        const x0 = x.invert(mx);
        const i = bisect(parsed, x0, 1);
        const d0 = parsed[Math.max(0, i - 1)];
        const d1 = parsed[Math.min(parsed.length - 1, i)];
        const d = x0.getTime() - d0.date.getTime() > d1.date.getTime() - x0.getTime() ? d1 : d0;

        const cx = x(d.date);
        const cy = y(d.value);
        focus.style("opacity", "1");
        focus.select(".focus-line").attr("x1", cx).attr("x2", cx);
        focus.select(".focus-dot").attr("cx", cx).attr("cy", cy);

        const label = metric === "tpv" ? "TPV" : "Count";
        tipDate.text(dateFmt(d.date));
        tipVal.text(`${label}: ${valueFmt(d.value)}`);

        const pad = 10;
        const line1 = tipDate.node() as SVGTextElement;
        const line2 = tipVal.node() as SVGTextElement;
        tipDate.attr("x", pad).attr("y", 16);
        tipVal.attr("x", pad).attr("y", 34);
        const w1 = line1.getComputedTextLength?.() ?? line1.getBBox().width;
        const w2 = line2.getComputedTextLength?.() ?? line2.getBBox().width;
        const tw = Math.max(w1, w2) + pad * 2;
        const th = 42;
        tip.select("rect.tip-bg").attr("width", tw).attr("height", th);

        let tx = mx + 12;
        let ty = my - th - 8;
        if (tx + tw > innerW - 4) tx = mx - tw - 12;
        if (tx < 4) tx = 4;
        if (ty < 4) ty = my + 12;
        if (ty + th > innerH - 4) ty = innerH - th - 4;
        tip.attr("transform", `translate(${tx},${ty})`);
      })
      .on("mouseleave", () => {
        focus.style("opacity", "0");
      });
  }, [data, height, metric, targetReference]);

  const aria =
    metric === "tpv"
      ? "Total payment volume over time"
      : "Successful transaction count over time";

  return (
    <div className="chart-wrap relative w-full min-w-0 isolate z-0 overflow-visible">
      <svg ref={ref} width="100%" height={height} className="block overflow-visible" role="img" aria-label={aria} />
    </div>
  );
}
