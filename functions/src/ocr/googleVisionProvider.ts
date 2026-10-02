import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import { adminStorage } from '../admin';
import { ExtractedPage } from '../imports/domain';
import { OcrProvider, OcrRequest } from './types';

const gcs = (bucket: string, path: string) => `gs://${bucket}/${path}`;
const textFrom = (response: protos.google.cloud.vision.v1.IAnnotateImageResponse) => response.fullTextAnnotation?.text?.trim() || '';

/** Uses runtime ADC; no credential is accepted from a callable request. */
export class GoogleVisionProvider implements OcrProvider {
  private readonly client = new ImageAnnotatorClient();
  private readonly sourceBucket = adminStorage.bucket();

  async extractImage({ sourceFile }: OcrRequest): Promise<ExtractedPage> {
    const [response] = await this.client.documentTextDetection({ image: { source: { imageUri: gcs(this.sourceBucket.name, sourceFile.storagePath) } } });
    const text = textFrom(response);
    if (!text) throw new Error('EMPTY_OCR_RESULT');
    return { id: sourceFile.id, pageNumber: sourceFile.order + 1, text };
  }

  async extractPdf({ importId, sourceFile }: OcrRequest): Promise<ExtractedPage[]> {
    const outputBucketName = process.env.OCR_OUTPUT_BUCKET || this.sourceBucket.name;
    const prefix = `book-imports/${importId}/ocr-output/${sourceFile.id}/`;
    const [operation] = await this.client.asyncBatchAnnotateFiles({ requests: [{
      inputConfig: { gcsSource: { uri: gcs(this.sourceBucket.name, sourceFile.storagePath) }, mimeType: 'application/pdf' },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      outputConfig: { gcsDestination: { uri: gcs(outputBucketName, prefix) }, batchSize: 1 }
    }] });
    await operation.promise();
    const [files] = await adminStorage.bucket(outputBucketName).getFiles({ prefix });
    const pages: ExtractedPage[] = [];
    for (const file of files.filter(file => file.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
      const [body] = await file.download();
      const parsed = JSON.parse(body.toString()) as { responses?: protos.google.cloud.vision.v1.IAnnotateImageResponse[] };
      for (const response of parsed.responses || []) {
        const text = textFrom(response);
        if (text) pages.push({ id: `${sourceFile.id}-${pages.length + 1}`, pageNumber: pages.length + 1, text });
      }
    }
    if (!pages.length) throw new Error('EMPTY_OCR_RESULT');
    return pages;
  }
}
