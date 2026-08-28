/**
 * Public API for the matching module.
 *
 * @module
 */

export type { ParentChildMatch } from './parent-child-match.js';
export { GenericTxParentChildMatcher, isMissingAmountTolerable, addAdjustmentChild } from './generic-tx-matcher.js';
export { GenericOrderMatcher } from './generic-order-matcher.js';
export { AmazonOrderMatcher } from './amazon-order-matcher.js';
export { EtsyOrderMatcher } from './etsy-order-matcher.js';
