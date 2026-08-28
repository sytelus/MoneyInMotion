/**
 * Amazon order-history parent-child matcher.
 *
 * Ported from C# `AmazonOrderMatcher`. A thin subclass of
 * {@link GenericOrderMatcher} that supplies Amazon-specific
 * provider attribute names for shipping, tax, and discount.
 *
 * @module
 */

import type { AccountInfo } from '../models/account-info.js';
import { GenericOrderMatcher } from './generic-order-matcher.js';

export class AmazonOrderMatcher extends GenericOrderMatcher {
    constructor(accountInfo: AccountInfo) {
        super(accountInfo, 'shipping charge', 'tax charged', 'total promotions');
    }
}
