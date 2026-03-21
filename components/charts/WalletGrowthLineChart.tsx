"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

import { hslVar } from "@/lib/chart-theme";

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export type WalletGrowthPoint = {
  bucket_start: string;
  new_personal_wallets: unknown;
  new_business_wallets: unknown;
};

/**
 * Personal vs merchant (business) new wallets per bucket — same axes for comparison.
 * Business wallets = non-PERSONAL `walletType` (merchant-linked / business accounts).
 */
export function WalletGrowthLineChart({ data, height = 260 }: { data: WalletGrowthPoint[]; height?: number }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return;

    const margin = { top: 28, right: 20, bottom: 36, left: 44 };
    const width = ref.current.parentElement?.clientWidth ?? 600;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const parsed = data.map((d) => ({
      date: new Date(d.bucket_start),
      personal: num(d.new_personal_wallets),
      merchant: num(d.new_business_wallets),
    }));

    const x = d3
      .scaleTime()
      .domain(d3.extent(parsed, (d) => d.date) as [Date, Date])
      .range([0, innerW]);

    const maxY = d3.max(parsed, (d) => Math.max(d.personal, d.merchant)) ?? 1;
    const y = d3.scaleLinear().domain([0, maxY]).nice().range([innerH, 0]);

    const linePersonal = d3
      .line<(typeof parsed)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.personal))
      .curve(d3.curveMonotoneX);

    const lineMerchant = d3
      .line<(typeof parsed)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.merchant))
      .curve(d3.curveMonotoneX);

    const strokePersonal = hslVar("--chart-line");
    const strokeMerchant = hslVar("--chart-2");
    const muted = hslVar("--muted-foreground");

    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("path")
      .datum(parsed)
      .attr("fill", "none")
      .attr("stroke", strokePersonal)
      .attr("stroke-width", 2.5)
      .attr("d", linePersonal);

    g.append("path")
      .datum(parsed)
      .attr("fill", "none")
      .attr("stroke", strokeMerchant)
      .attr("stroke-width", 2.5)
      .attr("d", lineMerchant);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, parsed.length)))
      .selectAll("text")
      .style("fill", muted);

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat((v) => d3.format(",.0f")(v as number)))
      .selectAll("text")
      .style("fill", muted);

    g.selectAll(".domain, .tick line").style("stroke", hslVar("--border"));

    const leg = g.append("g").attr("transform", `translate(0, -4)`);
    [
      { label: "Personal", color: strokePersonal, x: 0 },
      { label: "Merchant (business)", color: strokeMerchant, x: 128 },
    ].forEach((item) => {
      const row = leg.append("g").attr("transform", `translate(${item.x}, 0)`);
      row.append("line").attr("x1", 0).attr("x2", 18).attr("y1", 0).attr("y2", 0).attr("stroke", item.color).attr("stroke-width", 2.5);
      row.append("text").attr("x", 22).attr("y", 4).text(item.label).style("fill", muted).style("font-size", "11px");
    });
  }, [data, height]);

  return (
    <div className="w-full overflow-hidden">
      <svg ref={ref} width="100%" height={height} className="block" role="img" aria-label="Personal and merchant new wallets over time" />
    </div>
  );
}
