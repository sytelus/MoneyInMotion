using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;

namespace MoneyAI.ParentChildMatchers
{
    public class AmazonOrderMatcher : IParentChildMatch
    {
        AccountInfo accountInfo;
        public AmazonOrderMatcher(AccountInfo accountInfo)
        {
            this.accountInfo = accountInfo;
        }

        public IEnumerable<KeyValuePair<Transaction, Transaction>> GetParents(IEnumerable<Transaction> children, Transactions availableTransactions)
        {
            var lineitemParents = availableTransactions.Where(tx => tx.AccountId == this.accountInfo.Id && tx.LineItemType == LineItemType.None)
                .GroupBy(tx => tx.InstituteReference).ToDictionary(g => g.Key, g => g.ToArray());

            var nonLineitemParents = availableTransactions
                .Where(tx => tx.AccountId != this.accountInfo.Id 
                    && tx.EntityName.IndexOf("amazon", StringComparison.CurrentCultureIgnoreCase) >= 0)
                .GroupBy(tx => GetNonLineItemKey(tx)).ToDictionary(g => g.Key, g => g.ToArray());

            foreach(var child in children)
            {
                //If child is line item
                if (child.LineItemType != LineItemType.None)
                {
                    var parents = lineitemParents.GetValueOrDefault(child.InstituteReference);

                    if (parents != null && parents.Length == 1)
                        yield return new KeyValuePair<Transaction, Transaction>(child, parents[0]);
                    else if (parents != null && parents.Length > 0)
                        throw new Exception("{0} parents for Child ID {1} where found in AccountID {2}".FormatEx(parents.Length, child.Id, child.AccountId));
                }
                else
                {
                    var parents = nonLineitemParents.GetValueOrDefault(GetNonLineItemKey(child)) ??
                        nonLineitemParents.Values.SelectMany(txArray => 
                            txArray.Where(tx => Math.Abs(tx.Amount - child.Amount) <= 1 
                                && Math.Abs(tx.TransactionDate.Subtract(child.TransactionDate).TotalDays) <= 2
                                && !tx.Children.Any()))
                        //Better amount match takes priority
                        .OrderBy(tx => ((double)(Math.Abs(tx.Amount - child.Amount))) 
                            * (Math.Abs(tx.TransactionDate.Subtract(child.TransactionDate).TotalDays) + 1))
                        .ToArray();

                    if (parents.Length > 0)
                        yield return new KeyValuePair<Transaction, Transaction>(child, parents[0]);
                }
            }
        }

        private static string GetNonLineItemKey(Transaction tx)
        {
            return string.Concat(tx.Amount.ToCurrencyString(), "|", tx.TransactionDate.ToShortDateString());
        }

        private static bool IsMissingAmountTolerable(Transaction parent, decimal missingChildAmount)
        {
            return GenericTxParentChildMatcher.IsMissingAmountTolerable(parent, missingChildAmount);
        }

        const string ImportInfoId = "CreatedBy.AmazonOrderMatcher";
        public bool HandleIncompleteParent(Transaction parent, Transactions availableTransactions, decimal missingChildAmount)
        {
            if (missingChildAmount == 0)
                return true;

            var promotionsAmount = Utils.ParseDecimal(parent.ProviderAttributes[@"total promotions"]);
            var shippingAmount = Utils.ParseDecimal(parent.ProviderAttributes[@"shipping charge"]);
            var taxAmount = Utils.ParseDecimal(parent.ProviderAttributes[@"tax charged"]);
            var updatedMissingChildAmount = missingChildAmount - (promotionsAmount + shippingAmount + taxAmount);

            if (IsMissingAmountTolerable(parent, updatedMissingChildAmount))
            {
                AddAdjustmentChild(parent, availableTransactions, promotionsAmount, TransactionReason.DiscountRecieved, "Promotion");
                AddAdjustmentChild(parent, availableTransactions, shippingAmount, TransactionReason.Purchase, "Shipping");
                AddAdjustmentChild(parent, availableTransactions, taxAmount, TransactionReason.Purchase, "Tax");

                var finalMissingAmount = -1M * updatedMissingChildAmount;
                AddAdjustmentChild(parent, availableTransactions, finalMissingAmount,
                    finalMissingAmount >= 0 ? TransactionReason.MatchAdjustmentCredit: TransactionReason.MatchAdjustmentDebit, 
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
                var tx = new Transaction(matcherImportInfo.Id, accountInfo,
                    null, new Transaction.ImportedValues()
                    {
                        Amount = amount,
                        EntityName = "{0} - {1}".FormatEx(adjustmentTag, parent.EntityName),
                        EntityNameNormalized = "{0} - {1}".FormatEx(adjustmentTag, parent.EntityName),
                        InstituteReference = "{0}.{1}".FormatEx(adjustmentTag, parent.InstituteReference),
                        RequiresParent = true,
                        SubAccountName = parent.SubAccountName,
                        TransactionDate = parent.TransactionDate,
                        TransactionReason = transactionReason
                    });
                availableTransactions.AddNew(tx, accountInfo, matcherImportInfo, false);

                availableTransactions.RelateParentChild(parent.Id, tx.Id);
            }
        }
    }
}
