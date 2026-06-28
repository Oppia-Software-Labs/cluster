import { useQuery } from "@tanstack/react-query";
import { http } from "./http";

export type Health = {
  status: string;
  message: string;
};

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data } = await http.get<Health>("/health");
      return data;
    },
  });
}
