using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.ParentChildMatchers
{
    public class GenericTxParentChildMatcher : IParentChildMatch
    {
        public IEnumerable<KeyValuePair<Transaction, Transaction>> GetParents(IEnumerable<Transaction> children, Transactions availableTransactions)
        {
            throw new NotSupportedException("GenericTxParentChildMatcher does not support parent search");
        }

        public static bool IsMissingAmountTolerable(Transaction parent, decimal missingChildAmount)
        {
            return Math.Abs(missingChildAmount) < Math.Round(Math.Abs(parent.Amount) * 0.02M, 2)
                || Math.Abs(missingChildAmount) < 0.5M;
        }

        const string ImportInfoId = "CreatedBy.GenericTxParentChildMatcher";
        public bool HandleIncompleteParent(Transaction parent, Transactions availableTransactions, decimal missingChildAmount)
        {
            if (missingChildAmount == 0)
                return true;

            if (IsMissingAmountTolerable(parent, missingChildAmount))
            {
                var finalMissingAmount = -1M * missingChildAmount;
                AddAdjustmentChild(parent, availableTransactions, finalMissingAmount,
                    finalMissingAmount >= 0 ? TransactionReason.MatchAdjustmentCredit : TransactionReason.MatchAdjustmentDebit, 
                    "Adjustment");

                return true;
            }
            else
                return false;
        }

        private static void AddAdjustmentChild(Transaction parent, Transactions availableTransactions, decimal amount
            , TransactionReason transactionReason, string adjustmentTag)
        {
            ImportInfo matcherImportInfo;

            if (availableTransactions.HasImportInfo(ImportInfoId))
                matcherImportInfo = availableTransactions.GetImportInfo(ImportInfoId);
            else
                matcherImportInfo = new ImportInfo(ImportInfoId, ImportInfoId, null, null, ImportInfoId);   //TODO: how can we accomodate manufatured import?
            AccountInfo accountInfo = availableTransactions.GetAccountInfo(parent.AccountId);

            if (amount != 0)
            {
                var tx = new Transaction(matcherImportInfo.Id, accountInfo, new Transaction.ImportedValues()
                    {
                        Amount = amount,
                        EntityName = "{0} - {1}".FormatEx(adjustmentTag, parent.EntityName),
                        EntityNameNormalized = "{0} - {1}".FormatEx(adjustmentTag, parent.EntityName),
                        InstituteReference = "{0}.{1}".FormatEx(adjustmentTag, parent.InstituteReference),
                        RequiresParent = true,
                        SubAccountName = parent.SubAccountName,
                        TransactionDate = parent.TransactionDate,
                        TransactionReason = transactionReason,
                        LineNumber = null
                    });
                availableTransactions.AddNew(tx, accountInfo, matcherImportInfo, false);

                availableTransactions.RelateParentChild(parent.Id, tx.Id);
            }
        }
    }
}
