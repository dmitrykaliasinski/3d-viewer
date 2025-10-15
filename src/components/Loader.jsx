import React from 'react';

const Loader = () => {
  return (
    <div className="loader-overlay">
      <div className="loader">
        <div className="spinner"></div>
        <p>Loading model...</p>
      </div>
    </div>
  );
};

export default Loader;
