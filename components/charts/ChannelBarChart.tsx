"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

import { formatYAxisCompact } from "@/lib/chart-axis-format";
import { chartColors, hslVar } from "@/lib/chart-theme";
import { formatChannelLabel } from "@/lib/channel-labels";

type Row = { channel: string; tpv: string | number };

export function ChannelBarChart({ data, height = 260 }: { data: Row[]; height?: number }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return;

    const margin = { top: 16, right: 20, bottom: 76, left: 56 };
    const width = ref.current.parentElement?.clientWidth ?? 600;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const rows = data.map((d) => ({
      channel: d.channel,
      tpv: typeof d.tpv === "string" ? parseFloat(d.tpv) : d.tpv,
    }));

    const x = d3
      .scaleBand()
      .domain(rows.map((d) => d.channel))
      .range([0, innerW])
      .padding(0.28);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.tpv) ?? 1])
      .nice()
      .range([innerH, 0]);

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const palette = chartColors();
    const color = d3
      .scaleOrdinal<string, string>()
      .domain(rows.map((r) => r.channel))
      .range(palette);
    const muted = hslVar("--muted-foreground");

    const tipBg = hslVar("--popover");
    const tipFg = hslVar("--popover-foreground");
    const tipBorder = hslVar("--border");

    const fmtMoney = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    g.selectAll("rect.bar")
      .data(rows)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.channel) ?? 0)
      .attr("y", (d) => y(d.tpv))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerH - y(d.tpv))
      .attr("rx", 4)
      .attr("fill", (d) => color(d.channel))
      .style("cursor", "pointer");

    const xAxis = d3.axisBottom(x).tickFormat((d) => formatChannelLabel(String(d)));
    const xg = g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis);
    xg.style("pointer-events", "none");
    xg.selectAll("text")
      .style("fill", muted)
      .style("font-size", "11px")
      .attr("transform", null)
      .style("text-anchor", "middle");

    const yg = g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((v) => formatYAxisCompact(v as number)));
    yg.style("pointer-events", "none");
    yg.selectAll("text")
      .style("fill", muted)
      .style("font-size", "11px");

    g.selectAll(".domain, .tick line").style("stroke", hslVar("--border"));

    const tooltip = g
      .append("g")
      .attr("class", "chart-tooltip-layer bar-tooltip-pop")
      .style("opacity", 0)
      .style("pointer-events", "none");

    tooltip.append("rect").attr("rx", 8).attr("class", "chart-tooltip-shadow").attr("fill", tipBg).attr("stroke", tipBorder).attr("stroke-width", 1);
    const tipCh = tooltip.append("text").attr("fill", tipFg).style("font-size", "12px").style("font-weight", "600");
    const tipAmt = tooltip.append("text").attr("fill", tipFg).style("font-size", "12px");

    type RowT = (typeof rows)[0];

    function positionTooltip(px: number, py: number, d: RowT) {
      tipCh.text(formatChannelLabel(d.channel));
      tipAmt.text(fmtMoney(d.tpv));
      const pad = 10;
      const w1 = (tipCh.node() as SVGTextElement).getComputedTextLength();
      const w2 = (tipAmt.node() as SVGTextElement).getComputedTextLength();
      const tw = Math.max(w1, w2, 80) + pad * 2;
      const th = 40;
      tipCh.attr("x", pad).attr("y", 17);
      tipAmt.attr("x", pad).attr("y", 32);
      tooltip.select("rect").attr("width", tw).attr("height", th);

      let tx = px + 12;
      let ty = py - th - 8;
      if (tx + tw > innerW - 4) tx = px - tw - 12;
      if (tx < 4) tx = 4;
      if (ty < 4) ty = py + 12;
      if (ty + th > innerH - 4) ty = innerH - th - 4;
      tooltip.attr("transform", `translate(${tx},${ty})`);
    }

    g.selectAll("rect.bar")
      .on("mouseenter", function (event, d) {
        const row = d as RowT;
        const [px, py] = d3.pointer(event, g.node());
        positionTooltip(px, py, row);
        tooltip.style("opacity", 1);
      })
      .on("mousemove", function (event, d) {
        const row = d as RowT;
        const [px, py] = d3.pointer(event, g.node());
        positionTooltip(px, py, row);
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });
  }, [data, height]);

  return (
    <div className="chart-wrap relative w-full min-w-0 isolate z-0 overflow-visible">
      <svg ref={ref} width="100%" height={height} className="block overflow-visible" role="img" aria-label="TPV by channel" />
    </div>
  );
}
