import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { InteractiveModel } from '../components/InteractiveModel.jsx';
import ModelLoader from '../components/ModelLoader.jsx';
import Loader from '../components/Loader.jsx';

export const Home = () => {
  const [modelUrl, setModelUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const controlsContent = <ModelLoader onModelLoad={setModelUrl} onLoadingChange={setLoading} />;

  return (
    <Layout controls={controlsContent} loading={loading}>
      {modelUrl && <InteractiveModel modelUrl={modelUrl} onLoaded={() => setLoading(false)} />}
    </Layout>
  );
};
