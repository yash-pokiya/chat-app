import { motion } from 'framer-motion';

export default function StatsCard({ icon, label, value, sub, gradient = 'from-brand-500 to-cyan-400' }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="stat-card"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl shadow-sm`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-ink mb-0.5">{value ?? '—'}</div>
      <div className="text-sm font-medium text-ink-muted">{label}</div>
      {sub && <div className="text-xs text-ink-faint mt-1">{sub}</div>}
    </motion.div>
  );
}
