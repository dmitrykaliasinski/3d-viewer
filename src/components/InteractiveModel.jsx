import { useEffect, useRef, useState } from 'react';
import { useCursor, useGLTF } from '@react-three/drei';
import { AnimationMixer, Box3, LoopOnce, Vector3 } from 'three';
import { createPortal, useFrame } from '@react-three/fiber';

const normalizeName = name => name.replace(/\./g, '').toLowerCase();

const getTrackTargetName = trackName => trackName.split('.')[0];

const stripUniqueSuffix = name => name.replace(/_\d+$/, '');

const namesReferToClip = (objectName, clipName) => {
  const object = normalizeName(objectName);
  const clip = normalizeName(clipName);
  if (!object || !clip) return false;
  if (object === clip) return true;

  const objectBase = normalizeName(stripUniqueSuffix(objectName));
  if (objectBase === clip) return true;
  if (clip.startsWith(`${object}_`) || clip.startsWith(`${objectBase}_`)) return true;

  return false;
};

const objectNames = object => [object.name, object.userData?.name].filter(Boolean);

const chainNames = object => {
  const names = [];
  for (let current = object; current; current = current.parent) {
    names.push(...objectNames(current));
  }
  return names;
};

const normalizedBaseName = name => normalizeName(stripUniqueSuffix(name));

const isDisplayObject = object =>
  chainNames(object).some(name => {
    const base = normalizedBaseName(name);
    return base === 'display' || base.startsWith('display');
  });

const isLightObjectName = name => {
  const base = normalizedBaseName(name);
  return base === 'light_on_off' || base.startsWith('light_on_off');
};

export const InteractiveModel = ({ modelUrl, onLoaded, position = [0, 0, 0], scale = 1 }) => {
  const { scene, animations } = useGLTF(modelUrl);
  const [activeActions, setActiveActions] = useState({});
  const [hovered, setHover] = useState(false);
  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  const objectClipMapRef = useRef(new Map());
  const clipMetaRef = useRef([]);
  const lampOnRef = useRef(false);
  const lampMaterialsRef = useRef([]);
  const [lampOn, setLampOn] = useState(false);
  const [lampMount, setLampMount] = useState(null);

  useEffect(() => {
    if (!scene || !animations) return;

    scene.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.depthWrite = true;
      }
    });

    objectClipMapRef.current = new Map();
    actionsRef.current = {};
    clipMetaRef.current = [];
    lampMaterialsRef.current = [];
    lampOnRef.current = false;
    setLampOn(false);
    setLampMount(null);

    let lightRoot = null;

    scene.traverse(child => {
      if (!objectNames(child).some(isLightObjectName)) return;
      if (!lightRoot) lightRoot = child;

      if (!child.isMesh || !child.material) return;

      if (!child.userData.lampMaterialCloned) {
        child.material = Array.isArray(child.material)
          ? child.material.map(material => material.clone())
          : child.material.clone();
        child.userData.lampMaterialCloned = true;
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(mat => {
        if (!mat?.name) return;
        if (!/light|glass/i.test(mat.name)) return;
        lampMaterialsRef.current.push({
          mat,
          emissive: mat.emissive.clone(),
          emissiveIntensity: mat.emissiveIntensity ?? 1,
        });
      });
    });

    if (lightRoot) {
      const center = new Box3().setFromObject(lightRoot).getCenter(new Vector3());
      lightRoot.worldToLocal(center);
      setLampMount({ parent: lightRoot, position: center.toArray() });
    }

    if (animations.length > 0) {
      mixerRef.current = new AnimationMixer(scene);

      const bindObjectToClip = (object, clipName) => {
        object.traverse(child => {
          if (!objectClipMapRef.current.has(child.uuid)) {
            objectClipMapRef.current.set(child.uuid, clipName);
          }
        });
      };

      animations.forEach(clip => {
        const clipName = clip.name.replace(/\./g, '');
        actionsRef.current[clipName] = mixerRef.current.clipAction(clip);

        const targetNames = new Set(clip.tracks.map(track => getTrackTargetName(track.name)));
        clipMetaRef.current.push({ clipName, targetNames });

        const normalizedTargets = new Set([...targetNames].map(normalizeName));

        scene.traverse(object => {
          const names = objectNames(object);
          const matchesClip = names.some(name => namesReferToClip(name, clipName));
          const matchesTarget = names.some(name => normalizedTargets.has(normalizeName(name)));
          if (matchesClip || matchesTarget) {
            bindObjectToClip(object, clipName);
          }
        });
      });
    }

    onLoaded?.();

    return () => {
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
      objectClipMapRef.current = new Map();
      clipMetaRef.current = [];
      setActiveActions({});
    };
  }, [scene, animations, onLoaded]);

  useCursor(hovered);
  useFrame((_, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
  });

  const findClipName = object => {
    let current = object;
    while (current) {
      const mapped = objectClipMapRef.current.get(current.uuid);
      if (mapped) return mapped;
      current = current.parent;
    }

    const names = chainNames(object);

    for (const { clipName, targetNames } of clipMetaRef.current) {
      if (names.some(name => namesReferToClip(name, clipName))) return clipName;
      for (const targetName of targetNames) {
        if (names.some(name => namesReferToClip(name, targetName) || normalizeName(name) === normalizeName(targetName))) {
          return clipName;
        }
      }
    }

    return null;
  };

  const applyLampState = on => {
    lampOnRef.current = on;
    setLampOn(on);
    lampMaterialsRef.current.forEach(({ mat, emissive, emissiveIntensity }) => {
      if (on) {
        const isLamp = /light/i.test(mat.name);
        mat.emissive.set(isLamp ? '#fff3c4' : '#ffd27a');
        mat.emissiveIntensity = isLamp ? 6 : 1.8;
      } else {
        mat.emissive.copy(emissive);
        mat.emissiveIntensity = emissiveIntensity;
      }
      mat.needsUpdate = true;
    });
  };

  const clickableElementHover = e => {
    e.stopPropagation();
    setHover(Boolean(findClipName(e.object) || isDisplayObject(e.object)));
  };

  const handlePointerDown = e => {
    e.stopPropagation();

    if (isDisplayObject(e.object)) {
      applyLampState(!lampOnRef.current);
      return;
    }

    const clipName = findClipName(e.object);
    if (!clipName) return;

    const action = actionsRef.current[clipName];
    if (!action) return;

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
    <>
      <primitive
        key={modelUrl}
        object={scene}
        position={position}
        scale={scale}
        onPointerDown={handlePointerDown}
        onPointerOver={clickableElementHover}
        onPointerOut={() => setHover(false)}
      />
      {lampMount &&
        createPortal(
          <pointLight
            color="#ffe1a8"
            intensity={lampOn ? 1 : 0}
            distance={0}
            decay={2}
            position={lampMount.position}
          />,
          lampMount.parent
        )}
    </>
  );
};
