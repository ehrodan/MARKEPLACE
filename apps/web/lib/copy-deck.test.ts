import { describe, expect, it } from "vitest";
import { AWARENESS, COPY, copyBlocks, type Block } from "./copy-deck";

/**
 * Guarda-corpo do copy: nenhuma peca comercial pode reintroduzir urgencia
 * fabricada, escassez falsa, prova social inventada ou promessa numerica que
 * a interface nao comprova (docs/07, docs/18 secao 3.2, gates G0-G3 fechados).
 */
const forbidden: ReadonlyArray<readonly [string, RegExp]> = [
  ["escassez de estoque", /[uú]ltim[ao]s?\s+unidade/i],
  ["escassez de estoque", /\brestam?\s+(apenas|s[oó]|poucas?|poucos?)?\s*\d*\s*(itens?|unidades?|vagas?)/i],
  ["escassez de estoque", /\b(esgotando|acabando|quase acabando)\b/i],
  ["prazo fabricado", /\bs[oó] hoje\b/i],
  ["prazo fabricado", /\bagora ou nunca\b/i],
  ["prazo fabricado", /\b[uú]ltima chance\b/i],
  ["prazo fabricado", /\bpor tempo limitado\b/i],
  ["prazo fabricado", /\boferta rel[aâ]mpago\b/i],
  ["prazo fabricado", /\bcontagem regressiva\b/i],
  ["prazo fabricado", /\bfaltam?\s+\d+/i],
  ["pressao sobre o leitor", /\b(corre|corra|corram)\b/i],
  ["pressao sobre o leitor", /\bn[aã]o perca\b/i],
  ["pressao sobre o leitor", /\bn[aã]o fique de fora\b/i],
  ["pressao sobre o leitor", /\baproveite (agora|j[aá])\b/i],
  ["vaga artificial", /\bvagas? limitadas?\b/i],
  ["vaga artificial", /\bexclusivo para os \d+ primeiros\b/i],
  ["volume social inventado", /\d+\s*mil\s+(usu[aá]rios|clientes|vendas|vendedores|pedidos)/i],
  ["volume social inventado", /\b(milhares|centenas|milh[oõ]es)\s+de\b/i],
  ["volume social inventado", /\b\d[\d.,]*\s*(mil|milh[oõ]es?|k)\s+(de\s+)?(usu[aá]rios|clientes|vendas|vendedores|pedidos|itens)\b/i],
  ["volume social inventado", /\b\d+\s*(usu[aá]rios|clientes|vendedores|vendas|pedidos|avalia[cç][oõ]es)\b/i],
  ["prova social fabricada", /\bclientes satisfeitos\b/i],
  ["prova social fabricada", /\bnota\s+\d(?:[.,]\d)?\s*(de|\/)\s*5\b/i],
  ["prova social fabricada", /\b(l[ií]der de mercado|melhor do brasil|n[uú]mero 1 do brasil)\b/i],
  ["promessa nao comprovada", /\bgarantid[oa]s?\b/i],
  ["promessa nao comprovada", /\bpagamento instant[aâ]neo\b/i],
  ["promessa nao comprovada", /\bentrega autom[aá]tica\b/i],
  ["promessa nao comprovada", /\bna hora\b/i],
  ["promessa nao comprovada", /\bem segundos\b/i],
  ["prazo numerico nao comprovado", /\b\d+\s*(minutos?|horas?|dias?|semanas?|meses)\b/i],
  ["percentual hardcoded", /\d+(?:[.,]\d+)?\s*%/],
  ["hype", /\b(imperd[ií]vel|incr[ií]vel|revolucion[aá]ri[oa]|sensacional|imbat[ií]vel)\b/i],
];

const requiredFields = ["kicker", "headline", "subhead", "body"] as const;
const optionalFields = ["cta", "microcopy"] as const;

const surfaces = [
  "landing",
  "market",
  "search",
  "listing",
  "cart",
  "purchases",
  "sellerPublic",
  "rewards",
  "ranking",
  "trust",
];

