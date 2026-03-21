"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

import { chartColors, hslVar } from "@/lib/chart-theme";

type Row = { channel: string; tpv: string | number };

export function ChannelBarChart({ data, height = 220 }: { data: Row[]; height?: number }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return;

    const margin = { top: 16, right: 16, bottom: 56, left: 52 };
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
      .padding(0.2);

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

    const tooltip = g.append("g").attr("class", "bar-tooltip").style("opacity", 0).style("pointer-events", "none");
    tooltip.append("rect").attr("rx", 6).attr("fill", tipBg).attr("stroke", tipBorder).attr("stroke-width", 1);
    const tipCh = tooltip.append("text").attr("fill", tipFg).style("font-size", "11px");
    const tipAmt = tooltip.append("text").attr("fill", tipFg).style("font-size", "12px").style("font-weight", "600");

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
      .style("cursor", "pointer")
      .on("mouseenter", function (_event, d) {
        const bx = (x(d.channel) ?? 0) + x.bandwidth() / 2;
        const by = y(d.tpv);
        tipCh.text(d.channel);
        tipAmt.text(fmtMoney(d.tpv));
        const pad = 8;
        const w1 = (tipCh.node() as SVGTextElement).getComputedTextLength();
        const w2 = (tipAmt.node() as SVGTextElement).getComputedTextLength();
        const tw = Math.max(w1, w2, 72) + pad * 2;
        const th = 38;
        let tx = bx - tw / 2;
        if (tx < 4) tx = 4;
        if (tx + tw > innerW - 4) tx = innerW - tw - 4;
        let ty = by - th - 8;
        if (ty < 4) ty = by + 8;
        tooltip.select("rect").attr("x", tx).attr("y", ty).attr("width", tw).attr("height", th);
        tipCh.attr("x", tx + pad).attr("y", ty + 15);
        tipAmt.attr("x", tx + pad).attr("y", ty + 30);
        tooltip.style("opacity", 1);
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("fill", muted)
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat((v) => d3.format(",.0f")(v as number)))
      .selectAll("text")
      .style("fill", muted);

    g.selectAll(".domain, .tick line").style("stroke", hslVar("--border"));
  }, [data, height]);

  return (
    <div className="w-full overflow-hidden">
      <svg ref={ref} width="100%" height={height} className="block" role="img" aria-label="TPV by channel" />
    </div>
  );
}
