import { ExtractedPage, ImportSourceFile } from '../imports/domain';

export type OcrRequest = { importId: string; sourceFile: ImportSourceFile };
export interface OcrProvider {
  extractImage(request: OcrRequest): Promise<ExtractedPage>;
  extractPdf(request: OcrRequest): Promise<ExtractedPage[]>;
}
