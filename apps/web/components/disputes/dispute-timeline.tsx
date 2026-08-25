import { CircleDot, Lock } from "lucide-react";
import {
  disputeEventActorLabels,
  disputePhaseIndex,
  disputePhaseLabels,
  disputePhaseSummaries,
  disputePhases,
  formatDisputeInstant,
  type DisputeEvent,
  type DisputePhase,
} from "./dispute-state";
import styles from "./disputes.module.css";

type TrackStepState = "CONCLUIDA" | "ATUAL" | "FUTURA" | "PREVISTA";

const trackStepLabels: Record<TrackStepState, string> = {
  CONCLUIDA: "Etapa concluída",
  ATUAL: "Etapa atual",
  FUTURA: "Etapa ainda não alcançada",
  PREVISTA: "Etapa prevista pelo processo",
};

function stepState(phase: DisputePhase, current: DisputePhase | null): TrackStepState {
  if (!current) return "PREVISTA";
  const currentIndex = disputePhaseIndex(current);
  const index = disputePhaseIndex(phase);
  if (index < currentIndex) return "CONCLUIDA";
  if (index === currentIndex) return "ATUAL";
  return "FUTURA";
}

/**
 * Sequência de fases como lista ordenada. Com `current` nulo o componente vira mapa
 * do processo — explicação do rito, sem afirmar em que fase uma disputa concreta está.
 * Estado nunca depende só de cor: cada passo carrega rótulo textual próprio.
 */
export function DisputePhaseTrack({
  current,
  headingId,
}: {
  current: DisputePhase | null;
  headingId: string;
}) {
  return (
    <ol className={styles.track} aria-labelledby={headingId}>
      {disputePhases.map((phase, index) => {
        const state = stepState(phase, current);
        return (
          <li
            key={phase}
            className={styles.trackStep}
            data-state={state}
            aria-current={state === "ATUAL" ? "step" : undefined}
          >
            <span className={styles.trackMarker} aria-hidden="true">{index + 1}</span>
            <div className={styles.trackBody}>
              <strong>{disputePhaseLabels[phase]}</strong>
              <span className={styles.trackState}>{trackStepLabels[state]}</span>
              <p>{disputePhaseSummaries[phase]}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Histórico de eventos já ocorridos, na ordem em que o servidor os entregou.
 * O texto de cada evento chega escopado pela API: nenhum nome, contato ou conteúdo
 * de evidência restrita é montado no cliente.
 */
export function DisputeTimeline({
  events,
  headingId,
}: {
  events: readonly DisputeEvent[];
  headingId: string;
}) {
  if (events.length === 0) {
    return (
      <p className={styles.emptyNote}>
        <Lock aria-hidden="true" size={15} />
        Nenhum evento foi entregue pela fonte canônica. A tela não preenche histórico por conta própria.
      </p>
    );
  }

  return (
    <ol className={styles.timeline} aria-labelledby={headingId}>
      {events.map((event) => (
        <li key={event.eventId} className={styles.timelineItem}>
          <span className={styles.timelineMarker} aria-hidden="true">
            <CircleDot size={14} />
          </span>
          <div className={styles.timelineBody}>
            <div className={styles.timelineMeta}>
              <span className={styles.timelineActor}>{disputeEventActorLabels[event.actor]}</span>
              <span className={styles.timelinePhase}>{disputePhaseLabels[event.phase]}</span>
              <time dateTime={event.at}>{formatDisputeInstant(event.at)}</time>
            </div>
            <p>{event.summary}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