const requiredPaths = [
  "landing.hero",
  "landing.proof.intro",
  "landing.proof.origin",
  "landing.proof.state",
  "landing.proof.nextStep",
  "landing.viewerInvite",
  "landing.finalCta",
  "market.header",
  "market.loading",
  "market.empty",
  "market.error",
  "search.field",
  "search.noResults",
  "search.recovery",
  "listing.trust",
  "listing.provenance",
  "listing.nextStep",
  "cart.header",
  "cart.sellerGroups",
  "cart.empty",
  "cart.priceRevalidation",
  "purchases.header",
  "purchases.filters",
  "purchases.empty.all",
  "purchases.empty.awaitingPayment",
  "purchases.empty.inDelivery",
  "purchases.empty.inDispute",
  "purchases.empty.completed",
  "sellerPublic.header",
  "sellerPublic.noListings",
  "rewards.header",
  "rewards.level",
  "ranking.header",
  "ranking.season",
  "trust.custody",
  "trust.dualConfirmation",
  "trust.dispute",
];

const entries = [...copyBlocks(COPY), ...copyBlocks(AWARENESS, "awareness")];

function textOf(block: Block): string {
  return Object.values(block).join(" · ");
}

describe("copy deck", () => {
  it("cobre todas as superfícies e todos os blocos contratados", () => {
    expect(Object.keys(COPY).sort()).toEqual([...surfaces].sort());
    const paths = new Set(entries.map((entry) => entry.path));
    for (const path of requiredPaths) expect(paths.has(path), `bloco ausente: ${path}`).toBe(true);
    expect(entries.length).toBe(requiredPaths.length + Object.keys(AWARENESS).length);
  });

  it("não deixa campo obrigatório vazio", () => {
    for (const { path, block } of entries) {
      for (const field of requiredFields) {
        expect(block[field].trim(), `${path}.${field} vazio`).not.toBe("");
      }
      for (const field of optionalFields) {
        const value = block[field];
        if (value !== undefined) expect(value.trim(), `${path}.${field} vazio`).not.toBe("");
      }
    }
  });

  it("recusa urgência, escassez, prova social inventada e promessa não comprovada", () => {
    for (const { path, block } of entries) {
      const text = textOf(block);
      for (const [label, pattern] of forbidden) {
        expect(pattern.test(text), `${path} viola "${label}" (${String(pattern)})`).toBe(false);
      }
    }
  });

  it("mantém o guarda-corpo capaz de reprovar texto proibido", () => {
    const violations = [
      "Últimas unidades disponíveis!",
      "Só hoje: aproveite já antes que acabe.",
      "Corra, vagas limitadas nesta turma.",
      "Milhares de clientes já compraram aqui.",
      "Mais de 10 mil usuários confiam na plataforma.",
      "Resultado garantido com pagamento instantâneo.",
      "Entrega automática em 5 minutos.",
      "98% de satisfação comprovada.",
      "Nota 4,9 de 5 nas avaliações.",
      "Faltam 3 para encerrar a contagem regressiva.",
    ];
    for (const sample of violations) {
      expect(forbidden.some(([, pattern]) => pattern.test(sample)), `não capturou: ${sample}`).toBe(true);
    }
  });

  it("documenta os cinco níveis de consciência e espelha o nível em uso na landing", () => {
    expect(Object.keys(AWARENESS)).toEqual([
      "unaware",
      "problemAware",
      "solutionAware",
      "productAware",
      "mostAware",
    ]);
    expect(AWARENESS.solutionAware.headline).toBe(COPY.landing.hero.headline);
    expect(AWARENESS.solutionAware.subhead).toBe(COPY.landing.hero.subhead);
    const headlines = entries.map((entry) => entry.block.headline);
    expect(new Set(headlines).size, "headline repetida entre blocos").toBe(headlines.length - 1);
  });

  it("permanece congelado em profundidade", () => {
    expect(Object.isFrozen(COPY)).toBe(true);
    expect(Object.isFrozen(COPY.trust)).toBe(true);
    expect(Object.isFrozen(COPY.trust.custody)).toBe(true);
    expect(Object.isFrozen(AWARENESS.unaware)).toBe(true);
  });
});
