import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { InteractiveModel } from '../components/InteractiveModel.jsx';

const ERROR_MODEL_PATH = '/models/err.glb';

export const ModelViewerPage = () => {
  const [loading, setLoading] = useState(true);
  const { modelName } = useParams();

  const modelPaths = {
    K7748C: '/models/K7748C.glb',
    oven: '/models/oven.glb',
  };

  const modelPath = modelPaths[modelName] || ERROR_MODEL_PATH;

  return (
    <Layout loading={loading} cameraPosition={modelPath === ERROR_MODEL_PATH ? [0, 0.8, 4] : [5, 0.8, 4]}>
      <InteractiveModel
        modelUrl={modelPath}
        onLoaded={() => setLoading(false)}
        scale={modelPath === ERROR_MODEL_PATH ? 6 : 1}
      />
    </Layout>
  );
};
