"use client";

import { Bounds, Center, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Mesh,
  MeshStandardMaterial,
  type Group,
  type Material,
} from "three";
import { BRAND } from "@/lib/brand";

const rotations = [
  [0.05, -0.3, -0.04],
  [0.12, 0.35, 0.02],
  [-0.08, -0.72, 0.05],
] as const;

function Model({ activeStep, reducedMotion, onReady }: { activeStep: number; reducedMotion: boolean; onReady: () => void }) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF(BRAND.assets.model) as unknown as { scene: Group };
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = object as Mesh;
      const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const enhanced: Material[] = materials.map((material): Material => {
        const next: Material = material.clone();
        if (next instanceof MeshStandardMaterial) {
          next.roughness = Math.min(next.roughness, 0.58);
          next.metalness = Math.max(next.metalness, 0.38);
          next.envMapIntensity = 1.7;
        }
        return next;
      });
      mesh.material = Array.isArray(mesh.material) ? enhanced : enhanced[0];
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    onReady();
  }, [onReady, model]);

  useEffect(() => {
    if (!reducedMotion || !group.current) return;
    const target = rotations[Math.min(activeStep, rotations.length - 1)] ?? rotations[0];
    group.current.rotation.set(target[0], target[1], target[2]);
  }, [activeStep, reducedMotion]);

  useFrame((_, delta) => {
    if (!group.current || reducedMotion) return;
    const target = rotations[Math.min(activeStep, rotations.length - 1)] ?? rotations[0];
    const damping = 1 - Math.exp(-delta * 4.2);
    group.current.rotation.x += (target[0] - group.current.rotation.x) * damping;
    group.current.rotation.y += (target[1] - group.current.rotation.y) * damping;
    group.current.rotation.z += (target[2] - group.current.rotation.z) * damping;
  });

  return (
    <Bounds fit clip observe margin={1.18}>
      <Center>
        <group ref={group}>
          <primitive object={model} />
        </group>
      </Center>
    </Bounds>
  );
}

export default function HeroModelCanvas({
  activeStep,
  active,
  reducedMotion,
  onModelReady,
}: {
  activeStep: number;
  active: boolean;
  reducedMotion: boolean;
  onModelReady: () => void;
}) {
  return (
    <Canvas
      className="landing-model__canvas"
      camera={{ position: [0, 0, 4.2], fov: 34, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => { gl.toneMappingExposure = 1; }}
      aria-label="Modelo tridimensional do símbolo triangular OCHPOCH"
    >
      {/* Iluminacao de VITRINE ESCURA.
          A calibragem anterior somava ~16 de intensidade com exposicao 1.65,
          porque o palco era creme e a peca precisava vencer um fundo claro.
          Sobre o fundo escuro da loja isso estourava o render inteiro: o
          `Bounds observe` reenquadra a peca a cada mudanca de layout, e a
          peca superexposta preenchia o palco de branco.
          Agora e luz de joalheria: uma chave quente marcada, um preenchimento
          dourado fraco, e um contraluz frio que separa a silhueta do fundo. */}
      <hemisphereLight intensity={0.5} color="#fff9e9" groundColor="#1a1712" />
      <ambientLight intensity={0.3} />
      <directionalLight position={[4, 6, 7]} intensity={2.1} color="#fff4d2" />
      <directionalLight position={[-4, 2, 4]} intensity={0.9} color="#d7a742" />
      <pointLight position={[-2, -1, -4]} intensity={1.6} color="#8fd7d7" />
      <Model activeStep={activeStep} reducedMotion={reducedMotion} onReady={onModelReady} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableDamping={!reducedMotion}
        dampingFactor={0.08}
        minDistance={2.8}
        maxDistance={6.4}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.82}
      />
    </Canvas>
  );
}
