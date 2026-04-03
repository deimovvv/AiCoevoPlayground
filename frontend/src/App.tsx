import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Routes, Route } from "react-router";
import { Home } from "./pages/Home";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { BrandWorkspace } from "./pages/BrandWorkspace";
import { GenerationPipeline } from "./pages/GenerationPipeline";
import ToolsPage from "./pages/ToolsPage";
import PipelineConfigPage from "./pages/PipelineConfigPage";
import { GeneratePage } from "./pages/GeneratePage";
import { ToolRunPage } from "./pages/ToolRunPage";
import { BrandProvider } from "./lib/BrandContext";
import { Workspace } from "./pages/Workspace";
import { BrandSettings } from "./pages/BrandSettings";
import { ContentPage } from "./pages/ContentPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { AutomationsPage } from "./pages/AutomationsPage";
import { PerformancePage } from "./pages/PerformancePage";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary caught:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: "#ff6b6b", fontFamily: "monospace", fontSize: 14 }}>
          <h2 style={{ color: "#fff", marginBottom: 12 }}>Component Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#1a1a1a", padding: 16, borderRadius: 8 }}>
            {this.state.error.message}{"\n\n"}{this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: "8px 16px", background: "#333", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/dashboard"
        element={
          <BrandProvider>
            <AppLayout />
          </BrandProvider>
        }
      >
        <Route index element={<Workspace />} />
        <Route path="content" element={<ContentPage />} />
        <Route path="brand" element={<BrandSettings />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="performance/organic" element={<PerformancePage tab="organic" />} />
        <Route path="performance/ads" element={<PerformancePage tab="ads" />} />
        <Route path="brands" element={<Dashboard />} />
        <Route path="brands/:brandId" element={<BrandWorkspace />} />
        <Route path="brands/:brandId/generate" element={<GenerationPipeline />} />
        <Route path="generate" element={<GeneratePage />} />
        <Route path="generate/:toolId" element={<ErrorBoundary><ToolRunPage /></ErrorBoundary>} />
        <Route path="tools/images" element={<ToolsPage />} />
        <Route path="tools/video" element={<ToolsPage />} />
        <Route path="pipeline" element={<PipelineConfigPage />} />
      </Route>
    </Routes>
  );
}

export default App;
