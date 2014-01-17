using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using CommonUtils;
using System.Diagnostics;

namespace MoneyAI.ParentChildMatchers
{
    public class GenericOrderMatcher : IParentChildMatch
    {
        AccountInfo accountInfo;
        string shippingAttribute, taxAttribute, discountAttribute;
        public GenericOrderMatcher(AccountInfo accountInfo, string shippingAttribute, string taxAttribute, string discountAttribute)
        {
            this.accountInfo = accountInfo;
            this.shippingAttribute = shippingAttribute;
            this.taxAttribute = taxAttribute;
            this.discountAttribute = discountAttribute;
        }

        public IEnumerable<KeyValuePair<Transaction, Transaction>> GetParents(IEnumerable<Transaction> children, Transactions availableTransactions)
        {
            //Find the order parent and create index on match filter
            var lineitemParents = availableTransactions.Where(tx => tx.AccountId == this.accountInfo.Id && tx.LineItemType == LineItemType.None)
                .GroupBy(tx => tx.ParentChildMatchFilter).ToDictionary(g => g.Key, g => g.ToArray());

            //Find regular tx who we will attach order parents, create index on date+amount
            var nonLineitemParents = availableTransactions
                .Where(tx => tx.AccountId != this.accountInfo.Id
                    && this.accountInfo.InterAccountNameTags.Any(nameTag => 
                        tx.EntityName.IndexOf(nameTag, StringComparison.CurrentCultureIgnoreCase) >= 0))
                .GroupBy(tx => GetNonLineItemKey(tx)).ToDictionary(g => g.Key, g => g.ToArray());

            //For each child find its parent
            foreach(var child in children)
            {
                //For line items find parents simply by match filter
                if (child.LineItemType != LineItemType.None)
                {
                    var parents = lineitemParents.GetValueOrDefault(child.ParentChildMatchFilter);

                    if (parents != null && parents.Length == 1)
                        yield return new KeyValuePair<Transaction, Transaction>(child, parents[0]);
                    else if (parents != null && parents.Length > 0)
                        throw new Exception("{0} parents for Child ID {1} where found in AccountID {2}".FormatEx(parents.Length, child.Id, child.AccountId));
                }
                else
                {
                    //For non-line items, find parent by amount+transaction date. Failing that find parent by getting tx whoes amount and date is +/- 1 of child
                    var parents = nonLineitemParents.GetValueOrDefault(GetNonLineItemKey(child)) ??
                        nonLineitemParents.Values.SelectMany(txArray => 
                            txArray.Where(tx => Math.Abs(tx.Amount - child.Amount) <= 1 
                                && Math.Abs(tx.TransactionDate.Subtract(child.TransactionDate).TotalDays) <= 2
                                && !tx.Children.Any()))
                        //zero delta in amount match takes priority
                        .OrderBy(tx => ((double)(Math.Abs(tx.Amount - child.Amount))) 
                            * (Math.Abs(tx.TransactionDate.Subtract(child.TransactionDate).TotalDays) + 1))
                        .ToArray();

                    if (parents.Length > 0)
                        yield return new KeyValuePair<Transaction, Transaction>(child, parents[0]); //Return top parent
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

        const string ImportInfoId = "CreatedBy.GenericOrderMatcher";
        public bool HandleIncompleteParent(Transaction parent, Transactions availableTransactions, decimal missingChildAmount)
        {
            if (missingChildAmount == 0)
                return true;

            var promotionsAmount = Utils.ParseDecimal(parent.ProviderAttributes.GetValueOrDefault(this.discountAttribute, "0"));
            var shippingAmount = Utils.ParseDecimal(parent.ProviderAttributes.GetValueOrDefault(this.shippingAttribute, "0"));
            var taxAmount = Utils.ParseDecimal(parent.ProviderAttributes.GetValueOrDefault(this.taxAttribute, "0"));
            var updatedMissingChildAmount = missingChildAmount - (promotionsAmount + shippingAmount + taxAmount);

            if (IsMissingAmountTolerable(parent, updatedMissingChildAmount))
            {
                AddAdjustmentChild(parent, availableTransactions, promotionsAmount, TransactionReason.DiscountRecieved, "Discount");
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
                matcherImportInfo = new ImportInfo(ImportInfoId, ImportInfoId, null, null, ImportInfoId, null);   //TODO: how can we accomodate manufatured import?
            AccountInfo accountInfo = availableTransactions.GetAccountInfo(parent.AccountId);

            if (amount != 0)
            {
                var tx = new Transaction(matcherImportInfo.Id, accountInfo,
                    new Transaction.ImportedValues()
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
