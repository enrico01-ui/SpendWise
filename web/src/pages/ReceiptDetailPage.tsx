import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiRequest, getAccessToken } from "../lib/api";
import type { Receipt } from "../types/receipt";
import { Card, ErrorState, LoadingState } from "../components/ui";

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";

export function ReceiptDetailPage() {
  const { id } = useParams();
  const [imageUrl, setImageUrl] = useState("");
  const query = useQuery({
    queryKey: ["receipt", id],
    enabled: Boolean(id),
    queryFn: () => apiRequest<Receipt>(`/receipts/${id}`),
  });

  useEffect(() => {
    if (!id) return;
    let active = true;
    const controller = new AbortController();
    void fetch(`${baseUrl}/receipts/${id}/image`, {
      credentials: "include",
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.blob() : Promise.reject(new Error("Could not load receipt image")))
      .then((blob) => {
        if (!active) return;
        setImageUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      controller.abort();
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [id]);

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={query.error instanceof Error ? query.error.message : "Could not load receipt"} />;
  const receipt = query.data;
  return (
    <div>
      <Link to="/receipts" className="mb-4 inline-block text-sm text-slate-600 underline">Back to receipts</Link>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="min-h-96 p-3">
          {imageUrl ? <img src={imageUrl} alt="Uploaded receipt" className="max-h-[70vh] w-full rounded object-contain" /> : <LoadingState label="Loading image..." />}
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h1 className="text-lg font-semibold">Receipt details</h1><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{receipt.status}</span></div>
          {receipt.rawText ? <pre className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-4 text-sm">{receipt.rawText}</pre> : <p className="text-sm text-slate-500">No raw text available yet.</p>}
        </Card>
      </div>
    </div>
  );
}
