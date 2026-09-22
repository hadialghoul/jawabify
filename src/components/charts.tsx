import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, radius } from '../theme';

export const CHART_COLORS = ['#4F46E5', '#059669', '#D97706', '#7C3AED', '#F97316', '#0EA5E9', '#E11D48'];

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: item.color }]} />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function useBox(minHeight: number) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return { width, onLayout, height: minHeight };
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(value));
  const n = value / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * mag;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function curvePath(points: { x: number; y: number }[], closeTo?: number) {
  if (!points.length) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y} ${cx} ${p1.y} ${p1.x} ${p1.y}`;
  }
  if (closeTo != null) {
    d += ` L ${points[points.length - 1].x} ${closeTo} L ${points[0].x} ${closeTo} Z`;
  }
  return d;
}

export function AreaLineChart({
  data,
  series,
  xKey,
  height = 220,
}: {
  data: Record<string, string | number>[];
  series: { key: string; color: string; type?: 'area' | 'line' }[];
  xKey: string;
  height?: number;
}) {
  const box = useBox(height);
  const pad = { top: 12, right: 8, bottom: 28, left: 32 };
  const innerW = Math.max(box.width - pad.left - pad.right, 1);
  const innerH = height - pad.top - pad.bottom;
  const maxVal = niceMax(
    Math.max(
      1,
      ...data.flatMap((row) => series.map((s) => Number(row[s.key] ?? 0))),
    ),
  );
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const labelEvery = Math.max(1, Math.ceil(data.length / 5));

  return (
    <View onLayout={box.onLayout} style={{ height }}>
      {box.width > 0 ? (
        <Svg width={box.width} height={height}>
          <Defs>
            {series.map((s) => (
              <LinearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <Stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </LinearGradient>
            ))}
          </Defs>
          {[0, 0.5, 1].map((t) => {
            const y = pad.top + innerH * (1 - t);
            return (
              <GLine key={t} x1={pad.left} x2={pad.left + innerW} y1={y} y2={y} />
            );
          })}
          {series.map((s) => {
            const pts = data.map((row, i) => ({
              x: pad.left + i * step,
              y: pad.top + innerH - (Number(row[s.key] ?? 0) / maxVal) * innerH,
            }));
            if (s.type === 'line') {
              return (
                <Path
                  key={s.key}
                  d={curvePath(pts)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                />
              );
            }
            return (
              <Path
                key={s.key}
                d={curvePath(pts, pad.top + innerH)}
                fill={`url(#grad-${s.key})`}
                stroke={s.color}
                strokeWidth={2}
              />
            );
          })}
          <SvgText x={4} y={pad.top + 10} fontSize={10} fill={colors.mutedForeground}>
            {maxVal}
          </SvgText>
          {data.map((row, i) =>
            i % labelEvery === 0 ? (
              <SvgText
                key={i}
                x={pad.left + i * step}
                y={height - 8}
                fontSize={9}
                fill={colors.mutedForeground}
                textAnchor="middle"
              >
                {String(row[xKey])}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

function GLine({ x1, x2, y1, y2 }: { x1: number; x2: number; y1: number; y2: number }) {
  return <Line x1={x1} x2={x2} y1={y1} y2={y2} stroke={colors.border} strokeDasharray="4 4" />;
}

export function BarChartView({
  data,
  xKey,
  yKey,
  color = CHART_COLORS[0],
  height = 200,
  formatX,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  formatX?: (v: string | number) => string;
}) {
  const box = useBox(height);
  const pad = { top: 12, right: 8, bottom: 28, left: 28 };
  const innerW = Math.max(box.width - pad.left - pad.right, 1);
  const innerH = height - pad.top - pad.bottom;
  const maxVal = niceMax(Math.max(1, ...data.map((d) => Number(d[yKey] ?? 0))));
  const gap = 3;
  const barW = data.length ? Math.max(4, (innerW - gap * data.length) / data.length) : 8;
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <View onLayout={box.onLayout} style={{ height }}>
      {box.width > 0 ? (
        <Svg width={box.width} height={height}>
          {[0, 0.5, 1].map((t) => {
            const y = pad.top + innerH * (1 - t);
            return <GLine key={t} x1={pad.left} x2={pad.left + innerW} y1={y} y2={y} />;
          })}
          {data.map((row, i) => {
            const v = Number(row[yKey] ?? 0);
            const h = (v / maxVal) * innerH;
            const x = pad.left + i * (barW + gap);
            return (
              <Rect
                key={i}
                x={x}
                y={pad.top + innerH - h}
                width={barW}
                height={Math.max(h, v > 0 ? 2 : 0)}
                rx={3}
                fill={color}
              />
            );
          })}
          {data.map((row, i) =>
            i % labelEvery === 0 ? (
              <SvgText
                key={`l-${i}`}
                x={pad.left + i * (barW + gap) + barW / 2}
                y={height - 8}
                fontSize={9}
                fill={colors.mutedForeground}
                textAnchor="middle"
              >
                {formatX ? formatX(row[xKey]) : String(row[xKey])}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

export function HorizontalBarChart({
  data,
  labelKey,
  valueKey,
  color = CHART_COLORS[0],
  height,
}: {
  data: { [k: string]: string | number }[];
  labelKey: string;
  valueKey: string;
  color?: string;
  height?: number;
}) {
  const rows = data.slice(0, 10);
  const box = useBox(height ?? Math.max(160, rows.length * 28 + 8));
  const maxVal = Math.max(1, ...rows.map((d) => Number(d[valueKey] ?? 0)));
  const rowH = 26;
  const h = height ?? rows.length * rowH + 8;
  const labelW = 92;
  const padRight = 36;

  return (
    <View onLayout={box.onLayout} style={{ height: h }}>
      {box.width > 0
        ? rows.map((row, i) => {
            const v = Number(row[valueKey] ?? 0);
            const track = Math.max(box.width - labelW - padRight, 40);
            const w = (v / maxVal) * track;
            return (
              <View key={i} style={[styles.hRow, { height: rowH }]}>
                <Text numberOfLines={1} style={styles.hLabel}>
                  {String(row[labelKey])}
                </Text>
                <View style={[styles.hTrack, { width: track }]}>
                  <View style={[styles.hBar, { width: Math.max(w, v > 0 ? 4 : 0), backgroundColor: color }]} />
                </View>
                <Text style={styles.hVal}>{v}</Text>
              </View>
            );
          })
        : null}
    </View>
  );
}

export function DonutChart({
  data,
  height = 220,
  colors: palette = CHART_COLORS,
}: {
  data: { name: string; value: number }[];
  height?: number;
  colors?: string[];
}) {
  const box = useBox(height);
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = Math.min(box.width || height, height);
  const cx = (box.width || size) / 2;
  const cy = size / 2 - 8;
  const rOut = Math.min(cx, cy) - 8;
  const rIn = rOut * 0.58;
  const slices = useMemo(() => {
    if (!total) return [];
    let angle = 0;
    return data.map((d, i) => {
      const sweep = (d.value / total) * 360;
      const start = angle;
      const end = angle + Math.max(sweep, d.value > 0 ? 0.6 : 0);
      angle = end;
      const startOut = polar(cx, cy, rOut, start);
      const endOut = polar(cx, cy, rOut, end);
      const startIn = polar(cx, cy, rIn, start);
      const endIn = polar(cx, cy, rIn, end);
      const large = end - start > 180 ? 1 : 0;
      const dPath = `M ${startOut.x} ${startOut.y} A ${rOut} ${rOut} 0 ${large} 1 ${endOut.x} ${endOut.y} L ${endIn.x} ${endIn.y} A ${rIn} ${rIn} 0 ${large} 0 ${startIn.x} ${startIn.y} Z`;
      return { dPath, color: palette[i % palette.length], ...d };
    });
  }, [data, total, cx, cy, rOut, rIn, palette]);

  return (
    <View>
      <View onLayout={box.onLayout} style={{ height: size }}>
        {box.width > 0 ? (
          <Svg width={box.width} height={size}>
            {total === 0 ? (
              <Circle cx={cx} cy={cy} r={rOut} fill={colors.muted} />
            ) : (
              slices.map((s, i) => <Path key={i} d={s.dPath} fill={s.color} />)
            )}
            <SvgText x={cx} y={cy + 4} fontSize={16} fontWeight="700" fill={colors.foreground} textAnchor="middle">
              {total}
            </SvgText>
          </Svg>
        ) : null}
      </View>
      <ChartLegend items={data.map((d, i) => ({ label: `${d.name} (${d.value})`, color: palette[i % palette.length] }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.foreground },
  cardSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.mutedForeground, fontWeight: '600' },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hLabel: { width: 92, fontSize: 11, fontWeight: '600', color: colors.foreground },
  hTrack: { height: 10, backgroundColor: colors.muted, borderRadius: 99, overflow: 'hidden' },
  hBar: { height: 10, borderRadius: 99 },
  hVal: { width: 28, fontSize: 11, fontWeight: '700', color: colors.mutedForeground, textAlign: 'right' },
});
