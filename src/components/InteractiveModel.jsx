import { useEffect, useRef, useState } from 'react';
import { useCursor, useGLTF } from '@react-three/drei';
import { AnimationMixer, Box3, BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { createPortal, useFrame } from '@react-three/fiber';
import { createDependencyController, parseAnimationName } from '../animation/dependencyController';

// Model exports use dots and numeric suffixes differently for clips and objects.
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
  return base === 'light' || base.startsWith('light');
};

const getMaterials = material => (Array.isArray(material) ? material : [material]);

const prepareMaterials = scene => {
  const originalDepthWrites = new Map();
  scene.traverse(child => {
    if (!child.isMesh || !child.material) return;
    getMaterials(child.material).forEach(material => {
      if (!originalDepthWrites.has(material)) originalDepthWrites.set(material, material.depthWrite);
      material.depthWrite = true;
    });
  });

  return () => {
    originalDepthWrites.forEach((depthWrite, material) => {
      material.depthWrite = depthWrite;
    });
  };
};

// Display meshes toggle the lamp. Newer exports name the lamp mesh Light.
const prepareLamp = scene => {
  const lampMaterials = [];
  const replacements = [];
  let lightRoot = null;

  scene.traverse(child => {
    const names = objectNames(child);
    const isLamp =
      names.some(isLightObjectName) &&
      child.isMesh &&
      child.material &&
      getMaterials(child.material).some(mat => /light/i.test(mat.name) && mat.emissive);
    if (!isLamp) return;
    if (!lightRoot) lightRoot = child;
    if (!child.isMesh || !child.material) return;

    // useGLTF caches the scene. Restore its materials when this viewer releases it.
    const originalMaterial = child.material;
    child.material = Array.isArray(originalMaterial)
      ? originalMaterial.map(material => material.clone())
      : originalMaterial.clone();
    replacements.push({ child, originalMaterial, materials: getMaterials(child.material) });

    getMaterials(child.material).forEach(mat => {
      if (!/light|glass/i.test(mat.name) || !mat.emissive) return;
      lampMaterials.push({
        mat,
        emissive: mat.emissive.clone(),
        emissiveIntensity: mat.emissiveIntensity ?? 1,
      });
    });
  });

  let mount = null;
  if (lightRoot) {
    const center = new Box3().setFromObject(lightRoot).getCenter(new Vector3());
    lightRoot.worldToLocal(center);
    mount = { parent: lightRoot, position: center.toArray() };
  }

  return {
    materials: lampMaterials,
    mount,
    cleanup: () => {
      replacements.forEach(({ child, originalMaterial, materials }) => {
        child.material = originalMaterial;
        // Textures remain shared with the cached GLTF and must not be disposed here.
        materials.forEach(material => material.dispose());
      });
    },
  };
};

