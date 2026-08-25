"use client";

import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Group, type Material } from "three";
import { BRAND } from "@/lib/brand";

/**
 * Palco da abertura: a peça da marca gira, flutua e recua.
 *
 * Diferenças deliberadas em relação a `hero-model-canvas.tsx`, que ficou preso
 * a um palco claro:
 *
 * 1. Sem `<Bounds fit clip observe>`. O `observe` reenquadra a cada mudança de
 *    layout, e num palco que muda de tamanho durante o scroll isso reaproxima
 *    a câmera sem aviso. Aqui a escala é medida uma vez com `Box3` e fixada.
 * 2. Sem `OrbitControls`. Esta peça não é para inspecionar — a inspeção mora em
 *    `/itens/:slug/3d`, onde a pessoa pediu por ela. Aqui ela é a abertura, e
 *    um controle de arrasto competiria com o scroll, que é o gesto da loja.
 * 3. Luz de joalheria, calibrada para fundo escuro: chave quente marcada,
 *    preenchimento dourado fraco e contraluz frio que descola a silhueta.
 *    `toneMappingExposure` fica em 1 — acima disso o ouro estoura e a peça
 *    vira uma mancha branca.
 */

const FLOAT_AMPLITUDE = 0.09;
const FLOAT_SPEED = 0.9;
/** Voltas que a peça dá ao longo do trilho inteiro, dirigidas pelo scroll. */
const TURNS_PER_TRACK = Math.PI * 1.6;
/** Pose neutra: onde a peça descansa quando ninguém rolou nada. */
const REST_ROTATION_Y = -0.35;
/** Altura-alvo da peça em unidades de cena, para a escala não depender do GLB. */
const TARGET_HEIGHT = 2.4;

function Piece({
  recede,
  spin,
  animated,
}: {
  recede: number;
  spin: number;
  animated: boolean;
}) {
  const group = useRef<Group>(null);
  const { scene } = useGLTF(BRAND.assets.model) as unknown as { scene: Group };

  const { model, scale } = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = object;
      // `Mesh` sem genericos entrega `material` como `any` nestes tipos do three;
      // a anotacao existe para o lint nao propagar `any` pelo resto do bloco.
      const current = mesh.material as Material | Material[];
      const polish = (material: Material): Material => {
        const next: Material = material.clone();
        if (next instanceof MeshStandardMaterial) {
          next.roughness = Math.min(next.roughness, 0.42);
          next.metalness = Math.max(next.metalness, 0.72);
        }
        return next;
      };
      mesh.material = Array.isArray(current) ? current.map(polish) : polish(current);
    });

    // Escala medida, não adivinhada: um GLB trocado no futuro continua cabendo.
    // `setFromObject` percorre matrizes de mundo; um clone recém-criado ainda
    // não foi adicionado à cena, então elas estão desatualizadas e a caixa sai
    // vazia — o que fazia a peça herdar a escala crua do arquivo.
    clone.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const largest = Math.max(size.x, size.y, size.z);
    const factor = largest > 0 ? TARGET_HEIGHT / largest : 1;

    // Centraliza na origem para o giro acontecer no centro da peça, e não em
    // torno de um pivô herdado do arquivo.
    const center = box.getCenter(new Vector3());
    clone.position.set(-center.x, -center.y, -center.z);

    return { model: clone, scale: factor };
  }, [scene]);

  useFrame((state) => {
    const node = group.current;
    if (!node) return;

    // ROTAÇÃO DIRIGIDA PELO SCROLL, não pelo relógio.
    // `docs/07 §1.4` proíbe que a peça "vire auto-rotação", e girar por tempo
    // era exatamente isso. Aqui a mão de quem rola é que gira: parado o scroll,
    // parada a peça, na pose neutra em que ela nasce. É manipulação direta, o
    // mesmo princípio que o doc autoriza no viewer de SCR-PUB-013.
    node.rotation.y = REST_ROTATION_Y + spin * TURNS_PER_TRACK;

    // A flutuação continua no relógio, e de propósito: ela não é rotação —
    // é o respiro que separa a peça do fundo. Amplitude de 0.09 unidade, muito
    // abaixo do que o doc chama de motion expressivo.
    if (animated) {
      node.position.y = Math.sin(state.clock.elapsedTime * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    }

    // Recuo em Z conforme o scroll: a peça se afasta enquanto a loja se
    // aproxima. É o oposto do zoom-in de anúncio — ela sai de cena por
    // profundidade, não por corte.
    node.position.z = -recede * 2.6;
  });

  return (
    <group ref={group} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

export default function OvertureCanvas({
  recede,
  spin,
  active,
  animated,
  onReady,
}: {
  recede: number;
  /** Progresso do trilho em [0,1]. E o scroll que gira a peca. */
  spin: number;
  active: boolean;
  animated: boolean;
  onReady: () => void;
}) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <Canvas
      className="store-overture__canvas"
      camera={{ position: [0, 0, 5], fov: 32, near: 0.1, far: 60 }}
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1;
      }}
      aria-hidden="true"
    >
      <hemisphereLight intensity={0.45} color="#fff6e2" groundColor="#12100c" />
      <ambientLight intensity={0.22} />
      <directionalLight position={[3.5, 5, 6]} intensity={2.4} color="#fff1cc" />
      <directionalLight position={[-4, 1.5, 3]} intensity={0.8} color="#d7a742" />
      <pointLight position={[-2.5, -1.5, -4]} intensity={2.2} color="#7fd4d4" />
      <Piece animated={animated} recede={recede} spin={spin} />
    </Canvas>
  );
}
