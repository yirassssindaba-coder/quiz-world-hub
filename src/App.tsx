import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TranslateProvider } from "@/contexts/TranslateContext";
import { MediaPlayerProvider } from "@/contexts/MediaPlayerContext";
import { ExperienceProvider } from "@/contexts/ExperienceContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Layout from "@/components/layout/Layout";
import PageTransition from "@/components/motion/PageTransition";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Quiz from "./pages/Quiz";
import QuizPlay from "./pages/QuizPlay";
import WorldClock from "./pages/WorldClock";
import News from "./pages/News";
import SavedNews from "./pages/SavedNews";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Translator from "./pages/Translator";
import Media from "./pages/Media";
import NotFound from "./pages/NotFound";

const QuizImporterLazy = lazy(() => import("./pages/QuizImporter"));
const DocumentVaultLazy = lazy(() => import("./pages/DocumentVault"));

function QuizImporter() {
  return (
    <Suspense fallback={<div className="container py-16 text-center text-sm text-muted-foreground">Memuat PDF Importer...</div>}>
      <QuizImporterLazy />
    </Suspense>
  );
}

function DocumentVault() {
  return (
    <Suspense fallback={<div className="container py-16 text-center text-sm text-muted-foreground">Memuat Document Vault...</div>}>
      <DocumentVaultLazy />
    </Suspense>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000 } },
});

function AnimatedRoutes() {
  const location = useLocation();
  const wrap = (el: React.ReactNode) => <PageTransition>{el}</PageTransition>;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={wrap(<Index />)} />
        <Route path="/auth" element={wrap(<Auth />)} />
        <Route path="/quiz" element={<ErrorBoundary>{wrap(<Quiz />)}</ErrorBoundary>} />
        <Route path="/quiz/:slug" element={<ErrorBoundary>{wrap(<QuizPlay />)}</ErrorBoundary>} />
        <Route path="/world-clock" element={<ErrorBoundary>{wrap(<WorldClock />)}</ErrorBoundary>} />
        <Route path="/news" element={<ErrorBoundary>{wrap(<News />)}</ErrorBoundary>} />
        <Route path="/news/saved" element={<ErrorBoundary>{wrap(<SavedNews />)}</ErrorBoundary>} />
        <Route path="/dashboard" element={<ErrorBoundary>{wrap(<Dashboard />)}</ErrorBoundary>} />
        <Route path="/profile" element={<ErrorBoundary>{wrap(<Profile />)}</ErrorBoundary>} />
        <Route path="/admin" element={<ErrorBoundary>{wrap(<Admin />)}</ErrorBoundary>} />
        <Route path="/translator" element={<ErrorBoundary>{wrap(<Translator />)}</ErrorBoundary>} />
        <Route path="/media" element={<ErrorBoundary>{wrap(<Media />)}</ErrorBoundary>} />
        <Route path="/quiz-importer" element={<ErrorBoundary>{wrap(<QuizImporter />)}</ErrorBoundary>} />
        <Route path="/documents" element={<ErrorBoundary>{wrap(<DocumentVault />)}</ErrorBoundary>} />
        <Route path="*" element={wrap(<NotFound />)} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TranslateProvider>
          <ExperienceProvider>
            <MediaPlayerProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <ErrorBoundary>
                    <Layout>
                      <AnimatedRoutes />
                    </Layout>
                  </ErrorBoundary>
                </BrowserRouter>
              </TooltipProvider>
            </MediaPlayerProvider>
          </ExperienceProvider>
        </TranslateProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
