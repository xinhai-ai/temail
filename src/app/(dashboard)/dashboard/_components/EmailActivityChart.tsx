"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type EmailActivityChartProps = {
  data: { date: string; count: number }[];
};

export function EmailActivityChart({ data }: EmailActivityChartProps) {
  const t = useTranslations("dashboard");

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("widgets.emailActivity.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("widgets.emailActivity.subtitle")}</p>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
                itemStyle={{ color: "hsl(var(--primary))" }}
                formatter={(value) => [
                  t("widgets.emailActivity.tooltipValue", { count: value }),
                  t("widgets.emailActivity.tooltipLabel"),
                ]}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
