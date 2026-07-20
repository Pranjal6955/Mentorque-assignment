import { useAuth } from "../context/AuthContext";

export default function AdminSettings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-semibold text-white">Admin Settings</h1>

      <div className="bg-navy-900 border border-navy-700 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-medium text-white">Account Information</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1 border-b border-navy-800">
            <span className="text-slate-400">Name</span>
            <span className="text-white font-medium">{user?.name || "—"}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-navy-800">
            <span className="text-slate-400">Email</span>
            <span className="text-white font-medium">{user?.email || "—"}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-navy-800">
            <span className="text-slate-400">Role</span>
            <span className="text-primary-400 font-medium">{user?.role || "ADMIN"}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Timezone</span>
            <span className="text-white font-medium">{user?.timezone || "UTC"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
