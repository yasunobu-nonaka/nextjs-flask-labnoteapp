"use client";

import { createContext, useContext } from "react";

type AdminContextValue = {
  isAdmin: boolean;
};

export const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
});

export function useAdmin() {
  return useContext(AdminContext);
}
