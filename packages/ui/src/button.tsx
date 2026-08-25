import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Escada de ação, medida nos concorrentes de `docs/20`:
 *
 *   primary   — acento sólido, texto escuro. É a compra.
 *   secondary — o MESMO acento a 10%, texto no acento. A ação irmã da compra.
 *   quiet     — superfície neutra. Existe, mas não disputa.
 *   outline / ghost / danger — navegação, ação discreta e destrutiva.
 *
 * A diferença entre `primary` e `secondary` é INTENSIDADE, não matiz: as duas
 * seguem sendo a única cor de ação da superfície. Trocar a matiz faria o olho
 * ler a segunda como "cancelar".
 */
type ButtonVariant = "primary" | "secondary" | "quiet" | "outline" | "ghost" | "danger";
type ButtonSize = "small" | "default" | "large";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  iconBefore?: ReactNode;
  iconAfter?: ReactNode;
}

/**
 * Botão Midas Foundry (doc 18):
 * - primary = accent/gold, única ação de valor por seção (regra 90/10);
 * - ícone nunca substitui rótulo em ação financeira;
 * - alvo de toque >= 44px; foco visível com --color-focus.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className = "",
    variant = "primary",
    size = "default",
    fullWidth = false,
    loading = false,
    loadingLabel = "Processando",
    iconBefore,
    iconAfter,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    size !== "default" && `ui-button--${size}`,
    fullWidth && "ui-button--full",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : iconBefore}
      <span>{loading ? loadingLabel : children}</span>
      {!loading && iconAfter}
    </button>
  );
});