import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Home, Settings } from 'lucide-react';
import { auditLogsService, AuditLog } from '../lib/database';
import { useApp } from '../context/AppContext';
import { AppLayout } from './AppLayout';

import { useSubscriptionGuard } from '../hooks/useSubscriptionGuard';

export const AuditLogPage = () => {
  useSubscriptionGuard();
  const { setCurrentPage: navigateTo } = useApp();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterIngredient, setFilterIngredient] = useState('');
  const [filterOperation, setFilterOperation] = useState('Operation');
  const [filterUser, setFilterUser] = useState('');
  const [currentLogPage] = useState(2);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const data = await auditLogsService.getAll();
      setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const filteredLogs = logs.filter(log => {
    const ingredientName = log.table_name === 'ingredients' 
      ? (log.new_values?.name || log.old_values?.name || '')
      : '';
    const matchesIngredient = !filterIngredient || ingredientName.toLowerCase().includes(filterIngredient.toLowerCase());
    const matchesOperation = filterOperation === 'Operation' || log.operation === filterOperation;
    const matchesUser = !filterUser || log.user_name.toLowerCase().includes(filterUser.toLowerCase());
    return matchesIngredient && matchesOperation && matchesUser;
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-2xl sm:rounded-3xl shadow-lg border border-border p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-1">Audit Logs</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Track all changes and activities</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <input
              type="text"
              placeholder="Ingredient"
              value={filterIngredient}
              onChange={(e) => setFilterIngredient(e.target.value)}
              className="px-6 py-3 border-2 border-blue-300 rounded-2xl focus:outline-none focus:border-blue-400 transition-colors"
            />

            <select
              value={filterOperation}
              onChange={(e) => setFilterOperation(e.target.value)}
              className="px-6 py-3 border-2 border-cyan-400 bg-cyan-50 text-gray-700 rounded-2xl focus:outline-none appearance-none cursor-pointer font-medium"
            >
              <option>Operation</option>
              <option>Added</option>
              <option>Removed</option>
              <option>Adjusted</option>
            </select>

            <input
              type="text"
              placeholder="User"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="px-6 py-3 border-2 border-blue-300 rounded-2xl focus:outline-none focus:border-blue-400 transition-colors"
            />

            <div className="flex items-center gap-3 px-6 py-3 border-2 border-cyan-400 bg-cyan-50 rounded-2xl">
              <Calendar size={20} className="text-gray-600" />
              <span className="text-gray-700 font-medium">Tiamestopp</span>
              <Calendar size={20} className="text-gray-600" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 rounded-t-2xl p-4"></div>

          <div className="bg-gray-50 rounded-b-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-white border-b-2 border-gray-100">
                  <th className="text-left px-6 py-4 font-bold text-gray-900">Ingredient</th>
                  <th className="text-left px-6 py-4 font-bold text-gray-900">Operation</th>
                  <th className="text-left px-6 py-4 font-bold text-gray-900">Amount</th>
                  <th className="text-left px-6 py-4 font-bold text-gray-900">User</th>
                  <th className="text-left px-6 py-4 font-bold text-gray-900">Tiamespho</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const ingredientName = log.table_name === 'ingredients'
                    ? (log.new_values?.name || log.old_values?.name || 'Unknown')
                    : 'N/A';
                  const oldQty = log.old_values?.quantity || 0;
                  const newQty = log.new_values?.quantity || 0;
                  const amount = Math.abs(newQty - oldQty);
                  
                  return (
                    <tr key={log.id} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">{ingredientName}</td>
                      <td className="px-6 py-4 text-gray-700">{log.operation}</td>
                      <td className="px-6 py-4 text-gray-700">
                        {log.table_name === 'ingredients' ? `${amount} units` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{log.user_name}</td>
                      <td className="px-6 py-4 text-gray-700">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex items-center justify-center gap-4 py-6 bg-white">
              <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ChevronLeft size={20} />
                <span className="font-medium">Prev</span>
              </button>
              <button className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-semibold">
                {currentLogPage}
              </button>
              <button className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-600 font-semibold transition-colors">
                3
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
                <span className="font-medium">Next</span>
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
