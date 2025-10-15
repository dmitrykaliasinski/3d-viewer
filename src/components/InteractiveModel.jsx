import { Suspense, useEffect, useRef, useState } from 'react';
import { useCursor, useGLTF, Loader } from '@react-three/drei';
import { AnimationMixer, LoopOnce } from 'three';
import { useFrame } from '@react-three/fiber';

export const InteractiveModel = ({ modelUrl, onLoaded, position = [0, 0, 0], scale = 1 }) => {
  const { scene, animations } = useGLTF(modelUrl);
  const [activeActions, setActiveActions] = useState({});
  const [hovered, setHover] = useState(false);
  const mixerRef = useRef(null);
  const actionsRef = useRef({});

  useEffect(() => {
    if (!scene || !animations) return;

    scene.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.depthWrite = true;
      }
    });

    if (animations.length > 0) {
      mixerRef.current = new AnimationMixer(scene);
      animations.forEach(clip => {
        const clipName = clip.name.replace(/\./g, '');
        actionsRef.current[clipName] = mixerRef.current.clipAction(clip);
      });
    }

    onLoaded?.();

    return () => {
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
      setActiveActions({});
    };
  }, [scene, animations, onLoaded]);

  useCursor(hovered);
  useFrame((_, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
  });

  const clickableElementHover = e => {
    e.stopPropagation();

    const hoveredObject = e.object;
    const name = hoveredObject.name;

    const hasAction = Object.keys(actionsRef.current).find(clip => clip.toLowerCase() === name.toLowerCase());

    hasAction ? setHover(true) : setHover(false);
  };

  const handlePointerDown = e => {
    e.stopPropagation();
    const clickedObject = e.object;
    const name = clickedObject.name;
    console.log(name);
    const clipName = Object.keys(actionsRef.current).find(clip => clip.toLowerCase() === name.toLowerCase());
    if (!clipName) return;

    const action = actionsRef.current[clipName];

    const isActive = activeActions[clipName];

    if (isActive) {
      action.time = 1;
      action.paused = false;
      action.timeScale = -1;
      action.play();
    } else {
      action.reset();
      action.timeScale = 1;
      action.clampWhenFinished = true;
      action.loop = LoopOnce;
      action.play();
    }

    setActiveActions(prev => ({
      ...prev,
      [clipName]: !isActive,
    }));
  };

  return (
    <primitive
      key={modelUrl}
      object={scene}
      position={position}
      scale={scale}
      onPointerDown={handlePointerDown}
      onPointerOver={clickableElementHover}
      onPointerOut={() => setHover(false)}
    />
  );
};
