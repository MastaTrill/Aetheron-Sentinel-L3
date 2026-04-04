import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string;
  trend?: number;
  onClick?: () => void;
}

const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  trend,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="bg-gray-700/50 px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
    >
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-white">{value}</span>
        {trend !== undefined && trend !== 0 && (
          <div
            className={`flex items-center text-xs ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}
          >
            {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
