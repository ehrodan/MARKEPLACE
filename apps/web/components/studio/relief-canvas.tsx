"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  ACESFilmicToneMapping,
  DoubleSide,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
} from "three";
import styles from "./relief-studio.module.css";

export type ReliefView = "front" | "angle";

export type ReliefViewRequest = {
  readonly view: ReliefView;
  readonly sequence: number;
};

export type ReliefCanvasProps = {
  readonly sourceUrl: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly depth: number;
  readonly reducedMotion: boolean;
  readonly viewRequest: ReliefViewRequest;
  readonly onReady: () => void;
  readonly onError: () => void;
};

const CAMERA_POSITIONS: Record<ReliefView, Vector3> = {
  front: new Vector3(0, 0, 4.6),
  angle: new Vector3(2.15, 1.05, 3.8),
};

function WebGlFallback({ onError }: { onError: () => void }) {
  useEffect(() => { onError(); }, [onError]);
  return (
    <div className={styles.canvasFallback} role="status">
      O navegador não abriu o WebGL. A fonte 2D continua disponível.
    </div>
  );
}

function ContextLossGuard({ onError }: { onError: () => void }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onError();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    return () => { canvas.removeEventListener("webglcontextlost", handleContextLost, false); };
  }, [gl, onError]);

  return null;
}

function CameraRig({
  reducedMotion,
  viewRequest,
}: {
  reducedMotion: boolean;
  viewRequest: ReliefViewRequest;
}) {
  const { camera, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);

  useEffect(() => {
    camera.position.copy(CAMERA_POSITIONS[viewRequest.view]);
    camera.lookAt(0, 0, 0);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    invalidate();
  }, [camera, invalidate, viewRequest]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      autoRotate={false}
      enableDamping={!reducedMotion}
      dampingFactor={0.075}
      enablePan={false}
      enableZoom
      minDistance={2.8}
      maxDistance={7}
      minPolarAngle={Math.PI * 0.18}
      maxPolarAngle={Math.PI * 0.82}
      minAzimuthAngle={-Math.PI * 0.42}
      maxAzimuthAngle={Math.PI * 0.42}
    />
  );
}

function ReliefSurface({
  sourceUrl,
  imageWidth,
  imageHeight,
  depth,
  onReady,
  onError,
}: Omit<ReliefCanvasProps, "reducedMotion" | "viewRequest">) {
  const { gl, invalidate } = useThree();
  const [texture, setTexture] = useState<Texture | null>(null);
  const aspect = imageWidth / imageHeight;
  const surfaceWidth = aspect >= 1 ? 2.9 : 2.9 * aspect;
  const surfaceHeight = aspect >= 1 ? 2.9 / aspect : 2.9;

  const geometry = useMemo(
    () => new PlaneGeometry(surfaceWidth, surfaceHeight, 96, 96),
    [surfaceHeight, surfaceWidth],
  );
  const material = useMemo(() => new MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.4,
    metalness: 0.06,
    transparent: true,
    alphaTest: 0.02,
    side: DoubleSide,
  }), []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useEffect(() => {
    let released = false;
    const loadedTexture = new TextureLoader().load(
      sourceUrl,
      (nextTexture) => {
        if (released) {
          nextTexture.dispose();
          return;
        }
        nextTexture.colorSpace = SRGBColorSpace;
        nextTexture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
        nextTexture.needsUpdate = true;
        setTexture(nextTexture);
      },
      undefined,
      () => { if (!released) onError(); },
    );

    return () => {
      released = true;
      loadedTexture.dispose();
    };
  }, [gl, onError, sourceUrl]);

  useEffect(() => {
    material.map = texture;
    material.displacementMap = texture;
    material.bumpMap = texture;
    material.displacementScale = depth;
    material.displacementBias = depth * -0.32;
    material.bumpScale = depth * 0.7;
    material.needsUpdate = true;
    invalidate();
    if (texture) onReady();
  }, [depth, invalidate, material, onReady, texture]);

  return <mesh geometry={geometry} material={material} />;
}

function Scene(props: ReliefCanvasProps) {
  return (
    <>
      <ambientLight intensity={1.7} />
      <hemisphereLight intensity={2.4} color="#e9fbff" groundColor="#07141c" />
      <directionalLight position={[3.8, 4.5, 5.5]} intensity={4.2} color="#dffcff" />
      <directionalLight position={[-3.5, -1, 3]} intensity={2.2} color="#e1b8ff" />
      <ReliefSurface
        key={props.sourceUrl}
        sourceUrl={props.sourceUrl}
        imageWidth={props.imageWidth}
        imageHeight={props.imageHeight}
        depth={props.depth}
        onReady={props.onReady}
        onError={props.onError}
      />
      <CameraRig reducedMotion={props.reducedMotion} viewRequest={props.viewRequest} />
      <ContextLossGuard onError={props.onError} />
    </>
  );
}

export default function ReliefCanvas(props: ReliefCanvasProps) {
  return (
    <Canvas
      aria-label="Prévia interativa do relevo 2,5D"
      camera={{ position: [0, 0, 4.6], fov: 34, near: 0.1, far: 50 }}
      dpr={[1, 1.5]}
      fallback={<WebGlFallback onError={props.onError} />}
      frameloop="demand"
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
