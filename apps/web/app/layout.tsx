import type { Metadata, Viewport } from "next";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/big-shoulders-display/700";
import "@fontsource/big-shoulders-display/800";
import "@fontsource/ibm-plex-mono/400";
import "@fontsource/ibm-plex-mono/600";
import "@midas/ui/styles.css";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.name}`,
  },
  description: "Marketplace digital com estados operacionais, origem e próxima ação visíveis.",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#080908",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo-principal">Ir para o conteúdo principal</a>
        <div id="global-live-region" className="ui-visually-hidden" aria-live="polite" aria-atomic="true" />
        {children}
      </body>
    </html>
  );
}
