import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import Splash from "@/components/Splash";

export const metadata: Metadata = {
  title: "Panel de Vida",
  description: "Tu día y tu entreno en un solo sitio.",
  applicationName: "Panel de Vida",
  appleWebApp: {
    capable: true,
    title: "Panel",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo-m-64.png",
    apple: "/logo-m-180.png",
  },
  formatDetection: { telephone: false, email: false, address: false },
  // iOS: abrir a pantalla completa, sin la barra de Safari, al lanzarla desde el icono.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#262624",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Splash />
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
