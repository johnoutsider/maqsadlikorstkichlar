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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Public+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <SupabaseAuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
