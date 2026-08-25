"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@midas/ui";
import { itemTypeLabel } from "@/components/marketplace/formatters";
import { COPY } from "@/lib/copy-deck";
import {
  CHANNEL_LABELS,
  MAX_QUERY_LENGTH,
  SEARCH_CHANNELS,
  SEARCH_SORTS,
  SORT_LABELS,
  currencyFractionDigits,
  majorToMinorUnits,
  minorUnitsToMajor,
  type SearchFacet,
  type SearchQueryState,
  type SearchSort,
} from "./search-query";
import styles from "./search.module.css";

export interface SearchFiltersProps {
  state: SearchQueryState;
  /** Publica o novo estado na URL. A tela decide push/replace. */
  onChange: (next: SearchQueryState) => void;
  /** Tipos presentes nos anúncios já carregados. Nenhum tipo é inventado. */
  itemTypes: readonly string[];
  facets: readonly SearchFacet[];
  /** Moeda única do conjunto carregado, ou `null` quando não há uma só. */
  currency: string | null;
  /** Explicação de por que a faixa de preço está indisponível, quando estiver. */
  priceNotice: string | null;
  busy: boolean;
}

const PRICE_HELP_ID = "busca-preco-ajuda";
const PRICE_ERROR_ID = "busca-preco-erro";

function isSortValue(value: string): value is SearchSort {
  return (SEARCH_SORTS as readonly string[]).includes(value);
}

