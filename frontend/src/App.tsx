import { Routes, Route } from "react-router";
import { Home } from "./pages/Home";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardOverview } from "./pages/DashboardOverview";
import { Dashboard } from "./pages/Dashboard";
import { BrandWorkspace } from "./pages/BrandWorkspace";
import { GenerationPipeline } from "./pages/GenerationPipeline";
import ToolsPage from "./pages/ToolsPage";
import PipelineConfigPage from "./pages/PipelineConfigPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<AppLayout />}>
        <Route index element={<DashboardOverview />} />
        <Route path="brands" element={<Dashboard />} />
        <Route path="brands/:brandId" element={<BrandWorkspace />} />
        <Route path="brands/:brandId/generate" element={<GenerationPipeline />} />
        <Route path="tools/images" element={<ToolsPage />} />
        <Route path="tools/video" element={<ToolsPage />} />
        <Route path="pipeline" element={<PipelineConfigPage />} />
      </Route>
    </Routes>
  );
}

export default App;
