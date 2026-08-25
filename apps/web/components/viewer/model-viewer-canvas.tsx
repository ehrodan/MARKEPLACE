"use client";

import { Center, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ComponentRef, type ErrorInfo, type ReactNode } from "react";
import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Group,
  type Material,
} from "three";
import { BRAND } from "@/lib/brand";

export type ViewerView = "front" | "angle" | "side";

type ViewRequest = {
  key: ViewerView;
  sequence: number;
};

const viewPositions: Record<ViewerView, [number, number, number]> = {
  front: [0, 0.05, 4.35],
  angle: [3.15, 0.8, 3.35],
  side: [4.35, 0.05, 0],
};

function BrandModel({ onReady }: { onReady: () => void }) {
  const { scene } = useGLTF(BRAND.assets.model) as unknown as { scene: Group };
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = object as Mesh;
      const source: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const materials: Material[] = source.map((material): Material => {
        const next: Material = material.clone();
        if (next instanceof MeshStandardMaterial) {
          next.roughness = Math.min(next.roughness, 0.52);
          next.metalness = Math.max(next.metalness, 0.42);
          next.envMapIntensity = 1.8;
        }
        return next;
      });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    });
    const size = new Box3().setFromObject(clone).getSize(new Vector3());
    const longestSide = Math.max(size.x, size.y, size.z);
    if (Number.isFinite(longestSide) && longestSide > 0) {
      clone.scale.multiplyScalar(2.15 / longestSide);
    }
    return clone;
  }, [scene]);

  useEffect(() => { onReady(); }, [model, onReady]);

  return (
    <Center>
      <primitive object={model} />
    </Center>
  );
}

class SceneErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function CameraDirector({
  introEnabled,
  introInterrupted,
  modelReady,
  viewRequest,
  resetSequence,
}: {
  introEnabled: boolean;
  introInterrupted: boolean;
  modelReady: boolean;
  viewRequest: ViewRequest;
  resetSequence: number;
}) {
  const { camera, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const introStartedAt = useRef<number | null>(null);
  const introFrom = useRef(new Vector3(0.7, 1.05, 6.2));
  const introTo = useRef(new Vector3(...viewPositions.front));

  const positionCamera = (position: [number, number, number]) => {
    camera.position.set(...position);
    camera.lookAt(0, 0, 0);
    if (controls.current) {
      controls.current.target.set(0, 0, 0);
      controls.current.update();
    }
    invalidate();
  };

  useEffect(() => {
    if (!modelReady) return;
    if (!introEnabled) {
      positionCamera(viewPositions.front);
      return;
    }
    camera.position.copy(introFrom.current);
    camera.lookAt(0, 0, 0);
    introStartedAt.current = performance.now();
    invalidate();
  }, [camera, introEnabled, invalidate, modelReady]);

  useEffect(() => {
    if (!modelReady || viewRequest.sequence === 0) return;
    introStartedAt.current = null;
    positionCamera(viewPositions[viewRequest.key]);
  }, [modelReady, viewRequest]);

  useEffect(() => {
    if (!modelReady || resetSequence === 0) return;
    introStartedAt.current = null;
    positionCamera(viewPositions.front);
  }, [modelReady, resetSequence]);

  useEffect(() => {
    if (introInterrupted) introStartedAt.current = null;
  }, [introInterrupted]);

  useFrame(() => {
    const startedAt = introStartedAt.current;
    if (startedAt === null || introInterrupted || !modelReady) return;
    const progress = Math.min((performance.now() - startedAt) / 800, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    camera.position.lerpVectors(introFrom.current, introTo.current, eased);
    camera.lookAt(0, 0, 0);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    if (progress < 1) invalidate();
    else introStartedAt.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom
      enableDamping
      dampingFactor={0.075}
      minDistance={2.55}
      maxDistance={7}
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.88}
    />
  );
}

function Scene({
  introEnabled,
  introInterrupted,
  viewRequest,
  resetSequence,
  onReady,
  onError,
}: {
  introEnabled: boolean;
  introInterrupted: boolean;
  viewRequest: ViewRequest;
  resetSequence: number;
  onReady: () => void;
  onError: () => void;
}) {
  const [modelReady, setModelReady] = useState(false);
  const markReady = () => {
    setModelReady(true);
    onReady();
  };

  return (
    <>
      <hemisphereLight intensity={3.2} color="#fff9e9" groundColor="#526b55" />
      <ambientLight intensity={2.2} />
      <directionalLight position={[4.5, 6.5, 7]} intensity={5.8} color="#fff6dc" />
      <directionalLight position={[-5, 2, 4]} intensity={4.4} color="#e6b85a" />
      <pointLight position={[0, -3.4, 4]} intensity={2.8} color="#bbd1bc" />
      <SceneErrorBoundary onError={onError}>
        <Suspense fallback={null}>
          <BrandModel onReady={markReady} />
        </Suspense>
      </SceneErrorBoundary>
      <CameraDirector
        introEnabled={introEnabled}
        introInterrupted={introInterrupted}
        modelReady={modelReady}
        viewRequest={viewRequest}
        resetSequence={resetSequence}
      />
    </>
  );
}

export default function ModelViewerCanvas({
  introEnabled,
  introInterrupted,
  viewRequest,
  resetSequence,
  onReady,
  onError,
}: {
  introEnabled: boolean;
  introInterrupted: boolean;
  viewRequest: ViewRequest;
  resetSequence: number;
  onReady: () => void;
  onError: () => void;
}) {
  return (
    <Canvas
      className="viewer-canvas"
      camera={{ position: [0.7, 1.05, 6.2], fov: 33, near: 0.1, far: 100 }}
      dpr={[1, 1.75]}
      frameloop="demand"
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => { gl.toneMappingExposure = 1.72; }}
      aria-label="Modelo tridimensional interativo do símbolo OCHPOCH MARKET"
    >
      <Scene
        introEnabled={introEnabled}
        introInterrupted={introInterrupted}
        viewRequest={viewRequest}
        resetSequence={resetSequence}
        onReady={onReady}
        onError={onError}
      />
    </Canvas>
  );
}
