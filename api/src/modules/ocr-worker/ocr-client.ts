import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { env } from "../../config/env.js";

const fieldSchema = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  confidence: z.number().nullable(),
});

const itemSchema = z.object({
  name: z.string(),
  qty: z.number(),
  lineTotal: z.number().int(),
  confidence: z.number(),
});

const extractResponseSchema = z.object({
  engine: z.string(),
  durationMs: z.number().int(),
  confidence: z.number(),
  rawText: z.string(),
  fields: z.object({
    merchant: fieldSchema,
    date: fieldSchema,
    total: fieldSchema,
    items: z.array(itemSchema),
  }),
  warnings: z.array(z.string()),
});

const phashResponseSchema = z.object({ phash: z.string() });

export type OcrExtractResult = z.infer<typeof extractResponseSchema>;

export interface OcrClient {
  extract(imagePath: string, engine: string): Promise<OcrExtractResult>;
  phash(imagePath: string): Promise<string>;
}

const imagePart = async (imagePath: string): Promise<Blob> => {
  const contents = await readFile(path.resolve(process.cwd(), imagePath));
  const extension = path.extname(imagePath).toLowerCase();
  const type = extension === ".png" ? "image/png" : "image/jpeg";
  return new Blob([contents], { type });
};

const readJson = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    throw new Error(`OCR service returned HTTP ${response.status}`);
  }
  return response.json();
};

export class HttpOcrClient implements OcrClient {
  private readonly baseUrl: string;

  public constructor(baseUrl = env.OCR_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public async extract(
    imagePath: string,
    engine: string,
  ): Promise<OcrExtractResult> {
    const form = new FormData();
    form.append("image", await imagePart(imagePath), path.basename(imagePath));
    form.append("engine", engine);
    form.append("preprocess", "{}");
    const response = await fetch(`${this.baseUrl}/ocr/extract`, {
      method: "POST",
      body: form,
    });
    return extractResponseSchema.parse(await readJson(response));
  }

  public async phash(imagePath: string): Promise<string> {
    const form = new FormData();
    form.append("image", await imagePart(imagePath), path.basename(imagePath));
    const response = await fetch(`${this.baseUrl}/image/phash`, {
      method: "POST",
      body: form,
    });
    return phashResponseSchema.parse(await readJson(response)).phash;
  }
}
