import { describe, it, expect } from 'vitest';
import { AccountType } from '@moneyinmotion/core';
import { ContentType } from '../../src/parsers/file-format/index.js';
import {
    getStatementParser,
    AmexParser,
    BarclayParser,
    PayPalParser,
    GenericStatementParser,
} from '../../src/parsers/statement/index.js';

describe('getStatementParser', () => {
    it('accepts human-readable American Express names from the web UI', () => {
        const parser = getStatementParser(
            'American Express',
            AccountType.CreditCard,
            '',
            ContentType.Csv,
        );

        expect(parser).toBeInstanceOf(AmexParser);
    });

    it('accepts canonical Barclay and PayPal names regardless of spacing/case', () => {
        const barclayParser = getStatementParser(
            'Barclay Bank',
            AccountType.CreditCard,
            '',
            ContentType.Csv,
        );
        const payPalParser = getStatementParser(
            'PayPal',
            AccountType.EPayment,
            '',
            ContentType.Csv,
        );

        expect(barclayParser).toBeInstanceOf(BarclayParser);
        expect(payPalParser).toBeInstanceOf(PayPalParser);
    });

    it('falls back to the generic parser for unsupported institutions', () => {
        const parser = getStatementParser(
            'Some Local Credit Union',
            AccountType.BankChecking,
            '',
            ContentType.Csv,
        );

        expect(parser).toBeInstanceOf(GenericStatementParser);
    });
});
