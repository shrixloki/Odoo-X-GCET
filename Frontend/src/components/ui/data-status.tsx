import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wifi, WifiOff, Clock, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface DataStatusProps {
  onRefresh?: () => void;
  showDetails?: boolean;
}

export function DataStatus({ onRefresh, showDetails = true }: DataStatusProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusColor = () => {
    if (!isOnline) return 'destructive';
    return 'default';
  };

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="h-3 w-3" />;
    return <Wifi className="h-3 w-3" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    return 'Online';
  };

  const handleRefresh = () => {
    setLastSync(new Date());
    onRefresh?.();
  };

  if (!showDetails) {
    return (
      <Badge variant={getStatusColor()} className="flex items-center gap-1">
        {getStatusIcon()}
        {getStatusText()}
      </Badge>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Badge variant={getStatusColor()} className="flex items-center gap-1">
            {getStatusIcon()}
            {getStatusText()}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Connection Status</h4>
            {onRefresh && (
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                Connection
              </span>
              <Badge variant={isOnline ? 'default' : 'destructive'}>
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            
            {lastSync && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Last Sync
                </span>
                <span className="text-muted-foreground">
                  {lastSync.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {!isOnline && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-xs text-muted-foreground">
                You're currently offline. Some features may be limited.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
