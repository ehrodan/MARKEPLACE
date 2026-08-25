import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import styles from "./announcement-bar.module.css";

/**
 * Faixa estática de confiança no topo. A posição vem do benchmark de varejo,
 * mas o conteúdo é uma capability verificável do nosso produto.
 *
 * O que foi transportado: a POSIÇÃO e a HIERARQUIA. Uma faixa fina acima do
 * cabeçalho, texto curto, leitura imediata. É o primeiro contato e responde "por
 * que comprar aqui" antes de qualquer scroll.
 *
 * O que NÃO foi transportado, de propósito: o conteúdo. O benchmark usa
 * "CUPOM 1COMPRA = DESCONTO MÁXIMO" e "2X SEM JUROS". `docs/03 §10` proíbe
 * desconto sem preço de referência praticado, e o PSP não está conectado —
 * anunciar parcelamento seria afirmar capability que não existe (`RF-Q49`:
 * ausência de provider é `UNSUPPORTED`, nunca sucesso mockado).
 *
 * Então a faixa carrega o que É verdade hoje: as três garantias estruturais do
 * produto. Reduzir risco percebido com fato verificável converte tanto quanto
 * cupom, e não vira processo.
 *
 * `docs/03 §5` proíbe carrossel automático na home. Por isso existe uma única
 * mensagem, sem temporizador, layout shift ou conteúdo alternado por JavaScript.
 */
export function AnnouncementBar() {
  return (
    <aside className={styles.bar} aria-label="Como a plataforma protege a compra">
      <div className={styles.inner}>
        <p>
          <ShieldCheck aria-hidden="true" size={15} />
          <strong>Compra com contexto:</strong>
          <span> preço, estoque e vendedor vêm do catálogo publicado.</span>
        </p>
        <Link href="/seguranca">Entenda a proteção</Link>
      </div>
    </aside>
  );
}
