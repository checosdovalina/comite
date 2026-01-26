import { useQuery } from "@tanstack/react-query";
import type { CounselorTeam } from "@shared/schema";

interface SubdomainInfo {
  subdomain: string | null;
  team: {
    id: string;
    name: string;
    committeeId: string;
  } | null;
  error?: string;
}

export function useSubdomain() {
  const { data, isLoading, error } = useQuery<SubdomainInfo>({
    queryKey: ["/api/subdomain-info"],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  return {
    subdomain: data?.subdomain || null,
    team: data?.team || null,
    isSubdomainAccess: !!data?.subdomain && !!data?.team,
    isLoading,
    error: data?.error || null,
  };
}
