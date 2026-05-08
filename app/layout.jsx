import "./globals.css";
import { Inter, Outfit } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui-next",
});

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-next",
});

export const metadata = {
  title: "Apoiar Brasil | Operacao privada",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${outfit.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
