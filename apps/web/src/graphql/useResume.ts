import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GET_RESUME, LIST_RESUMES, CREATE_RESUME } from '@resume-studio/graphql-client';
import type { CmsResume } from '@resume-studio/transformer';
import { useAuth } from '@/auth/AuthContext';
import { gqlClient } from './client';

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
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['resumes'],
    enabled: isAuthenticated,
    retry: false,
    queryFn: async () => {
      const res = await gqlClient.request<ListResumesResponse>(LIST_RESUMES);
      return res.resumes;
    },
  });
}

export function useResume(id: string | null) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['resume', id],
    enabled: Boolean(id) && isAuthenticated,
    retry: false,
    queryFn: async () => {
      if (!id) return null;
      const res = await gqlClient.request<GetResumeResponse>(GET_RESUME, { id });
      return res.resume;
    },
  });
}

/** Fetch only the live `updatedAt` for a resume — used as a save-time staleness check. */
export async function fetchResumeUpdatedAt(id: string): Promise<string | null> {
  const res = await gqlClient.request<{ resume: { updatedAt?: string | null } | null }>(
    /* GraphQL */ `
      query ResumeUpdatedAt($id: ID!) {
        resume(where: { id: $id }) {
          updatedAt
        }
      }
    `,
    { id },
  );
  return res.resume?.updatedAt ?? null;
}

interface CreateResumeResponse {
  createResume: { id: string };
}

export function useCreateResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title }: { title?: string } = {}) => {
      const res = await gqlClient.request<CreateResumeResponse>(CREATE_RESUME, {
        data: { title: title || 'Untitled Resume' },
      });
      return res.createResume.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    },
  });
}
