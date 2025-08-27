/**
 * PersonalInfoStep Component
 * First step of onboarding - personal information and photo upload
 */

import React, { useState, useRef, useCallback } from 'react';
import { validatePersonalInfo } from '../../../utils/validation';
import { uploadProfileImage } from '../../../services/image-processing';
import PhotoUploadCrop from '../PhotoUploadCrop';
import './PersonalInfoStep.css';

export default function PersonalInfoStep({
  data = {},
  onUpdate,
  onComplete,
  onNext,
  onPrevious,
  isLoading = false,
  error = null,
  canSkip = false,
  onSkip = null
}) {
  const [formData, setFormData] = useState({
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    phone: data.phone || '',
    location: {
      city: data.location?.city || '',
      state: data.location?.state || '',
      country: data.location?.country || '',
      timezone: data.location?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    bio: data.bio || '',
    profileImage: data.profileImage || null,
    linkedInUrl: data.linkedInUrl || '',
    website: data.website || '',
    preferredName: data.preferredName || ''
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(data.profileImage?.url || null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [originalImage, setOriginalImage] = useState(null);

  // Update parent component when form data changes
  const updateFormData = useCallback((updates) => {
    const newFormData = { ...formData, ...updates };
    setFormData(newFormData);
    
    // Clear validation errors for updated fields
    const newErrors = { ...validationErrors };
    Object.keys(updates).forEach(key => {
      delete newErrors[key];
      if (key === 'location' && typeof updates[key] === 'object') {
        Object.keys(updates[key]).forEach(subKey => {
          delete newErrors[`location.${subKey}`];
        });
      }
    });
    setValidationErrors(newErrors);

    if (onUpdate) {
      onUpdate(newFormData);
    }
  }, [formData, validationErrors, onUpdate]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('location.')) {
      const locationField = name.split('.')[1];
      updateFormData({
        location: {
          ...formData.location,
          [locationField]: value
        }
      });
    } else {
      updateFormData({ [name]: value });
    }
  };

  // Handle photo upload
  const handlePhotoSelect = (file) => {
    setOriginalImage(file);
    setShowCropModal(true);
  };

  // Handle cropped photo
  const handlePhotoCropped = async (croppedBlob, cropInfo) => {
    try {
      setIsUploading(true);
      setShowCropModal(false);

      const uploadedImage = await uploadProfileImage(croppedBlob, {
        userId: data.userId,
        cropInfo,
        filename: originalImage.name
      });

      updateFormData({
        profileImage: {
          id: uploadedImage.id,
          url: uploadedImage.url,
          thumbnailUrl: uploadedImage.thumbnailUrl,
          cropInfo
        }
      });

      setImagePreview(uploadedImage.url);
    } catch (error) {
      console.error('Photo upload failed:', error);
      setValidationErrors({
        ...validationErrors,
        profileImage: 'Failed to upload photo. Please try again.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Remove photo
  const handlePhotoRemove = () => {
    updateFormData({ profileImage: null });
    setImagePreview(null);
  };

  // Validate form
  const validateForm = () => {
    const validation = validatePersonalInfo(formData);
    setValidationErrors(validation.errors);
    return validation.isValid;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = document.querySelector('.form-field.error input, .form-field.error textarea');
      if (firstErrorField) {
        firstErrorField.focus();
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (onComplete) {
      onComplete(formData);
    }
  };

  // Auto-save on blur
  const handleBlur = () => {
    if (onUpdate) {
      onUpdate(formData);
    }
  };

  return (
    <div className="personal-info-step">
      <form onSubmit={handleSubmit} className="personal-info-form">
        {/* Photo Upload Section */}
        <div className="photo-section">
          <h3>Profile Photo</h3>
          <p className="section-description">
            Add a professional photo to help clients recognize you. This will be visible on your public profile.
          </p>
          
          <PhotoUploadCrop
            currentImage={imagePreview}
            onPhotoSelect={handlePhotoSelect}
            onPhotoRemove={handlePhotoRemove}
            onPhotoCropped={handlePhotoCropped}
            isUploading={isUploading}
            error={validationErrors.profileImage}
            className="profile-photo-upload"
          />
        </div>

        {/* Basic Information */}
        <div className="form-section">
          <h3>Basic Information</h3>
          
          <div className="form-row">
            <div className={`form-field ${validationErrors.firstName ? 'error' : ''}`}>
              <label htmlFor="firstName">
                First Name <span className="required">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Enter your first name"
                disabled={isLoading}
                autoComplete="given-name"
                aria-describedby={validationErrors.firstName ? 'firstName-error' : undefined}
              />
              {validationErrors.firstName && (
                <span id="firstName-error" className="error-message">
                  {validationErrors.firstName}
                </span>
              )}
            </div>

            <div className={`form-field ${validationErrors.lastName ? 'error' : ''}`}>
              <label htmlFor="lastName">
                Last Name <span className="required">*</span>
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Enter your last name"
                disabled={isLoading}
                autoComplete="family-name"
                aria-describedby={validationErrors.lastName ? 'lastName-error' : undefined}
              />
              {validationErrors.lastName && (
                <span id="lastName-error" className="error-message">
                  {validationErrors.lastName}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className={`form-field ${validationErrors.preferredName ? 'error' : ''}`}>
              <label htmlFor="preferredName">
                Preferred Name <span className="optional">(Optional)</span>
              </label>
              <input
                id="preferredName"
                name="preferredName"
                type="text"
                value={formData.preferredName}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="What should clients call you?"
                disabled={isLoading}
                aria-describedby={validationErrors.preferredName ? 'preferredName-error' : undefined}
              />
              {validationErrors.preferredName && (
                <span id="preferredName-error" className="error-message">
                  {validationErrors.preferredName}
                </span>
              )}
            </div>

            <div className={`form-field ${validationErrors.email ? 'error' : ''}`}>
              <label htmlFor="email">
                Email Address <span className="required">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="your@email.com"
                disabled={isLoading}
                autoComplete="email"
                aria-describedby={validationErrors.email ? 'email-error' : undefined}
              />
              {validationErrors.email && (
                <span id="email-error" className="error-message">
                  {validationErrors.email}
                </span>
              )}
            </div>
          </div>

          <div className={`form-field ${validationErrors.phone ? 'error' : ''}`}>
            <label htmlFor="phone">
              Phone Number <span className="required">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="+1 (555) 123-4567"
              disabled={isLoading}
              autoComplete="tel"
              aria-describedby={validationErrors.phone ? 'phone-error' : undefined}
            />
            {validationErrors.phone && (
              <span id="phone-error" className="error-message">
                {validationErrors.phone}
              </span>
            )}
          </div>
        </div>

        {/* Location Information */}
        <div className="form-section">
          <h3>Location</h3>
          
          <div className="form-row">
            <div className={`form-field ${validationErrors['location.city'] ? 'error' : ''}`}>
              <label htmlFor="location.city">
                City <span className="required">*</span>
              </label>
              <input
                id="location.city"
                name="location.city"
                type="text"
                value={formData.location.city}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Your city"
                disabled={isLoading}
                autoComplete="address-level2"
                aria-describedby={validationErrors['location.city'] ? 'city-error' : undefined}
              />
              {validationErrors['location.city'] && (
                <span id="city-error" className="error-message">
                  {validationErrors['location.city']}
                </span>
              )}
            </div>

            <div className={`form-field ${validationErrors['location.state'] ? 'error' : ''}`}>
              <label htmlFor="location.state">
                State/Province <span className="required">*</span>
              </label>
              <input
                id="location.state"
                name="location.state"
                type="text"
                value={formData.location.state}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Your state or province"
                disabled={isLoading}
                autoComplete="address-level1"
                aria-describedby={validationErrors['location.state'] ? 'state-error' : undefined}
              />
              {validationErrors['location.state'] && (
                <span id="state-error" className="error-message">
                  {validationErrors['location.state']}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className={`form-field ${validationErrors['location.country'] ? 'error' : ''}`}>
              <label htmlFor="location.country">
                Country <span className="required">*</span>
              </label>
              <select
                id="location.country"
                name="location.country"
                value={formData.location.country}
                onChange={handleInputChange}
                onBlur={handleBlur}
                disabled={isLoading}
                autoComplete="country"
                aria-describedby={validationErrors['location.country'] ? 'country-error' : undefined}
              >
                <option value="">Select your country</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="UK">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="IT">Italy</option>
                <option value="ES">Spain</option>
                <option value="NL">Netherlands</option>
                <option value="SE">Sweden</option>
                <option value="NO">Norway</option>
                <option value="DK">Denmark</option>
                <option value="FI">Finland</option>
                <option value="CH">Switzerland</option>
                <option value="AT">Austria</option>
                <option value="BE">Belgium</option>
                <option value="IE">Ireland</option>
                <option value="NZ">New Zealand</option>
                <option value="JP">Japan</option>
                <option value="SG">Singapore</option>
              </select>
              {validationErrors['location.country'] && (
                <span id="country-error" className="error-message">
                  {validationErrors['location.country']}
                </span>
              )}
            </div>

            <div className={`form-field ${validationErrors['location.timezone'] ? 'error' : ''}`}>
              <label htmlFor="location.timezone">
                Timezone <span className="required">*</span>
              </label>
              <select
                id="location.timezone"
                name="location.timezone"
                value={formData.location.timezone}
                onChange={handleInputChange}
                onBlur={handleBlur}
                disabled={isLoading}
                aria-describedby={validationErrors['location.timezone'] ? 'timezone-error' : undefined}
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Anchorage">Alaska Time (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii Time (HST)</option>
                <option value="America/Toronto">Eastern Time - Canada</option>
                <option value="Europe/London">Greenwich Mean Time (GMT)</option>
                <option value="Europe/Berlin">Central European Time (CET)</option>
                <option value="Europe/Stockholm">Central European Time (CET)</option>
                <option value="Australia/Sydney">Australian Eastern Time (AET)</option>
                <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                <option value="Asia/Singapore">Singapore Standard Time (SST)</option>
              </select>
              {validationErrors['location.timezone'] && (
                <span id="timezone-error" className="error-message">
                  {validationErrors['location.timezone']}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="form-section">
          <h3>Professional Bio</h3>
          
          <div className={`form-field ${validationErrors.bio ? 'error' : ''}`}>
            <label htmlFor="bio">
              About You <span className="required">*</span>
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="Tell us about your professional background, expertise, and what makes you unique. This will be displayed on your public profile. (150-500 characters recommended)"
              disabled={isLoading}
              rows={4}
              maxLength={1000}
              aria-describedby={validationErrors.bio ? 'bio-error' : 'bio-help'}
            />
            <div id="bio-help" className="field-help">
              {formData.bio.length}/1000 characters
            </div>
            {validationErrors.bio && (
              <span id="bio-error" className="error-message">
                {validationErrors.bio}
              </span>
            )}
          </div>
        </div>

        {/* Professional Links */}
        <div className="form-section">
          <h3>Professional Links <span className="optional">(Optional)</span></h3>
          
          <div className={`form-field ${validationErrors.linkedInUrl ? 'error' : ''}`}>
            <label htmlFor="linkedInUrl">
              LinkedIn Profile
            </label>
            <input
              id="linkedInUrl"
              name="linkedInUrl"
              type="url"
              value={formData.linkedInUrl}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="https://linkedin.com/in/yourprofile"
              disabled={isLoading}
              aria-describedby={validationErrors.linkedInUrl ? 'linkedIn-error' : undefined}
            />
            {validationErrors.linkedInUrl && (
              <span id="linkedIn-error" className="error-message">
                {validationErrors.linkedInUrl}
              </span>
            )}
          </div>

          <div className={`form-field ${validationErrors.website ? 'error' : ''}`}>
            <label htmlFor="website">
              Personal Website
            </label>
            <input
              id="website"
              name="website"
              type="url"
              value={formData.website}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="https://yourwebsite.com"
              disabled={isLoading}
              aria-describedby={validationErrors.website ? 'website-error' : undefined}
            />
            {validationErrors.website && (
              <span id="website-error" className="error-message">
                {validationErrors.website}
              </span>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          {onPrevious && (
            <button
              type="button"
              className="button secondary"
              onClick={onPrevious}
              disabled={isLoading || isUploading}
            >
              Previous
            </button>
          )}
          
          {canSkip && onSkip && (
            <button
              type="button"
              className="button ghost"
              onClick={onSkip}
              disabled={isLoading || isUploading}
            >
              Skip for Now
            </button>
          )}
          
          <button
            type="submit"
            className="button primary"
            disabled={isLoading || isUploading}
          >
            {isLoading || isUploading ? 'Saving...' : 'Continue'}
          </button>
        </div>

        {/* Global Error */}
        {error && (
          <div className="form-error">
            {error}
          </div>
        )}
      </form>

      {/* Photo Crop Modal */}
      {showCropModal && originalImage && (
        <div className="crop-modal-overlay">
          <div className="crop-modal">
            <PhotoUploadCrop
              originalImage={originalImage}
              onPhotoCropped={handlePhotoCropped}
              onCancel={() => setShowCropModal(false)}
              isModal={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}