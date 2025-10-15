import { OrbitControls, Environment, MeshReflectorMaterial } from '@react-three/drei';
import { InteractiveModel } from './InteractiveModel.jsx';
import { MOUSE } from 'three';
const Scene = ({ modelUrl, onModelLoaded }) => {
  return (
    <>
      <ambientLight intensity={1} />
      <directionalLight position={[1, 0, 0]} />
      <pointLight position={[0, 2.5, 0]} intensity={20} color="white" />
      <OrbitControls
        mouseButtons={{
          LEFT: MOUSE.RIGHT,
          RIGHT: MOUSE.LEFT,
        }}
      />
      <Environment preset="city" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={2048}
          mixBlur={1}
          mixStrength={80}
          roughness={1}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#050505"
          metalness={0.5}
        />
      </mesh>

      {modelUrl && <InteractiveModel url={modelUrl} onLoaded={onModelLoaded} />}
    </>
  );
};

export default Scene;
