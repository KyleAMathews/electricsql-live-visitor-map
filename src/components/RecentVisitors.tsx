import React, { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';

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
    <div className="recent-visitors-panel" key={updateKey}>
      <h3>Recent Visitors</h3>
      <div className="visitors-list">
        {recentVisitors.map((visitor) => (
          <div key={visitor.id} className="visitor-item">
            <span>New visitor from {visitor.city || 'Unknown City'} </span>
            <span className="time-ago">
              {formatDistanceToNow(new Date(visitor.last_seen), { addSuffix: true })}
            </span>
          </div>
        ))}
        {recentVisitors.length === 0 && (
          <div className="no-visitors">No visitors in the last hour</div>
        )}
      </div>
      <style jsx>{`
        .recent-visitors-panel {
          position: absolute;
          top: 20px;
          right: 20px;
          padding: 16px;
          width: 300px;
          max-height: 400px;
          overflow-y: auto;
          z-index: 1000;
          color: #fff;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
        }

        @media (max-width: 768px) {
          .recent-visitors-panel {
            display: none;
          }
        }

        h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 500;
          letter-spacing: 0.5px;
          color: #fff;
          text-transform: uppercase;
        }

        .visitors-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .visitor-item {
          font-size: 14px;
          padding: 8px 12px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(5px);
          transition: all 0.3s ease;
        }

        .visitor-item:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
        }

        .time-ago {
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          display: block;
          margin-top: 4px;
        }

        .no-visitors {
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
          text-align: center;
          padding: 12px;
        }

        @keyframes glow {
          0% {
            box-shadow: 0 0 5px rgba(255, 255, 255, 0.1);
          }
          50% {
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
          }
          100% {
            box-shadow: 0 0 5px rgba(255, 255, 255, 0.1);
          }
        }

        .visitor-item:first-child {
          animation: glow 2s infinite;
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </div>
  );
};

export default RecentVisitors;
