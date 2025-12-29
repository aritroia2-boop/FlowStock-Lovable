import { useState, useEffect } from 'react';
import { X, Check, XCircle, Users, Clock, CheckCircle2 } from 'lucide-react';
import { notificationsService, Notification } from '../lib/database';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationUpdate: () => void;
}

export const NotificationsModal = ({ isOpen, onClose, onNotificationUpdate }: NotificationsModalProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await notificationsService.getMyNotifications();
      const filteredData = data.filter(n => n.type !== 'team_invite');
      setNotifications(filteredData);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvite = async (notification: Notification) => {
    if (!notification.team_id) return;

    setProcessingId(notification.id);
    try {
      await notificationsService.acceptTeamInvite(notification.id, notification.team_id);
      await loadNotifications();
      onNotificationUpdate();
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      alert(error.message || 'Failed to accept invite');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineInvite = async (notification: Notification) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;

    setProcessingId(notification.id);
    try {
      await notificationsService.declineTeamInvite(notification.id);
      await loadNotifications();
      onNotificationUpdate();
    } catch (error: any) {
      console.error('Error declining invite:', error);
      alert(error.message || 'Failed to decline invite');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsService.markAsRead(notificationId);
      await loadNotifications();
      onNotificationUpdate();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsService.markAllAsRead();
      await loadNotifications();
      onNotificationUpdate();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'team_invite':
        return <Users size={20} className="text-blue-500" />;
      default:
        return <Clock size={20} className="text-muted-foreground" />;
    }
  };

  const pendingNotifications = notifications.filter(n => n.status === 'pending');
  const otherNotifications = notifications.filter(n => n.status !== 'pending');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-20 px-4">
      <div className="bg-card rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingNotifications.length} pending invitation{pendingNotifications.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {notifications.some(n => !n.read_at) && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-xl transition-colors"
            >
              <X size={24} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
                <CheckCircle2 size={32} className="text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium">No notifications</p>
              <p className="text-sm text-muted-foreground mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingNotifications.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pending</h3>
                  {pendingNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-4 border-2 border-blue-200 dark:border-blue-800 ${
                        !notification.read_at ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-foreground">{notification.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                              {notification.metadata && (
                                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="bg-background/80 px-2 py-1 rounded-lg">
                                    Role: {notification.metadata.role}
                                  </span>
                                  <span className="text-muted-foreground">{formatTime(notification.created_at)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => handleAcceptInvite(notification)}
                              disabled={processingId === notification.id}
                              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Check size={16} />
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeclineInvite(notification)}
                              disabled={processingId === notification.id}
                              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <XCircle size={16} />
                              Decline
                            </button>
                            {!notification.read_at && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {otherNotifications.length > 0 && (
                <>
                  {pendingNotifications.length > 0 && (
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6">Recent</h3>
                  )}
                  {otherNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`bg-card border rounded-2xl p-4 ${
                        notification.status === 'accepted'
                          ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20'
                          : notification.status === 'declined'
                          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
                          : 'border-border'
                      } ${!notification.read_at ? 'ring-2 ring-blue-200 dark:ring-blue-800' : 'opacity-75'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {notification.status === 'accepted' ? (
                            <CheckCircle2 size={20} className="text-green-500" />
                          ) : notification.status === 'declined' ? (
                            <XCircle size={20} className="text-red-500" />
                          ) : (
                            getNotificationIcon(notification.type)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground">{notification.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                              notification.status === 'accepted'
                                ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                                : notification.status === 'declined'
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                                : 'bg-muted text-foreground'
                            }`}>
                              {notification.status.charAt(0).toUpperCase() + notification.status.slice(1)}
                            </span>
                            <span className="text-xs text-muted-foreground">{formatTime(notification.created_at)}</span>
                            {!notification.read_at && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="ml-auto text-xs text-primary hover:text-primary/80 transition-colors"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};