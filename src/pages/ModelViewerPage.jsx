import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { InteractiveModel } from '../components/InteractiveModel.jsx';

const MODEL_CONFIGS = {
  K7748C: { path: '/models/K7748C.glb', cameraPosition: [-1, 2, 4] },
  DGC7460HCPro: { path: '/models/DGC7460HCPro.glb', cameraPosition: [-0.5, 0.6, 1.5] },
  G5868SCVIXXL: { path: '/models/G5868SCVIXXL.glb', cameraPosition: [-1, 1, 2] },
  '5B70N9690ME': { path: '/models/5B70N9690ME.glb', cameraPosition: [-0.5, 0.6, 1.5] },
  '5C70S9690ME': { path: '/models/5C70S9690ME.glb', cameraPosition: [-0.5, 0.6, 1.5] },
};

const FALLBACK_CONFIG = {
  path: '/models/err.glb',
  cameraPosition: [0, 0.8, 4],
  scale: 6,
};

const ModelViewer = ({ config }) => {
  const [loading, setLoading] = useState(true);
  const handleLoaded = useCallback(() => setLoading(false), []);

  return (
    <Layout loading={loading} cameraPosition={config.cameraPosition}>
      <InteractiveModel modelUrl={config.path} onLoaded={handleLoaded} scale={config.scale ?? 1} />
    </Layout>
  );
};

export const ModelViewerPage = () => {
  const { modelName } = useParams();
  const config = Object.hasOwn(MODEL_CONFIGS, modelName) ? MODEL_CONFIGS[modelName] : FALLBACK_CONFIG;

  return <ModelViewer key={modelName} config={config} />;
};
