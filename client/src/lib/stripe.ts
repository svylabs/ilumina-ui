import { apiRequest } from "./queryClient";

export async function createCheckoutSession(submissionId: number) {
  const res = await apiRequest("POST", `/api/checkout/${submissionId}`);
  const { url } = await res.json();
  window.location.href = url;
}