const prepareAnimations = (scene, animations) => {
  const mixer = animations.length > 0 ? new AnimationMixer(scene) : null;
  const actions = {};
  const objectClipMap = new Map();
  const legacyClips = [];
  const grillHitAreas = [];
  const bindObjectToClip = (object, clipName) => {
    object.traverse(child => {
      if (!objectClipMap.has(child.uuid)) {
        objectClipMap.set(child.uuid, clipName);
      }
    });
  };

  animations.forEach(clip => {
    const clipName = clip.name;
    actions[clipName] = mixer.clipAction(clip);

    const targetNames = [...new Set(clip.tracks.map(track => getTrackTargetName(track.name)))];
    const structured = Boolean(parseAnimationName(clipName).id);
    const isGrill = /^out\.grid(?:\.requires\.|$)/i.test(clipName);
    if (!structured) legacyClips.push({ clipName, targetNames });

    const normalizedTargets = new Set(targetNames.map(normalizeName));

    scene.traverse(object => {
      const names = objectNames(object);
      const matchesClip = !structured && names.some(name => namesReferToClip(name, clipName));
      const matchesTarget = names.some(name => normalizedTargets.has(normalizeName(name)));
      if (matchesClip || matchesTarget) {
        bindObjectToClip(object, clipName);
      }
      if (isGrill && matchesTarget && object.isMesh && objectClipMap.get(object.uuid) === clipName) {
        grillHitAreas.push({ object, clipName });
      }
    });
  });

  if (legacyClips.length) scene.traverse(object => {
    if (objectClipMap.has(object.uuid)) return;

    const names = chainNames(object);
    const match = legacyClips.find(({ clipName, targetNames }) =>
      names.some(name =>
        namesReferToClip(name, clipName) ||
        targetNames.some(targetName => namesReferToClip(name, targetName))
      )
    );
    if (match) objectClipMap.set(object.uuid, match.clipName);
  });

  const hitMeshes = grillHitAreas.map(({ object, clipName }) => {
    object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox;
    const size = bounds.getSize(new Vector3());
    const hitMesh = new Mesh(
      new BoxGeometry(size.x, Math.max(size.y, 0.025), size.z),
      new MeshBasicMaterial({ visible: false }),
    );
    bounds.getCenter(hitMesh.position);
    object.add(hitMesh);
    objectClipMap.set(hitMesh.uuid, clipName);
    return hitMesh;
  });

  return {
    mixer, actions, objectClipMap,
    removeHitMeshes() {
      hitMeshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
    },
  };
};

export const InteractiveModel = ({ modelUrl, onLoaded, position = [0, 0, 0], scale = 1 }) => {
  const { scene, animations } = useGLTF(modelUrl);
  const [hovered, setHover] = useState(false);
  const mixerRef = useRef(null);
  const controllerRef = useRef(null);
  const objectClipMapRef = useRef(new Map());
  const lampOnRef = useRef(false);
  const lampMaterialsRef = useRef([]);
  const [lampOn, setLampOn] = useState(false);
  const [lampMount, setLampMount] = useState(null);

  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    const restoreMaterials = prepareMaterials(scene);
    const lamp = prepareLamp(scene);
    const { mixer, actions, objectClipMap, removeHitMeshes } = prepareAnimations(scene, animations);

    mixerRef.current = mixer;
    const controller = createDependencyController(mixer, actions);
    controllerRef.current = controller;
    objectClipMapRef.current = objectClipMap;
    lampMaterialsRef.current = lamp.materials;
    lampOnRef.current = false;
    setLampOn(false);
    setLampMount(lamp.mount);
    setHover(false);

    return () => {
      controller.dispose();
      mixer?.stopAllAction();
      mixer?.uncacheRoot(scene);
      removeHitMeshes();
      lamp.cleanup();
      restoreMaterials();
      mixerRef.current = null;
      controllerRef.current = null;
      objectClipMapRef.current = new Map();
      lampMaterialsRef.current = [];
    };
  }, [scene, animations]);

  useEffect(() => {
    onLoadedRef.current?.();
  }, [scene, animations]);

  useCursor(hovered);
  useFrame((_, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
  });

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
    });
  };

  const clickableElementHover = e => {
    e.stopPropagation();
    setHover(objectClipMapRef.current.has(e.object.uuid) || isDisplayObject(e.object));
  };

  const handleClick = e => {
    // R3F reports movement since pointer-down in pixels; dragging controls must not activate parts.
    if (e.button !== 0 || e.delta > 2) return;

    e.stopPropagation();

    if (isDisplayObject(e.object)) {
      applyLampState(!lampOnRef.current);
      return;
    }

    const clipName = objectClipMapRef.current.get(e.object.uuid);
    if (!clipName) return;

    void controllerRef.current?.toggle(clipName);
  };

  return (
    <>
      <primitive
        key={modelUrl}
        object={scene}
        position={position}
        scale={scale}
        onClick={handleClick}
        onPointerOver={clickableElementHover}
        onPointerOut={() => setHover(false)}
      />
      {lampMount &&
        createPortal(
          <pointLight
            color='#ffe1a8'
            intensity={lampOn ? 2 : 0}
            distance={0}
            decay={2}
            position={lampMount.position}
          />,
          lampMount.parent,
        )}
    </>
  );
};
