export default function StatCard({ title, value, sub, icon: Icon, color = 'violet' }) {
  const colors = {
    violet: 'bg-violet-500/10 text-violet-400',
    green:  'bg-green-500/10  text-green-400',
    blue:   'bg-blue-500/10   text-blue-400',
    orange: 'bg-orange-500/10 text-orange-400',
    red:    'bg-red-500/10    text-red-400',
  };

  return (
    <div className="card flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
