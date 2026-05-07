import React, { useState, useEffect } from 'react';
import { getChatMemorySyncService, SyncProgress, SyncResult } from '../../services/chat/sync/ChatMemorySyncService';

interface SessionSyncButtonProps {
  sessionId: string;
  onSyncComplete?: (result: SyncResult) => void;
  className?: string;
}

export const SessionSyncButton: React.FC<SessionSyncButtonProps> = ({ 
  sessionId, 
  onSyncComplete,
  className = ''
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [syncService] = useState(() => getChatMemorySyncService());

  useEffect(() => {
    // Subscribe to progress updates
    const unsubscribe = syncService.onProgressUpdate((progressData: SyncProgress) => {
      if (progressData.sessionId === sessionId) {
        setProgress(progressData.progress);
        setStage(progressData.stage);
        setIsSyncing(progressData.isSyncing);
        
        if (progressData.errors.length > 0) {
          setError(progressData.errors[progressData.errors.length - 1]);
        }
        
        // Auto-clear syncing state when progress reaches 100%
        if (progressData.progress === 100) {
          setTimeout(() => {
            setIsSyncing(false);
            setProgress(0);
            setStage('');
          }, 500);
        }
      }
    });

    // Check initial state
    const initialProgress = syncService.getSyncProgress(sessionId);
    if (initialProgress) {
      setProgress(initialProgress.progress);
      setStage(initialProgress.stage);
      setIsSyncing(initialProgress.isSyncing);
    }

    return unsubscribe;
  }, [sessionId, syncService]);

  const handleSync = async () => {
    if (isSyncing) {
      // If button shows syncing but service doesn't, force clear stuck state
      if (!syncService.isSessionSyncing(sessionId)) {
        console.log('Detected stuck button state, clearing...');
        setIsSyncing(false);
        setProgress(0);
        setStage('');
        setError(null);
      }
      return; // Prevent duplicate syncs
    }

    try {
      setError(null);
      setProgress(0);
      setStage('Starting sync...');
      setIsSyncing(true);
      
      // Add timeout to prevent getting stuck
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sync timeout after 30 seconds')), 30000);
      });
      
      const result = await Promise.race([
        syncService.syncSession(sessionId),
        timeoutPromise
      ]) as SyncResult;
      
      if (onSyncComplete) {
        onSyncComplete(result);
      }

      // Reset state after successful sync
      if (result.success) {
        setTimeout(() => {
          setIsSyncing(false);
          setProgress(0);
          setStage('');
        }, 1000);
      } else {
        // Reset state on failure
        setIsSyncing(false);
        setProgress(0);
        setStage('');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      
      // Special handling for "Sync already in progress" error
      if (errorMessage.includes('Sync already in progress')) {
        console.log('Sync already in progress, force clearing stuck state...');
        syncService.forceClearSyncState(sessionId);
        setError('Sync was stuck, cleared state. Please try again.');
      } else {
        setError(errorMessage);
      }
      
      setIsSyncing(false);
      setProgress(0);
      setStage('');
      console.error('Sync failed:', err);
    }
  };

  // Add a recovery button for stuck states
  const handleForceRecovery = () => {
    console.log('Force recovery triggered');
    syncService.forceClearSyncState(sessionId);
    setIsSyncing(false);
    setProgress(0);
    setStage('');
    setError(null);
  };

  return (
    <div className={`session-sync-button ${className}`}>
      <button
        onClick={handleSync}
        disabled={isSyncing}
        style={{
          padding: '8px 16px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: isSyncing ? '#f0f0f0' : '#007bff',
          color: isSyncing ? '#666' : 'white',
          cursor: isSyncing ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {isSyncing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
            <div 
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid #007bff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
            <span style={{ fontSize: '12px' }}>{stage}</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>({progress}%)</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Sync</span>
          </div>
        )}
      </button>

      {isSyncing && (
        <div style={{ marginTop: '8px' }}>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e0e0e0',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#007bff',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{
            fontSize: '10px',
            color: '#666',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>{stage}</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          color: '#721c24',
          fontSize: '12px'
        }}>
          {error}
          {error.includes('stuck') && (
            <button
              onClick={handleForceRecovery}
              style={{
                marginLeft: '8px',
                padding: '2px 6px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '2px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              Force Recovery
            </button>
          )}
        </div>
      )}

      {/* Show success message briefly */}
      {!isSyncing && progress === 100 && !error && (
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#28a745',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Sync completed successfully
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SessionSyncButton;
