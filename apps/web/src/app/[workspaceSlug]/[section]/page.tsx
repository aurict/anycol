import { notFound } from "next/navigation";
import { DashboardOverview } from "../../../components/dashboard-overview";
import { ModulePage } from "../../../components/module-page";

const sections = new Set([
  "overview",
  "campaigns",
  "calendar",
  "ads",
  "seo",
  "analytics",
  "reports",
  "inbox",
  "automations",
  "integrations",
  "settings",
]);

export default async function SectionPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; section: string }>;
}) {
  const { workspaceSlug, section } = await params;
  if (!sections.has(section)) notFound();
  return section === "overview" ? (
    <DashboardOverview workspaceSlug={workspaceSlug} />
  ) : (
    <ModulePage section={section} workspaceSlug={workspaceSlug} />
  );
}