export function SearchFilters({
  state,
  onChange,
  itemTypes,
  facets,
  currency,
  priceNotice,
  busy,
}: SearchFiltersProps) {
  const fractionDigits = currency === null ? 2 : currencyFractionDigits(currency);
  const priceDisabled = currency === null;

  const [term, setTerm] = useState(state.q);
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());

  // A URL manda: voltar/avançar, remover chip e sugestão de recuperação
  // reescrevem os campos sem o usuário reeditar nada.
  useEffect(() => { setTerm(state.q); }, [state.q]);

  useEffect(() => {
    setMinInput(state.precoMinMinor === null ? "" : minorUnitsToMajor(state.precoMinMinor, fractionDigits));
    setMaxInput(state.precoMaxMinor === null ? "" : minorUnitsToMajor(state.precoMaxMinor, fractionDigits));
    setPriceError(null);
  }, [state.precoMinMinor, state.precoMaxMinor, fractionDigits]);

  function registerChip(id: string, element: HTMLButtonElement | null) {
    if (element === null) chipRefs.current.delete(id);
    else chipRefs.current.set(id, element);
  }

  /**
   * Foco nunca cai no `body`: vai para o próximo chip e, quando o removido era
   * o último, volta para o campo de busca (WCAG 2.2 — 3.2.x, foco previsível).
   */
  function removeFacet(index: number) {
    const facet = facets.at(index);
    if (!facet) return;
    const successor = facets.at(index + 1);
    const target = successor ? chipRefs.current.get(successor.id) : searchInputRef.current;
    onChange(facet.next);
    target?.focus();
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    let precoMinMinor: string | null = null;
    let precoMaxMinor: string | null = null;

    if (!priceDisabled) {
      if (minInput.trim() !== "") {
        precoMinMinor = majorToMinorUnits(minInput, fractionDigits);
        if (precoMinMinor === null) {
          setPriceError("Informe o preço mínimo como um valor, por exemplo 129,90.");
          return;
        }
      }
      if (maxInput.trim() !== "") {
        precoMaxMinor = majorToMinorUnits(maxInput, fractionDigits);
        if (precoMaxMinor === null) {
          setPriceError("Informe o preço máximo como um valor, por exemplo 1.299,90.");
          return;
        }
      }
    } else {
      precoMinMinor = state.precoMinMinor;
      precoMaxMinor = state.precoMaxMinor;
    }

    setPriceError(null);
    onChange({ ...state, q: term, precoMinMinor, precoMaxMinor });
  }

  return (
    <form className={styles.filters} role="search" aria-label="Buscar no catálogo público" onSubmit={submit}>
      <div className={styles.filterGrid}>
        <div className={`${styles.field} ${styles.searchField}`}>
          <label htmlFor="busca-termo">{COPY.search.field.cta} no catálogo público</label>
          <div className={styles.inputWithIcon}>
            <Search aria-hidden="true" size={17} />
            <input
              id="busca-termo"
              ref={searchInputRef}
              type="search"
              name="q"
              value={term}
              maxLength={MAX_QUERY_LENGTH}
              autoComplete="off"
              placeholder={COPY.search.field.microcopy}
              aria-describedby="busca-termo-ajuda"
              onChange={(event) => { setTerm(event.target.value); }}
            />
          </div>
          <p className={styles.hint} id="busca-termo-ajuda">
            A consulta entra no endereço da página: dá para compartilhar, favoritar e voltar.
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor="busca-tipo">Tipo de item</label>
          <select
            id="busca-tipo"
            name="tipo"
            value={state.tipo ?? ""}
            disabled={itemTypes.length === 0}
            onChange={(event) => {
              const value = event.target.value;
              onChange({ ...state, tipo: value === "" ? null : value });
            }}
          >
            <option value="">Todos os tipos</option>
            {itemTypes.map((value) => (
              <option value={value} key={value}>{itemTypeLabel(value)}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="busca-ordem">Ordenar</label>
          <select
            id="busca-ordem"
            name="ordem"
            value={state.ordem}
            onChange={(event) => {
              const value = event.target.value;
              if (isSortValue(value)) onChange({ ...state, ordem: value });
            }}
          >
            {SEARCH_SORTS.map((value) => (
              <option value={value} key={value}>{SORT_LABELS[value]}</option>
            ))}
          </select>
        </div>

        <fieldset className={styles.channelGroup}>
          <legend>Canal</legend>
          {SEARCH_CHANNELS.map((value) => (
            <label className={styles.channelOption} key={value}>
              <input
                type="radio"
                name="canal"
                value={value}
                checked={state.canal === value}
                onChange={() => { onChange({ ...state, canal: value }); }}
              />
              <span>{CHANNEL_LABELS[value]}</span>
            </label>
          ))}
        </fieldset>

        <div className={`${styles.field} ${styles.priceField}`}>
          <span className={styles.fieldLabel} id="busca-preco-rotulo">
            Faixa de preço{currency === null ? "" : ` (${currency})`}
          </span>
          <div className={styles.priceRow} role="group" aria-labelledby="busca-preco-rotulo">
            <span className={styles.priceInput}>
              <label htmlFor="busca-preco-min">Mínimo</label>
              <input
                id="busca-preco-min"
                type="text"
                inputMode="decimal"
                name="preco-min"
                value={minInput}
                disabled={priceDisabled}
                autoComplete="off"
                aria-describedby={priceError === null ? PRICE_HELP_ID : `${PRICE_HELP_ID} ${PRICE_ERROR_ID}`}
                aria-invalid={priceError === null ? undefined : true}
                onChange={(event) => { setMinInput(event.target.value); }}
              />
            </span>
            <span className={styles.priceInput}>
              <label htmlFor="busca-preco-max">Máximo</label>
              <input
                id="busca-preco-max"
                type="text"
                inputMode="decimal"
                name="preco-max"
                value={maxInput}
                disabled={priceDisabled}
                autoComplete="off"
                aria-describedby={priceError === null ? PRICE_HELP_ID : `${PRICE_HELP_ID} ${PRICE_ERROR_ID}`}
                aria-invalid={priceError === null ? undefined : true}
                onChange={(event) => { setMaxInput(event.target.value); }}
              />
            </span>
          </div>
          <p className={styles.hint} id={PRICE_HELP_ID}>
            {priceNotice ?? "O valor viaja na URL em unidade mínima da moeda, sem arredondamento."}
          </p>
          {priceError === null ? null : (
            <p className={styles.fieldError} id={PRICE_ERROR_ID} role="alert">{priceError}</p>
          )}
        </div>
      </div>

      <div className={styles.filterActions}>
        <Button type="submit" loading={busy} loadingLabel="Consultando" iconBefore={<Search aria-hidden="true" size={16} />}>
          {COPY.search.field.cta}
        </Button>
        {facets.length === 0 ? null : (
          <Button
            variant="outline"
            onClick={() => {
              onChange({ ...state, q: "", tipo: null, precoMinMinor: null, precoMaxMinor: null });
              searchInputRef.current?.focus();
            }}
          >
            Limpar busca
          </Button>
        )}
      </div>

      {facets.length === 0 ? null : (
        <div className={styles.chipsRegion}>
          <h3 className={styles.chipsTitle} id="busca-chips-titulo">Critérios aplicados</h3>
          <ul className={styles.chips} aria-labelledby="busca-chips-titulo">
            {facets.map((facet, index) => (
              <li key={facet.id}>
                <button
                  type="button"
                  className={styles.chip}
                  ref={(element) => { registerChip(facet.id, element); }}
                  aria-label={`Remover ${facet.label}: ${facet.value}`}
                  onClick={() => { removeFacet(index); }}
                >
                  <span className={styles.chipLabel}>{facet.label}</span>
                  <span className={styles.chipValue}>{facet.value}</span>
                  <X aria-hidden="true" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
