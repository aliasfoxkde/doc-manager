import { useDocumentStore } from '../stores/documentStore';

export default function SyncStatus() {
  const { syncStatus } = useDocumentStore();

  if (!syncStatus.connected) return null;

  return (
    <div className="sync-status-bar">
      <span className="sync-indicator">● Synced</span>
      {syncStatus.lastSync && (
        <span className="sync-time">
          {new Date(syncStatus.lastSync).toLocaleTimeString()}
        </span>
      )}
      {syncStatus.pendingChanges > 0 && (
        <span className="sync-pending">
          {syncStatus.pendingChanges} pending changes
        </span>
      )}
    </div>
  );
}
