import { useRef, useState, type DragEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiRequest, getAccessToken } from "../lib/api";
import type { Receipt, ReceiptStatus } from "../types/receipt";
import { Button, Card, ErrorState, LoadingState } from "../components/ui";

type ReceiptList = { items: Receipt[]; page: number; pageSize: number; total: number };

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";
const pendingStatuses: ReceiptStatus[] = ["UPLOADED", "PROCESSING"];

export const getReceiptRefetchInterval = (items: Receipt[] | undefined) =>
  items?.some((item) => pendingStatuses.includes(item.status)) ? 3000 : false;

export function ReceiptsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");
  const [progress, setProgress] = useState(0);

  const query = useQuery({
    queryKey: ["receipts", page],
    placeholderData: keepPreviousData,
    queryFn: () => apiRequest<ReceiptList>(`/receipts?page=${page}&pageSize=20`),
    refetchInterval: (result) => getReceiptRefetchInterval(result.state.data?.items),
  });

  const mutation = useMutation({
    mutationFn: (upload: File) => new Promise<{ id: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${baseUrl}/receipts`);
      xhr.withCredentials = true;
      const token = getAccessToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText) as { id: string });
        else reject(new Error("Upload failed"));
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      const form = new FormData();
      form.append("file", upload);
      xhr.send(form);
    }),
    onSuccess: async ({ id }) => {
      setFile(null); setPreview(""); setProgress(0);
      await queryClient.invalidateQueries({ queryKey: ["receipts"] });
      navigate(`/receipts/${id}`);
    },
  });

  const selectFile = (selected: File | undefined) => {
    setFileError("");
    if (!selected) return;
    if (!["image/jpeg", "image/png"].includes(selected.type)) { setFileError("Only JPG and PNG files are supported."); return; }
    if (selected.size > 10 * 1024 * 1024) { setFileError("File must be 10 MB or smaller."); return; }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); };

  const data = query.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h1 className="mb-3 text-lg font-semibold">Upload receipt</h1>
        <div onDragOver={(e) => e.preventDefault()} onDrop={drop} onClick={() => inputRef.current?.click()} className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => selectFile(e.target.files?.[0])} />
          {preview ? <img src={preview} alt="Receipt preview" className="mx-auto max-h-64 max-w-full rounded object-contain" /> : "Drag a JPG or PNG here, or click to choose"}
        </div>
        {fileError && <div className="mt-3"><ErrorState message={fileError} /></div>}
        {progress > 0 && <div className="mt-3 h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-slate-900" style={{ width: `${progress}%` }} /></div>}
        {mutation.isError && <div className="mt-3"><ErrorState message={mutation.error instanceof Error ? mutation.error.message : "Upload failed"} /></div>}
        {file && <Button className="mt-3 w-full sm:w-auto" disabled={mutation.isPending} onClick={() => mutation.mutate(file)}>{mutation.isPending ? `Uploading ${progress}%` : "Upload"}</Button>}
      </Card>

      <div>
        <h1 className="mb-3 text-xl font-semibold">Receipts</h1>
        {query.isPending && <LoadingState />}
        {query.isError && <ErrorState message={query.error instanceof Error ? query.error.message : "Could not load receipts"} />}
        {data && data.items.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">No receipts yet.</Card>}
        {data && data.items.length > 0 && (
          <div className="grid gap-3">
            {data.items.map((receipt) => (
              <button key={receipt.id} onClick={() => navigate(`/receipts/${receipt.id}`)} className="text-left">
                <Card className="flex items-center justify-between p-4 hover:border-slate-400">
                  <div><div className="font-medium">{receipt.merchantName ?? "Processing receipt"}</div><div className="text-sm text-slate-500">{receipt.purchaseDate ? new Date(receipt.purchaseDate).toLocaleDateString() : new Date(receipt.createdAt).toLocaleDateString()}</div></div>
                  <StatusBadge status={receipt.status} />
                </Card>
              </button>
            ))}
          </div>
        )}
        {data && pageCount > 1 && <div className="mt-4 flex items-center justify-between"><Button disabled={page === 1} onClick={() => setPage((v) => v - 1)}>Previous</Button><span className="text-sm">Page {page} of {pageCount}</span><Button disabled={page >= pageCount} onClick={() => setPage((v) => v + 1)}>Next</Button></div>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReceiptStatus }) {
  const colors: Record<ReceiptStatus, string> = { UPLOADED: "bg-blue-100 text-blue-800", PROCESSING: "bg-amber-100 text-amber-800", NEEDS_REVIEW: "bg-purple-100 text-purple-800", CONFIRMED: "bg-green-100 text-green-800", FAILED: "bg-red-100 text-red-800" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors[status]}`}>{status.replace("_", " ")}</span>;
}
