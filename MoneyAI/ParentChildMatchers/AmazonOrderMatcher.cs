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
            //Cache for lineitem parents
            var lineitemParents = availableTransactions.Where(tx => tx.AccountId == this.accountInfo.Id && !Utils.ParseBool(tx.ProviderAttributes["$IsLineItem"], null))
                .GroupBy(tx => tx.InstituteReference).ToDictionary(g => g.Key, g => g.ToArray());

            var nonLineitemParents = availableTransactions
                .Where(tx => tx.AccountId != this.accountInfo.Id 
                    && tx.EntityName.IndexOf("amazon", StringComparison.CurrentCultureIgnoreCase) >= 0)
                .GroupBy(tx => GetNonLineItemKey(tx)).ToDictionary(g => g.Key, g => g.ToArray());

            foreach(var child in children)
            {
                //If child is line item
                if (Utils.ParseBool(child.ProviderAttributes["$IsLineItem"], null))
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
                                && tx.TransactionDate.Subtract(child.TransactionDate).TotalDays <= 2))
                        .OrderBy(tx => ((double)(Math.Abs(tx.Amount - child.Amount) + 1)) * (tx.TransactionDate.Subtract(child.TransactionDate).TotalDays + 1))
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
    }
}
