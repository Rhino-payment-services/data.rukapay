"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

import { hslVar } from "@/lib/chart-theme";

type Point = { bucket_start: string; tpv: string | number };

export function TimeseriesLineChart({ data, height = 220 }: { data: Point[]; height?: number }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return;

    const margin = { top: 16, right: 16, bottom: 36, left: 56 };
    const width = ref.current.parentElement?.clientWidth ?? 600;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const parsed = data.map((d) => ({
      date: new Date(d.bucket_start),
      tpv: typeof d.tpv === "string" ? parseFloat(d.tpv) : d.tpv,
    }));

    const x = d3
      .scaleTime()
      .domain(d3.extent(parsed, (d) => d.date) as [Date, Date])
      .range([0, innerW]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(parsed, (d) => d.tpv) ?? 1])
      .nice()
      .range([innerH, 0]);

    const line = d3
      .line<(typeof parsed)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.tpv))
      .curve(d3.curveMonotoneX);

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const area = d3
      .area<(typeof parsed)[0]>()
      .x((d) => x(d.date))
      .y0(innerH)
      .y1((d) => y(d.tpv))
      .curve(d3.curveMonotoneX);

    const areaFill = hslVar("--chart-area");
    const lineStroke = hslVar("--chart-line");
    const muted = hslVar("--muted-foreground");

    g.append("path")
      .datum(parsed)
      .attr("fill", areaFill)
      .attr("fill-opacity", 0.22)
      .attr("d", area);

    g.append("path")
      .datum(parsed)
      .attr("fill", "none")
      .attr("stroke", lineStroke)
      .attr("stroke-width", 2.5)
      .attr("d", line);

    const xAxis = d3.axisBottom(x).ticks(Math.min(8, parsed.length));
    const yAxis = d3.axisLeft(y).ticks(5).tickFormat((v) => d3.format(",.0f")(v as number));

    g.append("g").attr("transform", `translate(0,${innerH})`).call(xAxis).selectAll("text").style("fill", muted);

    g.append("g").call(yAxis).selectAll("text").style("fill", muted);

    g.selectAll(".domain, .tick line").style("stroke", hslVar("--border"));
  }, [data, height]);

  return (
    <div className="w-full overflow-hidden">
      <svg ref={ref} width="100%" height={height} className="block" role="img" aria-label="TPV over time" />
    </div>
  );
}
