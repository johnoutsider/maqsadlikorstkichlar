import type { Metadata } from "next";
import "./globals.css";
import { SupabaseAuthProvider } from "@/contexts/SupabaseAuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: "Ilmiy Ko'rsatkichlar Tizimi — O'zbekiston Jahon Tillari Universiteti",
  description: "Universitet professor-o'qituvchilarining ilmiy ishlar hisobini yuritish tizimi.",
};

const themeScript = `
  let isDark = false;
  try {
    const saved = localStorage.getItem('ikt-theme');
    if (saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      isDark = true;
    }
  } catch (e) {}
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SupabaseAuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
