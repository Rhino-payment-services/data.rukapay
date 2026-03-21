"use client";

import * as d3 from "d3";
import { useEffect, useRef } from "react";

import { timeTickFormatForSpan } from "@/lib/chart-axis-format";
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
export function WalletGrowthLineChart({ data, height = 280 }: { data: WalletGrowthPoint[]; height?: number }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !data.length) return;

    const margin = { top: 32, right: 20, bottom: 52, left: 48 };
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

    const leg = g.append("g").attr("transform", `translate(0, -6)`);
    [
      { label: "Personal", color: strokePersonal, x: 0 },
      { label: "Merchant (business)", color: strokeMerchant, x: 148 },
    ].forEach((item) => {
      const row = leg.append("g").attr("transform", `translate(${item.x}, 0)`);
      row.append("line").attr("x1", 0).attr("x2", 18).attr("y1", 0).attr("y2", 0).attr("stroke", item.color).attr("stroke-width", 2.5);
      row.append("text").attr("x", 22).attr("y", 4).text(item.label).style("fill", muted).style("font-size", "11px");
    });

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

    const [tStart, tEnd] = x.domain();
    const xTickFmt = timeTickFormatForSpan(tStart, tEnd);
    const xAxisG = g
      .append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(xTickFmt as (d: Date | d3.NumberValue, i: number) => string));
    xAxisG.selectAll("text").style("fill", muted).style("font-size", "12px").attr("dy", "0.71em");

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat((v) => d3.format(",.0f")(v as number)))
      .selectAll("text")
      .style("fill", muted)
      .style("font-size", "11px");

    g.selectAll(".domain, .tick line").style("stroke", hslVar("--border"));

    const bisect = d3.bisector((d: (typeof parsed)[0]) => d.date).left;
    const dateFmt = d3.timeFormat("%b %d, %Y");
    const fmtInt = (n: number) => d3.format(",.0f")(n);

    const tipBg = hslVar("--popover");
    const tipFg = hslVar("--popover-foreground");
    const tipBorder = hslVar("--border");

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
      .attr("class", "wallet-focus-line")
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", hslVar("--border"))
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 3");

    focus
      .append("circle")
      .attr("class", "dot-personal")
      .attr("r", 5)
      .attr("fill", strokePersonal)
      .attr("stroke", hslVar("--background"))
      .attr("stroke-width", 2);

    focus
      .append("circle")
      .attr("class", "dot-merchant")
      .attr("r", 5)
      .attr("fill", strokeMerchant)
      .attr("stroke", hslVar("--background"))
      .attr("stroke-width", 2);

    const tip = focus.append("g").attr("class", "wallet-tip");
    tip.append("rect").attr("rx", 8).attr("class", "chart-tooltip-shadow").attr("fill", tipBg).attr("stroke", tipBorder).attr("stroke-width", 1);
    const t1 = tip.append("text").attr("fill", tipFg).style("font-size", "12px").style("font-weight", "600");
    const t2 = tip.append("text").attr("fill", tipFg).style("font-size", "11px");
    const t3 = tip.append("text").attr("fill", tipFg).style("font-size", "11px").style("font-weight", "500");

    const pad = 10;
    const lineH = 18;

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
        const cyp = y(d.personal);
        const cym = y(d.merchant);

        focus.style("opacity", "1");
        focus.select(".wallet-focus-line").attr("x1", cx).attr("x2", cx);
        focus.select(".dot-personal").attr("cx", cx).attr("cy", cyp);
        focus.select(".dot-merchant").attr("cx", cx).attr("cy", cym);

        t1.text(dateFmt(d.date));
        t2.text(`Personal: ${fmtInt(d.personal)} new`);
        t3.text(`Merchant (business): ${fmtInt(d.merchant)} new`);

        t1.attr("x", pad).attr("y", 16);
        t2.attr("x", pad).attr("y", 16 + lineH);
        t3.attr("x", pad).attr("y", 16 + lineH * 2);

        const w1 = (t1.node() as SVGTextElement).getComputedTextLength();
        const w2 = (t2.node() as SVGTextElement).getComputedTextLength();
        const w3 = (t3.node() as SVGTextElement).getComputedTextLength();
        const tw = Math.max(w1, w2, w3) + pad * 2;
        const th = 60;
        tip.select("rect").attr("width", tw).attr("height", th);

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
  }, [data, height]);

  return (
    <div className="chart-wrap relative w-full min-w-0 isolate z-0 overflow-visible">
      <svg ref={ref} width="100%" height={height} className="block overflow-visible" role="img" aria-label="Personal and merchant new wallets over time" />
    </div>
  );
}
