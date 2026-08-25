"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, ShieldCheck } from "lucide-react";
import { Button, Panel, StatusBadge } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { DataProvenance } from "@/components/account/data-provenance";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import styles from "./notifications.module.css";

/** Contrato canônico publicado pela borda de retenção. */
export const PREFERENCES_ENDPOINT = "/v1/me/reminder-consents";

export type ConsentChannel = "EMAIL" | "PUSH" | "IN_APP";
export type ConsentPurpose = "CART_RECOVERY" | "PRICE_WATCH" | "STOCK_WATCH" | "ORDER_UPDATE";
export type ConsentState = "GRANTED" | "MISSING" | "REVOKED";

export interface ConsentRecord {
  purpose: ConsentPurpose;
  channel: ConsentChannel;
  state: ConsentState;
  granted: boolean;
  decidedAt: string | null;
  policyVersion: string | null;
}

export interface CommunicationPreferences {
  asOf: string;
  data: ConsentRecord[];
}

export interface ConsentChange {
  purpose: ConsentPurpose;
  channel: ConsentChannel;
  granted: boolean;
}

interface PurposeDefinition {
  purpose: ConsentPurpose;
  label: string;
  /** Transacional não é marketing, mas a API respeita uma revogação explícita. */
  transactional: boolean;
  /** Uma frase concreta sobre o evento que pode originar o lembrete. */
  promise: string;
  detail: string;
}

export const CONSENT_CHANNELS: readonly ConsentChannel[] = ["EMAIL", "PUSH", "IN_APP"];

const channelLabels: Record<ConsentChannel, string> = {
  EMAIL: "E-mail",
  PUSH: "Push",
  IN_APP: "No app",
};

export const CONSENT_PURPOSES: readonly PurposeDefinition[] = [
  {
    purpose: "CART_RECOVERY",
    label: "Lembrete de carrinho",
    transactional: false,
    promise: "Um lembrete para retomar um carrinho salvo, sempre com o preço vigente no momento do envio.",
    detail: "A política limita a um lembrete por carrinho, até dois por pessoa, e separa mensagens de marketing por pelo menos 72 horas.",
  },
  {
    purpose: "PRICE_WATCH",
    label: "Vigilância de preço",
    transactional: false,
    promise: "Aviso quando um anúncio acompanhado tiver uma queda real de preço.",
    detail: "Mensagens de marketing respeitam intervalo mínimo de 72 horas e janela de silêncio entre 21h e 9h para e-mail e push.",
  },
  {
    purpose: "STOCK_WATCH",
    label: "Volta ao estoque",
    transactional: false,
    promise: "Aviso quando um anúncio acompanhado voltar a ter unidade disponível.",
    detail: "Mensagens de marketing respeitam intervalo mínimo de 72 horas e janela de silêncio entre 21h e 9h para e-mail e push.",
  },
  {
    purpose: "ORDER_UPDATE",
    label: "Andamento do pedido",
    transactional: true,
    promise: "Confirmação de pagamento, entrega, disputa e reembolso dos seus pedidos. Nenhuma oferta é enviada com essa finalidade.",
    detail: "Este aviso é transacional e pode funcionar sem opt-in. Se você o revogar, a política bloqueia novos lembretes desse canal mesmo assim.",
  },
];

export function cellKey(purpose: ConsentPurpose, channel: ConsentChannel): string {
  return `${purpose}:${channel}`;
}

/**
 * Estado inicial da matriz. Toda célula começa sem autorização e só sobe
 * para ligada quando a API devolve `GRANTED` e `granted === true`.
 */
export function optionalConsentState(consents: readonly ConsentRecord[]): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const definition of CONSENT_PURPOSES) {
    for (const channel of CONSENT_CHANNELS) {
      state[cellKey(definition.purpose, channel)] = false;
    }
  }
  for (const record of consents) {
    const key = cellKey(record.purpose, record.channel);
    if (Object.hasOwn(state, key)) {
      state[key] = record.state === "GRANTED" && record.granted;
    }
  }
  return state;
}

function findRecord(
  consents: readonly ConsentRecord[],
  purpose: ConsentPurpose,
  channel: ConsentChannel,
): ConsentRecord | undefined {
  return consents.find((record) => record.purpose === purpose && record.channel === channel);
}

export function describeChange(change: ConsentChange): string {
  const definition = CONSENT_PURPOSES.find((entry) => entry.purpose === change.purpose);
  const label = definition ? definition.label : change.purpose;
  return `${label} por ${channelLabels[change.channel]}: ${change.granted ? "ligado" : "desligado"}`;
}

function formatDecisionDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export interface ConsentMatrixProps {
  consents: readonly ConsentRecord[];
  /** Somente leitura enquanto a API não expõe a mutação. */
  disabled?: boolean;
  saving?: boolean;
  onSave?: (changes: readonly ConsentChange[]) => void;
}

/**
 * Matriz finalidade × canal. O componente mantém apenas o rascunho local;
 * a verdade é sempre o conjunto de registros vindo da API. Depois de um save
 * confirmado, o container remonta a matriz para descartar o rascunho.
 */
