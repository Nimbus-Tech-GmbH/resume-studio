import { useQuery } from '@tanstack/react-query';
import { GET_RESUME, LIST_RESUMES } from '@resume-studio/graphql-client';
import type { CmsResume } from '@resume-studio/transformer';
import { gqlClient } from './client.js';

interface ListResumesResponse {
  resumes: Array<{
    id: string;
    title?: string;
    updatedAt?: string;
    language?: { id: string; label?: string; value?: string } | null;
    basicInformation?: { id: string; name?: string; label?: string };
  }>;
}

interface GetResumeResponse {
  resume: CmsResume | null;
}

export function useResumeList() {
  return useQuery({
    queryKey: ['resumes'],
    retry: false,
    queryFn: async () => {
      const res = await gqlClient.request<ListResumesResponse>(LIST_RESUMES);
      return res.resumes;
    },
  });
}

export function useResume(id: string | null) {
  return useQuery({
    queryKey: ['resume', id],
    enabled: Boolean(id),
    retry: false,
    queryFn: async () => {
      if (!id) return null;
      const res = await gqlClient.request<GetResumeResponse>(GET_RESUME, { id });
      return res.resume;
    },
  });
}
