/**
 * Verification Badge Component
 * Displays verification status badges for different verification types
 */

import React from 'react';
import './VerificationBadge.css';

export const VerificationBadge = ({ 
  type, 
  status, 
  size = 'medium', 
  showLabel = true, 
  tooltipText = null,
  onClick = null 
}) => {
  const getBadgeConfig = (type, status) => {
    const configs = {
      linkedin: {
        icon: (
          <svg viewBox="0 0 24 24" className="badge-icon">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        ),
        color: '#0077B5',
        label: 'LinkedIn'
      },
      manual: {
        icon: <span className="badge-icon">👤</span>,
        color: '#6c757d',
        label: 'Manual'
      },
      admin: {
        icon: <span className="badge-icon">👨‍💼</span>,
        color: '#28a745',
        label: 'Admin Verified'
      },
      email: {
        icon: <span className="badge-icon">📧</span>,
        color: '#17a2b8',
        label: 'Email'
      },
      phone: {
        icon: <span className="badge-icon">📱</span>,
        color: '#ffc107',
        label: 'Phone'
      },
      id_document: {
        icon: <span className="badge-icon">🆔</span>,
        color: '#dc3545',
        label: 'ID Document'
      }
    };

    return configs[type] || {
      icon: <span className="badge-icon">❓</span>,
      color: '#6c757d',
      label: 'Unknown'
    };
  };

  const getStatusConfig = (status) => {
    const configs = {
      verified: {
        className: 'verified',
        icon: '✓',
        label: 'Verified'
      },
      pending: {
        className: 'pending',
        icon: '⏳',
        label: 'Pending'
      },
      failed: {
        className: 'failed',
        icon: '✗',
        label: 'Failed'
      },
      expired: {
        className: 'expired',
        icon: '⏰',
        label: 'Expired'
      },
      unverified: {
        className: 'unverified',
        icon: '○',
        label: 'Unverified'
      }
    };

    return configs[status] || {
      className: 'unknown',
      icon: '?',
      label: 'Unknown'
    };
  };

  const badgeConfig = getBadgeConfig(type, status);
  const statusConfig = getStatusConfig(status);

  const badgeClassName = [
    'verification-badge',
    `size-${size}`,
    `type-${type}`,
    `status-${statusConfig.className}`,
    onClick ? 'clickable' : '',
    showLabel ? 'with-label' : 'no-label'
  ].filter(Boolean).join(' ');

  const badgeContent = (
    <div className={badgeClassName} onClick={onClick}>
      <div className="badge-content">
        <div className="badge-type-icon" style={{ color: badgeConfig.color }}>
          {badgeConfig.icon}
        </div>
        <div className="badge-status-icon">
          {statusConfig.icon}
        </div>
        {showLabel && (
          <div className="badge-labels">
            <span className="badge-type-label">{badgeConfig.label}</span>
            <span className="badge-status-label">{statusConfig.label}</span>
          </div>
        )}
      </div>
      {tooltipText && <div className="badge-tooltip">{tooltipText}</div>}
    </div>
  );

  return badgeContent;
};

/**
 * Verification Badges List Component
 * Shows multiple verification badges for a user
 */
export const VerificationBadgesList = ({ 
  verifications = [], 
  size = 'small', 
  maxVisible = 3,
  showAll = false 
}) => {
  const [expanded, setExpanded] = useState(showAll);
  
  const visibleVerifications = expanded ? verifications : verifications.slice(0, maxVisible);
  const hiddenCount = verifications.length - maxVisible;

  return (
    <div className="verification-badges-list">
      <div className="badges-container">
        {visibleVerifications.map((verification, index) => (
          <VerificationBadge
            key={`${verification.type}-${index}`}
            type={verification.type}
            status={verification.status}
            size={size}
            showLabel={false}
            tooltipText={`${verification.type} verification: ${verification.status}`}
          />
        ))}
        
        {!expanded && hiddenCount > 0 && (
          <button 
            className="badges-expand-button"
            onClick={() => setExpanded(true)}
          >
            +{hiddenCount}
          </button>
        )}
      </div>
      
      {expanded && verifications.length > maxVisible && (
        <button 
          className="badges-collapse-button"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      )}
    </div>
  );
};

/**
 * Profile Verification Summary Component
 * Shows overall verification status
 */
export const ProfileVerificationSummary = ({ 
  verifications = [], 
  completionPercentage = 0 
}) => {
  const verifiedCount = verifications.filter(v => v.status === 'verified').length;
  const totalCount = verifications.length;
  
  const getOverallStatus = () => {
    if (verifiedCount === 0) return 'unverified';
    if (verifiedCount === totalCount) return 'fully_verified';
    return 'partially_verified';
  };

  const overallStatus = getOverallStatus();

  return (
    <div className={`profile-verification-summary status-${overallStatus}`}>
      <div className="summary-header">
        <div className="summary-icon">
          {overallStatus === 'fully_verified' && <span className="status-icon verified">✅</span>}
          {overallStatus === 'partially_verified' && <span className="status-icon partial">⚡</span>}
          {overallStatus === 'unverified' && <span className="status-icon unverified">⭕</span>}
        </div>
        <div className="summary-text">
          <div className="summary-title">
            {overallStatus === 'fully_verified' && 'Fully Verified Profile'}
            {overallStatus === 'partially_verified' && 'Partially Verified Profile'}
            {overallStatus === 'unverified' && 'Unverified Profile'}
          </div>
          <div className="summary-subtitle">
            {verifiedCount} of {totalCount} verifications complete
          </div>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="verification-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
          <div className="progress-text">{Math.round(completionPercentage)}% complete</div>
        </div>
      )}

      <VerificationBadgesList 
        verifications={verifications} 
        size="medium" 
        maxVisible={4} 
      />

      {overallStatus !== 'fully_verified' && (
        <div className="verification-cta">
          <p>Complete your profile verification to build trust with clients.</p>
          <button className="btn btn-primary btn-sm">
            Continue Verification
          </button>
        </div>
      )}
    </div>
  );
};