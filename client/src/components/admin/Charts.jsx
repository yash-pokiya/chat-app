import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-2xl px-3 py-2 shadow-card text-sm">
      <p className="text-ink-faint text-xs mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.value} {p.name}
        </p>
      ))}
    </div>
  );
};

export function MessagesLineChart({ data }) {
  const formatted = (data || []).map((d) => ({
    hour: `${String(d._id).padStart(2, '0')}:00`,
    messages: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6C63FF" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis dataKey="hour" stroke="#9CA3AF" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone" dataKey="messages" name="messages"
          stroke="#6C63FF" strokeWidth={2.5}
          fill="url(#msgGrad)" dot={false}
          activeDot={{ r: 4, fill: '#6C63FF', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MessagesDayChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data || []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis dataKey="date" stroke="#9CA3AF" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="count" name="messages" fill="url(#barGrad)" radius={[6, 6, 0, 0]}>
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6C63FF" />
              <stop offset="100%" stopColor="#48CAE4" />
            </linearGradient>
          </defs>
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
