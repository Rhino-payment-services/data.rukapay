"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

import { chartColors, hslVar } from "@/lib/chart-theme";

type Row = { channel: string; tpv: string | number };

export function ChannelBarChart({ data, height = 220 }: { data: Row[]; height?: number }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return;

    const margin = { top: 16, right: 16, bottom: 56, left: 48 };
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

    g.selectAll("rect")
      .data(rows)
      .join("rect")
      .attr("x", (d) => x(d.channel) ?? 0)
      .attr("y", (d) => y(d.tpv))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerH - y(d.tpv))
      .attr("rx", 4)
      .attr("fill", (d) => color(d.channel));

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
