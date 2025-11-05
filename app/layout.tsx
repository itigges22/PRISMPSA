import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ClientNavigation } from "@/components/client-navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Toaster } from "sonner";
import { ChunkErrorHandler } from "@/components/chunk-error-handler";

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PRISM PSA - Professional Service Automation",
  description: "Professional Service Automation Platform for PRISM Marketing Agency",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
        <html lang="en">
          <body
            className={`${raleway.variable} font-sans antialiased`}
          >
            <ChunkErrorHandler />
            <div className="min-h-screen bg-gray-50">
              <Suspense fallback={
                <nav className="bg-white shadow-sm border-b">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                      <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
                      <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </nav>
              }>
                <ClientNavigation />
              </Suspense>
              <main className="flex-1">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  <Suspense fallback={null}>
                    <Breadcrumb />
                  </Suspense>
                  <div className="mt-4 sm:mt-6">
                    {children}
                  </div>
                </div>
              </main>
              <Toaster />
            </div>
          </body>
        </html>
  );
}
