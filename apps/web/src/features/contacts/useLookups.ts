"use client";

import type { CompanyListItem, User } from "@lulu/shared";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";

// Users and companies, for owner and company names and the pickers in the form.
export function useLookups() {
  const { data } = useApi(
    () => Promise.all([api.me(), api.users(), api.companies.list()]),
    [],
  );
  const [me, users, companies] = data ?? [null, null, null];

  const userById = new Map<string, User>((users?.data ?? []).map((u) => [u.id, u]));
  const companyById = new Map<string, CompanyListItem>((companies?.data ?? []).map((c) => [c.id, c]));

  return {
    me,
    users: users?.data ?? [],
    companies: companies?.data ?? [],
    userName: (id: string | null) => (id ? userById.get(id)?.name : undefined),
    companyName: (id: string | null) => (id ? companyById.get(id)?.name : undefined),
  };
}

export type Lookups = ReturnType<typeof useLookups>;
