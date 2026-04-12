/**
 * Aggregation module barrel exports.
 *
 * @module
 */

export {
    getReasonTitle,
    getReasonPluralTitle,
    getReasonCategory,
    formatReasonBreakdown,
} from './transaction-reason-utils.js';

export { KeyCounter } from './key-counter.js';

export { TransactionAggregates } from './transaction-aggregates.js';

export {
    TransactionAggregator,
    type AggregatorOptions,
} from './transaction-aggregator.js';

export {
    NetAggregator,
    type NetAggregatorOptions,
} from './net-aggregator.js';
