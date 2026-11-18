import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const riskToNumeric = (risk) => {
  if (typeof risk === 'number') return risk;
  switch (risk) {
    case 'Critical':
      return 3;
    case 'High':
      return 2;
    default:
      return 1;
  }
};

const formatTick = (value) => {
  if (value === 3) return 'Critical';
  if (value === 2) return 'High';
  if (value === 1) return 'Low';
  return '';
};

const RiskChart = ({ data = [] }) => {
  const formattedData = data.map((item) => ({
    ...item,
    temperature: item.temperature ?? 0,
    humidity: item.humidity ?? 0,
    rainfall: item.rainfall ?? 0,
    riskNum: item.riskNum ?? riskToNumeric(item.risk_score || item.risk),
  }));

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" stroke="#64748b" />
          <YAxis
            yAxisId="left"
            orientation="left"
            stroke="#64748b"
            label={{ value: 'Metrics (°C / % / mm)', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#f97316"
            domain={[0, 4]}
            ticks={[1, 2, 3]}
            tickFormatter={formatTick}
            label={{ value: 'Risk Score', angle: 90, position: 'insideRight', style: { fill: '#f97316', fontSize: 12 } }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', borderColor: '#e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(value, name) => {
              if (name === 'Risk Score') {
                const label = formatTick(value) || 'Low';
                return [label, name];
              }
              return [value, name];
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <Bar yAxisId="left" dataKey="temperature" fill="#ef4444" name="Temperature (°C)" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="humidity" fill="#3b82f6" name="Humidity (%)" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="rainfall" fill="#10b981" name="Rainfall (mm)" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="riskNum" stroke="#f97316" strokeWidth={3} name="Risk Score" dot={{ r: 6, fill: '#f97316' }} activeDot={{ r: 8 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RiskChart;