export function ConsentMatrix({ consents, disabled = false, saving = false, onSave }: ConsentMatrixProps) {
  const baseline = useMemo(() => optionalConsentState(consents), [consents]);
  const [draft, setDraft] = useState<Record<string, boolean | undefined>>(() => optionalConsentState(consents));

  const pending = useMemo<ConsentChange[]>(() => {
    const changes: ConsentChange[] = [];
    for (const definition of CONSENT_PURPOSES) {
      for (const channel of CONSENT_CHANNELS) {
        const key = cellKey(definition.purpose, channel);
        const next = draft[key] === true;
        if (next !== baseline[key]) {
          changes.push({ purpose: definition.purpose, channel, granted: next });
        }
      }
    }
    return changes;
  }, [baseline, draft]);

  function toggle(key: string, value: boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function turnOffEveryOptional() {
    setDraft(() => {
      const cleared: Record<string, boolean> = {};
      for (const definition of CONSENT_PURPOSES) {
        for (const channel of CONSENT_CHANNELS) {
          cleared[cellKey(definition.purpose, channel)] = false;
        }
      }
      return cleared;
    });
  }

  return (
    <div className={styles.matrixStack}>
      <div className={styles.protectiveBar}>
        <Button
          variant="primary"
          disabled={disabled}
          iconBefore={<ShieldCheck aria-hidden="true" size={18} />}
          onClick={turnOffEveryOptional}
        >
          Desligar todos os lembretes
        </Button>
        <p className={styles.protectiveCopy}>
          Prepara a revogação de todas as autorizações desta matriz. Revogar andamento do pedido pode
          impedir avisos transacionais naquele canal; o histórico continua disponível na conta.
        </p>
      </div>

      <div className={styles.matrix}>
        {CONSENT_PURPOSES.map((definition) => {
          const descriptionId = `consent-${definition.purpose}-desc`;
          return (
            <fieldset className={styles.row} key={definition.purpose}>
              <legend className={styles.rowLegend}>
                <span>{definition.label}</span>
                {definition.transactional ? <StatusBadge tone="info">Transacional</StatusBadge> : null}
              </legend>
              <p className={styles.rowPromise} id={descriptionId}>{definition.promise}</p>
              <p className={styles.rowReason}>{definition.detail}</p>
              <div className={styles.rowCells}>
                {CONSENT_CHANNELS.map((channel) => {
                  const channelLabel = channelLabels[channel];
                  const key = cellKey(definition.purpose, channel);
                  const on = draft[key] === true;
                  const record = findRecord(consents, definition.purpose, channel);
                  const decidedAt = formatDecisionDate(record?.decidedAt);
                  const inputId = `consent-${definition.purpose}-${channel}`;
                  const stateLabel = record?.state === "REVOKED"
                    ? "Revogado"
                    : record?.state === "GRANTED"
                      ? "Autorizado"
                      : "Sem decisão registrada";
                  return (
                    <label className={styles.cell} data-state={on ? "on" : "off"} htmlFor={inputId} key={channel}>
                      <input
                        className={styles.cellInput}
                        id={inputId}
                        type="checkbox"
                        checked={on}
                        disabled={disabled}
                        aria-label={`${definition.label} por ${channelLabel}`}
                        aria-describedby={descriptionId}
                        onChange={(event) => { toggle(key, event.target.checked); }}
                      />
                      <span className={styles.cellChannel}>{channelLabel}</span>
                      <span className={styles.cellState}>{on ? "Ligado" : "Desligado"}</span>
                      <span className={styles.cellMeta}>
                        {decidedAt
                          ? `${stateLabel} em ${decidedAt}`
                          : stateLabel}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className={styles.saveBar}>
        <div className={styles.pendingBlock} aria-live="polite">
          {pending.length === 0 ? (
            <p className={styles.pendingText}>Nenhuma alteração pendente.</p>
          ) : (
            <>
              <p className={styles.pendingText}>
                {pending.length === 1
                  ? "1 alteração ainda não salva:"
                  : `${String(pending.length)} alterações ainda não salvas:`}
              </p>
              <ul className={styles.pendingList}>
                {pending.map((change) => (
                  <li key={cellKey(change.purpose, change.channel)}>{describeChange(change)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <Button
          variant="primary"
          loading={saving}
          loadingLabel="Salvando"
          disabled={disabled || pending.length === 0}
          onClick={() => { onSave?.(pending); }}
        >
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

type SaveResult =
  | { kind: "success"; summary: readonly string[] }
  | {
      kind: "error";
      message: string;
      saved: readonly string[];
      failed: readonly string[];
      reference?: string;
    };

function ConsentPolicyNote({ mode }: { mode: "read-only" | "live" }) {
  return (
    <Panel className={styles.contractNote} as="aside">
      <div className={styles.contractIcon} aria-hidden="true"><ShieldCheck size={20} /></div>
      <div>
        <strong>Consentimento verificável e reversível</strong>
        <p>
          {mode === "read-only"
            ? "Não foi possível confirmar suas escolhas agora. Nenhum canal aparece autorizado sem a resposta da API, e os controles ficam bloqueados para evitar uma alteração enganosa."
            : "Cada escolha é registrada por finalidade e canal, com data e versão da política. Uma autorização revogada só volta a funcionar depois de uma nova ação explícita sua."}
        </p>
      </div>
    </Panel>
  );
}

interface ConsentMutationBody extends ConsentChange {
  reoptIn?: true;
}

/** Inclui a porta de reopt-in somente ao religar um registro revogado. */
export function buildConsentMutationBody(
  change: ConsentChange,
  current: ConsentRecord | undefined,
): ConsentMutationBody {
  return {
    ...change,
    ...(change.granted && current?.state === "REVOKED" ? { reoptIn: true as const } : {}),
  };
}

export function PreferencesView() {
  const resource = useApiResource<CommunicationPreferences>(PREFERENCES_ENDPOINT);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [revision, setRevision] = useState(0);

  const preferences = resource.status === "ready" ? resource.data : null;
  const consents = preferences?.data ?? [];

  async function save(changes: readonly ConsentChange[]) {
    if (changes.length === 0) return;
    setSaving(true);
    setResult(null);
    const saved: string[] = [];
    const failed: string[] = [];
    let firstError: unknown;

    for (const change of changes) {
      const current = findRecord(consents, change.purpose, change.channel);
      try {
        await apiRequest<ConsentRecord>(PREFERENCES_ENDPOINT, {
          method: "PUT",
          body: JSON.stringify(buildConsentMutationBody(change, current)),
        });
        saved.push(describeChange(change));
      } catch (error: unknown) {
        firstError ??= error;
        failed.push(describeChange(change));
      }
    }

    if (failed.length === 0) {
      setResult({ kind: "success", summary: saved });
      setRevision((value) => value + 1);
      resource.retry();
    } else {
      const reference = isApiError(firstError) ? firstError.problem.correlationId : undefined;
      setResult({
        kind: "error",
        message: firstError instanceof Error
          ? firstError.message
          : "A API não confirmou todas as alterações.",
        saved,
        failed,
        ...(reference ? { reference } : {}),
      });
      if (saved.length > 0) {
        setRevision((value) => value + 1);
        resource.retry();
      }
    }
    setSaving(false);
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="CONTA · COMUNICAÇÃO"
        title="Preferências de comunicação"
        description="Você decide o que a plataforma pode enviar, por finalidade e por canal. Nada opcional fica ligado sem um registro de consentimento seu."
        meta={<span><ShieldCheck aria-hidden="true" size={15} /> Default protetivo: desligado</span>}
        action={<Link className="text-link" href="/conta/notificacoes">Ver notificações recebidas</Link>}
      />

      {resource.status === "loading" || resource.status === "idle" ? (
        <ResourceLoading label="Carregando preferências de comunicação" />
      ) : (
        <>
          {preferences ? (
            <>
              <DataProvenance
                source={`GET ${PREFERENCES_ENDPOINT}`}
                scope="Consentimentos de lembrete desta conta"
                asOf={preferences.asOf}
              />
              <ConsentPolicyNote mode="live" />
            </>
          ) : (
            <>
              {resource.status === "error"
                ? <ResourceError error={resource.error} retry={resource.retry} />
                : null}
              <ConsentPolicyNote mode="read-only" />
            </>
          )}

          {result ? (
            <div
              className={`${styles.resultAlert} ${result.kind === "error" ? styles.resultAlertError : ""}`.trim()}
              role={result.kind === "error" ? "alert" : "status"}
            >
              {result.kind === "success" ? (
                <>
                  <strong>
                    {result.summary.length === 1
                      ? "1 alteração salva"
                      : `${String(result.summary.length)} alterações salvas`}
                  </strong>
                  <ul>{result.summary.map((line) => <li key={line}>{line}</li>)}</ul>
                </>
              ) : (
                <>
                  <strong>{result.saved.length > 0 ? "Algumas alterações foram salvas" : "Nada foi salvo"}</strong>
                  <p>{result.message}</p>
                  {result.saved.length > 0 ? <p>Confirmadas: {result.saved.join("; ")}.</p> : null}
                  <p>Não confirmadas: {result.failed.join("; ")}. Revise e tente novamente.</p>
                  {result.reference ? <code>Referência: {result.reference}</code> : null}
                </>
              )}
            </div>
          ) : null}

          <ConsentMatrix
            key={revision}
            consents={consents}
            disabled={preferences === null}
            saving={saving}
            onSave={(changes) => { void save(changes); }}
          />

          <Panel className={styles.sidePanel} as="aside">
            <div className={styles.sidePanelHead}>
              <BellRing aria-hidden="true" size={18} />
              <h2>Personalização, cookies e dados</h2>
            </div>
            <p>
              Esta tela controla somente lembretes de carrinho, preço, estoque e pedido. Desligar um lembrete não
              apaga o seu histórico de compras nem altera cookies ou recomendações.
            </p>
            <p>
              Cookies, personalização e direitos sobre dados são controles separados para que uma escolha não
              seja usada como autorização para outra finalidade.
            </p>
            <Link className="text-link" href="/conta/privacidade">Exercer direitos sobre os seus dados</Link>
          </Panel>
        </>
      )}
    </div>
  );
}
