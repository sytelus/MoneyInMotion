/**
 * Barclay Bank statement parser, ported from C# BarclayParser.
 *
 * Barclay CSV files have banner lines before the actual header row,
 * so hasBannerLines is set to true.
 *
 * @module
 */

import { GenericStatementParser } from './generic-statement-parser.js';
import { ContentType } from '../file-format/index.js';

export class BarclayParser extends GenericStatementParser {
    constructor(content: string) {
        super(content, ContentType.Csv, [ContentType.Csv], { hasBannerLines: true });
    }
}
