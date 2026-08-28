/**
 * Etsy order-history parent-child matcher.
 *
 * Ported from C# `EtsyOrderMatcher`. A thin subclass of
 * {@link GenericOrderMatcher} that supplies Etsy-specific
 * provider attribute names for shipping, tax, and discount.
 *
 * @module
 */

import type { AccountInfo } from '../models/account-info.js';
import { GenericOrderMatcher } from './generic-order-matcher.js';

export class EtsyOrderMatcher extends GenericOrderMatcher {
    constructor(accountInfo: AccountInfo) {
        super(accountInfo, 'total_shipping_cost', 'total_tax_cost', 'discount_amt');
    }
}
