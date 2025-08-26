/**
 * Social Sharing Component
 * Social media sharing buttons and profile sharing functionality
 */

import React, { useState } from 'react';
import './SocialSharing.css';

const SocialSharing = ({ profile, socialData }) => {
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Get current profile URL
  const profileUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/profile/${profile.profileSlug}`
    : `/profile/${profile.profileSlug}`;

  const shareText = socialData?.openGraph?.description || 
    `Check out ${profile.displayName}'s professional profile on LegacyLancers`;

  // Social sharing handlers
  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  const shareToLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=600,height=400');
  };

  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`;
    window.open(facebookUrl, '_blank', 'width=600,height=400');
  };

  const shareViaEmail = () => {
    const subject = `Professional Profile: ${profile.displayName}`;
    const body = `I thought you might be interested in this professional profile:\n\n${shareText}\n\n${profileUrl}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = profileUrl;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy link');
      }
      document.body.removeChild(textArea);
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: socialData?.openGraph?.title || `${profile.displayName} - Professional Profile`,
          text: shareText,
          url: profileUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    }
  };

  const generateQRCode = () => {
    // In production, you might use a proper QR code library
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(profileUrl)}`;
    return qrUrl;
  };

  return (
    <div className="social-sharing">
      <div className="section-header">
        <h3>Share Profile</h3>
        <button 
          className="share-toggle"
          onClick={() => setShowShareMenu(!showShareMenu)}
          aria-label="Toggle share menu"
        >
          <span className="share-icon">📤</span>
        </button>
      </div>

      <div className={`share-menu ${showShareMenu ? 'open' : ''}`}>
        {/* Quick Share Buttons */}
        <div className="quick-share">
          <button 
            className="share-btn twitter"
            onClick={shareToTwitter}
            title="Share on Twitter"
          >
            <span className="btn-icon">🐦</span>
            <span className="btn-text">Twitter</span>
          </button>

          <button 
            className="share-btn linkedin"
            onClick={shareToLinkedIn}
            title="Share on LinkedIn"
          >
            <span className="btn-icon">💼</span>
            <span className="btn-text">LinkedIn</span>
          </button>

          <button 
            className="share-btn facebook"
            onClick={shareToFacebook}
            title="Share on Facebook"
          >
            <span className="btn-icon">📘</span>
            <span className="btn-text">Facebook</span>
          </button>

          <button 
            className="share-btn email"
            onClick={shareViaEmail}
            title="Share via Email"
          >
            <span className="btn-icon">📧</span>
            <span className="btn-text">Email</span>
          </button>
        </div>

        {/* Native Share (Mobile) */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <button 
            className="share-btn native"
            onClick={shareNative}
          >
            <span className="btn-icon">📱</span>
            <span className="btn-text">Share</span>
          </button>
        )}

        {/* Copy Link */}
        <div className="copy-link">
          <div className="link-input">
            <input 
              type="text" 
              value={profileUrl} 
              readOnly 
              className="profile-url"
            />
            <button 
              className={`copy-btn ${copied ? 'copied' : ''}`}
              onClick={copyProfileLink}
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>
          {copied && (
            <div className="copy-feedback">
              Link copied to clipboard!
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="qr-code-section">
          <h4>QR Code</h4>
          <div className="qr-code">
            <img 
              src={generateQRCode()} 
              alt="QR Code for profile"
              loading="lazy"
            />
          </div>
          <p className="qr-description">
            Scan to view profile on mobile
          </p>
        </div>

        {/* Social Media Preview */}
        {socialData && (
          <div className="share-preview">
            <h4>Share Preview</h4>
            <div className="preview-card">
              <div className="preview-header">
                <div className="preview-icon">🔗</div>
                <div className="preview-domain">legacylancers.com</div>
              </div>
              <div className="preview-content">
                <h5>{socialData.openGraph?.title}</h5>
                <p>{socialData.openGraph?.description}</p>
                {socialData.openGraph?.image && (
                  <div className="preview-image">
                    <img src={socialData.openGraph.image} alt="Profile preview" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share Stats (if available) */}
      {profile.shareCount && profile.shareCount > 0 && (
        <div className="share-stats">
          <div className="stat-item">
            <span className="stat-icon">📊</span>
            <span className="stat-text">
              Shared {profile.shareCount} times
            </span>
          </div>
        </div>
      )}

      {/* Professional Network */}
      <div className="professional-network">
        <h4>Connect Professionally</h4>
        <div className="network-links">
          {profile.linkedinUrl && (
            <a 
              href={profile.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="network-link linkedin"
            >
              <span className="link-icon">💼</span>
              <div className="link-content">
                <span className="link-name">LinkedIn</span>
                <span className="link-description">Professional network</span>
              </div>
            </a>
          )}

          {profile.portfolioUrl && (
            <a 
              href={profile.portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="network-link portfolio"
            >
              <span className="link-icon">🎯</span>
              <div className="link-content">
                <span className="link-name">Portfolio</span>
                <span className="link-description">View work samples</span>
              </div>
            </a>
          )}

          <button 
            className="network-link contact"
            onClick={() => window.location.href = `/profile/${profile.profileSlug}/contact`}
          >
            <span className="link-icon">✉️</span>
            <div className="link-content">
              <span className="link-name">Contact</span>
              <span className="link-description">Send direct message</span>
            </div>
          </button>
        </div>
      </div>

      {/* Share Encourage */}
      <div className="share-encourage">
        <div className="encourage-content">
          <h4>Found this helpful?</h4>
          <p>Share this profile with your network to help connect great talent with opportunities.</p>
          <div className="encourage-icons">
            <span>🤝</span>
            <span>💼</span>
            <span>🚀</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialSharing;