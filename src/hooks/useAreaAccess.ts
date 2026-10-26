import { useAccessibleWorkspaces } from "@/hooks/useAccessibleWorkspaces";
import type { WorkspaceArea } from "@/lib/appRoutes";

export const useAreaAccess = (area?: WorkspaceArea) => {
  const accessibleWorkspaces = useAccessibleWorkspaces();

  return {
    ...accessibleWorkspaces,
    data: area ? accessibleWorkspaces.areas[area] === true : true,
  };
};
