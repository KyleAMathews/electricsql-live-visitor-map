import React, { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import styles from './RecentVisitors.module.css';

interface Visitor {
  id: string;
  visitor_id: string;
  latitude: string | number;
  longitude: string | number;
  country: string;
  city: string;
  visit_count: number;
  last_seen: string;
}

interface RecentVisitorsProps {
  visitors: Visitor[];
}

const RecentVisitors: React.FC<RecentVisitorsProps> = ({ visitors }) => {
  const [updateKey, setUpdateKey] = useState(0);

  // Update timestamps every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateKey(key => key + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []); // Empty dependency array since we don't use any external values

  // Filter visitors from the last hour and sort by most recent
  const recentVisitors = visitors
    .filter(visitor => {
      const visitTime = new Date(visitor.last_seen).getTime();
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      return visitTime > oneHourAgo;
    })
    .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());

  return (
    <div className={styles['recent-visitors-panel']} key={updateKey}>
      <h3>Recent Visitors</h3>
      <div className={styles['visitors-list']}>
        {recentVisitors.map((visitor) => (
          <div key={visitor.id} className={styles['visitor-item']}>
            <span>New visitor from {visitor.city || 'Unknown City'} </span>
            <span className={styles['time-ago']}>
              {formatDistanceToNow(new Date(visitor.last_seen), { addSuffix: true })}
            </span>
          </div>
        ))}
        {recentVisitors.length === 0 && (
          <div className={styles['no-visitors']}>No visitors in the last hour</div>
        )}
      </div>
    </div>
  );
};

export default RecentVisitors;
