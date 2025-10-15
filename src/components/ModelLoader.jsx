import React, { useRef } from 'react';

const ModelLoader = ({ onModelLoad, onLoadingChange }) => {
  const fileInputRef = useRef();

  const handleFileUpload = event => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      alert('Please load format: .glb or .gltf');
      return;
    }

    onLoadingChange(true);
    const objectUrl = URL.createObjectURL(file);
    onModelLoad(objectUrl);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="model-loader">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".glb,.gltf"
        style={{ display: 'none' }}
      />
      <button onClick={handleButtonClick} className="upload-button">
        📁 Load 3D Model
      </button>
      <p className="file-hint">Can be uploaded formats: .glb, .gltf</p>
    </div>
  );
};

export default ModelLoader;
