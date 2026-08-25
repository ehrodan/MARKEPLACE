import type { Metadata } from "next";
import { DevicesView } from "@/components/security/devices-view";

export const metadata: Metadata = { title: "Dispositivos" };

export default function AccountDevicesPage() {
  return <DevicesView />;
}
