import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { InteractiveModel } from '../components/InteractiveModel.jsx';

const ERROR_MODEL_PATH = '/models/err.glb';

export const ModelViewerPage = () => {
  const [loading, setLoading] = useState(true);
  const { modelName } = useParams();

  const model = {
    K7748C: { path: '/models/K7748C.glb', cameraPosition: [-1, 2, 4] },
    DGC7460HCPro: { path: '/models/DGC7460HCPro.glb', cameraPosition: [-0.5, 0.6, 1.5] },
    G5868SCVIXXL: { path: '/models/G5868SCVIXXL.glb', cameraPosition: [-1, 1, 2] },
  };

  const modelPath = model[modelName]?.path || ERROR_MODEL_PATH;
  const cameraPosition = model[modelName]?.cameraPosition || [0, 0.8, 4];

  return (
    <Layout loading={loading} cameraPosition={cameraPosition}>
      <InteractiveModel
        modelUrl={modelPath}
        onLoaded={() => setLoading(false)}
        scale={modelPath === ERROR_MODEL_PATH ? 6 : 1}
      />
    </Layout>
  );
};
