/**
 * PhotoUploadCrop Component
 * Photo upload with cropping interface for profile pictures
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import './PhotoUploadCrop.css';

export default function PhotoUploadCrop({
  currentImage = null,
  originalImage = null,
  onPhotoSelect,
  onPhotoCropped,
  onPhotoRemove,
  onCancel,
  isUploading = false,
  isModal = false,
  error = null,
  className = '',
  maxSize = 5 * 1024 * 1024, // 5MB
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  cropAspectRatio = 1, // 1:1 for profile pictures
  cropSize = { width: 400, height: 400 }
}) {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  
  const [previewImage, setPreviewImage] = useState(currentImage);
  const [cropData, setCropData] = useState({
    x: 0,
    y: 0,
    width: 200,
    height: 200
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });

  // Initialize crop area when image loads
  useEffect(() => {
    if (originalImage && imageLoaded) {
      const img = imageRef.current;
      if (!img) return;

      const imgRect = img.getBoundingClientRect();
      const aspectRatio = naturalDimensions.width / naturalDimensions.height;
      
      let cropWidth, cropHeight;
      if (aspectRatio > cropAspectRatio) {
        cropHeight = Math.min(imgRect.height * 0.8, imgRect.height);
        cropWidth = cropHeight * cropAspectRatio;
      } else {
        cropWidth = Math.min(imgRect.width * 0.8, imgRect.width);
        cropHeight = cropWidth / cropAspectRatio;
      }

      setCropData({
        x: (imgRect.width - cropWidth) / 2,
        y: (imgRect.height - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight
      });
    }
  }, [originalImage, imageLoaded, naturalDimensions, cropAspectRatio]);

  // Handle file selection
  const handleFileSelect = useCallback((files) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      const acceptedTypesStr = acceptedTypes.map(type => type.split('/')[1]).join(', ');
      alert(`Please select a valid image file (${acceptedTypesStr})`);
      return;
    }
    
    // Validate file size
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      alert(`File size must be less than ${maxSizeMB}MB`);
      return;
    }
    
    if (onPhotoSelect) {
      onPhotoSelect(file);
    }
  }, [acceptedTypes, maxSize, onPhotoSelect]);

  // Handle drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    handleFileSelect(files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handle file input change
  const handleInputChange = (e) => {
    handleFileSelect(e.target.files);
  };

  // Trigger file input
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle image load
  const handleImageLoad = (e) => {
    const img = e.target;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    setImageLoaded(true);
  };

  // Mouse/touch events for cropping
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    
    const rect = imageRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left - cropData.x,
      y: e.clientY - rect.top - cropData.y
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !imageRef.current) return;
    
    e.preventDefault();
    const rect = imageRef.current.getBoundingClientRect();
    
    let newX = e.clientX - rect.left - dragStart.x;
    let newY = e.clientY - rect.top - dragStart.y;
    
    // Constrain crop area within image bounds
    newX = Math.max(0, Math.min(newX, rect.width - cropData.width));
    newY = Math.max(0, Math.min(newY, rect.height - cropData.height));
    
    setCropData(prev => ({
      ...prev,
      x: newX,
      y: newY
    }));
  }, [isDragging, dragStart, cropData.width, cropData.height]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Set up mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle crop resize
  const handleResizeMouseDown = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...cropData };
    
    const handleResizeMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let newCrop = { ...startCrop };
      const imgRect = imageRef.current.getBoundingClientRect();
      
      if (direction === 'se') {
        // Maintain aspect ratio
        const newWidth = Math.min(
          imgRect.width - startCrop.x,
          Math.max(50, startCrop.width + deltaX)
        );
        const newHeight = newWidth / cropAspectRatio;
        
        if (startCrop.y + newHeight <= imgRect.height) {
          newCrop.width = newWidth;
          newCrop.height = newHeight;
        }
      }
      
      setCropData(newCrop);
    };
    
    const handleResizeUp = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeUp);
    };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeUp);
  };

  // Generate cropped image
  const getCroppedImage = useCallback(() => {
    if (!originalImage || !imageRef.current) return null;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    // Calculate scale factor between display image and natural image
    const scaleX = naturalDimensions.width / img.clientWidth;
    const scaleY = naturalDimensions.height / img.clientHeight;
    
    // Set canvas dimensions
    canvas.width = cropSize.width;
    canvas.height = cropSize.height;
    
    // Calculate source crop coordinates
    const sourceX = cropData.x * scaleX;
    const sourceY = cropData.y * scaleY;
    const sourceWidth = cropData.width * scaleX;
    const sourceHeight = cropData.height * scaleY;
    
    // Draw cropped image
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, cropSize.width, cropSize.height
    );
    
    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });
  }, [originalImage, cropData, naturalDimensions, cropSize]);

  // Handle crop confirmation
  const handleCropConfirm = async () => {
    const croppedBlob = await getCroppedImage();
    if (croppedBlob && onPhotoCropped) {
      const cropInfo = {
        x: cropData.x,
        y: cropData.y,
        width: cropData.width,
        height: cropData.height,
        naturalWidth: naturalDimensions.width,
        naturalHeight: naturalDimensions.height
      };
      onPhotoCropped(croppedBlob, cropInfo);
    }
  };

  // Create object URL for preview
  const getImageUrl = () => {
    if (originalImage) {
      return URL.createObjectURL(originalImage);
    }
    return currentImage;
  };

  // Render upload interface
  if (!originalImage && !currentImage) {
    return (
      <div className={`photo-upload-crop ${className}`}>
        <div 
          className="upload-area"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleInputChange}
            className="file-input"
            aria-label="Upload profile photo"
          />
          
          <div className="upload-content">
            <div className="upload-icon">📷</div>
            <h4>Upload Profile Photo</h4>
            <p>Drag and drop your photo here, or click to browse</p>
            <button
              type="button"
              className="upload-button"
              onClick={triggerFileInput}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Choose Photo'}
            </button>
            <div className="upload-requirements">
              <small>
                Accepted formats: JPG, PNG, WebP • Max size: {(maxSize / (1024 * 1024)).toFixed(1)}MB
              </small>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="upload-error">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Render crop interface
  if (originalImage && isModal) {
    return (
      <div className={`photo-crop-modal ${className}`}>
        <div className="crop-header">
          <h3>Crop Your Photo</h3>
          <p>Adjust the crop area to frame your photo perfectly</p>
        </div>
        
        <div className="crop-container">
          <div className="crop-image-container">
            <img
              ref={imageRef}
              src={getImageUrl()}
              alt="Profile to crop"
              className="crop-image"
              onLoad={handleImageLoad}
              draggable={false}
            />
            
            {imageLoaded && (
              <div
                className="crop-overlay"
                style={{
                  left: `${cropData.x}px`,
                  top: `${cropData.y}px`,
                  width: `${cropData.width}px`,
                  height: `${cropData.height}px`
                }}
                onMouseDown={handleMouseDown}
              >
                <div className="crop-frame"></div>
                <div
                  className="resize-handle se"
                  onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                ></div>
              </div>
            )}
          </div>
          
          <div className="crop-preview">
            <h4>Preview</h4>
            <div className="preview-container">
              <canvas
                ref={canvasRef}
                className="preview-canvas"
                width={cropSize.width}
                height={cropSize.height}
              />
            </div>
          </div>
        </div>
        
        <div className="crop-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="upload-button"
            onClick={triggerFileInput}
            disabled={isUploading}
          >
            Choose Different Photo
          </button>
          <button
            type="button"
            className="button primary"
            onClick={handleCropConfirm}
            disabled={isUploading || !imageLoaded}
          >
            {isUploading ? 'Processing...' : 'Use This Photo'}
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          className="file-input"
          aria-label="Choose different photo"
        />
      </div>
    );
  }

  // Render current photo with edit/remove options
  return (
    <div className={`photo-upload-crop current-photo ${className}`}>
      <div className="photo-display">
        <div className="photo-container">
          <img
            src={previewImage || getImageUrl()}
            alt="Profile"
            className="profile-photo"
          />
          {isUploading && (
            <div className="upload-overlay">
              <div className="spinner"></div>
              <span>Uploading...</span>
            </div>
          )}
        </div>
        
        <div className="photo-actions">
          <button
            type="button"
            className="action-button edit"
            onClick={triggerFileInput}
            disabled={isUploading}
            title="Change photo"
          >
            <span className="icon">✏️</span>
            Change
          </button>
          <button
            type="button"
            className="action-button remove"
            onClick={onPhotoRemove}
            disabled={isUploading}
            title="Remove photo"
          >
            <span className="icon">🗑️</span>
            Remove
          </button>
        </div>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleInputChange}
        className="file-input"
        aria-label="Change profile photo"
      />
      
      {error && (
        <div className="upload-error">
          {error}
        </div>
      )}
    </div>
  );
}