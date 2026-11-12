/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ImageItem {
  id: string;
  url: string;
  name: string;
  type: string;
  width: number;
  height: number;
}

export type PageOrientation = 'portrait' | 'landscape' | 'original';

export interface PDFSettings {
  orientation: PageOrientation;
  compression: number; // 0 to 1
  useOriginalSize: boolean;
}
